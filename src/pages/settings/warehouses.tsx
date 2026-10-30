import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Grid3x3, Layers, Plus, Warehouse as WIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useStores } from '@/entities/admin';
import { WAREHOUSE_TYPE_LABELS, useWarehouses, type Warehouse, type WarehouseType } from '@/entities/warehouse';
import { api, errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Button, Dialog, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const LEVEL = ['', 'место текстом', 'справочник мест', 'адресные ячейки'];

/** Склады (ТЗ 8): торговый зал, склад, брак, лом; уровень хранения; генератор ячеек */
export default function WarehousesPage() {
  const whs = useWarehouses();
  const stores = useStores();
  const qc = useQueryClient();
  const [f, setF] = useState<{ id?: string; version?: number; storeId: string; name: string; code: string; type: WarehouseType; storageLevel: number; isActive: boolean } | null>(null);
  const [gen, setGen] = useState<{ warehouseId: string; zone: string; row: string; racks: string; shelves: string; cells: string } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      f!.id
        ? adminApi.updateWarehouse(f!.id, { version: f!.version!, name: f!.name, ...(f!.code ? { code: f!.code } : {}), isActive: f!.isActive })
        : adminApi.createWarehouse({ ...(f!.storeId ? { storeId: f!.storeId } : {}), name: f!.name, ...(f!.code ? { code: f!.code } : {}), type: f!.type, storageLevel: f!.storageLevel }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['warehouses'] }), setF(null), toast.success('Склад сохранён')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const generate = useMutation({
    mutationFn: () => {
      const pair = (s: string) => s.split('-').map((x) => Number(x.trim())) as [number, number];
      return api.post<{ created: number }>('/storage/locations/generate', { warehouseId: gen!.warehouseId, zone: gen!.zone, row: gen!.row, racks: pair(gen!.racks), shelves: pair(gen!.shelves), cells: pair(gen!.cells) }).then((r) => r.data);
    },
    onSuccess: (r) => (qc.invalidateQueries({ queryKey: ['locations'] }), qc.invalidateQueries({ queryKey: ['warehouses'] }), setGen(null), toast.success(`Ячеек создано: ${r.created ?? 'готово'}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const count = gen ? (() => {
    const n = (s: string) => {
      const [a, b] = s.split('-').map((x) => Number(x.trim()));
      return b >= a ? b - a + 1 : 0;
    };
    return n(gen.racks) * n(gen.shelves) * n(gen.cells);
  })() : 0;
  const groups = [...(stores.data ?? []).map((s) => ({ id: s.id as string | null, name: s.name })), { id: null, name: 'Центральные склады' }];
  return (
    <div className="space-y-6">
      <PageTitle
        title="Склады"
        sub="У каждой точки — торговый зал; дополнительно склад, брак, лом. Уровень хранения растёт вместе с магазином"
        actions={
          <Button variant="dark" onClick={() => setF({ storeId: stores.data?.[0]?.id ?? '', name: '', code: '', type: 'storage', storageLevel: 1, isActive: true })}>
            <Plus /> Склад
          </Button>
        }
      />
      {whs.isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {groups.map((g) => {
        const list = (whs.data ?? []).filter((w) => w.storeId === g.id && w.type !== 'customer' && w.type !== 'transit');
        if (!list.length) return null;
        return (
          <Tray key={g.id ?? 'central'} className="p-3">
            <div className="px-1 pb-2 text-[14px] font-medium">{g.name}</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((w: Warehouse) => (
                <div key={w.id} className={cn('rounded-[20px] bg-card p-4', !w.isActive && 'opacity-50')}>
                  <button onClick={() => setF({ id: w.id, version: w.version, storeId: w.storeId ?? '', name: w.name, code: w.code, type: w.type, storageLevel: w.storageLevel, isActive: w.isActive })} className="flex w-full items-center gap-2 text-left">
                    <WIcon className="size-4 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{w.name}</span>
                    <Pill tone={w.type === 'sales_floor' ? 'dark' : w.type === 'defect' || w.type === 'scrap' ? 'warn' : 'soft'}>{WAREHOUSE_TYPE_LABELS[w.type]}</Pill>
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <Layers className="size-3.5" /> уровень {w.storageLevel}: {LEVEL[w.storageLevel]}
                  </div>
                  <div className="mt-3 flex gap-1">
                    <Link to={`/stock/places`}>
                      <Button size="sm" variant="soft">
                        Места
                      </Button>
                    </Link>
                    <Button size="sm" variant="soft" onClick={() => setGen({ warehouseId: w.id, zone: 'S1', row: 'A', racks: '1-10', shelves: '1-4', cells: '1-3' })}>
                      <Grid3x3 /> Ячейки
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Tray>
        );
      })}
      <Dialog open={!!f} onOpenChange={(v) => !v && setF(null)} title={f?.id ? f.name : 'Новый склад'}>
        {f && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
              <Field label="Название">
                <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Подсобка" />
              </Field>
              <Field label="Код">
                <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().slice(0, 20) })} />
              </Field>
            </div>
            {!f.id && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Точка">
                  <select className={sel} value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>
                    {stores.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="">Центральный (без точки)</option>
                  </select>
                </Field>
                <Field label="Тип">
                  <select className={sel} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as WarehouseType })}>
                    {(['storage', 'sales_floor', 'defect', 'scrap'] as WarehouseType[]).map((t) => (
                      <option key={t} value={t}>
                        {WAREHOUSE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Уровень хранения">
                  <select className={sel} value={f.storageLevel} onChange={(e) => setF({ ...f, storageLevel: Number(e.target.value) })}>
                    {[1, 2, 3].map((l) => (
                      <option key={l} value={l}>
                        {l} — {LEVEL[l]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {f.id && <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Используется" />}
            <div className="flex justify-end">
              <Button variant="dark" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!gen} onOpenChange={(v) => !v && setGen(null)} title="Генератор ячеек" description="Адрес вида S1-A-03-2-05: зона — ряд — стеллаж — полка — ячейка. Склад перейдёт на уровень 3">
        {gen && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Зона">
                <Input value={gen.zone} onChange={(e) => setGen({ ...gen, zone: e.target.value.toUpperCase().slice(0, 6) })} />
              </Field>
              <Field label="Ряд">
                <Input value={gen.row} onChange={(e) => setGen({ ...gen, row: e.target.value.toUpperCase().slice(0, 4) })} />
              </Field>
              <Field label="Стеллажи">
                <Input value={gen.racks} onChange={(e) => setGen({ ...gen, racks: e.target.value })} />
              </Field>
              <Field label="Полки">
                <Input value={gen.shelves} onChange={(e) => setGen({ ...gen, shelves: e.target.value })} />
              </Field>
              <Field label="Ячейки">
                <Input value={gen.cells} onChange={(e) => setGen({ ...gen, cells: e.target.value })} />
              </Field>
            </div>
            <div className="rounded-[16px] bg-card-muted px-4 py-3 font-mono text-sm">
              {gen.zone}-{gen.row}-{String(gen.racks.split('-')[0]).padStart(2, '0')}-{gen.shelves.split('-')[0]}-{String(gen.cells.split('-')[0]).padStart(2, '0')} … <span className="font-sans text-muted">всего {count} ячеек</span>
            </div>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!count || count > 5000} loading={generate.isPending} onClick={() => generate.mutate()}>
                Создать {count} ячеек
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
