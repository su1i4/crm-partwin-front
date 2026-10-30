import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Ban, Car, Check, ChevronLeft, ChevronRight, ClipboardList, Columns3, HandCoins, List, MessageCircle, PackageCheck, Phone, Plus, Search, ShoppingBag, Sparkles, Trash2, Truck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCustomerCard } from '@/entities/customer';
import { useRegisters, type Counterparty } from '@/entities/pos';
import { QualityBadge } from '@/entities/product';
import { useSuppliers } from '@/entities/purchasing';
import { REQUEST_FLOW, REQUEST_STATUS, requestApi, useKanban, useRequest, useRequests, useSuggest, type RequestInput, type RequestItem, type RequestStatus, type RequestView } from '@/entities/request';
import { useCan, useSession } from '@/entities/session';
import { CounterpartyPicker } from '@/features/customer-picker';
import { errorMessage } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';

const LIMIT = 50;
const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';

function ViewSwitch({ v }: { v: 'list' | 'board' }) {
  const nav = useNavigate();
  return (
    <Segmented
      value={v}
      onChange={(x) => nav(x === 'list' ? '/requests' : '/requests/board')}
      options={[
        { value: 'board', label: <span className="flex items-center gap-1.5"><Columns3 className="size-3.5" /> Канбан</span> },
        { value: 'list', label: <span className="flex items-center gap-1.5"><List className="size-3.5" /> Список</span> },
      ]}
    />
  );
}

const Due = ({ dueAt, overdue }: { dueAt: string | null; overdue: boolean }) =>
  dueAt ? (
    <span className={cn('text-xs whitespace-nowrap', overdue ? 'font-medium text-accent' : 'text-muted')}>
      {overdue && <AlertTriangle className="mr-0.5 inline size-3" />}
      {date(dueAt, 'D MMM, HH:mm')}
    </span>
  ) : null;

