import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Check, FileBarChart, Handshake, Plus, ShieldCheck, Trash2, Undo2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Counterparty } from '@/entities/pos';
import { salesApi, useConsignees, useWarranties, useWarranty, useWarrantyReport, WARRANTY_DECISION, WARRANTY_STATUS, type Consignee, type WarrantyDecision, type WarrantyRow, type WarrantyStatus } from '@/entities/sales';
import { useCan, useSession } from '@/entities/session';
import { stockApi } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { CounterpartyPicker } from '@/features/customer-picker';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';
import { RegisterSelect } from './orders';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const n = (v: string | number | null | undefined) => Number(v ?? 0);

// ── Реализация ──────────────────────────────────────────

type Mode = 'give' | 'report' | 'return';
type QLine = { productId: string; name: string; qty: string; max?: number; price?: string };

/** Реализация (ТЗ 14.9): товар у реализатора на его складе; отчёт о проданном → долг; возврат непроданного */
export function ConsignmentPage() {
  const { data, isLoading, error, refetch } = useConsignees();
  const [dlg, setDlg] = useState<{ mode: Mode; c: Consignee | null } | null>(null);
  const totals = (data ?? []).reduce((a, c) => ({ cost: a.cost + n(c.cost), debt: a.debt + n(c.debt) }), { cost: 0, debt: 0 });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Реализация"
        sub={data?.length ? `${data.length} реализаторов · товар у них на ${money(totals.cost)} по себестоимости · долг ${money(totals.debt)}` : 'Отдаёте товар соседу или в точку на реализацию — он платит за проданное'}
        actions={
          <Button variant="dark" onClick={() => setDlg({ mode: 'give', c: null })}>
            <ArrowUpFromLine /> Передать товар
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="space-y-3 p-5">
              <Link to={`/customers/${c.id}`} className="flex items-center gap-2 text-[16px] font-medium hover:text-accent">
                <Handshake className="size-4 text-accent" /> {c.name}
              </Link>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Штук', num(c.qty, 0)],
                  ['Себест.', money(c.cost)],
                  ['Долг', money(c.debt)],
                ].map(([l, v], i) => (
                  <div key={l} className={cn('rounded-[14px] px-2 py-2', i === 2 && n(c.debt) > 0 ? 'bg-accent-soft' : 'bg-card-muted')}>
                    <div className="text-[11px] text-muted">{l}</div>
                    <div className="text-[13.5px] font-semibold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="accent" onClick={() => setDlg({ mode: 'report', c })}>
                  <FileBarChart /> Отчёт о продаже
                </Button>
                <Button size="sm" onClick={() => setDlg({ mode: 'give', c })}>
                  <ArrowUpFromLine /> Ещё
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDlg({ mode: 'return', c })}>
                  <Undo2 /> Возврат
                </Button>
              </div>
            </Card>
          ))}
          {!data.length && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <EmptyState icon={<Handshake />} title="Реализаторов пока нет" hint="Передайте товар — для контрагента создастся склад «у клиента»" />
            </Card>
          )}
        </div>
      )}
      <ConsignDialog state={dlg} onClose={() => setDlg(null)} />
    </div>
  );
}

const TITLE: Record<Mode, string> = { give: 'Передать на реализацию', report: 'Отчёт реализатора', return: 'Возврат непроданного' };

