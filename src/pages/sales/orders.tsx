import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Ban, Banknote, MapPin, Package, Phone, Plus, Trash2, Truck, UserRound, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStaff } from '@/entities/admin';
import { useMoneyAccounts } from '@/entities/money';
import { useRegisters, type Counterparty } from '@/entities/pos';
import { DELIVERY_FLOW, DELIVERY_STATUS, ORDER_STATUS, salesApi, useOrder, useOrders, type DeliveryStatus, type Order, type OrderRow, type OrderStatus } from '@/entities/sales';
import { useCan, useSession } from '@/entities/session';
import { CounterpartyPicker } from '@/features/customer-picker';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const n = (v: string | number | null | undefined) => Number(v ?? 0);

function useDrivers() {
  const staff = useStaff({ limit: 200 });
  return useMemo(() => (staff.data?.items ?? []).filter((m) => m.status === 'active'), [staff.data]);
}

/** Касса для отгрузки/отчёта: по текущей точке, первая активная */
export function RegisterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const store = useSession((s) => s.storeId);
  const regs = useRegisters(store);
  const list = (regs.data ?? []).filter((r) => r.isActive);
  useEffect(() => {
    if (!value && list[0]) onChange(list[0].id);
  }, [value, list, onChange]);
  return (
    <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

// ── Список заказов ──────────────────────────────────────

const TABS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'reserved', label: 'В резерве' },
  { value: 'partially_shipped', label: 'Частично' },
  { value: 'shipped', label: 'Отгружены' },
  { value: 'cancelled', label: 'Отменены' },
];

