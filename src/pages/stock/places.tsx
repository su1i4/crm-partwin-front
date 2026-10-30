import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid3x3, MapPin, Printer, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/entities/session';
import { openPdf, stockApi } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { api, errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { num } from '@/shared/lib/format';
import { Button, Card, EmptyState, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';
import { PlaceDialog } from './index';

interface Loc {
  id: string;
  code: string;
  name: string | null;
  kind: 'zone' | 'rack' | 'shelf' | 'cell';
  cell_type: string | null;
  blocked: boolean;
  qty: string;
  products: number;
}

/** Места и ячейки (ТЗ 9.7): уровень 1 — текстовое место, 2 — справочник мест, 3 — адресные ячейки */
export default function PlacesPage() {
  const whs = useWarehouses();
  const can = useCan();
  const qc = useQueryClient();
  const list = physical(whs.data);
  const [wh, setWh] = useState('');
  const [tab, setTab] = useState<'without' | 'places'>('without');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [placeOpen, setPlaceOpen] = useState(false);
  useEffect(() => {
    if (!wh && list[0]) setWh(list[0].id);
  }, [wh, list]);
  const without = useQuery({ queryKey: ['without-place', wh], queryFn: () => stockApi.withoutPlace(wh), enabled: !!wh && tab === 'without' });
  const locs = useQuery({ queryKey: ['locations', wh], queryFn: () => api.get<Loc[]>(`/storage/warehouses/${wh}/locations`).then((r) => r.data), enabled: !!wh && tab === 'places' });
  const fromText = useMutation({
    mutationFn: () => api.post<{ places: number; created: number }>(`/storage/warehouses/${wh}/from-text-places`, {}).then((r) => r.data),
    onSuccess: (r) => (qc.invalidateQueries({ queryKey: ['locations', wh] }), toast.success(`Мест: ${r.places}, новых: ${r.created}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const labels = useMutation({
    mutationFn: () => stockApi.productLabels([...sel].map((productId) => ({ productId, copies: 1, warehouseId: wh }))),
    onSuccess: openPdf,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cellLabels = useMutation({
    mutationFn: () => api.post<Blob>(`/storage/warehouses/${wh}/labels`, {}, { responseType: 'blob' }).then((r) => r.data),
    onSuccess: openPdf,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const items = without.data ?? [];
  const allSel = items.length > 0 && items.every((i) => sel.has(i.id));
  return (
    <div className="space-y-6">
      <PageTitle title="Места и ячейки" sub="Начните с «где лежит» текстом — «Стеллаж 3, полка 2». Ячейки с адресом — когда склад вырастет" />
      <div className="flex flex-wrap items-center gap-2">
        <select value={wh} onChange={(e) => (setWh(e.target.value), setSel(new Set()))} className="h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
          {list.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'without', label: 'Без места' },
            { value: 'places', label: 'Справочник мест' },
          ]}
        />
      </div>

      {tab === 'without' && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-pill px-5 py-3 text-pill-ink">
            <MapPin className="size-5 text-accent" />
            <span className="flex-1 text-sm">
              <b className="text-lg tabular-nums">{num(items.length)}</b> товаров с остатком без места — продавец их не найдёт
            </span>
            {sel.size > 0 && (
              <>
                <Button size="sm" variant="soft" loading={labels.isPending} onClick={() => labels.mutate()}>
                  <Printer /> Этикетки ({sel.size})
                </Button>
                {(can('stock.locations') || can('products.write')) && (
                  <Button size="sm" variant="accent" onClick={() => setPlaceOpen(true)}>
                    Указать место ({sel.size})
                  </Button>
                )}
              </>
            )}
          </div>
          {without.isLoading && <Skeleton className="h-64 rounded-[24px]" />}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
              <label className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-xs text-muted">
                <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(items.map((i) => i.id)))} className="size-4 accent-[var(--accent)]" />
                Выбрать все
              </label>
              {items.map((i) => (
                <label key={i.id} className={cn('flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0', sel.has(i.id) && 'bg-accent-soft')}>
                  <input
                    type="checkbox"
                    checked={sel.has(i.id)}
                    onChange={() =>
                      setSel((s) => {
                        const n = new Set(s);
                        if (n.has(i.id)) n.delete(i.id);
                        else n.add(i.id);
                        return n;
                      })
                    }
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{i.name}</span>
                  <span className="font-mono text-xs text-muted">{i.sku}</span>
                  <span className="w-16 text-right text-[13px] font-semibold tabular-nums">{num(i.qty, 3)}</span>
                </label>
              ))}
            </div>
          )}
          {without.data && !items.length && (
            <Card>
              <EmptyState title="У всех товаров есть место" hint="Отлично — продавец найдёт любую деталь" />
            </Card>
          )}
        </>
      )}

      {tab === 'places' && (
        <>
          <div className="flex flex-wrap gap-2">
            {can('stock.locations') && (
              <Button loading={fromText.isPending} onClick={() => fromText.mutate()}>
                <Wand2 /> Собрать справочник из текстовых мест
              </Button>
            )}
            <Button loading={cellLabels.isPending} onClick={() => cellLabels.mutate()} disabled={!locs.data?.length}>
              <Printer /> Этикетки мест
            </Button>
          </div>
          {locs.isLoading && <Skeleton className="h-48 rounded-[24px]" />}
          {locs.data && (
            <Tray className="p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {locs.data.map((l) => (
                  <div key={l.id} className={cn('rounded-[18px] bg-card p-3', l.blocked && 'opacity-50')}>
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="size-4 text-accent" />
                      <span className="font-mono text-[14px] font-semibold">{l.code}</span>
                      {l.blocked && <Pill tone="warn" className="ml-auto h-5">заблок.</Pill>}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {l.products} товаров · {num(l.qty, 0)} шт
                    </div>
                  </div>
                ))}
              </div>
              {!locs.data.length && <EmptyState title="Справочника мест нет" hint="Склад работает на уровне 1: место — текст в остатках. Соберите справочник из уже указанных мест" />}
            </Tray>
          )}
        </>
      )}
      <PlaceDialog
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        productIds={[...sel]}
        defaultWarehouse={wh}
        onDone={() => (setSel(new Set()), qc.invalidateQueries({ queryKey: ['without-place', wh] }))}
      />
    </div>
  );
}