/** Заявки (ТЗ 13): список, просроченные первыми */
export function RequestsPage() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const storeId = useSession((s) => s.storeId);
  const { data, isLoading, error, refetch } = useRequests({ status: status || undefined, q: dq || undefined, page, limit: LIMIT, ...(storeId ? { storeId } : {}) });
  const nav = useNavigate();
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title="Заявки клиентов"
        sub="«Подобрать» или «привезти под заказ»: варианты по классам, предоплата, заказ поставщику или соседу, «ваша деталь пришла»"
        actions={
          <>
            <ViewSwitch v="list" />
            <Button variant="dark" onClick={() => nav('/requests/new')}>
              <Plus /> Заявка
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={status}
          onChange={(v) => set('status', v || undefined)}
          options={[
            { value: '', label: 'Все' },
            { value: 'new,selecting', label: 'В работе' },
            { value: 'offered', label: 'Предложено' },
            { value: 'ordered', label: 'Заказано' },
            { value: 'arrived', label: 'Привезли' },
            { value: 'issued,refused', label: 'Закрытые' },
          ]}
        />
        <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер, клиент, деталь" className="max-w-xs flex-1" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.items.map((r) => (
          <Link key={r.id} to={`/requests/${r.id}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 transition hover:ring-line-strong', r.overdue ? 'ring-accent-line' : 'ring-line')}>
            <span className="font-mono text-[13px] text-muted sm:w-24">{r.number}</span>
            <span className="order-first min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
              <span className="block truncate text-[14.5px] font-medium">{r.what ?? 'Без позиций'}</span>
              <span className="block truncate text-xs text-muted">
                {r.customerName ?? 'без клиента'}
                {r.vehicle && ` · ${r.vehicle}`}
                {r.kind === 'select' ? ' · подобрать' : ' · под заказ'}
              </span>
            </span>
            {Number(r.prepaid) > 0 && <Pill tone="ok">предоплата {money(r.prepaid)}</Pill>}
            <Due dueAt={r.dueAt} overdue={r.overdue} />
            <span className="text-xs text-faint">{ago(r.createdAt)}</span>
            <Pill tone={REQUEST_STATUS[r.status].tone} className="sm:w-28">
              {REQUEST_STATUS[r.status].label}
            </Pill>
          </Link>
        ))}
        {data && !data.items.length && (
          <Card>
            <EmptyState icon={<ClipboardList />} title="Заявок нет" hint="Клиент спросил то, чего нет? Запишите заявку — номер, фото, машину" />
          </Card>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="icon-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <span className="text-sm text-muted tabular-nums">
            {page} / {pages}
          </span>
          <Button size="icon-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Канбан заявок: перетаскивание меняет статус (только разрешённые переходы) */
export function RequestsBoardPage() {
  const storeId = useSession((s) => s.storeId);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const { data, isLoading, error, refetch } = useKanban({ q: dq || undefined, ...(storeId ? { storeId } : {}) });
  const qc = useQueryClient();
  const nav = useNavigate();
  const [drag, setDrag] = useState<{ id: string; from: RequestStatus; version: number } | null>(null);
  const [over, setOver] = useState<RequestStatus | null>(null);
  const move = useMutation({
    mutationFn: (x: { id: string; version: number; to: RequestStatus }) => requestApi.status(x.id, x.version, x.to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
    onError: (e) => (toast.error(errorMessage(e)), qc.invalidateQueries({ queryKey: ['requests'] })),
  });
  const cols = (data?.columns ?? []).filter((c) => c.status !== 'refused' || c.items.length);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Заявки"
        sub={data ? `${num(data.total)} в работе · перетащите карточку, чтобы сменить статус. Выдача — с кассы` : ' '}
        actions={
          <>
            <ViewSwitch v="board" />
            <Button variant="dark" onClick={() => nav('/requests/new')}>
              <Plus /> Заявка
            </Button>
          </>
        }
      />
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер, клиент, деталь" className="max-w-sm" />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-96 rounded-[24px]" />}
      <div className="scroll-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {cols.map((c) => (
          <div
            key={c.status}
            onDragOver={(e) => (e.preventDefault(), setOver(c.status))}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              setOver(null);
              if (drag && drag.from !== c.status) move.mutate({ id: drag.id, version: drag.version, to: c.status });
              setDrag(null);
            }}
            className={cn('flex w-72 shrink-0 flex-col rounded-[24px] bg-card-muted p-2 transition', over === c.status && 'ring-2 ring-accent')}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="flex items-center gap-2 text-[13.5px] font-medium">
                <span className={cn('size-2 rounded-full', c.status === 'new' ? 'bg-accent' : c.status === 'arrived' ? 'bg-ok' : c.status === 'ordered' ? 'bg-ink' : 'bg-line-strong')} />
                {REQUEST_STATUS[c.status].label}
              </span>
              <span className="text-xs text-muted tabular-nums">{c.items.length}</span>
            </div>
            <div className="scroll-thin flex max-h-[calc(100dvh-320px)] min-h-24 flex-col gap-1.5 overflow-y-auto">
              {c.items.map((r) => (
                <Link
                  key={r.id}
                  to={`/requests/${r.id}`}
                  draggable
                  onDragStart={() => setDrag({ id: r.id, from: c.status, version: r.version })}
                  className={cn('block cursor-grab rounded-[18px] bg-card p-3 shadow-card ring-1 active:cursor-grabbing', r.overdue ? 'ring-accent' : 'ring-transparent')}
                >
                  <div className="flex items-center justify-between text-[11.5px] text-muted">
                    <span className="font-mono">{r.number}</span>
                    <Due dueAt={r.dueAt} overdue={r.overdue} />
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13.5px] font-medium">{r.what ?? 'Без позиций'}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                    <UserRound className="size-3" /> <span className="truncate">{r.customerName ?? '—'}</span>
                  </div>
                  {r.vehicle && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <Car className="size-3" /> <span className="truncate">{r.vehicle}</span>
                    </div>
                  )}
                  {Number(r.prepaid) > 0 && (
                    <Pill tone="ok" className="mt-2 h-5">
                      предоплата {money(r.prepaid)}
                    </Pill>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Заявка ──────────────────────────────────────────────

type ItemForm = { key: string; id?: string; number: string; name: string; qty: string };

function OfferDialog({ r, item, onClose }: { r: RequestView; item: RequestItem | null; onClose: () => void }) {
  const sug = useSuggest(r.id, !!item);
  const qc = useQueryClient();
  const s = sug.data?.find((x) => x.itemId === item?.id);
  const [picked, setPicked] = useState<{ key: string; name: string; brand: string | null; qualityClass: string | null; price: string; productId?: string; supplierId?: string; purchasePrice?: string | null; leadDays?: number | null; inStock: boolean }[]>([]);
  useEffect(() => {
    if (item) setPicked(item.offers.map((o) => ({ key: o.id, name: o.name, brand: o.brand ?? null, qualityClass: o.qualityClass ?? null, price: o.price, productId: o.productId ?? undefined, supplierId: o.supplierId ?? undefined, purchasePrice: o.purchasePrice, leadDays: o.leadDays, inStock: !!o.inStock })));
  }, [item]);
  const save = useMutation({
    mutationFn: () =>
      requestApi.offer(
        r.id,
        r.version,
        item!.id,
        picked.map(({ key, ...o }) => (void key, { ...o, price: String(Number(o.price) || 0) })),
      ),
    onSuccess: (v) => (qc.setQueryData(['request', r.id], v), onClose(), toast.success('Варианты сохранены — можно отправить клиенту')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const has = (k: string) => picked.some((p) => p.key === k);
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()} title={`Варианты: ${item?.name ?? ''}`} description={item?.number ? `Номер ${item.number} — наличие в каталоге и в прайсах поставщиков` : 'Без номера — добавьте варианты вручную'} className="max-w-4xl">
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="scroll-thin max-h-[55vh] space-y-3 overflow-y-auto">
          {sug.isLoading && <Skeleton className="h-40" />}
          {s && (
            <>
              <div className="text-xs font-medium tracking-wide text-muted uppercase">В каталоге</div>
              {s.catalog.map((c) => (
                <button
                  key={c.productId}
                  disabled={has(c.productId)}
                  onClick={() => setPicked((x) => [...x, { key: c.productId, name: c.name, brand: c.brand, qualityClass: c.qualityClass, price: '', productId: c.productId, inStock: Number(c.stock) > 0 }])}
                  className="flex w-full items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2 text-left text-[13px] disabled:opacity-40"
                >
                  <QualityBadge value={c.qualityClass as never} />
                  <span className="min-w-0 flex-1 truncate">
                    {c.name} <span className="text-muted">{c.brand}</span>
                  </span>
                  <Pill tone={Number(c.stock) > 0 ? 'ok' : 'muted'}>{Number(c.stock) > 0 ? `${num(c.stock)} шт` : 'нет'}</Pill>
                </button>
              ))}
              {!s.catalog.length && <div className="text-sm text-muted">Нет в каталоге</div>}
              <div className="pt-2 text-xs font-medium tracking-wide text-muted uppercase">У поставщиков и соседей</div>
              {s.suppliers.map((o) => (
                <button
                  key={o.id}
                  disabled={has(o.id)}
                  onClick={() => setPicked((x) => [...x, { key: o.id, name: o.name ?? item!.name, brand: o.brand, qualityClass: null, price: o.priceKgs ? String(Math.ceil((Number(o.priceKgs) * 1.35) / 10) * 10) : '', supplierId: o.supplierId, purchasePrice: o.priceKgs ?? null, leadDays: o.leadDays, inStock: false }])}
                  className="flex w-full items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2 text-left text-[13px] disabled:opacity-40"
                >
                  <Truck className="size-3.5 text-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    {o.supplierName} · <span className="font-mono">{o.number}</span> {o.brand}
                  </span>
                  <span className="text-right text-xs">
                    <b className="tabular-nums">{o.priceKgs ? money(o.priceKgs) : '—'}</b>
                    <span className="block text-muted">{o.leadDays != null ? `${o.leadDays} дн` : ''}</span>
                  </span>
                </button>
              ))}
              {!s.suppliers.length && <div className="text-sm text-muted">В прайсах не найдено</div>}
            </>
          )}
          <button onClick={() => setPicked((x) => [...x, { key: crypto.randomUUID(), name: item?.name ?? '', brand: null, qualityClass: 'aftermarket', price: '', inStock: false }])} className="flex h-9 w-full items-center justify-center gap-1 rounded-full text-[13px] text-muted ring-1 ring-line ring-dashed hover:text-ink">
            <Plus className="size-3.5" /> Вариант вручную
          </button>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-muted uppercase">Предложить клиенту · {picked.length}</div>
          {picked.map((p, i) => (
            <div key={p.key} className="space-y-1.5 rounded-[16px] bg-card p-3 ring-1 ring-line">
              <div className="flex gap-1.5">
                <Input value={p.name} onChange={(e) => setPicked((x) => x.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} className="h-9 flex-1 text-[13px]" />
                <button onClick={() => setPicked((x) => x.filter((_, k) => k !== i))} className="grid size-9 place-items-center text-muted hover:text-accent" aria-label="Убрать">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select value={p.qualityClass ?? ''} onChange={(e) => setPicked((x) => x.map((y, k) => (k === i ? { ...y, qualityClass: e.target.value || null } : y)))} className="h-9 rounded-full bg-card-muted px-3 text-[12.5px] outline-none">
                  <option value="original">Оригинал</option>
                  <option value="oem">OEM</option>
                  <option value="aftermarket">Аналог</option>
                  <option value="copy">Копия</option>
                  <option value="used">Б/у</option>
                </select>
                <span className="flex-1 text-xs text-muted">
                  {p.inStock ? 'в наличии' : p.leadDays != null ? `привезём за ${p.leadDays} дн` : ''}
                  {p.purchasePrice && ` · закуп ${money(p.purchasePrice)}`}
                </span>
                <input value={p.price} inputMode="decimal" placeholder="цена" onChange={(e) => setPicked((x) => x.map((y, k) => (k === i ? { ...y, price: e.target.value.replace(/[^\d.]/g, '') } : y)))} className="h-9 w-24 rounded-xl bg-card-muted px-2 text-right font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink" />
              </div>
            </div>
          ))}
          {!picked.length && <div className="rounded-[16px] bg-card-muted px-4 py-6 text-center text-sm text-muted">Выберите варианты слева — «лестница» по классам: оригинал, OEM, аналог</div>}
          <Button variant="dark" className="w-full" disabled={!picked.length || picked.some((p) => !Number(p.price))} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить варианты
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Заявка: позиции, варианты, выбор клиента, заказ, предоплата, выдача */
export function RequestPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const storeId = useSession((s) => s.storeId);
  const { data: r, isLoading, error, refetch } = useRequest(isNew ? null : id);
  const presetCustomer = useCustomerCard(isNew ? sp.get('customer') : null);
  const regs = useRegisters(storeId);
  const sup = useSuppliers('');
  const nb = useSuppliers('', 'neighbor');
  const [head, setHead] = useState({ kind: 'order' as 'order' | 'select', customerId: '', customerName: '', customerPhone: '', customerVehicleId: '', vehicleText: '', dueAt: '', comment: '' });
  const [items, setItems] = useState<ItemForm[]>([{ key: crypto.randomUUID(), number: '', name: '', qty: '1' }]);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(false);
  const [offerItem, setOfferItem] = useState<RequestItem | null>(null);
  const [orderDlg, setOrderDlg] = useState<{ kind: 'supplier' | 'neighbor'; sourceId: string; purchasePrice: string; dueAt: string; itemIds: string[] } | null>(null);
  const [prepay, setPrepay] = useState<{ amount: string; method: 'cash' | 'card' | 'transfer' } | null>(null);
  const [refuse, setRefuse] = useState<{ reason: string; refund: 'money' | 'advance' } | null>(null);
  const [issue, setIssue] = useState<{ method: 'cash' | 'card' | 'transfer' } | null>(null);
  const customer = useCustomerCard(head.customerId || null);
  useEffect(() => {
    if (r) {
      setHead({ kind: r.kind, customerId: r.customerId ?? '', customerName: r.customer?.name ?? r.customerName ?? '', customerPhone: r.customer?.phone ?? r.customerPhone ?? '', customerVehicleId: r.customerVehicleId ?? '', vehicleText: r.vehicleText ?? '', dueAt: r.dueAt ? r.dueAt.slice(0, 16) : '', comment: r.comment ?? '' });
      setItems(r.items.map((i) => ({ key: i.id, id: i.id, number: i.number ?? '', name: i.name, qty: String(Number(i.qty)) })));
      setDirty(false);
    }
  }, [r]);
  useEffect(() => {
    if (presetCustomer.data) setHead((h) => ({ ...h, customerId: presetCustomer.data!.id, customerName: presetCustomer.data!.name, customerPhone: presetCustomer.data!.phone ?? '' }));
  }, [presetCustomer.data]);
  const editable = isNew || (r && !['issued', 'refused'].includes(r.status));
  const body = (): RequestInput => ({
    kind: head.kind,
    ...(storeId && isNew ? { storeId } : {}),
    customerId: head.customerId || null,
    customerName: head.customerId ? null : head.customerName || null,
    customerPhone: head.customerId ? null : head.customerPhone || null,
    customerVehicleId: head.customerVehicleId || null,
    vehicleText: head.customerVehicleId ? null : head.vehicleText || null,
    dueAt: head.dueAt ? new Date(head.dueAt).toISOString() : null,
    comment: head.comment || null,
    items: items.filter((i) => i.name.trim() || i.number.trim()).map((i) => ({ ...(i.id ? { id: i.id } : {}), number: i.number.trim() || null, name: i.name.trim() || i.number.trim(), qty: String(Number(i.qty) || 1) })),
  });
  const done = (v: RequestView, msg?: string) => {
    qc.setQueryData(['request', v.id], v);
    qc.invalidateQueries({ queryKey: ['requests'] });
    if (msg) toast.success(msg);
  };
  const save = useMutation({
    mutationFn: () => (isNew ? requestApi.create(body()) : requestApi.update(id!, { ...body(), version: r!.version })),
    onSuccess: (v) => {
      done(v, 'Сохранено');
      setDirty(false);
      if (isNew) nav(`/requests/${v.id}`, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = useMutation({ mutationFn: (s: RequestStatus) => requestApi.status(id!, r!.version, s), onSuccess: (v) => done(v, v.statusLabel), onError: (e) => toast.error(errorMessage(e)) });
  const choose = useMutation({
    mutationFn: (x: { itemId: string; offerId: string }) => requestApi.choose(id!, { version: r!.version, ...x }),
    onSuccess: (v) => done(v, 'Клиент выбрал вариант'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const order = useMutation({
    mutationFn: () =>
      requestApi.order(id!, {
        version: r!.version,
        sourceKind: orderDlg!.kind,
        sourceId: orderDlg!.sourceId,
        ...(orderDlg!.itemIds.length ? { itemIds: orderDlg!.itemIds } : {}),
        ...(orderDlg!.purchasePrice ? { purchasePrice: orderDlg!.purchasePrice } : {}),
        ...(orderDlg!.dueAt ? { dueAt: new Date(orderDlg!.dueAt).toISOString() } : {}),
      }),
    onSuccess: (v) => (done(v, orderDlg!.kind === 'supplier' ? 'Добавлено в черновик заказа поставщику' : 'Записано: берём у соседа'), setOrderDlg(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pay = useMutation({
    mutationFn: () => requestApi.prepay(id!, { version: r!.version, amount: prepay!.amount, method: prepay!.method, ...(regs.data?.[0] ? { registerId: regs.data[0].id } : {}) }),
    onSuccess: (v) => (done(v, 'Предоплата принята'), setPrepay(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ref = useMutation({
    mutationFn: () => requestApi.refuse(id!, { version: r!.version, reason: refuse!.reason, ...(Number(r!.prepaid) > 0 ? { refund: refuse!.refund, ...(regs.data?.[0] ? { registerId: regs.data[0].id } : {}) } : {}) }),
    onSuccess: (v) => (done(v, 'Отказ записан'), setRefuse(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const due = r ? r.items.reduce((a, i) => a + Number(i.salePrice ?? 0) * Number(i.qty), 0) - Number(r.prepaid) : 0;
  const iss = useMutation({
    mutationFn: () => requestApi.issue(id!, { version: r!.version, registerId: regs.data![0].id, ...(due > 0 ? { payments: [{ method: issue!.method, amount: String(due) }] } : {}) }),
    onSuccess: (x) => (done(x.request, `Выдано, чек ${x.receipt.number}`), setIssue(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const msg = useMutation({ mutationFn: () => requestApi.message(id!), onSuccess: (m) => window.open(m.whatsappUrl, '_blank'), onError: (e) => toast.error(errorMessage(e)) });
  const sources = useMemo(() => (orderDlg?.kind === 'neighbor' ? nb.data?.items : sup.data?.items) ?? [], [orderDlg?.kind, nb.data, sup.data]);
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!isNew && (isLoading || !r)) return <Skeleton className="h-96 rounded-[28px]" />;
  const st = r?.status;
  const setI = (key: string, p: Partial<ItemForm>) => (setItems((x) => x.map((i) => (i.key === key ? { ...i, ...p } : i))), setDirty(true));
  const pick = (c: Counterparty) => (setHead((h) => ({ ...h, customerId: c.id, customerName: c.name, customerPhone: c.phone ?? '', customerVehicleId: '' })), setDirty(true));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/requests/board" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[26px] leading-tight font-medium">
          {isNew ? 'Новая заявка' : <>Заявка <span className="font-mono text-muted">{r!.number}</span></>}
        </h1>
        {st && (
          <Pill tone={REQUEST_STATUS[st].tone} className="h-8 px-3">
            {REQUEST_STATUS[st].label}
          </Pill>
        )}
        {r?.overdue && <Pill tone="accent" className="h-8 px-3">просрочена</Pill>}
        {editable && (
          <Button disabled={!dirty && !isNew} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить
          </Button>
        )}
        {st === 'arrived' && (
          <Button onClick={() => msg.mutate()} loading={msg.isPending}>
            <MessageCircle /> «Деталь пришла»
          </Button>
        )}
        {st && ['offered', 'ordered', 'arrived'].includes(st) && can('pos.use') && (
          <Button variant="accent" disabled={!regs.data?.length} onClick={() => setIssue({ method: 'cash' })}>
            <PackageCheck /> Выдать
          </Button>
        )}
        {r && editable && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="dark">Статус</Button>
            </MenuTrigger>
            <MenuContent>
              {r.nextStatuses.filter((s) => s !== 'refused').map((s) => (
                <MenuItem key={s} onSelect={() => status.mutate(s)}>
                  <Check /> {REQUEST_STATUS[s].label}
                </MenuItem>
              ))}
              <MenuItem onSelect={() => setPrepay({ amount: '', method: 'cash' })}>
                <HandCoins /> Предоплата
              </MenuItem>
              <MenuItem onSelect={() => setOrderDlg({ kind: 'supplier', sourceId: '', purchasePrice: '', dueAt: '', itemIds: [] })}>
                <ShoppingBag /> Заказать у поставщика
              </MenuItem>
              <MenuItem onSelect={() => setOrderDlg({ kind: 'neighbor', sourceId: '', purchasePrice: '', dueAt: '', itemIds: [] })}>
                <Truck /> Взять у соседа
              </MenuItem>
              {r.nextStatuses.includes('refused') && (
                <MenuItem className="text-accent" onSelect={() => setRefuse({ reason: '', refund: 'money' })}>
                  <Ban /> Отказ
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        )}
      </div>

      {r && (
        <div className="flex gap-1">
          {REQUEST_FLOW.filter((s) => s !== 'refused').map((s, i, a) => {
            const cur = (a as RequestStatus[]).indexOf(r.status);
            return <div key={s} className={cn('h-1.5 flex-1 rounded-full', r.status === 'refused' ? 'bg-line' : i <= cur ? 'bg-accent' : 'bg-line')} title={REQUEST_STATUS[s].label} />;
          })}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={head.kind}
                onChange={(v) => (setHead({ ...head, kind: v }), setDirty(true))}
                options={[
                  { value: 'order', label: 'Привезти под заказ' },
                  { value: 'select', label: 'Подобрать' },
                ]}
              />
              <span className="flex-1" />
              {head.customerId ? (
                <span className="flex items-center gap-2 rounded-full bg-card-muted py-1 pr-1 pl-3 text-sm">
                  <Link to={`/customers/${head.customerId}`} className="font-medium hover:text-accent">
                    {head.customerName}
                  </Link>
                  {head.customerPhone && <span className="text-muted">{head.customerPhone}</span>}
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => setPicker(true)}>
                      сменить
                    </Button>
                  )}
                </span>
              ) : (
                editable && (
                  <Button size="sm" onClick={() => setPicker(true)}>
                    <UserRound /> Клиент из базы
                  </Button>
                )
              )}
            </div>
            {!head.customerId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Имя клиента">
                  <Input disabled={!editable} value={head.customerName} onChange={(e) => (setHead({ ...head, customerName: e.target.value }), setDirty(true))} placeholder="Азамат" />
                </Field>
                <Field label="Телефон">
                  <Input disabled={!editable} inputMode="tel" value={head.customerPhone} onChange={(e) => (setHead({ ...head, customerPhone: e.target.value }), setDirty(true))} placeholder="0555 123 456" />
                </Field>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              {customer.data?.vehicles.length ? (
                <Field label="Машина">
                  <select className={sel} disabled={!editable} value={head.customerVehicleId} onChange={(e) => (setHead({ ...head, customerVehicleId: e.target.value }), setDirty(true))}>
                    <option value="">Другая / не указана</option>
                    {customer.data.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} {v.plate ? `· ${v.plate}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Машина">
                  <Input disabled={!editable} value={head.vehicleText} onChange={(e) => (setHead({ ...head, vehicleText: e.target.value }), setDirty(true))} placeholder="Camry 40, 2009, 2AZ" />
                </Field>
              )}
              <Field label="Срок">
                <Input type="datetime-local" disabled={!editable} value={head.dueAt} onChange={(e) => (setHead({ ...head, dueAt: e.target.value }), setDirty(true))} />
              </Field>
            </div>
            <Field label="Комментарий">
              <Input disabled={!editable} value={head.comment} onChange={(e) => (setHead({ ...head, comment: e.target.value }), setDirty(true))} placeholder="Нужна до субботы, бюджет до 5000" />
            </Field>
          </Card>

          <Tray className="space-y-2 p-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[14px] font-medium">Что нужно</span>
              {editable && (
                <Button size="sm" variant="ghost" onClick={() => (setItems((x) => [...x, { key: crypto.randomUUID(), number: '', name: '', qty: '1' }]), setDirty(true))}>
                  <Plus /> Позиция
                </Button>
              )}
            </div>
            {items.map((f) => {
              const it = r?.items.find((x) => x.id === f.id);
              return (
                <div key={f.key} className="space-y-2 rounded-[18px] bg-card p-3">
                  <div className="flex flex-wrap gap-2">
                    <Input disabled={!editable} value={f.number} onChange={(e) => setI(f.key, { number: e.target.value })} placeholder="Номер детали" className="h-10 w-44 font-mono" />
                    <Input disabled={!editable} value={f.name} onChange={(e) => setI(f.key, { name: e.target.value })} placeholder="Колодки передние" className="h-10 min-w-48 flex-1" />
                    <Input disabled={!editable} value={f.qty} inputMode="numeric" onChange={(e) => setI(f.key, { qty: e.target.value.replace(/\D/g, '') })} className="h-10 w-16 text-center" />
                    {editable && !it?.offers.some((o) => o.chosen) && items.length > 1 && (
                      <button onClick={() => (setItems((x) => x.filter((y) => y.key !== f.key)), setDirty(true))} className="grid size-10 place-items-center text-muted hover:text-accent" aria-label="Убрать">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                  {it && (
                    <div className="space-y-1.5">
                      {it.offers.map((o) => (
                        <div key={o.id} className={cn('flex flex-wrap items-center gap-2 rounded-[14px] px-3 py-2 text-[13px]', o.chosen ? 'bg-accent-soft ring-1 ring-accent' : 'bg-card-muted')}>
                          {o.qualityClass && <QualityBadge value={o.qualityClass as never} />}
                          <span className="min-w-0 flex-1 truncate">
                            {o.name} {o.brand && <span className="text-muted">{o.brand}</span>}
                          </span>
                          <span className="text-xs text-muted">{o.inStock ? 'в наличии' : o.leadDays != null ? `${o.leadDays} дн` : ''}</span>
                          <b className="tabular-nums">{money(o.price)}</b>
                          {o.chosen ? (
                            <Pill tone="accent">выбрал</Pill>
                          ) : (
                            editable && (
                              <Button size="sm" variant="ghost" loading={choose.isPending && choose.variables?.offerId === o.id} onClick={() => choose.mutate({ itemId: it.id, offerId: o.id })}>
                                Выбрал
                              </Button>
                            )
                          )}
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {editable && (
                          <Button size="sm" variant={it.offers.length ? 'ghost' : 'dark'} onClick={() => setOfferItem(it)}>
                            <Sparkles /> {it.offers.length ? 'Изменить варианты' : 'Найти варианты'}
                          </Button>
                        )}
                        {it.sourceName && (
                          <span>
                            {it.sourceKind === 'neighbor' ? 'у соседа' : 'заказ'} {it.sourceName}
                            {it.purchaseOrderNumber && ` · ${it.purchaseOrderNumber}`}
                          </span>
                        )}
                        {it.arrivedAt && <Pill tone="ok">пришло {date(it.arrivedAt, 'D MMM')}</Pill>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {isNew && <div className="px-1 text-xs text-muted">После сохранения — подбор вариантов по номеру: каталог и прайсы поставщиков</div>}
          </Tray>
        </div>

        <div className="space-y-4">
          {r && (
            <div className="hatch space-y-2 rounded-[24px] bg-pill p-5 text-pill-ink">
              <div className="flex justify-between text-sm opacity-70">
                <span>Сумма выбранного</span>
                <span className="tabular-nums">{money(r.items.reduce((a, i) => a + Number(i.salePrice ?? 0) * Number(i.qty), 0))}</span>
              </div>
              <div className="flex justify-between text-sm opacity-70">
                <span>Предоплата</span>
                <span className="tabular-nums">{money(r.prepaid)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm opacity-70">К оплате при выдаче</span>
                <span className="text-[28px] font-semibold tabular-nums">{money(Math.max(0, due))}</span>
              </div>
            </div>
          )}
          {r?.customer?.phone && (
            <a href={`tel:${r.customer.phone}`} className="flex items-center gap-2 rounded-[18px] bg-card px-4 py-3 text-sm ring-1 ring-line">
              <Phone className="size-4 text-accent" /> {r.customer.phone}
            </a>
          )}
          {r?.refuseReason && <div className="rounded-[18px] bg-card-muted px-4 py-3 text-sm">Отказ: {r.refuseReason}</div>}
          {r && r.history.length > 0 && (
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">История</div>
              <div className="space-y-1.5 px-1">
                {r.history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <div key={i} className="flex gap-2 text-[12.5px]">
                      <span className="w-24 shrink-0 text-muted">{date(h.at, 'D MMM, HH:mm')}</span>
                      <span>
                        {REQUEST_STATUS[h.status as RequestStatus]?.label ?? h.status}
                        {h.note && <span className="text-muted"> — {h.note}</span>}
                      </span>
                    </div>
                  ))}
              </div>
            </Tray>
          )}
        </div>
      </div>

      <CounterpartyPicker open={picker} onOpenChange={setPicker} onPick={(c) => (pick(c), setPicker(false))} title="Клиент заявки" />
      {r && <OfferDialog r={r} item={offerItem} onClose={() => setOfferItem(null)} />}
      <Dialog open={!!orderDlg} onOpenChange={(v) => !v && setOrderDlg(null)} title={orderDlg?.kind === 'neighbor' ? 'Взять у соседа' : 'Заказать у поставщика'} description={orderDlg?.kind === 'supplier' ? 'Строки попадут в черновик заказа этому поставщику' : 'Долг соседу запишется при выдаче'}>
        {orderDlg && r && (
          <div className="mt-4 space-y-4">
            <Field label={orderDlg.kind === 'neighbor' ? 'Сосед' : 'Поставщик'}>
              <select className={sel} value={orderDlg.sourceId} onChange={(e) => setOrderDlg({ ...orderDlg, sourceId: e.target.value })}>
                <option value="">—</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {r.items.length > 1 && (
              <div className="space-y-1">
                {r.items.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={orderDlg.itemIds.includes(i.id)} onChange={(e) => setOrderDlg({ ...orderDlg, itemIds: e.target.checked ? [...orderDlg.itemIds, i.id] : orderDlg.itemIds.filter((x) => x !== i.id) })} className="size-4 accent-[var(--accent)]" />
                    {i.name}
                  </label>
                ))}
                <div className="text-xs text-muted">Ничего не отмечено — все позиции</div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Закупочная цена">
                <Input inputMode="decimal" value={orderDlg.purchasePrice} onChange={(e) => setOrderDlg({ ...orderDlg, purchasePrice: e.target.value.replace(/[^\d.]/g, '') })} />
              </Field>
              <Field label="Когда привезут">
                <Input type="datetime-local" value={orderDlg.dueAt} onChange={(e) => setOrderDlg({ ...orderDlg, dueAt: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!orderDlg.sourceId} loading={order.isPending} onClick={() => order.mutate()}>
                Заказать
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!prepay} onOpenChange={(v) => !v && setPrepay(null)} title="Предоплата" description="Засчитается при выдаче">
        {prepay && (
          <div className="mt-4 space-y-4">
            <Field label="Сумма">
              <Input autoFocus inputMode="decimal" value={prepay.amount} onChange={(e) => setPrepay({ ...prepay, amount: e.target.value.replace(/[^\d.]/g, '') })} className="text-lg font-semibold" />
            </Field>
            <Segmented
              value={prepay.method}
              onChange={(m) => setPrepay({ ...prepay, method: m })}
              options={[
                { value: 'cash', label: 'Наличные' },
                { value: 'card', label: 'Карта' },
                { value: 'transfer', label: 'Перевод' },
              ]}
            />
            <div className="flex justify-end">
              <Button variant="dark" disabled={!(Number(prepay.amount) > 0)} loading={pay.isPending} onClick={() => pay.mutate()}>
                Принять {Number(prepay.amount) > 0 && money(prepay.amount)}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!refuse} onOpenChange={(v) => !v && setRefuse(null)} title="Отказ от заявки" description="Заявка попадёт в отчёт «Что спрашивают, но нет»">
        {refuse && r && (
          <div className="mt-4 space-y-4">
            <Field label="Причина">
              <Input autoFocus value={refuse.reason} onChange={(e) => setRefuse({ ...refuse, reason: e.target.value })} placeholder="Клиент нашёл дешевле" />
            </Field>
            {Number(r.prepaid) > 0 && (
              <Field label={`Предоплата ${money(r.prepaid)}`}>
                <Segmented
                  value={refuse.refund}
                  onChange={(v) => setRefuse({ ...refuse, refund: v })}
                  options={[
                    { value: 'money', label: 'Вернуть деньгами' },
                    { value: 'advance', label: 'Оставить авансом' },
                  ]}
                />
              </Field>
            )}
            <div className="flex justify-end">
              <Button variant="dark" disabled={!refuse.reason.trim()} loading={ref.isPending} onClick={() => ref.mutate()}>
                Записать отказ
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!issue} onOpenChange={(v) => !v && setIssue(null)} title="Выдать клиенту" description="Создастся чек продажи; предоплата засчитается, для заказанного у поставщика — приёмка">
        {issue && r && (
          <div className="mt-4 space-y-4">
            <div className="flex items-baseline justify-between rounded-[18px] bg-card-muted px-4 py-3">
              <span className="text-sm text-muted">Доплатить</span>
              <span className="text-2xl font-semibold tabular-nums">{money(Math.max(0, due))}</span>
            </div>
            {due > 0 && (
              <Segmented
                value={issue.method}
                onChange={(m) => setIssue({ method: m })}
                options={[
                  { value: 'cash', label: 'Наличные' },
                  { value: 'card', label: 'Карта' },
                  { value: 'transfer', label: 'Перевод' },
                ]}
              />
            )}
            {r.items.some((i) => !i.salePrice) && <div className="text-xs text-warn">У части позиций не выбран вариант — они выдадутся без цены</div>}
            <div className="flex justify-end">
              <Button variant="accent" loading={iss.isPending} onClick={() => iss.mutate()}>
                <PackageCheck /> Выдать
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