/** Заказы покупателей (ТЗ 14.6): оптовики и СТО — цены фиксируются, товар в резерве, отгрузка частями */
export function OrdersPage() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') ?? '') as '' | OrderStatus;
  const { data, isLoading, error, refetch } = useOrders({ status: status || undefined });
  const can = useCan();
  const nav = useNavigate();
  const total = (data ?? []).filter((o) => o.status !== 'cancelled' && o.status !== 'shipped').reduce((a, o) => a + n(o.total), 0);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Заказы покупателей"
        sub={data ? `${data.length} заказов · в работе на ${money(total)}` : 'Резерв под клиента, предоплата, отгрузка частями, доставка'}
        actions={
          can('sales.orders') && (
            <Button variant="dark" onClick={() => nav('/sales/orders/new')}>
              <Plus /> Заказ
            </Button>
          )
        }
      />
      <Segmented value={status} onChange={(v) => setSp(v ? { status: v } : {}, { replace: true })} options={TABS} />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="space-y-1.5">
          {data.map((o) => (
            <OrderItem key={o.id} o={o} />
          ))}
          {!data.length && (
            <Card>
              <EmptyState icon={<Package />} title="Заказов нет" hint="Заказ — когда клиент берёт много и забирает позже или с доставкой" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function OrderItem({ o }: { o: OrderRow }) {
  const st = ORDER_STATUS[o.status];
  return (
    <Link to={`/sales/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line transition hover:ring-line-strong">
      <span className="w-28 font-mono text-[13px]">{o.number}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium">{o.customer}</span>
        <span className="block truncate text-xs text-muted">
          {o.phone ?? ''}
          {o.address && ` · ${o.address}`}
        </span>
      </span>
      {o.deliveryStatus && (
        <Pill tone="outline">
          <Truck className="size-3" /> {DELIVERY_STATUS[o.deliveryStatus]}
        </Pill>
      )}
      {o.dueOn && <span className="text-xs text-muted">к {date(o.dueOn, 'D MMM')}</span>}
      <Pill tone={st.tone}>{st.label}</Pill>
      <span className="w-28 text-right font-semibold tabular-nums">{money(o.total)}</span>
    </Link>
  );
}

// ── Новый заказ ─────────────────────────────────────────

type Draft = { product: PickedProduct; qty: string; price: string };

function NewOrder() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const drivers = useDrivers();
  const [cp, setCp] = useState<Counterparty | null>(null);
  const [picker, setPicker] = useState(false);
  const [lines, setLines] = useState<Draft[]>([]);
  const [f, setF] = useState({ reserve: true, dueOn: '', delivery: false, address: '', driverId: '', deliveryCost: '', comment: '' });
  const sum = lines.reduce((a, l) => a + n(l.qty) * n(l.price), 0);
  const create = useMutation({
    mutationFn: () =>
      salesApi.createOrder({
        counterpartyId: cp!.id,
        lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty, ...(l.price && n(l.price) !== n(l.product.price) ? { price: l.price } : {}) })),
        reserve: f.reserve,
        ...(f.dueOn ? { dueOn: f.dueOn } : {}),
        ...(f.delivery && f.address.trim() ? { address: f.address.trim() } : {}),
        ...(f.delivery && f.driverId ? { driverId: f.driverId } : {}),
        ...(f.delivery && f.deliveryCost ? { deliveryCost: f.deliveryCost } : {}),
        ...(f.comment.trim() ? { comment: f.comment.trim() } : {}),
      }),
    onSuccess: (o) => (qc.invalidateQueries({ queryKey: ['sales-orders'] }), toast.success(`Заказ ${o.number} создан`), nav(`/sales/orders/${o.id}`, { replace: true })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const add = (p: PickedProduct) =>
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: String(n(l.qty) + 1) } : l));
      return [...ls, { product: p, qty: '1', price: p.price != null ? String(p.price) : '' }];
    });
  return (
    <div className="space-y-6">
      <PageTitle title={<span className="flex items-center gap-3"><BackLink />Новый заказ</span>} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <ProductAddField onPick={add} placeholder="Номер, название или скан — добавить в заказ" />
          <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
            {lines.map((l, i) => (
              <div key={l.product.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 last:border-0">
                <span className="min-w-48 flex-1">
                  <span className="block truncate text-[14px] font-medium">{l.product.name}</span>
                  <span className="block text-xs text-muted">
                    {l.product.brandName} · {l.product.mainNumber ?? l.product.sku}
                  </span>
                </span>
                <input inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="h-9 w-16 rounded-xl bg-card-muted px-2 text-center text-sm tabular-nums outline-none" />
                <span className="text-xs text-muted">×</span>
                <input inputMode="decimal" value={l.price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="h-9 w-24 rounded-xl bg-card-muted px-2 text-right text-sm tabular-nums outline-none" />
                <span className="w-24 text-right font-medium tabular-nums">{money(n(l.qty) * n(l.price))}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Убрать">
                  <Trash2 />
                </Button>
              </div>
            ))}
            {!lines.length && <EmptyState icon={<Package />} title="Добавьте товары" hint="Цена фиксируется в момент заказа и не меняется при переоценке" />}
          </div>
        </div>
        <Card className="h-fit space-y-4 p-5">
          <Field label="Клиент">
            <button onClick={() => setPicker(true)} className="flex h-11 w-full items-center gap-2 rounded-full bg-card-muted px-4 text-left text-sm">
              <UserRound className="size-4 text-muted" />
              <span className={cn('flex-1 truncate', !cp && 'text-muted')}>{cp?.name ?? 'Выбрать клиента'}</span>
            </button>
          </Field>
          <Switch checked={f.reserve} onChange={(v) => setF({ ...f, reserve: v })} label="Зарезервировать товар" />
          <Field label="Забрать к">
            <Input type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
          </Field>
          <Switch checked={f.delivery} onChange={(v) => setF({ ...f, delivery: v })} label="Доставка" />
          {f.delivery && (
            <div className="space-y-3 rounded-[18px] bg-card-muted p-3">
              <Input icon={<MapPin />} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Адрес" />
              <select className={sel} value={f.driverId} onChange={(e) => setF({ ...f, driverId: e.target.value })}>
                <option value="">Водитель — потом</option>
                {drivers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.position ? ` · ${m.position}` : ''}
                  </option>
                ))}
              </select>
              <Input inputMode="decimal" value={f.deliveryCost} onChange={(e) => setF({ ...f, deliveryCost: e.target.value })} placeholder="Стоимость доставки" />
            </div>
          )}
          <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Комментарий" />
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">Итого</span>
            <span className="text-2xl font-semibold tabular-nums">{money(sum + (f.delivery ? n(f.deliveryCost) : 0))}</span>
          </div>
          <Button variant="dark" size="lg" className="w-full" disabled={!cp || !lines.length || lines.some((l) => !(n(l.qty) > 0))} loading={create.isPending} onClick={() => create.mutate()}>
            Создать заказ
          </Button>
        </Card>
      </div>
      <CounterpartyPicker open={picker} onOpenChange={setPicker} onPick={(c) => (setCp(c), setPicker(false))} />
    </div>
  );
}

const BackLink = ({ to = '/sales/orders' }: { to?: string }) => (
  <Link to={to} className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink" aria-label="Назад">
    <ArrowLeft className="size-4" />
  </Link>
);

// ── Карточка заказа ─────────────────────────────────────

export function OrderPage() {
  const { id } = useParams();
  if (!id || id === 'new') return <NewOrder />;
  return <OrderView id={id} />;
}

function OrderView({ id }: { id: string }) {
  const { data: o, isLoading, error, refetch } = useOrder(id);
  const qc = useQueryClient();
  const can = useCan();
  const [dlg, setDlg] = useState<'ship' | 'prepay' | 'cancel' | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ lineId: string; price: string } | null>(null);
  const done = () => (qc.invalidateQueries({ queryKey: ['sales-order', id] }), qc.invalidateQueries({ queryKey: ['sales-orders'] }));
  const setPrice = useMutation({ mutationFn: () => salesApi.setLinePrice(id, priceEdit!.lineId, priceEdit!.price), onSuccess: () => (done(), setPriceEdit(null)), onError: (e) => toast.error(errorMessage(e)) });
  const delivery = useMutation({ mutationFn: (s: DeliveryStatus) => salesApi.delivery(id, { status: s }), onSuccess: done, onError: (e) => toast.error(errorMessage(e)) });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !o) return <Skeleton className="h-96 rounded-[28px]" />;
  const st = ORDER_STATUS[o.status];
  const open = o.status !== 'shipped' && o.status !== 'cancelled';
  const left = o.lines.reduce((a, l) => a + (n(l.qty) - n(l.shipped_qty)) * n(l.price), 0);
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <BackLink />
            Заказ {o.number}
          </span>
        }
        sub={`от ${date(o.createdAt, 'D MMM, HH:mm')}${o.dueOn ? ` · забрать к ${date(o.dueOn, 'D MMM')}` : ''}`}
        actions={
          open &&
          can('sales.orders') && (
            <>
              <Button variant="ghost" onClick={() => setDlg('cancel')}>
                <Ban /> Отменить
              </Button>
              <Button onClick={() => setDlg('prepay')}>
                <Wallet /> Предоплата
              </Button>
              <Button variant="dark" onClick={() => setDlg('ship')}>
                <Package /> Отгрузить
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
          {o.lines.map((l) => {
            const shipped = n(l.shipped_qty);
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-0">
                <Link to={`/products/${l.product_id}`} className="min-w-48 flex-1 truncate text-[14px] font-medium hover:text-accent">
                  {l.name}
                </Link>
                <span className="text-sm tabular-nums">
                  {num(l.qty, 3)} шт
                  {shipped > 0 && <span className={cn('ml-1 text-xs', shipped >= n(l.qty) ? 'text-ok' : 'text-warn')}>отгр. {num(shipped, 3)}</span>}
                </span>
                {priceEdit?.lineId === l.id ? (
                  <span className="flex items-center gap-1">
                    <input autoFocus inputMode="decimal" value={priceEdit.price} onChange={(e) => setPriceEdit({ ...priceEdit, price: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setPrice.mutate()} className="h-8 w-24 rounded-xl bg-card-muted px-2 text-right text-sm outline-none" />
                    <Button size="sm" variant="dark" loading={setPrice.isPending} onClick={() => setPrice.mutate()}>
                      OK
                    </Button>
                  </span>
                ) : (
                  <button disabled={!open || !can('sales.custom_price')} onClick={() => setPriceEdit({ lineId: l.id, price: String(n(l.price)) })} className="w-24 text-right text-sm tabular-nums enabled:hover:text-accent">
                    × {money(l.price)}
                  </button>
                )}
                <span className="w-28 text-right font-medium tabular-nums">{money(n(l.qty) * n(l.price))}</span>
              </div>
            );
          })}
        </div>
        <div className="space-y-3">
          <Card className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <Pill tone={st.tone}>{st.label}</Pill>
              <span className="text-2xl font-semibold tabular-nums">{money(o.total)}</span>
            </div>
            {n(o.prepaidRemaining) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Предоплата (остаток)</span>
                <span className="font-medium text-ok tabular-nums">{money(o.prepaidRemaining)}</span>
              </div>
            )}
            {open && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Не отгружено на</span>
                <span className="tabular-nums">{money(left)}</span>
              </div>
            )}
            {o.comment && <div className="rounded-[14px] bg-card-muted px-3 py-2 text-sm">{o.comment}</div>}
          </Card>
          {o.address && (
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                <Truck className="size-4 text-accent" /> Доставка
              </div>
              <div className="text-sm">{o.address}</div>
              {o.deliveryCost && <div className="text-xs text-muted">Стоимость: {money(o.deliveryCost)}</div>}
              <div className="flex flex-wrap gap-1">
                {DELIVERY_FLOW.map((s) => {
                  const idx = o.deliveryStatus ? DELIVERY_FLOW.indexOf(o.deliveryStatus) : -1;
                  const i = DELIVERY_FLOW.indexOf(s);
                  return (
                    <button
                      key={s}
                      disabled={i <= idx || delivery.isPending || !(can('deliveries.manage') || can('deliveries.own'))}
                      onClick={() => delivery.mutate(s)}
                      className={cn('h-8 rounded-full px-3 text-[12.5px] ring-1', i <= idx ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line enabled:hover:ring-ink')}
                    >
                      {DELIVERY_STATUS[s]}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
          <Tray className="p-3">
            <div className="px-1 pb-1 text-[13px] font-medium">История</div>
            {[...o.history].reverse().map((h, i) => (
              <div key={i} className="flex justify-between gap-2 px-1 py-1 text-[12.5px]">
                <span>
                  {ORDER_STATUS[h.status as OrderStatus]?.label ?? DELIVERY_STATUS[h.status as DeliveryStatus] ?? h.status}
                  {h.note && <span className="text-muted"> · {h.note}</span>}
                </span>
                <span className="text-muted">{date(h.at, 'DD.MM HH:mm')}</span>
              </div>
            ))}
          </Tray>
        </div>
      </div>
      <ShipDialog order={o} open={dlg === 'ship'} onClose={() => setDlg(null)} onDone={done} />
      <PrepayDialog order={o} open={dlg === 'prepay'} onClose={() => setDlg(null)} onDone={done} />
      <CancelDialog order={o} open={dlg === 'cancel'} onClose={() => setDlg(null)} onDone={done} />
    </div>
  );
}

function ShipDialog({ order, open, onClose, onDone }: { order: Order; open: boolean; onClose: () => void; onDone: () => void }) {
  const [reg, setReg] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [pay, setPay] = useState<'debt' | 'cash'>('debt');
  useEffect(() => {
    if (open) setQty(Object.fromEntries(order.lines.map((l) => [l.id, String(Math.max(0, n(l.qty) - n(l.shipped_qty)))])));
  }, [open, order]);
  const sum = order.lines.reduce((a, l) => a + n(qty[l.id]) * n(l.price), 0);
  const toPay = Math.max(0, sum - n(order.prepaidRemaining));
  const m = useMutation({
    mutationFn: () =>
      salesApi.ship(order.id, {
        registerId: reg,
        lines: order.lines.filter((l) => n(qty[l.id]) > 0).map((l) => ({ lineId: l.id, qty: qty[l.id] })),
        ...(pay === 'cash' && toPay > 0 ? { payments: [...(n(order.prepaidRemaining) > 0 ? [{ method: 'advance', amount: String(Math.min(sum, n(order.prepaidRemaining))) }] : []), { method: 'cash', amount: toPay.toFixed(2) }] } : {}),
      }),
    onSuccess: () => (onDone(), onClose(), toast.success('Отгружено — чек создан')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Отгрузка" description="Можно частями — укажите, сколько отдаёте сейчас" className="max-w-xl">
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          {order.lines.map((l) => {
            const max = n(l.qty) - n(l.shipped_qty);
            return (
              <div key={l.id} className={cn('flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2', max <= 0 && 'opacity-50')}>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{l.name}</span>
                <span className="text-xs text-muted">из {num(max, 3)}</span>
                <input disabled={max <= 0} inputMode="decimal" value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} className="h-8 w-16 rounded-xl bg-card px-2 text-center text-sm outline-none" />
              </div>
            );
          })}
        </div>
        <Field label="Касса">
          <RegisterSelect value={reg} onChange={setReg} />
        </Field>
        <Segmented
          value={pay}
          onChange={setPay}
          options={[
            { value: 'debt', label: 'Предоплата, остальное в долг' },
            { value: 'cash', label: 'Оплата наличными' },
          ]}
        />
        <div className="flex justify-between rounded-[16px] bg-card-muted px-4 py-3 text-sm">
          <span>Сумма отгрузки {money(sum)}</span>
          <b>{pay === 'cash' ? `к оплате ${money(toPay)}` : `в долг ${money(toPay)}`}</b>
        </div>
        <Button variant="dark" size="lg" className="w-full" disabled={!reg || sum <= 0} loading={m.isPending} onClick={() => m.mutate()}>
          Отгрузить
        </Button>
      </div>
    </Dialog>
  );
}

function PrepayDialog({ order, open, onClose, onDone }: { order: Order; open: boolean; onClose: () => void; onDone: () => void }) {
  const accs = useMoneyAccounts({});
  const list = (accs.data ?? []).filter((a) => a.isActive && ['cash', 'wallet', 'bank', 'acquiring'].includes(a.type));
  const [acc, setAcc] = useState('');
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (open) (setAmount(''), setAcc(''));
  }, [open]);
  const m = useMutation({ mutationFn: () => salesApi.prepay(order.id, { accountId: acc || list[0].id, amount: amount.replace(',', '.') }), onSuccess: () => (onDone(), onClose(), toast.success('Предоплата принята')), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Предоплата" description={`Заказ на ${money(order.total)}`}>
      <div className="mt-4 space-y-3">
        <Input autoFocus inputMode="decimal" icon={<Banknote />} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
        <select className={sel} value={acc} onChange={(e) => setAcc(e.target.value)}>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button variant="dark" size="lg" className="w-full" disabled={!(n(amount.replace(',', '.')) > 0) || !list.length} loading={m.isPending} onClick={() => m.mutate()}>
          Принять
        </Button>
      </div>
    </Dialog>
  );
}

function CancelDialog({ order, open, onClose, onDone }: { order: Order; open: boolean; onClose: () => void; onDone: () => void }) {
  const accs = useMoneyAccounts({});
  const [mode, setMode] = useState<'advance' | 'refund'>('advance');
  const [acc, setAcc] = useState('');
  const [reason, setReason] = useState('');
  const has = n(order.prepaidRemaining) > 0;
  const list = (accs.data ?? []).filter((a) => a.isActive && ['cash', 'wallet', 'bank'].includes(a.type));
  const m = useMutation({
    mutationFn: () => salesApi.cancel(order.id, { prepayment: mode, ...(mode === 'refund' ? { accountId: acc || list[0]?.id } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: () => (onDone(), onClose(), toast.success('Заказ отменён, резерв снят')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={`Отменить ${order.number}?`} description="Резерв снимется">
      <div className="mt-4 space-y-3">
        {has && (
          <>
            <div className="text-sm">Предоплата {money(order.prepaidRemaining)}:</div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'advance', label: 'Оставить авансом' },
                { value: 'refund', label: 'Вернуть деньги' },
              ]}
            />
            {mode === 'refund' && (
              <select className={sel} value={acc} onChange={(e) => setAcc(e.target.value)}>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    Вернуть из: {a.name}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" />
        <Button variant="accent" size="lg" className="w-full" loading={m.isPending} onClick={() => m.mutate()}>
          Отменить заказ
        </Button>
      </div>
    </Dialog>
  );
}

// ── Доставки ────────────────────────────────────────────

/** Доставки (ТЗ 14.8): доска по статусам, водитель двигает заказ, сдаёт выручку в кассу */
export function DeliveriesPage() {
  const can = useCan();
  const manage = can('deliveries.manage') || can('sales.orders');
  const [mineSel, setMine] = useState<boolean | null>(null);
  const mine = mineSel ?? !manage;
  const { data, isLoading, error, refetch } = useOrders({ mine });
  const drivers = useDrivers();
  const qc = useQueryClient();
  const [driver, setDriver] = useState('');
  const [handover, setHandover] = useState(false);
  const [paying, setPaying] = useState<OrderRow | null>(null);
  const rows = (data ?? []).filter((o) => o.address && o.status !== 'cancelled' && (!driver || o.driverId === driver));
  const move = useMutation({
    mutationFn: ({ id, s }: { id: string; s: DeliveryStatus }) => salesApi.delivery(id, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-orders'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const driverName = (id: string | null) => drivers.find((d) => d.id === id)?.name;
  const cols: (DeliveryStatus | 'none')[] = ['none', ...DELIVERY_FLOW];
  return (
    <div className="space-y-6">
      <PageTitle
        title="Доставки"
        sub="Собран → в пути → доставлен → оплачен. Деньги у водителя — в подотчёте, пока не сдаст в кассу"
        actions={
          <Button variant="dark" onClick={() => setHandover(true)}>
            <Banknote /> Сдать выручку
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {manage && (
          <select className="h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Все водители</option>
            {drivers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <Switch checked={mine} onChange={setMine} label="Только мои" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="scroll-thin -mx-1 grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-2">
          {cols.map((c) => {
            const items = rows.filter((o) => (c === 'none' ? !o.deliveryStatus && o.status !== 'shipped' : o.deliveryStatus === c));
            const next = c === 'none' ? 'assembled' : DELIVERY_FLOW[DELIVERY_FLOW.indexOf(c) + 1];
            return (
              <Tray key={c} className="p-2">
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <span className="text-[14px] font-medium">{c === 'none' ? 'Ждут сборки' : DELIVERY_STATUS[c]}</span>
                  <Pill tone="soft">{items.length}</Pill>
                </div>
                <div className="space-y-1.5">
                  {items.map((o) => (
                    <div key={o.id} className="space-y-1.5 rounded-[18px] bg-card p-3 shadow-card">
                      <Link to={`/sales/orders/${o.id}`} className="flex justify-between gap-2 hover:text-accent">
                        <span className="truncate text-[13.5px] font-medium">{o.customer}</span>
                        <span className="text-[13px] font-semibold tabular-nums">{money(o.total)}</span>
                      </Link>
                      <div className="flex items-start gap-1 text-xs text-muted">
                        <MapPin className="mt-0.5 size-3 shrink-0" /> {o.address}
                      </div>
                      {o.phone && (
                        <a href={`tel:${o.phone}`} className="flex items-center gap-1 text-xs text-ink-2">
                          <Phone className="size-3" /> {o.phone}
                        </a>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="truncate text-[11.5px] text-faint">{driverName(o.driverId) ?? 'водитель не назначен'}</span>
                        {next && (
                          <Button
                            size="sm"
                            variant={next === 'paid' ? 'accent' : 'soft'}
                            loading={move.isPending && move.variables?.id === o.id}
                            onClick={() => (next === 'paid' ? setPaying(o) : move.mutate({ id: o.id, s: next }))}
                          >
                            {DELIVERY_STATUS[next]} <ArrowRight />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Tray>
            );
          })}
        </div>
      )}
      <DeliveryPayDialog order={paying} onClose={() => setPaying(null)} />
      <HandoverDialog open={handover} onClose={() => setHandover(false)} drivers={manage ? drivers.map((d) => ({ id: d.id, name: d.name })) : []} />
    </div>
  );
}

function DeliveryPayDialog({ order, onClose }: { order: OrderRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [amount, setAmount] = useState('');
  useEffect(() => {
    if (order) (setAmount(String(n(order.total))), setMethod('cash'));
  }, [order]);
  const m = useMutation({
    mutationFn: () => salesApi.delivery(order!.id, { status: 'paid', payment: { method, amount: amount.replace(',', '.') } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['sales-orders'] }), onClose(), toast.success(method === 'cash' ? 'Деньги у водителя в подотчёте' : 'Перевод — на проверку')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()} title="Клиент оплатил" description={order ? `${order.number} · ${order.customer}` : ''}>
      <div className="mt-4 space-y-3">
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: 'cash', label: 'Наличные водителю' },
            { value: 'transfer', label: 'Перевод' },
          ]}
        />
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
        <Button variant="dark" size="lg" className="w-full" disabled={!(n(amount.replace(',', '.')) > 0)} loading={m.isPending} onClick={() => m.mutate()}>
          Оплачено
        </Button>
      </div>
    </Dialog>
  );
}

function HandoverDialog({ open, onClose, drivers }: { open: boolean; onClose: () => void; drivers: { id: string; name: string }[] }) {
  const accs = useMoneyAccounts({});
  const list = (accs.data ?? []).filter((a) => a.isActive && (a.type === 'cash' || a.type === 'safe'));
  const [to, setTo] = useState('');
  const [driver, setDriver] = useState('');
  const [amount, setAmount] = useState('');
  const m = useMutation({
    mutationFn: () => salesApi.handover({ toAccountId: to || list[0].id, ...(driver ? { driverId: driver } : {}), ...(amount.trim() ? { amount: amount.replace(',', '.') } : {}) }),
    onSuccess: (r) => (onClose(), toast.success(`Сдано ${money(r.amount)}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Сдать выручку" description="Наличные водителя из подотчёта — в кассу или сейф">
      <div className="mt-4 space-y-3">
        {drivers.length > 0 && (
          <select className={sel} value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Я сдаю</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <select className={sel} value={to} onChange={(e) => setTo(e.target.value)}>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              В: {a.name}
            </option>
          ))}
        </select>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма — пусто = всё" />
        <Button variant="dark" size="lg" className="w-full" disabled={!list.length} loading={m.isPending} onClick={() => m.mutate()}>
          Сдать
        </Button>
      </div>
    </Dialog>
  );
}
