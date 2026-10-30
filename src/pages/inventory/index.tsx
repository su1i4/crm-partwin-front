import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Layers, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { buildTree, useCategories } from '@/entities/category';
import { STATUS_LABEL, useDocs } from '@/entities/document';
import { useCan } from '@/entities/session';
import { stockApi, useInventory, type InventoryRow } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductAddField } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, num } from '@/shared/lib/format';
import { sound } from '@/shared/lib/sound';
import { Button, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch } from '@/shared/ui';

/** Инвентаризации (ТЗ 9.3): список и запуск — полная или частичная (группа, полка) */
export function InventoryListPage() {
  const nav = useNavigate();
  const can = useCan();
  const { data, isLoading, error, refetch } = useDocs({ type: 'inventory', limit: 50 });
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Инвентаризации"
        sub="Без остановки продаж: учётное количество берётся на время скана"
        actions={
          can('stock.inventory') && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> Начать инвентаризацию
            </Button>
          )
        }
      />
      {isLoading && <Skeleton className="h-40 rounded-[28px]" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.items.length === 0 && (
        <div className="rounded-[28px] bg-card">
          <EmptyState icon={<ClipboardCheck />} title="Инвентаризаций ещё не было" hint="Начните с одной полки или группы — так быстрее, чем весь склад сразу" />
        </div>
      )}
      <div className="space-y-1.5">
        {data?.items.map((d) => (
          <Link key={d.id} to={`/stock/inventory/${d.id}`} className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5 ring-1 ring-line hover:ring-line-strong">
            <span className="grid size-10 place-items-center rounded-full bg-card-muted text-[11px] font-semibold">{date(d.docDate, 'DD.MM')}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{d.number}</span>
              <span className="block truncate text-xs text-muted">
                {d.warehouseName}
                {d.comment && ` · ${d.comment}`}
              </span>
            </span>
            <Pill tone={STATUS_LABEL[d.status].tone}>{d.status === 'posted' ? 'Завершена' : 'Идёт подсчёт'}</Pill>
          </Link>
        ))}
      </div>
      <CreateInventoryDialog open={open} onOpenChange={setOpen} onCreated={(id) => nav(`/stock/inventory/${id}`)} />
    </div>
  );
}

function CreateInventoryDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const whs = useWarehouses();
  const cats = useCategories();
  const tree = useMemo(() => buildTree(cats.data ?? []), [cats.data]);
  const [wh, setWh] = useState('');
  const [scope, setScope] = useState<'all' | 'category' | 'place'>('all');
  const [cat, setCat] = useState('');
  const [place, setPlace] = useState('');
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (open && !wh) setWh(physical(whs.data)[0]?.id ?? '');
  }, [open, whs.data, wh]);
  const m = useMutation({
    mutationFn: () =>
      stockApi.createInventory({
        warehouseId: wh,
        ...(scope === 'category' && cat ? { categoryId: cat } : {}),
        ...(scope === 'place' && place ? { place } : {}),
        ...(comment ? { comment } : {}),
        sheetName: 'Лист 1',
      }),
    onSuccess: (r) => (onOpenChange(false), onCreated(r.id)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Начать инвентаризацию">
      <div className="mt-4 space-y-4">
        <Field label="Склад">
          <select value={wh} onChange={(e) => setWh(e.target.value)} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
            {physical(whs.data).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Весь склад' }, { value: 'category', label: 'Группа' }, { value: 'place', label: 'Полка' }]} />
        {scope === 'category' && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
            <option value="">— группа —</option>
            {tree.flatMap((c) => [c, ...c.children]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </select>
        )}
        {scope === 'place' && <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="A-3" />}
        <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий" />
        <div className="flex justify-end">
          <Button variant="dark" disabled={!wh || (scope === 'category' && !cat) || (scope === 'place' && !place)} loading={m.isPending} onClick={() => m.mutate()}>
            Начать
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

type Filter = 'all' | 'diff' | 'uncounted';

/** Подсчёт: скан → +1, правка количества; несколько листов параллельно; итог — оприходование и списание */
export function InventoryPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading, error, refetch } = useInventory(id);
  const [sheet, setSheet] = useState<string>('');
  const [filter, setFilter] = useState<Filter>('all');
  const [finishOpen, setFinishOpen] = useState(false);
  const [zero, setZero] = useState(true);
  const [last, setLast] = useState<{ name: string; counted: string } | null>(null);
  useEffect(() => {
    if (data && !sheet) setSheet(data.sheets.find((s) => s.status === 'open')?.id ?? data.sheets[0]?.id ?? '');
  }, [data, sheet]);
  const done = data?.status === 'posted';

  const count = useMutation({
    mutationFn: (b: { productId: string; qty: string; mode: 'add' | 'set' }) => stockApi.count(id!, { sheetId: sheet, ...b, scannedAt: new Date().toISOString() }),
    onSuccess: (r) => {
      setLast({ name: r.name, counted: r.counted });
      qc.invalidateQueries({ queryKey: ['inventory', id] });
    },
    onError: (e) => (sound.error(), toast.error(errorMessage(e))),
  });
  const addSheet = useMutation({
    mutationFn: () => stockApi.addSheet(id!, `Лист ${(data?.sheets.length ?? 0) + 1}`),
    onSuccess: () => refetch(),
  });
  const finish = useMutation({
    mutationFn: () => stockApi.finish(id!, data!.version, zero),
    onSuccess: () => {
      toast.success('Инвентаризация завершена: излишки оприходованы, недостача списана');
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      setFinishOpen(false);
      refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-[32px]" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const rows = data.rows.filter((r) => (filter === 'diff' ? Number(r.diff) !== 0 && r.countedAt : filter === 'uncounted' ? !r.countedAt : true));
  const s = data.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => nav('/stock/inventory')}>
          <ArrowLeft /> Инвентаризации
        </Button>
        <h1 className="mr-auto pl-1 text-xl font-semibold">Инвентаризация {data.number}</h1>
        {done ? (
          <Pill tone="ok">Завершена</Pill>
        ) : (
          <Button variant="dark" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 /> Завершить
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Товаров в области', s.products, 'soft'],
          ['Посчитано', `${s.counted} из ${s.products}`, 'soft'],
          ['Излишки', s.surplus, 'ok'],
          ['Недостача', s.shortage, 'accent'],
        ].map(([k, v, t]) => (
          <div key={String(k)} className={cn('rounded-[22px] p-4', t === 'accent' && Number(v) ? 'bg-accent-soft' : t === 'ok' && Number(v) ? 'bg-ok-soft' : 'bg-card')}>
            <div className="text-xs text-muted">{k}</div>
            <div className="text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${s.products ? (s.counted / s.products) * 100 : 0}%` }} />
      </div>

      {!done && (
        <div className="space-y-2 rounded-[24px] bg-card-muted p-2">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Layers className="size-4 text-muted" />
            {data.sheets.map((sh) => (
              <button key={sh.id} onClick={() => setSheet(sh.id)} className={cn('h-8 rounded-full px-3 text-[13px] ring-1', sheet === sh.id ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line')}>
                {sh.name}
              </button>
            ))}
            <button onClick={() => addSheet.mutate()} className="h-8 rounded-full px-3 text-[13px] text-muted ring-1 ring-line ring-dashed">
              + лист (параллельно)
            </button>
            {last && (
              <span className="ml-auto text-[13px]">
                {last.name}: <b className="tabular-nums">{num(last.counted, 3)}</b>
              </span>
            )}
          </div>
          <ProductAddField placeholder="Сканируйте товар — каждый скан +1" onPick={(p) => count.mutate({ productId: p.id, qty: '1', mode: 'add' })} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Все' }, { value: 'diff', label: 'Расхождения' }, { value: 'uncounted', label: 'Не посчитано' }]} />
        <span className="text-xs text-muted">Учётное — на время последнего скана товара</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <InvRow key={r.productId} r={r} disabled={done} onSet={(qty) => count.mutate({ productId: r.productId, qty, mode: 'set' })} />
        ))}
        {!rows.length && <div className="rounded-[24px] bg-card"><EmptyState title="Пусто" /></div>}
      </div>
      {data.lateMovements.length > 0 && (
        <div className="rounded-[22px] bg-warn-soft p-4 text-sm">
          <b>Поздние движения</b> — пришли после скана, но датированы раньше (офлайн-чеки):
          {data.lateMovements.map((m) => (
            <div key={m.id} className="text-xs">
              {m.name}: {num(m.qty, 3)} · {m.number} · {date(m.movedAt, 'D MMM HH:mm')}
            </div>
          ))}
        </div>
      )}
      <Dialog open={finishOpen} onOpenChange={setFinishOpen} title="Завершить инвентаризацию?" description={`Излишков: ${s.surplus}, недостач: ${s.shortage}. Создадутся документы оприходования и списания.`}>
        <div className="mt-4 space-y-4">
          <Switch checked={zero} onChange={setZero} label={`Непосчитанные (${s.products - s.counted}) — это ноль, списать`} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFinishOpen(false)}>
              Продолжить подсчёт
            </Button>
            <Button variant="dark" loading={finish.isPending} onClick={() => finish.mutate()}>
              Завершить
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function InvRow({ r, disabled, onSet }: { r: InventoryRow; disabled: boolean; onSet: (q: string) => void }) {
  const [v, setV] = useState<string | null>(null);
  const diff = Number(r.diff);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] bg-card px-3 py-2 ring-1 ring-line sm:grid-cols-[minmax(0,1fr)_70px_90px_80px]">
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
        <span className="text-xs text-muted">
          {r.sku}
          {r.place && ` · ${r.place}`}
        </span>
      </span>
      <span className="hidden text-right text-[13px] text-muted tabular-nums sm:block">учёт {num(r.book, 3)}</span>
      <input
        disabled={disabled}
        value={v ?? (r.countedAt ? num(r.counted, 3) : '')}
        placeholder="—"
        onFocus={(e) => (setV(r.countedAt ? String(Number(r.counted)) : ''), e.target.select())}
        onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => {
          if (v !== null && v !== '' && Number(v.replace(',', '.')) !== Number(r.counted)) onSet(String(Number(v.replace(',', '.'))));
          setV(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-9 w-full rounded-xl bg-card-muted px-2 text-right text-[14px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink"
      />
      <span className={cn('hidden text-right text-[13px] font-semibold tabular-nums sm:block', !r.countedAt ? 'text-faint' : diff > 0 ? 'text-ok' : diff < 0 ? 'text-accent' : 'text-muted')}>
        {r.countedAt ? (diff > 0 ? `+${num(diff, 3)}` : num(diff, 3)) : '—'}
      </span>
    </div>
  );
}
