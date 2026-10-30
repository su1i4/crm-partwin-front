import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Info, Snowflake, Sparkles, Sun, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { purchasingApi, useSuppliers, type AutoLine, type AutoPreview } from '@/entities/purchasing';
import { useSession } from '@/entities/session';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { Button, Card, EmptyState, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
type Row = AutoLine & { key: string; on: boolean };

function Explain({ e, unit = 'шт' }: { e: AutoLine['explain']; unit?: string }) {
  const items: [string, string][] = [
    ['Остаток', `${num(e.stock, 3)} ${unit}`],
    ['Уже заказано', `${num(e.expected, 3)}`],
    ['Продано за период', num(e.salesLastDays, 3)],
    ['Год назад, тот же период', num(e.salesLastYear, 3)],
    ['Спрос в день', num(e.dailyDemand, 3)],
    ['Мин / макс', `${e.min ?? '—'} / ${e.max ?? '—'}`],
    ['Срок поставки', `${e.leadDays} дн`],
    ['Точка заказа', num(e.reorderPoint, 2)],
    ['Цель', num(e.target, 2)],
    ['Кратность / мин. партия', `${num(e.multiplicity, 3)} / ${num(e.minQty, 3)}`],
  ];
  return (
    <div className="grid gap-x-6 gap-y-1 px-4 pb-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-line/60 py-1">
          <span className="text-muted">{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
      {e.season && (
        <div className="flex items-center gap-1 py-1 text-muted">
          {e.season === 'summer' ? <Sun className="size-3.5 text-warn" /> : <Snowflake className="size-3.5 text-accent" />} сезонные мин/макс
        </div>
      )}
    </div>
  );
}

/** Автозаказ (ТЗ 10.4): что заканчивается — с объяснением каждой цифры, по поставщикам → черновики заказов */
export default function AutoOrderPage() {
  const storeId = useSession((s) => s.storeId);
  const cats = useCategories();
  const sup = useSuppliers('');
  const nav = useNavigate();
  const [p, setP] = useState({ supplierId: '', categoryId: '', days: '30', coverDays: '14', includeWithoutRules: true });
  const [res, setRes] = useState<AutoPreview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const preview = useMutation({
    mutationFn: () =>
      purchasingApi.autoPreview({
        ...(storeId ? { storeId } : {}),
        ...(p.supplierId ? { supplierId: p.supplierId } : {}),
        ...(p.categoryId ? { categoryId: p.categoryId } : {}),
        days: Number(p.days) || 30,
        coverDays: Number(p.coverDays) || 0,
        includeWithoutRules: p.includeWithoutRules,
      }),
    onSuccess: (r) => (setRes(r), setRows(r.lines.map((l, i) => ({ ...l, key: `${l.productId}-${i}`, on: !!l.supplierId })))),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.autoCreate({
        ...(storeId ? { storeId } : {}),
        lines: rows
          .filter((r) => r.on && r.supplierId && Number(r.qty) > 0)
          .map((r) => ({ productId: r.productId, supplierId: r.supplierId!, qty: String(Number(r.qty)), price: r.price, unitId: r.unitId, currency: r.currency, explain: r.explain })),
      }),
    onSuccess: (orders) => {
      toast.success(`Создано черновиков: ${orders.length}`);
      nav(orders.length === 1 ? `/purchasing/orders/${orders[0].id}` : '/purchasing/orders?f=draft');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: Row[] }>();
    for (const r of rows) {
      const k = r.supplierId ?? 'none';
      const g = m.get(k) ?? { name: r.supplierName ?? 'Поставщик не определён', rows: [] };
      g.rows.push(r);
      m.set(k, g);
    }
    return [...m.entries()].sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : 0));
  }, [rows]);
  const chosen = rows.filter((r) => r.on && r.supplierId && Number(r.qty) > 0);
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-6">
      <PageTitle title="Автозаказ" sub="Учитывает мин./макс. (и сезонные), продажи за период и год назад, срок поставки, кратность и уже заказанное" />
      <Card className="grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_140px_auto]">
        <Field label="Поставщик">
          <select className={sel} value={p.supplierId} onChange={(e) => setP({ ...p, supplierId: e.target.value })}>
            <option value="">Все</option>
            {sup.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Группа">
          <select className={sel} value={p.categoryId} onChange={(e) => setP({ ...p, categoryId: e.target.value })}>
            <option value="">Все</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {'— '.repeat(c.level)}
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Продажи за, дн">
          <Input inputMode="numeric" value={p.days} onChange={(e) => setP({ ...p, days: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Запас на, дн">
          <Input inputMode="numeric" value={p.coverDays} onChange={(e) => setP({ ...p, coverDays: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Button variant="dark" size="lg" loading={preview.isPending} onClick={() => preview.mutate()}>
          <Wand2 /> Рассчитать
        </Button>
        <div className="sm:col-span-2 lg:col-span-5">
          <Switch checked={p.includeWithoutRules} onChange={(v) => setP({ ...p, includeWithoutRules: v })} label="Учитывать товары без мин./макс. (по продажам)" />
        </div>
      </Card>

      {preview.isPending && <Skeleton className="h-64 rounded-[24px]" />}
      {res && !preview.isPending && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-pill px-5 py-3 text-pill-ink">
            {res.season === 'summer' ? <Sun className="size-5 text-warn" /> : <Snowflake className="size-5" />}
            <span className="flex-1 text-sm">
              <b className="text-lg tabular-nums">{rows.length}</b> позиций к заказу · {groups.length} поставщик(ов) · продажи за {res.days} дн, запас на {res.coverDays} дн
            </span>
            <Button variant="accent" disabled={!chosen.length} loading={create.isPending} onClick={() => create.mutate()}>
              <Sparkles /> Создать черновики ({chosen.length})
            </Button>
          </div>
          {!rows.length && (
            <Card>
              <EmptyState title="Заказывать нечего" hint="Всего хватает с учётом уже заказанного. Задайте мин./макс. в карточках товаров для точного расчёта" />
            </Card>
          )}
          {groups.map(([k, g]) => {
            const total = g.rows.filter((r) => r.on).reduce((a, r) => a + Number(r.qty) * Number(r.price ?? 0), 0);
            return (
              <Tray key={k} className="p-3">
                <div className="flex items-center gap-3 px-1 pb-2">
                  <span className={cn('flex-1 text-[15px] font-medium', k === 'none' && 'text-accent')}>{g.name}</span>
                  <span className="text-xs text-muted">{g.rows.filter((r) => r.on).length} поз.</span>
                  <span className="text-[14px] font-semibold tabular-nums">{money(total, g.rows[0]?.currency)}</span>
                </div>
                {k === 'none' && (
                  <div className="mb-2 flex items-center gap-2 rounded-[14px] bg-accent-soft px-3 py-2 text-xs text-accent">
                    <Info className="size-3.5" /> Выберите поставщика для строк — иначе они не попадут в заказ
                  </div>
                )}
                <div className="space-y-1">
                  {g.rows.map((r) => (
                    <div key={r.key} className={cn('rounded-[16px] bg-card', !r.on && 'opacity-50')}>
                      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                        <input type="checkbox" checked={r.on} onChange={(e) => set(r.key, { on: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{r.name}</span>
                          <span className="block font-mono text-xs text-muted">{r.number ?? r.sku}</span>
                        </span>
                        {k === 'none' && (
                          <select value={r.supplierId ?? ''} onChange={(e) => set(r.key, { supplierId: e.target.value || null, supplierName: sup.data?.items.find((s) => s.id === e.target.value)?.name ?? null, on: !!e.target.value })} className="h-9 w-48 rounded-full bg-card-muted px-3 text-[13px] outline-none">
                            <option value="">поставщик…</option>
                            {sup.data?.items.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <Pill tone="soft" className="hidden sm:inline-flex">
                          ост. {num(r.explain.stock, 3)}
                        </Pill>
                        <input value={r.qty} inputMode="decimal" onChange={(e) => set(r.key, { qty: e.target.value.replace(/[^\d.]/g, '') })} className="h-9 w-20 rounded-xl bg-card-muted px-2 text-right font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink" />
                        <span className="w-24 text-right text-[13px] text-muted tabular-nums">{r.price ? money(r.price, r.currency) : 'без цены'}</span>
                        <button onClick={() => setOpen(open === r.key ? null : r.key)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-muted" title="Почему столько">
                          <ChevronDown className={cn('size-4 transition', open === r.key && 'rotate-180')} />
                        </button>
                      </div>
                      {open === r.key && <Explain e={r.explain} />}
                    </div>
                  ))}
                </div>
              </Tray>
            );
          })}
        </>
      )}
      {!res && !preview.isPending && (
        <Card>
          <EmptyState icon={<Sparkles />} title="Нажмите «Рассчитать»" hint="Покажем, что заканчивается, сколько заказать и почему — по каждой строке" />
        </Card>
      )}
    </div>
  );
}
