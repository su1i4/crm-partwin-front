import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DOC_KIND } from '@/entities/document';
import { purchasingApi, useSuppliers } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { useMovements } from '@/entities/stock';
import { api, errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Dialog, EmptyState, Field, Input, Pill, Skeleton } from '@/shared/ui';

const KIND: Record<string, string> = { sale: 'Продажа', return: 'Возврат' };
const docTitle = (type: string) => DOC_KIND[type as keyof typeof DOC_KIND]?.title ?? KIND[type] ?? type;

/** Вкладка «Движения»: каждый приход/расход с документом и остатком после (ТЗ 9.1) */
export function MovesTab({ productId, unit }: { productId: string; unit: string }) {
  const { data, isLoading } = useMovements(productId);
  if (isLoading) return <Skeleton className="h-48 rounded-[24px]" />;
  if (!data?.length) return <EmptyState title="Движений нет" hint="Остаток меняют только проведённые документы и чеки" />;
  return (
    <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
      <table className="w-full min-w-[640px] text-[13.5px]">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-normal">Дата</th>
            <th className="px-2 font-normal">Документ</th>
            <th className="px-2 font-normal">Склад</th>
            <th className="px-2 text-right font-normal">Кол-во</th>
            <th className="px-2 text-right font-normal">Себест.</th>
            <th className="px-4 text-right font-normal">Остаток</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => {
            const plus = Number(m.qty) > 0;
            return (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-muted">{date(m.movedAt, 'DD.MM.YY HH:mm')}</td>
                <td className="px-2">
                  <Link to={m.type === 'sale' ? `/sales?q=${m.number}` : `/documents/${m.documentId}`} className="hover:text-accent">
                    {docTitle(m.type)} <span className="font-mono text-muted">№{m.number}</span>
                  </Link>
                </td>
                <td className="px-2 text-ink-2">{m.warehouseName}</td>
                <td className={cn('px-2 text-right font-semibold tabular-nums', plus ? 'text-ok' : 'text-accent')}>
                  {plus ? '+' : ''}
                  {num(m.qty, 3)}
                </td>
                <td className="px-2 text-right text-muted tabular-nums">{m.costAmount ? money(m.costAmount) : '—'}</td>
                <td className="px-4 text-right tabular-nums">
                  {num(m.balance, 3)} <span className="text-muted">{unit}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface Cross {
  id: string;
  aNumber: string;
  aBrand: string | null;
  bNumber: string;
  bBrand: string | null;
  crossType: 'full' | 'partial' | 'oem_replacement';
  source: string;
  createdAt: string;
}
const CROSS: Record<Cross['crossType'], string> = { full: 'полная замена', partial: 'частичная', oem_replacement: 'замена OEM' };

/** Кроссы товара: добавить / удалить. Аналоги считаются на 2 уровня (ТЗ 4.3) */
export function CrossesBlock({ productId, mainNumber, brand }: { productId: string; mainNumber: string | null; brand: string | null }) {
  const qc = useQueryClient();
  const can = useCan();
  const { data, isLoading } = useQuery({ queryKey: ['crosses', productId], queryFn: () => api.get<Cross[]>(`/products/${productId}/crosses`).then((r) => r.data) });
  const [form, setForm] = useState<{ bNumber: string; bBrand: string; crossType: Cross['crossType'] } | null>(null);
  const add = useMutation({
    mutationFn: (f: NonNullable<typeof form>) =>
      api.post('/crosses', { aNumber: mainNumber, ...(brand ? { aBrand: brand } : {}), bNumber: f.bNumber.trim(), ...(f.bBrand.trim() ? { bBrand: f.bBrand.trim() } : {}), crossType: f.crossType }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['crosses', productId] }), setForm(null), toast.success('Кросс добавлен')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/crosses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crosses', productId] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[15px] font-medium">Кроссы</div>
        {can('catalog.manage') && mainNumber && (
          <Button size="sm" onClick={() => setForm({ bNumber: '', bBrand: '', crossType: 'full' })}>
            <Plus /> Кросс
          </Button>
        )}
      </div>
      {isLoading && <Skeleton className="h-20 rounded-[20px]" />}
      <div className="space-y-1.5">
        {data?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-4 ring-1 ring-line">
            <span className="font-mono text-[13.5px]">{c.aNumber}</span>
            <span className="text-xs text-muted">{c.aBrand}</span>
            <ArrowLeftRight className="size-3.5 text-accent" />
            <span className="font-mono text-[13.5px]">{c.bNumber}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{c.bBrand}</span>
            <Pill tone={c.crossType === 'full' ? 'dark' : 'soft'}>{CROSS[c.crossType]}</Pill>
            <Pill tone="outline" className="hidden sm:inline-flex">{c.source}</Pill>
            {can('catalog.manage') && (
              <button onClick={() => confirm('Удалить кросс?') && del.mutate(c.id)} className="grid size-7 place-items-center rounded-full text-muted hover:text-accent" aria-label="Удалить">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {data && !data.length && <div className="rounded-[20px] bg-card px-4 py-3 text-sm text-muted ring-1 ring-line">Кроссов нет — аналоги ищутся только по общему справочнику</div>}
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)} title="Новый кросс" description={`${mainNumber ?? ''} ${brand ?? ''} = …`}>
        {form && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Номер аналога">
                <Input autoFocus value={form.bNumber} onChange={(e) => setForm({ ...form, bNumber: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Бренд">
                <Input value={form.bBrand} onChange={(e) => setForm({ ...form, bBrand: e.target.value })} />
              </Field>
            </div>
            <Field label="Тип">
              <select value={form.crossType} onChange={(e) => setForm({ ...form, crossType: e.target.value as Cross['crossType'] })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                {Object.entries(CROSS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!form.bNumber.trim()} loading={add.isPending} onClick={() => add.mutate(form)}>
                Добавить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Вкладка «Поставщики»: коды поставщиков, кратность, мин./макс., история закупок ──

type SupRow = { supplierId: string; supplierName: string; supplierCode: string; multiplicity: string; minQty: string; leadDays: string; preferred: boolean; lastPrice: string | null; lastCurrency: string | null };
type RuleRow = { storeId: string | null; minQty: string; maxQty: string; summerMin: string; summerMax: string; winterMin: string; winterMax: string };

export function SuppliersTab({ productId, unit }: { productId: string; unit: string }) {
  const qc = useQueryClient();
  const can = useCan();
  const edit = can('purchasing.orders') || can('purchasing.suppliers');
  const sp = useQuery({ queryKey: ['product-suppliers', productId], queryFn: () => purchasingApi.productSuppliers(productId) });
  const rules = useQuery({ queryKey: ['stock-rules', productId], queryFn: () => purchasingApi.stockRules(productId) });
  const hist = useQuery({ queryKey: ['purchase-history', productId], queryFn: () => purchasingApi.purchaseHistory(productId), enabled: can('products.view_cost'), retry: false });
  const all = useSuppliers('');
  const [rows, setRows] = useState<SupRow[] | null>(null);
  const [rr, setRr] = useState<RuleRow | null>(null);
  const [supDirty, setSupDirty] = useState(false);
  useEffect(() => {
    if (sp.data)
      setRows(sp.data.map((s) => ({ supplierId: s.supplierId, supplierName: s.supplierName, supplierCode: s.supplierCode ?? '', multiplicity: s.multiplicity ? String(Number(s.multiplicity)) : '1', minQty: s.minQty ? String(Number(s.minQty)) : '', leadDays: s.leadDays?.toString() ?? '', preferred: s.preferred, lastPrice: s.lastPrice, lastCurrency: s.lastCurrency })));
    setSupDirty(false);
  }, [sp.data]);
  useEffect(() => {
    if (rules.data) {
      const r = rules.data.find((x) => !x.storeId) ?? null;
      const s = (v: string | null | undefined) => (v != null ? String(Number(v)) : '');
      setRr({ storeId: null, minQty: s(r?.minQty), maxQty: s(r?.maxQty), summerMin: s(r?.summerMin), summerMax: s(r?.summerMax), winterMin: s(r?.winterMin), winterMax: s(r?.winterMax) });
    }
  }, [rules.data]);
  const saveSup = useMutation({
    mutationFn: () =>
      purchasingApi.setProductSuppliers(
        productId,
        rows!.map((r) => ({ supplierId: r.supplierId, supplierCode: r.supplierCode.trim() || null, multiplicity: r.multiplicity || '1', ...(r.minQty ? { minQty: r.minQty } : {}), leadDays: r.leadDays ? Number(r.leadDays) : null, preferred: r.preferred })),
      ),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['product-suppliers', productId] }), toast.success('Поставщики сохранены')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveRules = useMutation({
    mutationFn: () => {
      const n = (v: string) => (v ? v : null);
      return purchasingApi.setStockRules(productId, [{ storeId: null, minQty: n(rr!.minQty), maxQty: n(rr!.maxQty), summerMin: n(rr!.summerMin), summerMax: n(rr!.summerMax), winterMin: n(rr!.winterMin), winterMax: n(rr!.winterMax), supplierId: null }]);
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['stock-rules', productId] }), toast.success('Мин./макс. сохранены — автозаказ учтёт')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setRow = (i: number, p: Partial<SupRow>) => (setSupDirty(true), setRows((x) => x!.map((r, k) => (k === i ? { ...r, ...p } : p.preferred ? { ...r, preferred: false } : r))));
  const cell = 'h-9 rounded-xl bg-card-muted px-2 text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-ink disabled:bg-transparent';
  const rule = (k: keyof RuleRow, label: string) => (
    <label className="space-y-1">
      <span className="block px-1 text-xs text-muted">{label}</span>
      <input disabled={!edit} value={(rr?.[k] as string) ?? ''} inputMode="decimal" onChange={(e) => setRr({ ...rr!, [k]: e.target.value.replace(/[^\d.]/g, '') })} className={cn(cell, 'w-full bg-card')} placeholder="—" />
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="rounded-[24px] bg-card ring-1 ring-line">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[15px] font-medium">Поставщики товара</span>
            {edit && (
              <select
                value=""
                onChange={(e) => {
                  const s = all.data?.items.find((x) => x.id === e.target.value);
                  if (s && rows && !rows.some((r) => r.supplierId === s.id)) setRows([...rows, { supplierId: s.id, supplierName: s.name, supplierCode: '', multiplicity: '1', minQty: '', leadDays: '', preferred: !rows.length, lastPrice: null, lastCurrency: null }]), setSupDirty(true);
                }}
                className="h-8 rounded-full bg-card-muted px-3 text-[13px] outline-none"
              >
                <option value="">+ поставщик</option>
                {all.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {sp.isLoading && <Skeleton className="m-3 h-20" />}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="text-left text-xs text-muted">
                <tr className="border-y border-line">
                  <th className="px-4 py-2 font-normal">Поставщик</th>
                  <th className="px-1 font-normal">Его код</th>
                  <th className="px-1 font-normal">Кратность</th>
                  <th className="px-1 font-normal">Мин. партия</th>
                  <th className="px-1 font-normal">Срок, дн</th>
                  <th className="px-1 text-right font-normal">Последняя цена</th>
                  <th className="w-20 px-3 font-normal">Основной</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r, i) => (
                  <tr key={r.supplierId} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-medium">{r.supplierName}</td>
                    <td className="px-1">
                      <input disabled={!edit} value={r.supplierCode} onChange={(e) => setRow(i, { supplierCode: e.target.value })} className={cn(cell, 'w-28 font-mono')} placeholder="—" />
                    </td>
                    <td className="px-1">
                      <input disabled={!edit} value={r.multiplicity} inputMode="decimal" onChange={(e) => setRow(i, { multiplicity: e.target.value.replace(/[^\d.]/g, '') })} className={cn(cell, 'w-16 text-right')} />
                    </td>
                    <td className="px-1">
                      <input disabled={!edit} value={r.minQty} inputMode="decimal" onChange={(e) => setRow(i, { minQty: e.target.value.replace(/[^\d.]/g, '') })} className={cn(cell, 'w-16 text-right')} placeholder="—" />
                    </td>
                    <td className="px-1">
                      <input disabled={!edit} value={r.leadDays} inputMode="numeric" onChange={(e) => setRow(i, { leadDays: e.target.value.replace(/\D/g, '') })} className={cn(cell, 'w-14 text-right')} placeholder="—" />
                    </td>
                    <td className="px-1 text-right text-muted tabular-nums">{r.lastPrice ? money(r.lastPrice, r.lastCurrency ?? 'KGS') : '—'}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <input type="radio" disabled={!edit} checked={r.preferred} onChange={() => setRow(i, { preferred: true })} className="size-4 accent-[var(--accent)]" />
                        {edit && (
                          <button onClick={() => (setRows(rows.filter((_, k) => k !== i)), setSupDirty(true))} className="grid size-7 place-items-center rounded-full text-muted hover:text-accent" aria-label="Убрать">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows && !rows.length && <div className="px-4 pb-4 text-sm text-muted">Поставщик определится по прайсам и прошлым приёмкам. Код поставщика ищется в поиске</div>}
          {edit && supDirty && (
            <div className="flex justify-end px-4 pb-3">
              <Button variant="dark" size="sm" loading={saveSup.isPending} onClick={() => saveSup.mutate()}>
                Сохранить поставщиков
              </Button>
            </div>
          )}
        </div>

        {hist.data && (
          <div className="rounded-[24px] bg-card ring-1 ring-line">
            <div className="px-4 pt-3 pb-2 text-[15px] font-medium">История закупок</div>
            {hist.data.map((h) => (
              <Link key={h.documentId + h.number} to={`/documents/${h.documentId}`} className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] hover:bg-card-muted">
                <span className="w-20 text-muted">{date(h.date, 'DD.MM.YY')}</span>
                <span className="min-w-0 flex-1 truncate">{h.supplier ?? '—'}</span>
                <span className="text-muted tabular-nums">{num(h.qty, 3)} {unit}</span>
                <span className="w-28 text-right font-semibold tabular-nums">{h.price ? money(h.price, h.currency) : '—'}</span>
                {h.orderPrice && Number(h.orderPrice) !== Number(h.price) && <Pill tone="warn" className="h-5">в заказе {money(h.orderPrice, h.currency)}</Pill>}
              </Link>
            ))}
            {!hist.data.length && <div className="px-4 pb-4 text-sm text-muted">Ещё не закупали</div>}
          </div>
        )}
      </div>
      <div className="h-fit space-y-3 rounded-[24px] bg-card-muted p-4">
        <div className="text-[15px] font-medium">Минимум и максимум</div>
        <div className="text-xs text-muted">Остаток ниже минимума — в автозаказ, до максимума. Сезонные значения важнее обычных</div>
        {rr && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {rule('minQty', 'Мин.')}
              {rule('maxQty', 'Макс.')}
              {rule('summerMin', 'Лето, мин.')}
              {rule('summerMax', 'Лето, макс.')}
              {rule('winterMin', 'Зима, мин.')}
              {rule('winterMax', 'Зима, макс.')}
            </div>
            {edit && (
              <Button variant="dark" className="w-full" loading={saveRules.isPending} onClick={() => saveRules.mutate()}>
                Сохранить
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
