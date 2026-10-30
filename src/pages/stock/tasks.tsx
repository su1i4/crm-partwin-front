import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, ClipboardList, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStaff } from '@/entities/admin';
import { productApi } from '@/entities/product';
import { salesApi, TASK_KIND, useLocations, useWhTasks, useWorkload, type TaskStatus, type WhTask } from '@/entities/sales';
import { useCan, useSession } from '@/entities/session';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const STATUS: Record<TaskStatus, { label: string; tone: 'soft' | 'warn' | 'ok' | 'muted' }> = {
  open: { label: 'новое', tone: 'soft' },
  in_progress: { label: 'в работе', tone: 'warn' },
  done: { label: 'готово', tone: 'ok' },
  cancelled: { label: 'отменено', tone: 'muted' },
};

/** Названия товаров строк задания — карточки из кэша */
function useNames(ids: string[]) {
  const qs = useQueries({ queries: ids.map((id) => ({ queryKey: ['product', id], queryFn: () => productApi.card(id), staleTime: 5 * 60_000 })) });
  return useMemo(() => Object.fromEntries(ids.map((id, i) => [id, qs[i]?.data?.name ?? '…'])), [ids, qs]);
}

/** Задания склада (ТЗ 9.8): размещение после приёмки, подбор по маршруту ячеек, пополнение, пересчёт */
export default function WarehouseTasksPage() {
  const store = useSession((s) => s.storeId);
  const whs = useWarehouses(store);
  const list = physical(whs.data).filter((w) => w.storageLevel >= 2);
  const [wh, setWh] = useState('');
  const [status, setStatus] = useState<'active' | 'done'>('active');
  const [mine, setMine] = useState(false);
  const can = useCan();
  const qc = useQueryClient();
  useEffect(() => {
    if (!wh && list[0]) setWh(list[0].id);
  }, [list, wh]);
  const { data, isLoading, error, refetch } = useWhTasks({ warehouseId: wh || undefined, status: status === 'done' ? 'done' : undefined, mine });
  const work = useWorkload(wh || undefined);
  const [open, setOpen] = useState<WhTask | null>(null);
  const [pick, setPick] = useState(false);
  const tasks = (data ?? []).filter((t) => (status === 'done' ? t.status === 'done' : t.status === 'open' || t.status === 'in_progress'));
  const repl = useMutation({
    mutationFn: () => salesApi.replenish(wh),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['wh-tasks'] }), toast.success('Задания на пополнение созданы — если где-то ниже минимума')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (whs.data && !list.length)
    return (
      <div className="space-y-6">
        <PageTitle title="Задания склада" />
        <Card>
          <EmptyState icon={<ClipboardList />} title="Нужны адресные ячейки" hint="Задания работают на складах с уровнем хранения 2–3. Включите в «Настройки → Склады»" />
        </Card>
      </div>
    );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Задания склада"
        sub="Кладовщик сканирует ячейку и товар — остаток по ячейкам меняется сразу"
        actions={
          can('stock.tasks') && (
            <>
              <Button onClick={() => repl.mutate()} loading={repl.isPending} disabled={!wh}>
                <RefreshCw /> Пополнение
              </Button>
              <Button variant="dark" onClick={() => setPick(true)} disabled={!wh}>
                <Plus /> Подбор
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {list.length > 1 && <Segmented value={wh} onChange={setWh} options={list.map((w) => ({ value: w.id, label: w.name }))} />}
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'В работе' },
            { value: 'done', label: 'Сделано' },
          ]}
        />
        <Switch checked={mine} onChange={setMine} label="Мои и свободные" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-1.5">
          {error && <ErrorState error={error} onRetry={refetch} />}
          {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
          {tasks.map((t) => {
            const done = t.lines.filter((l) => n(l.doneQty) >= n(l.qty) || l.shortage || l.countedQty !== undefined).length;
            return (
              <button key={t.id} onClick={() => setOpen(t)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 text-left ring-1 ring-line hover:ring-line-strong">
                <span className="w-24 font-mono text-[13px]">{t.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{TASK_KIND[t.kind]}</span>
                  <span className="block text-xs text-muted">
                    {t.lines.length} строк · {ago(t.created_at)}
                    {t.assigneeName && ` · ${t.assigneeName}`}
                  </span>
                </span>
                <span className="w-24">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full bg-accent" style={{ width: `${(done / Math.max(1, t.lines.length)) * 100}%` }} />
                  </span>
                  <span className="text-[11px] text-muted tabular-nums">
                    {done} / {t.lines.length}
                  </span>
                </span>
                <Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill>
              </button>
            );
          })}
          {data && !tasks.length && (
            <Card>
              <EmptyState icon={<ClipboardList />} title={status === 'done' ? 'Пока ничего не сделано' : 'Заданий нет'} hint="Размещение создаётся само после приёмки, подбор — из заказа или вручную" />
            </Card>
          )}
        </div>
        <Tray className="h-fit p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">Нагрузка кладовщиков</div>
          {work.data?.map((w) => (
            <div key={w.name} className="mb-1 flex items-center gap-3 rounded-[14px] bg-card px-3 py-2 text-[13px] last:mb-0">
              <UserRound className="size-4 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{w.name}</span>
                <span className="block text-xs text-muted tabular-nums">
                  открыто {w.open} · за неделю {w.doneWeek}
                  {w.avgMinutes != null && ` · ~${Math.round(w.avgMinutes)} мин на задание`}
                </span>
              </span>
            </div>
          ))}
          {work.data && !work.data.length && <div className="px-1 text-sm text-muted">Нет данных</div>}
        </Tray>
      </div>
      <TaskDialog task={open} onClose={() => setOpen(null)} />
      <PickDialog open={pick} warehouseId={wh} onClose={() => setPick(false)} />
    </div>
  );
}

function TaskDialog({ task, onClose }: { task: WhTask | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [t, setT] = useState<WhTask | null>(task);
  useEffect(() => setT(task), [task]);
  const locs = useLocations(t?.warehouse_id);
  const code = (id?: string | null) => (id ? (locs.data?.find((l) => l.id === id)?.code ?? '…') : '—');
  const ids = useMemo(() => [...new Set((t?.lines ?? []).map((l) => l.productId))], [t]);
  const names = useNames(ids);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [cell, setCell] = useState<Record<number, string>>({});
  useEffect(() => {
    if (task) (setQty(Object.fromEntries(task.lines.map((l, i) => [i, task.kind === 'count' ? '' : String(Math.max(0, n(l.qty) - n(l.doneQty)))]))), setCell({}));
  }, [task]);
  const line = useMutation({
    mutationFn: ({ i, shortage }: { i: number; shortage?: boolean }) =>
      salesApi.taskLine(t!.id, { index: i, productId: t!.lines[i].productId, qty: shortage ? '0' : qty[i] || '0', ...(cell[i] ? { locationId: cell[i] } : {}), ...(shortage ? { shortage: true } : {}) }),
    onSuccess: (r) => {
      setT(r.task);
      qc.invalidateQueries({ queryKey: ['wh-tasks'] });
      if (r.alternative) toast.info(`Есть ещё в ячейке ${code(r.alternative.locationId)}: ${num(r.alternative.qty, 3)} шт. Поставили пересчёт`);
      else if (r.diff && n(r.diff) !== 0) toast.warning(`Расхождение ${n(r.diff) > 0 ? '+' : ''}${num(r.diff, 3)}`);
      if (r.task.status === 'done') toast.success('Задание выполнено');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!t) return null;
  const closed = t.status === 'done' || t.status === 'cancelled';
  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()} title={`${TASK_KIND[t.kind]} ${t.number}`} description={t.kind === 'pick' ? 'Маршрут по ячейкам — сверху вниз' : 'Отсканируйте ячейку и товар, введите количество'} className="max-w-2xl">
      <div className="scroll-thin mt-4 max-h-[60vh] space-y-1.5 overflow-y-auto">
        {t.lines.map((l, i) => {
          const finished = n(l.doneQty) >= n(l.qty) || !!l.shortage || l.countedQty !== undefined;
          const from = t.kind === 'placement' ? null : l.fromLocationId;
          const to = t.kind === 'pick' || t.kind === 'count' ? null : l.toLocationId;
          return (
            <div key={i} className={cn('space-y-2 rounded-[18px] p-3', finished ? 'bg-ok-soft' : 'bg-card-muted')}>
              <div className="flex items-center gap-2">
                {finished ? <Check className="size-4 text-ok" /> : <span className="grid size-5 place-items-center rounded-full bg-card text-[11px] tabular-nums">{i + 1}</span>}
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{names[l.productId]}</span>
                <span className="text-sm tabular-nums">{num(l.qty, 3)} шт</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                {from !== null && <span className="rounded-full bg-card px-2.5 py-1 font-mono">{code(from)}</span>}
                {from !== null && to !== null && <ArrowRight className="size-3.5 text-muted" />}
                {to !== null && <span className="rounded-full bg-pill px-2.5 py-1 font-mono text-pill-ink">{code(to)}</span>}
                {l.shortage && <Pill tone="accent-outline">недостача</Pill>}
                {l.countedQty !== undefined && <span className="text-muted">насчитали {num(l.countedQty, 3)}</span>}
                {!!n(l.doneQty) && !l.countedQty && <span className="text-muted">сделано {num(l.doneQty, 3)}</span>}
              </div>
              {!finished && !closed && (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={cell[i] ?? ''} onChange={(e) => setCell({ ...cell, [i]: e.target.value })} className="h-9 min-w-32 flex-1 rounded-full bg-card px-3 text-[13px] ring-1 ring-line outline-none">
                    <option value="">{(t.kind === 'placement' ? l.toLocationId : l.fromLocationId) ? 'Ячейка по заданию' : 'Ячейка…'}</option>
                    {locs.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input inputMode="decimal" value={qty[i] ?? ''} onChange={(e) => setQty({ ...qty, [i]: e.target.value })} placeholder={t.kind === 'count' ? 'сколько есть' : 'кол-во'} className="h-9 w-24 rounded-full bg-card px-3 text-center text-sm ring-1 ring-line outline-none" />
                  <Button size="sm" variant="dark" loading={line.isPending && line.variables?.i === i && !line.variables.shortage} disabled={qty[i] === '' || qty[i] === undefined} onClick={() => line.mutate({ i })}>
                    <Check /> Готово
                  </Button>
                  {t.kind === 'pick' && (
                    <Button size="sm" variant="ghost" loading={line.isPending && line.variables?.i === i && !!line.variables.shortage} onClick={() => line.mutate({ i, shortage: true })}>
                      <AlertTriangle /> Нет в ячейке
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

function PickDialog({ open, warehouseId, onClose }: { open: boolean; warehouseId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const staff = useStaff({ limit: 200 });
  const [lines, setLines] = useState<{ p: PickedProduct; qty: string }[]>([]);
  const [who, setWho] = useState('');
  useEffect(() => {
    if (open) (setLines([]), setWho(''));
  }, [open]);
  const m = useMutation({
    mutationFn: () => salesApi.pickTask({ warehouseId, lines: lines.map((l) => ({ productId: l.p.id, qty: l.qty })), ...(who ? { assigneeId: who } : {}) }),
    onSuccess: (t) => (qc.invalidateQueries({ queryKey: ['wh-tasks'] }), onClose(), toast.success(`Задание ${t.number}: маршрут построен`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Задание на подбор" description="Маршрут по ячейкам построится сам" className="max-w-xl">
      <div className="mt-4 space-y-3">
        <ProductAddField onPick={(p) => setLines((ls) => (ls.some((l) => l.p.id === p.id) ? ls : [...ls, { p, qty: '1' }]))} />
        <div className="space-y-1">
          {lines.map((l, i) => (
            <div key={l.p.id} className="flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{l.p.name}</span>
              <input inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="h-8 w-16 rounded-xl bg-card px-2 text-center text-sm outline-none" />
              <Button size="icon-sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Убрать">
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <select className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Кто соберёт — любой свободный</option>
          {staff.data?.items
            .filter((s) => s.status === 'active')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <Button variant="dark" size="lg" className="w-full" disabled={!lines.length || lines.some((l) => !(n(l.qty) > 0))} loading={m.isPending} onClick={() => m.mutate()}>
          Создать
        </Button>
      </div>
    </Dialog>
  );
}
