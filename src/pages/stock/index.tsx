import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MapPin, Printer, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { useCan, useSession } from '@/entities/session';
import { openPdf, stockApi, useStock } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { errorMessage } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { Button, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Skeleton, Switch } from '@/shared/ui';

const LIMIT = 50;

/** Остатки (ТЗ 7.1): по складам, место, в пути, доступно; сумма — при праве видеть себестоимость */
export default function StockPage() {
  const [sp, setSp] = useSearchParams();
  const can = useCan();
  const storeId = useSession((s) => s.storeId);
  const warehouseId = sp.get('warehouse') ?? undefined;
  const categoryId = sp.get('category') ?? undefined;
  const negative = sp.get('negative') === '1';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounce(q, 300);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [placeOpen, setPlaceOpen] = useState(false);
  const whs = useWarehouses();
  const cats = useCategories();
  const { data, isLoading, error, refetch, isFetching } = useStock({ warehouseId, categoryId, q: dq || undefined, page, limit: LIMIT, ...(storeId ? { storeId } : {}), ...(negative ? { onlyNegative: true, onlyPositive: false } : {}) });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  const whName = (id: string) => whs.data?.find((w) => w.id === id)?.name ?? 'Склад';
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const pageSum = data?.items.reduce((a, r) => a + Number(r.amount ?? 0), 0) ?? 0;
  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const labels = useMutation({
    mutationFn: () => stockApi.productLabels([...sel].map((productId) => ({ productId, copies: 1, ...(warehouseId ? { warehouseId } : {}) }))),
    onSuccess: openPdf,
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Остатки"
        sub={data ? `${num(data.total)} товаров${can('products.view_cost') ? ` · на странице ${money(pageSum)} по себестоимости` : ''}` : ' '}
        actions={<Switch checked={negative} onChange={(v) => set('negative', v ? '1' : undefined)} label="Только в минусе" />}
      />
      {data?.costRecalcPending && <div className="rounded-[20px] bg-warn-soft px-4 py-2.5 text-sm">Идёт пересчёт себестоимости после проведения задним числом — суммы могут измениться.</div>}
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-[220px] flex-1" icon={<Search />} placeholder="Номер, артикул, название" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={warehouseId ?? ''} onChange={(e) => set('warehouse', e.target.value || undefined)} className="h-11 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
          <option value="">Все склады</option>
          {whs.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select value={categoryId ?? ''} onChange={(e) => set('category', e.target.value || undefined)} className="h-11 max-w-56 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
          <option value="">Все группы</option>
          {cats.data?.filter((c) => !c.parentId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {sel.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-full bg-pill py-1.5 pr-1.5 pl-4 text-sm text-pill-ink">
          Выбрано: {sel.size}
          <button onClick={() => setSel(new Set())} className="opacity-60 hover:opacity-100" aria-label="Снять выбор">
            <X className="size-4" />
          </button>
          <span className="ml-auto flex gap-1.5">
            {(can('stock.locations') || can('products.write')) && (
              <Button size="sm" className="bg-white/10 text-pill-ink ring-0" onClick={() => setPlaceOpen(true)}>
                <MapPin /> Место
              </Button>
            )}
            <Button size="sm" className="bg-white/10 text-pill-ink ring-0" loading={labels.isPending} onClick={() => labels.mutate()}>
              <Printer /> Этикетки
            </Button>
          </span>
        </div>
      )}

      <div className="hidden grid-cols-[28px_minmax(0,2fr)_minmax(0,1.6fr)_90px_90px_110px] gap-3 px-4 text-xs text-muted md:grid">
        <span />
        <span>Товар</span>
        <span>По складам · место</span>
        <span className="text-right">Остаток</span>
        <span className="text-right">В пути</span>
        <span className="text-right">Сумма</span>
      </div>
      {isLoading && <div className="space-y-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 rounded-[20px]" />)}</div>}
      {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.items.length === 0 && (
        <div className="rounded-[28px] bg-card">
          <EmptyState title={negative ? 'В минусе ничего нет' : 'Остатков нет'} hint="Остаток появляется после проведения приёмки, оприходования или ввода остатков" />
        </div>
      )}
      <div className={cn('space-y-1.5', isFetching && !isLoading && 'opacity-60')}>
        {data?.items.map((r) => (
          <div key={r.productId} className={cn('grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] bg-card px-3 py-2.5 ring-1 md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1.6fr)_90px_90px_110px]', sel.has(r.productId) ? 'ring-ink' : 'ring-line')}>
            <input type="checkbox" checked={sel.has(r.productId)} onChange={() => toggle(r.productId)} className="size-4 accent-[var(--ink)]" aria-label="Выбрать" />
            <Link to={`/products/${r.productId}`} className="min-w-0">
              <span className="block truncate text-[14px] font-medium hover:underline">{r.name}</span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono text-ink-2">{r.mainNumber ?? r.sku}</span> · {r.brandName ?? 'без бренда'}
              </span>
            </Link>
            <span className="hidden min-w-0 flex-wrap gap-1 md:flex">
              {r.warehouses.map((w) => (
                <span key={w.warehouseId} className="inline-flex items-center gap-1 rounded-full bg-card-muted px-2 py-0.5 text-[11.5px] text-ink-2">
                  {whName(w.warehouseId)} <b className="tabular-nums">{num(w.qty, 3)}</b>
                  {w.place && (
                    <span className="flex items-center text-accent">
                      <MapPin className="size-3" />
                      {w.place}
                    </span>
                  )}
                </span>
              ))}
            </span>
            <span className={cn('text-right text-[15px] font-semibold tabular-nums', Number(r.qty) < 0 && 'text-accent')}>
              {num(r.qty, 3)} <span className="text-xs font-normal text-muted">{r.baseUnit}</span>
            </span>
            <span className="hidden text-right text-[13px] text-muted tabular-nums md:block">{Number(r.inTransit) ? num(r.inTransit, 3) : '—'}</span>
            <span className="hidden text-right text-[13px] tabular-nums md:block">{r.amount !== null ? money(r.amount) : '—'}</span>
          </div>
        ))}
      </div>
      {data && data.total > LIMIT && (
        <div className="flex justify-end gap-1.5">
          <Button size="icon-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Pill tone="dark" className="h-8 px-3">
            {page} / {pages}
          </Pill>
          <Button size="icon-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
      )}
      <PlaceDialog open={placeOpen} onOpenChange={setPlaceOpen} productIds={[...sel]} defaultWarehouse={warehouseId ?? physical(whs.data)[0]?.id} onDone={() => setSel(new Set())} />
    </div>
  );
}

/** Место хранения (уровень 1) для выбранных товаров на складе; подсказки из уже использованных значений (ТЗ 8.1) */
export function PlaceDialog({ open, onOpenChange, productIds, defaultWarehouse, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; productIds: string[]; defaultWarehouse?: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const whs = useWarehouses();
  const [wh, setWh] = useState(defaultWarehouse ?? '');
  const [place, setPlace] = useState('');
  const [hints, setHints] = useState<{ place: string; products: number }[]>([]);
  const load = async (w: string, q: string) => {
    if (!w) return;
    try {
      setHints(await stockApi.suggestPlaces(w, q || undefined));
    } catch {
      setHints([]);
    }
  };
  const m = useMutation({
    mutationFn: () => stockApi.setPlace(wh, productIds, place.trim() || null),
    onSuccess: () => {
      toast.success(place.trim() ? `Место «${place.trim()}» назначено` : 'Место убрано');
      qc.invalidateQueries({ queryKey: ['stock'] });
      onOpenChange(false);
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => (onOpenChange(v), v && (setWh(defaultWarehouse ?? ''), setPlace(''), void load(defaultWarehouse ?? '', '')))} title="Место хранения" description={`Товаров: ${productIds.length}`}>
      <div className="mt-4 space-y-4">
        <Field label="Склад">
          <select value={wh} onChange={(e) => (setWh(e.target.value), void load(e.target.value, place))} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
            {physical(whs.data).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Место" hint="Пусто — убрать место. Используйте уже существующие, чтобы не плодить «А1», «а-1», «A 1»">
          <Input autoFocus value={place} onChange={(e) => (setPlace(e.target.value), void load(wh, e.target.value))} placeholder="A-3, Toyota — верхняя полка, ящик 2" />
        </Field>
        {hints.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hints.slice(0, 12).map((h) => (
              <button key={h.place} onClick={() => setPlace(h.place)} className="rounded-full bg-card-muted px-3 py-1 text-[13px] hover:bg-line">
                {h.place} <span className="text-xs text-muted">{h.products}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="dark" disabled={!wh} loading={m.isPending} onClick={() => m.mutate()}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