function ConsignDialog({ state, onClose }: { state: { mode: Mode; c: Consignee | null } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const store = useSession((s) => s.storeId);
  const whs = useWarehouses(store);
  const own = physical(whs.data);
  const [cp, setCp] = useState<{ id: string; name: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [wh, setWh] = useState('');
  const [reg, setReg] = useState('');
  const [lines, setLines] = useState<QLine[]>([]);
  const mode = state?.mode ?? 'give';
  const theirs = useQuery({
    queryKey: ['consignee-stock', state?.c?.warehouseId],
    queryFn: () => stockApi.balances({ warehouseId: state!.c!.warehouseId, onlyPositive: true, limit: 200 }),
    enabled: !!state?.c && mode !== 'give',
  });
  useEffect(() => {
    if (state) (setCp(state.c ? { id: state.c.id, name: state.c.name } : null), setLines([]));
  }, [state]);
  useEffect(() => {
    if (!wh && own[0]) setWh(own[0].id);
  }, [own, wh]);
  useEffect(() => {
    if (theirs.data && mode !== 'give') setLines(theirs.data.items.map((r) => ({ productId: r.productId, name: r.name, qty: '', max: n(r.qty), price: '' })));
  }, [theirs.data, mode]);
  const add = (p: PickedProduct) => setLines((ls) => (ls.some((l) => l.productId === p.id) ? ls : [...ls, { productId: p.id, name: p.name, qty: '1' }]));
  const filled = lines.filter((l) => n(l.qty) > 0);
  const m = useMutation({
    mutationFn: () => {
      const ls = filled.map((l) => ({ productId: l.productId, qty: l.qty }));
      if (mode === 'give') return salesApi.consign({ counterpartyId: cp!.id, warehouseId: wh, lines: ls });
      if (mode === 'return') return salesApi.consignReturn({ counterpartyId: cp!.id, warehouseId: wh, lines: ls });
      return salesApi.consignReport({ counterpartyId: cp!.id, registerId: reg, sold: filled.map((l) => ({ productId: l.productId, qty: l.qty, ...(l.price ? { price: l.price } : {}) })) });
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['consignees'] }), onClose(), toast.success(mode === 'report' ? 'Продажа проведена — долг реализатора вырос' : 'Проведено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()} title={TITLE[mode]} description={cp?.name ?? 'Выберите реализатора'} className="max-w-2xl">
      <div className="mt-4 space-y-3">
        {!state?.c && (
          <button onClick={() => setPicker(true)} className="flex h-11 w-full items-center gap-2 rounded-full bg-card-muted px-4 text-left text-sm">
            <UserRound className="size-4 text-muted" />
            <span className={cn('flex-1 truncate', !cp && 'text-muted')}>{cp?.name ?? 'Кому передаём'}</span>
          </button>
        )}
        {mode === 'report' ? (
          <Field label="Касса продажи">
            <RegisterSelect value={reg} onChange={setReg} />
          </Field>
        ) : (
          <Field label={mode === 'give' ? 'Со склада' : 'На склад'}>
            <select className={sel} value={wh} onChange={(e) => setWh(e.target.value)}>
              {own.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {mode === 'give' && <ProductAddField onPick={add} autoFocus={false} placeholder="Добавить товар" />}
        {theirs.isLoading && mode !== 'give' && <Skeleton className="h-24 rounded-[18px]" />}
        <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
          {lines.map((l, i) => (
            <div key={l.productId} className="flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{l.name}</span>
              {l.max !== undefined && <span className="text-xs text-muted">у него {num(l.max, 3)}</span>}
              <input inputMode="decimal" value={l.qty} placeholder="0" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="h-8 w-16 rounded-xl bg-card px-2 text-center text-sm outline-none" />
              {mode === 'report' && <input inputMode="decimal" value={l.price ?? ''} placeholder="цена" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="h-8 w-20 rounded-xl bg-card px-2 text-right text-sm outline-none" />}
              {mode === 'give' && (
                <Button size="icon-sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Убрать">
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {mode !== 'give' && theirs.data && !lines.length && <div className="text-sm text-muted">У реализатора нет товара</div>}
        </div>
        {mode === 'report' && <div className="text-xs text-muted">Цена пусто — по прайсу клиента. Проданное оформится чеком в долг реализатору</div>}
        <Button variant="dark" size="lg" className="w-full" disabled={!cp || !filled.length || filled.some((l) => l.max !== undefined && n(l.qty) > l.max) || (mode === 'report' ? !reg : !wh)} loading={m.isPending} onClick={() => m.mutate()}>
          {mode === 'give' ? 'Передать' : mode === 'return' ? 'Принять возврат' : 'Провести продажу'}
        </Button>
      </div>
      <CounterpartyPicker open={picker} onOpenChange={setPicker} title="Реализатор" onPick={(c: Counterparty) => (setCp({ id: c.id, name: c.name }), setPicker(false))} />
    </Dialog>
  );
}

// ── Гарантия ────────────────────────────────────────────

const W_TABS: { value: '' | WarrantyStatus; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'accepted', label: 'Приняты' },
  { value: 'checking', label: 'Проверка' },
  { value: 'sent_to_supplier', label: 'У поставщика' },
  { value: 'decided', label: 'Решены' },
];
const W_FLOW: WarrantyStatus[] = ['accepted', 'checking', 'sent_to_supplier'];

/** Гарантия (ТЗ 11.6): приём → проверка → поставщик → решение (замена / деньги / отказ) */
export function WarrantyPage() {
  const [status, setStatus] = useState<'' | WarrantyStatus>('');
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const { data, isLoading, error, refetch } = useWarranties({ status: status || undefined, limit: 100 });
  const [open, setOpen] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Гарантия"
        sub="Срок гарантии берётся из правил группы на момент продажи — «в гарантии» или «срок истёк» видно сразу"
        actions={
          <Button variant="dark" onClick={() => setCreate(true)}>
            <Plus /> Принять деталь
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'list', label: 'Обращения' },
            { value: 'report', label: 'По брендам' },
          ]}
        />
        {tab === 'list' && <Segmented size="sm" value={status} onChange={setStatus} options={W_TABS} />}
      </div>
      {tab === 'report' ? (
        <WarrantyReport />
      ) : (
        <>
          {error && <ErrorState error={error} onRetry={refetch} />}
          {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
          {data && (
            <div className="space-y-1.5">
              {data.items.map((w) => (
                <WarrantyItem key={w.id} w={w} onOpen={() => setOpen(w.id)} />
              ))}
              {!data.items.length && (
                <Card>
                  <EmptyState icon={<ShieldCheck />} title="Обращений нет" />
                </Card>
              )}
            </div>
          )}
        </>
      )}
      <WarrantyDialog id={open} onClose={() => setOpen(null)} />
      <WarrantyCreate open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function WarrantyItem({ w, onOpen }: { w: WarrantyRow; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 text-left ring-1 ring-line hover:ring-line-strong">
      <span className="w-24 font-mono text-[13px]">{w.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium">{w.productName}</span>
        <span className="block truncate text-xs text-muted">
          {[w.brandName, w.customerName, w.supplierName && `пост. ${w.supplierName}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      {!w.inWarranty && <Pill tone="accent-outline">срок истёк</Pill>}
      <Pill tone={w.status === 'decided' ? (w.decision === 'reject' ? 'muted' : 'ok') : 'warn'}>{w.status === 'decided' && w.decision ? WARRANTY_DECISION[w.decision] : WARRANTY_STATUS[w.status]}</Pill>
      <span className="w-24 text-right text-xs text-muted">{ago(w.createdAt)}</span>
    </button>
  );
}

function WarrantyReport() {
  const { data, isLoading } = useWarrantyReport();
  if (isLoading || !data) return <Skeleton className="h-48 rounded-[24px]" />;
  const table = (rows: { name: string; total: number; replaced: number; refunded: number; rejected: number; open: number }[], title: string) => (
    <Tray className="p-3">
      <div className="px-1 pb-2 text-[14px] font-medium">{title}</div>
      <div className="overflow-hidden rounded-[18px] bg-card">
        <div className="grid grid-cols-[1fr_repeat(5,64px)] gap-2 border-b border-line px-3 py-2 text-[11.5px] text-muted">
          <span />
          <span className="text-right">всего</span>
          <span className="text-right">замена</span>
          <span className="text-right">деньги</span>
          <span className="text-right">отказ</span>
          <span className="text-right">открыто</span>
        </div>
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[1fr_repeat(5,64px)] gap-2 border-b border-line px-3 py-2 text-[13px] tabular-nums last:border-0">
            <span className="truncate font-medium">{r.name}</span>
            <span className="text-right font-semibold">{r.total}</span>
            <span className="text-right">{r.replaced}</span>
            <span className="text-right">{r.refunded}</span>
            <span className="text-right">{r.rejected}</span>
            <span className="text-right text-warn">{r.open}</span>
          </div>
        ))}
        {!rows.length && <div className="px-3 py-4 text-sm text-muted">Нет данных</div>}
      </div>
    </Tray>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {table(data.byBrand.map((r) => ({ ...r, name: r.brand })), 'По брендам')}
      {table(data.bySupplier.map((r) => ({ ...r, name: r.supplier })), 'По поставщикам')}
    </div>
  );
}

function WarrantyDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: w } = useWarranty(id);
  const qc = useQueryClient();
  const can = useCan();
  const [decision, setDecision] = useState<WarrantyDecision | null>(null);
  const [reason, setReason] = useState('');
  const [reg, setReg] = useState('');
  useEffect(() => {
    if (id) (setDecision(null), setReason(''));
  }, [id]);
  const done = () => (qc.invalidateQueries({ queryKey: ['warranty'] }), qc.invalidateQueries({ queryKey: ['warranty-one', id] }), qc.invalidateQueries({ queryKey: ['warranty-report'] }));
  const st = useMutation({ mutationFn: (s: WarrantyStatus) => salesApi.warrantyStatus(w!.id, { version: w!.version, status: s }), onSuccess: done, onError: (e) => toast.error(errorMessage(e)) });
  const dec = useMutation({
    mutationFn: () => salesApi.decide(w!.id, { version: w!.version, decision: decision!, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(decision === 'refund' ? { registerId: reg } : {}) }),
    onSuccess: () => (done(), onClose(), toast.success('Решение сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()} title={w ? `Обращение ${w.number}` : '…'} description={w ? `${date(w.createdAt, 'D MMM YYYY')} · ${num(w.qty, 3)} шт · ${w.inWarranty ? 'в гарантии' : 'срок истёк'}` : ''} className="max-w-xl">
      {w && (
        <div className="mt-4 space-y-4">
          <div className="rounded-[16px] bg-card-muted px-4 py-3 text-[14px]">{w.complaint}</div>
          <Link to={`/products/${w.productId}`} className="block text-sm text-accent underline">
            Карточка товара
          </Link>
          <div className="flex flex-wrap gap-1">
            {W_FLOW.map((s, i) => {
              const cur = w.status === 'decided' ? 99 : W_FLOW.indexOf(w.status);
              return (
                <button key={s} disabled={i <= cur || st.isPending || !can('sales.warranty')} onClick={() => st.mutate(s)} className={cn('h-8 rounded-full px-3 text-[12.5px] ring-1', i <= cur ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line enabled:hover:ring-ink')}>
                  {i <= cur && <Check className="mr-1 inline size-3" />}
                  {WARRANTY_STATUS[s]}
                </button>
              );
            })}
          </div>
          {w.status === 'decided' ? (
            <div className="rounded-[16px] bg-ok-soft px-4 py-3 text-sm">
              Решение: <b>{w.decision && WARRANTY_DECISION[w.decision]}</b>
              {w.decisionReason && ` — ${w.decisionReason}`}
            </div>
          ) : (
            can('sales.warranty') && (
              <div className="space-y-3 rounded-[18px] ring-1 ring-line p-3">
                <div className="text-sm font-medium">Решение</div>
                <Segmented
                  value={decision ?? ''}
                  onChange={(v) => setDecision((v || null) as WarrantyDecision | null)}
                  options={[
                    { value: 'replace', label: 'Замена' },
                    { value: 'refund', label: 'Вернуть деньги' },
                    { value: 'reject', label: 'Отказ' },
                  ]}
                />
                {decision === 'refund' && <RegisterSelect value={reg} onChange={setReg} />}
                {decision && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={decision === 'reject' ? 'Причина отказа — обязательно' : 'Комментарий'} />}
                <Button variant="dark" className="w-full" disabled={!decision || (decision === 'reject' && !reason.trim()) || (decision === 'refund' && !reg)} loading={dec.isPending} onClick={() => dec.mutate()}>
                  Сохранить решение
                </Button>
              </div>
            )
          )}
          <div className="space-y-0.5">
            {[...w.history].reverse().map((h, i) => (
              <div key={i} className="flex justify-between text-[12.5px]">
                <span>
                  {WARRANTY_STATUS[h.status as WarrantyStatus] ?? h.status}
                  {h.note && <span className="text-muted"> · {h.note}</span>}
                </span>
                <span className="text-muted">{date(h.at, 'DD.MM HH:mm')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function WarrantyCreate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<PickedProduct | null>(null);
  const [cp, setCp] = useState<Counterparty | null>(null);
  const [picker, setPicker] = useState(false);
  const [qty, setQty] = useState('1');
  const [complaint, setComplaint] = useState('');
  useEffect(() => {
    if (open) (setP(null), setCp(null), setQty('1'), setComplaint(''));
  }, [open]);
  const m = useMutation({
    mutationFn: () => salesApi.createWarranty({ productId: p!.id, ...(cp ? { customerId: cp.id } : {}), qty, complaint: complaint.trim() }),
    onSuccess: (w) => (qc.invalidateQueries({ queryKey: ['warranty'] }), onClose(), toast.success(`Принято: ${w.number}${w.inWarranty ? '' : ' — срок гарантии истёк'}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Принять по гарантии" description="Быстрее — из чека в «Продажах»: там подставится дата продажи и срок">
      <div className="mt-4 space-y-3">
        {p ? (
          <div className="flex items-center gap-2 rounded-[16px] bg-card-muted px-3 py-2 text-sm">
            <span className="flex-1 truncate">{p.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setP(null)}>
              Другой
            </Button>
          </div>
        ) : (
          <ProductAddField onPick={setP} placeholder="Какая деталь" />
        )}
        <button onClick={() => setPicker(true)} className="flex h-11 w-full items-center gap-2 rounded-full bg-card-muted px-4 text-left text-sm">
          <UserRound className="size-4 text-muted" />
          <span className={cn('flex-1 truncate', !cp && 'text-muted')}>{cp?.name ?? 'Клиент (необязательно)'}</span>
        </button>
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Что не так: стучит, течёт, не подошло…" />
        </div>
        <Button variant="dark" size="lg" className="w-full" disabled={!p || !complaint.trim() || !(n(qty) > 0)} loading={m.isPending} onClick={() => m.mutate()}>
          <ArrowDownToLine /> Принять
        </Button>
      </div>
      <CounterpartyPicker open={picker} onOpenChange={setPicker} onPick={(c) => (setCp(c), setPicker(false))} />
    </Dialog>
  );
}
