import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Ban, Check, ChevronLeft, ChevronRight, Copy, FileDown, FileSpreadsheet, MessageCircle, MoreHorizontal, PackageCheck, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ORDER_STATUS, purchasingApi, saveBlob, useOrder, useOrders, useSuppliers, type OrderStatus, type OrderView } from '@/entities/purchasing';
import { useCan, useSession } from '@/entities/session';
import { openPdf } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductAddField } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';
import { OffersSearch } from './price-lists';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const CURRENCIES = ['KGS', 'USD', 'CNY', 'AED', 'RUB', 'KZT', 'EUR'];
const LIMIT = 50;
const FILTERS: { value: string; label: string }[] = [
  { value: 'open', label: 'В работе' },
  { value: 'draft', label: 'Черновики' },
  { value: 'done', label: 'Закрытые' },
  { value: 'all', label: 'Все' },
];
const FILTER_STATUS: Record<string, string | undefined> = { open: 'sent,confirmed,partially_received', draft: 'draft', done: 'received,closed,cancelled', all: undefined };

/** Заказы поставщикам (ТЗ 10.3) */
export function OrdersPage() {
  const [sp, setSp] = useSearchParams();
  const f = sp.get('f') ?? 'open';
  const supplierId = sp.get('supplier') ?? undefined;
  const page = Number(sp.get('page') ?? 1);
  const storeId = useSession((s) => s.storeId);
  const { data, isLoading, error, refetch } = useOrders({ status: FILTER_STATUS[f], supplierId, page, limit: LIMIT, ...(storeId ? { storeId } : {}) });
  const can = useCan();
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
        title="Заказы поставщикам"
        sub="Отправка в WhatsApp / Telegram, PDF и Excel; приёмка по заказу сверяет «ожидалось / пришло» и цену"
        actions={
          can('purchasing.orders') && (
            <>
              <Link to="/purchasing/auto-order">
                <Button>
                  <Sparkles /> Автозаказ
                </Button>
              </Link>
              <Button variant="dark" onClick={() => nav(`/purchasing/orders/new${supplierId ? `?supplier=${supplierId}` : ''}`)}>
                <Plus /> Заказ
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={f} onChange={(v) => set('f', v === 'open' ? undefined : v)} options={FILTERS} />
        {supplierId && (
          <button onClick={() => set('supplier')} className="inline-flex h-8 items-center gap-1 rounded-full bg-pill px-3 text-[13px] text-pill-ink">
            один поставщик <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.items.map((o) => (
          <Link key={o.id} to={`/purchasing/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line transition hover:ring-line-strong">
            <span className="font-mono text-[13px] text-muted sm:w-28">{o.number}</span>
            <span className="order-first min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
              <span className="block truncate text-[14.5px] font-medium">{o.supplierName}</span>
              <span className="block text-xs text-muted">
                {date(o.createdAt, 'D MMM')} · {o.linesCount} поз.
                {o.source === 'auto' && ' · автозаказ'}
                {o.source === 'request' && ' · под заявку'}
              </span>
            </span>
            {o.expectedAt && (
              <span className={cn('text-xs', o.overdue ? 'font-medium text-accent' : 'text-muted')}>
                {o.overdue && <AlertTriangle className="mr-1 inline size-3.5" />}
                ждём {date(o.expectedAt, 'D MMM')}
              </span>
            )}
            <span className="ml-auto text-right text-[14px] font-semibold tabular-nums sm:ml-0 sm:w-28">{money(o.totalAmount, o.currency)}</span>
            <Pill tone={ORDER_STATUS[o.status].tone} className="sm:w-32">
              {ORDER_STATUS[o.status].label}
            </Pill>
          </Link>
        ))}
        {data && !data.items.length && (
          <Card>
            <EmptyState title="Заказов нет" hint="Создайте заказ вручную или через автозаказ — он посчитает, что заканчивается" />
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

type L = { key: string; productId: string; productName: string; sku: string; number: string | null; unitId?: string; unitName: string; qty: string; price: string; note: string; receivedQty?: string; autoOrder?: Record<string, unknown> };
const toLines = (o: OrderView): L[] =>
  o.lines.map((l) => ({
    key: l.id,
    productId: l.productId,
    productName: l.productName,
    sku: l.sku,
    number: l.supplierCode ?? l.number,
    unitId: l.unitId,
    unitName: l.unitName,
    qty: String(Number(l.qty)),
    price: l.price != null ? String(Number(l.price)) : '',
    note: l.note ?? '',
    receivedQty: String(Number(l.receivedQty)),
    autoOrder: l.extra?.autoOrder,
  }));

function SendDialog({ order, open, onOpenChange, onSent }: { order: OrderView; open: boolean; onOpenChange: (v: boolean) => void; onSent: () => void }) {
  const [msg, setMsg] = useState<{ text: string; whatsappUrl: string; telegramUrl: string } | null>(null);
  useEffect(() => {
    if (open) purchasingApi.orderMessage(order.id).then(setMsg, (e) => toast.error(errorMessage(e)));
  }, [open, order.id]);
  const pdf = useMutation({ mutationFn: () => purchasingApi.orderPdf(order.id), onSuccess: openPdf, onError: (e) => toast.error(errorMessage(e)) });
  const xlsx = useMutation({ mutationFn: () => purchasingApi.orderXlsx(order.id), onSuccess: (b) => saveBlob(b, `${order.number}.xlsx`), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Отправить ${order.number}`} description={order.supplier?.name}>
      <div className="mt-4 space-y-3">
        <pre className="scroll-thin max-h-60 overflow-auto rounded-[18px] bg-card-muted p-4 font-sans text-[13px] whitespace-pre-wrap">{msg?.text ?? '…'}</pre>
        <div className="grid grid-cols-2 gap-2">
          <a href={msg?.whatsappUrl} target="_blank" rel="noreferrer" onClick={onSent}>
            <Button variant="dark" className="w-full" disabled={!msg}>
              <MessageCircle /> WhatsApp
            </Button>
          </a>
          <a href={msg?.telegramUrl} target="_blank" rel="noreferrer" onClick={onSent}>
            <Button className="w-full" disabled={!msg}>
              <Send /> Telegram
            </Button>
          </a>
          <Button onClick={() => msg && navigator.clipboard.writeText(msg.text).then(() => toast.success('Текст скопирован'))}>
            <Copy /> Копировать
          </Button>
          <div className="flex gap-2">
            <Button className="flex-1" loading={pdf.isPending} onClick={() => pdf.mutate()}>
              <FileDown /> PDF
            </Button>
            <Button className="flex-1" loading={xlsx.isPending} onClick={() => xlsx.mutate()}>
              <FileSpreadsheet /> Excel
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted">После отправки заказ перейдёт в «Отправлен», его товар появится в остатках как «ожидается».</div>
      </div>
    </Dialog>
  );
}

/** Заказ поставщику: строки, отправка, подтверждение, приёмка по заказу, история */
export function OrderPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const storeId = useSession((s) => s.storeId);
  const { data: o, isLoading, error, refetch } = useOrder(isNew ? null : id);
  const sup = useSuppliers('');
  const nb = useSuppliers('', 'neighbor');
  const whs = useWarehouses();
  const [head, setHead] = useState({ supplierId: sp.get('supplier') ?? '', warehouseId: '', currency: 'KGS', expectedAt: '', comment: '' });
  const [lines, setLines] = useState<L[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [offers, setOffers] = useState<string | null>(null);
  useEffect(() => {
    if (o) {
      setHead({ supplierId: o.supplierId, warehouseId: o.warehouseId ?? '', currency: o.currency, expectedAt: o.expectedAt ?? '', comment: o.comment ?? '' });
      setLines(toLines(o));
      setDirty(false);
    }
  }, [o]);
  const suppliers = [...(sup.data?.items ?? []), ...(nb.data?.items ?? [])];
  const editable = isNew || (o && ['draft', 'sent', 'confirmed'].includes(o.status));
  const draft = isNew || o?.status === 'draft';
  const total = useMemo(() => lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0), [lines]);
  const body = () => ({
    supplierId: head.supplierId,
    ...(storeId ? { storeId } : {}),
    warehouseId: head.warehouseId || null,
    ...(draft ? { currency: head.currency } : {}),
    expectedAt: head.expectedAt || null,
    comment: head.comment || null,
    lines: lines.map((l) => ({ productId: l.productId, ...(l.unitId ? { unitId: l.unitId } : {}), qty: String(Number(l.qty) || 0), price: l.price ? String(Number(l.price)) : null, note: l.note || null })),
  });
  const save = useMutation({
    mutationFn: async () => (isNew ? purchasingApi.createOrder(body()) : purchasingApi.updateOrder(id!, { ...body(), version: o!.version })),
    onSuccess: (v) => {
      qc.setQueryData(['purchase-order', v.id], v);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDirty(false);
      toast.success('Сохранено');
      if (isNew) nav(`/purchasing/orders/${v.id}`, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = useMutation({
    mutationFn: async (s: 'sent' | 'confirmed' | 'closed' | 'cancelled') => {
      let v = o!.version;
      if (dirty && editable) v = (await purchasingApi.updateOrder(id!, { ...body(), version: v })).version;
      return purchasingApi.orderStatus(id!, v, s);
    },
    onSuccess: (v) => (qc.setQueryData(['purchase-order', v.id], v), qc.invalidateQueries({ queryKey: ['purchase-orders'] }), toast.success(v.statusLabel)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const receive = useMutation({
    mutationFn: () => purchasingApi.orderReceiving(id!, head.warehouseId || physical(whs.data)[0]?.id),
    onSuccess: (d) => nav(`/documents/${d.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editable && head.supplierId) save.mutate();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!isNew && (isLoading || !o)) return <Skeleton className="h-96 rounded-[28px]" />;
  const st = o?.status as OrderStatus | undefined;
  const setL = (key: string, p: Partial<L>) => (setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l))), setDirty(true));
  const priceDiffs = o?.receivings.flatMap((r) => r.priceDiffs ?? []) ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/purchasing/orders" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[26px] leading-tight font-medium">
          {isNew ? 'Новый заказ' : <>Заказ <span className="text-muted">{o!.number}</span></>}
        </h1>
        {st && (
          <Pill tone={ORDER_STATUS[st].tone} className="h-8 px-3">
            {ORDER_STATUS[st].label}
          </Pill>
        )}
        {editable && (
          <Button disabled={!head.supplierId || (!dirty && !isNew)} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить
          </Button>
        )}
        {st === 'draft' && (
          <Button variant="accent" disabled={!lines.length} onClick={() => setSendOpen(true)}>
            <Send /> Отправить
          </Button>
        )}
        {st === 'sent' && (
          <Button variant="dark" loading={status.isPending} onClick={() => status.mutate('confirmed')}>
            <Check /> Поставщик подтвердил
          </Button>
        )}
        {st && ['sent', 'confirmed', 'partially_received'].includes(st) && can('stock.receive') && (
          <Button variant="accent" loading={receive.isPending} onClick={() => receive.mutate()}>
            <PackageCheck /> Принять
          </Button>
        )}
        {o && (
          <Menu>
            <MenuTrigger className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line outline-none" aria-label="Ещё">
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent>
            <MenuItem onSelect={() => setSendOpen(true)}>
              <MessageCircle /> Текст / PDF / Excel
            </MenuItem>
            {st && ['partially_received', 'sent', 'confirmed'].includes(st) && (
              <MenuItem onSelect={() => confirm('Закрыть заказ? Недопоставленное перестанет «ожидаться».') && status.mutate('closed')}>
                <Check /> Закрыть
              </MenuItem>
            )}
            {st && ['draft', 'sent', 'confirmed'].includes(st) && (
              <MenuItem className="text-accent" onSelect={() => confirm('Отменить заказ?') && status.mutate('cancelled')}>
                <Ban /> Отменить
              </MenuItem>
            )}
            </MenuContent>
          </Menu>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Поставщик">
              <select className={sel} disabled={!draft} value={head.supplierId} onChange={(e) => (setHead({ ...head, supplierId: e.target.value }), setDirty(true))}>
                <option value="">— выберите —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Склад приёмки">
              <select className={sel} disabled={!editable} value={head.warehouseId} onChange={(e) => (setHead({ ...head, warehouseId: e.target.value }), setDirty(true))}>
                <option value="">Основной</option>
                {physical(whs.data).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Валюта">
              <select className={sel} disabled={!draft} value={head.currency} onChange={(e) => (setHead({ ...head, currency: e.target.value }), setDirty(true))}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Ожидаем">
              <Input type="date" disabled={!editable} value={head.expectedAt} onChange={(e) => (setHead({ ...head, expectedAt: e.target.value }), setDirty(true))} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Комментарий для поставщика">
                <Input disabled={!editable} value={head.comment} onChange={(e) => (setHead({ ...head, comment: e.target.value }), setDirty(true))} placeholder="Срочно, до пятницы" />
              </Field>
            </div>
          </Card>

          {editable && (
            <ProductAddField
              autoFocus={isNew}
              placeholder="Скан / номер / название — добавить в заказ"
              onPick={(p) => {
                setLines((ls) => {
                  const ex = ls.find((l) => l.productId === p.id && (l.unitId ?? null) === (p.unitId ?? null));
                  if (ex) return ls.map((l) => (l === ex ? { ...l, qty: String(Number(l.qty) + 1) } : l));
                  return [...ls, { key: crypto.randomUUID(), productId: p.id, productName: p.name, sku: p.sku, number: p.mainNumber, unitId: p.unitId, unitName: p.baseUnit, qty: '1', price: '', note: '' }];
                });
                setDirty(true);
              }}
            />
          )}

          <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
            <table className="w-full min-w-[600px] text-[13.5px]">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="w-8 py-2.5 pl-4 font-normal">№</th>
                  <th className="px-2 font-normal">Товар</th>
                  <th className="w-24 px-1 font-normal">Кол-во</th>
                  <th className="w-24 px-1 font-normal">Цена</th>
                  <th className="w-24 px-1 text-right font-normal">Сумма</th>
                  {!draft && <th className="w-20 px-1 text-right font-normal">Принято</th>}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const recv = Number(l.receivedQty ?? 0);
                  const full = recv >= Number(l.qty) && recv > 0;
                  return (
                    <tr key={l.key} className="border-b border-line last:border-0">
                      <td className="py-2 pl-4 text-xs text-faint">{i + 1}</td>
                      <td className="px-2">
                        <div className="truncate font-medium">{l.productName}</div>
                        <div className="text-xs text-muted">
                          <span className="font-mono">{l.number ?? l.sku}</span>
                          {l.autoOrder && <Pill tone="soft" className="ml-1 h-4 px-1.5 text-[10px]">авто</Pill>}
                        </div>
                      </td>
                      <td className="px-2">
                        <div className="flex items-center gap-1">
                          <input disabled={!editable} value={l.qty} inputMode="decimal" onChange={(e) => setL(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })} className="h-9 w-14 rounded-xl bg-card-muted px-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-ink disabled:bg-transparent" />
                          <span className="text-xs text-muted">{l.unitName}</span>
                        </div>
                      </td>
                      <td className="px-2">
                        <input disabled={!editable} value={l.price} inputMode="decimal" placeholder="—" onChange={(e) => setL(l.key, { price: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })} className="h-9 w-22 rounded-xl bg-card-muted px-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-ink disabled:bg-transparent" />
                      </td>
                      <td className="px-1 text-right font-semibold whitespace-nowrap tabular-nums">{l.price ? money((Number(l.qty) || 0) * Number(l.price), head.currency) : '—'}</td>
                      {!draft && (
                        <td className={cn('px-1 text-right whitespace-nowrap tabular-nums', full ? 'text-ok' : recv > 0 ? 'text-warn' : 'text-muted')}>
                          {num(recv, 3)} / {num(l.qty, 3)}
                        </td>
                      )}
                      <td className="pr-2 text-right whitespace-nowrap">
                        <button onClick={() => setOffers(l.number ?? l.sku)} className="inline-grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted hover:text-ink" title="Цены в прайсах">
                          <FileSpreadsheet className="size-3.5" />
                        </button>
                        {editable && recv === 0 && (
                          <button onClick={() => (setLines((ls) => ls.filter((x) => x.key !== l.key)), setDirty(true))} className="inline-grid size-7 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent" aria-label="Удалить">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!lines.length && <EmptyState title="Строк нет" hint="Сканируйте или найдите товар — или соберите заказ автозаказом" />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hatch rounded-[24px] bg-pill p-5 text-pill-ink">
            <div className="flex justify-between text-sm opacity-70">
              <span>Позиций</span>
              <span>{lines.length}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm opacity-70">Сумма</span>
              <span className="text-[28px] font-semibold tabular-nums">{money(total, head.currency)}</span>
            </div>
            {lines.some((l) => !l.price) && <div className="mt-1 text-xs opacity-60">у части строк нет цены</div>}
          </div>
          {o && o.receivings.length > 0 && (
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">Приёмки по заказу</div>
              <div className="space-y-1">
                {o.receivings.map((r) => (
                  <Link key={r.id} to={`/documents/${r.id}`} className="flex items-center gap-2 rounded-[14px] bg-card px-3 py-2 text-[13px]">
                    <span className="font-mono text-muted">{r.number}</span>
                    <span className="flex-1 text-xs text-muted">{date(r.docDate, 'D MMM')}</span>
                    <Pill tone={r.status === 'posted' ? 'ok' : 'soft'} className="h-5">
                      {r.status === 'posted' ? 'проведена' : 'черновик'}
                    </Pill>
                  </Link>
                ))}
              </div>
              {priceDiffs.length > 0 && (
                <div className="mt-2 rounded-[14px] bg-warn-soft px-3 py-2 text-xs text-ink-2">
                  <AlertTriangle className="mr-1 inline size-3.5 text-warn" />
                  Цена в накладной отличается от заказа у {priceDiffs.length} поз.
                </div>
              )}
            </Tray>
          )}
          {o && o.history.length > 0 && (
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">История</div>
              <div className="space-y-1.5 px-1">
                {o.history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <div key={i} className="flex gap-2 text-[12.5px]">
                      <span className="w-24 shrink-0 text-muted">{date(h.at, 'D MMM, HH:mm')}</span>
                      <span>
                        {ORDER_STATUS[h.status as OrderStatus]?.label ?? h.status}
                        {h.note && <span className="text-muted"> — {h.note}</span>}
                      </span>
                    </div>
                  ))}
              </div>
            </Tray>
          )}
        </div>
      </div>
      {o && (
        <SendDialog
          order={o}
          open={sendOpen}
          onOpenChange={setSendOpen}
          onSent={() => {
            if (o.status === 'draft') status.mutate('sent');
            setSendOpen(false);
          }}
        />
      )}
      <Dialog open={!!offers} onOpenChange={(v) => !v && setOffers(null)} title="Цены в прайсах" className="max-w-3xl">
        <div className="mt-4">{offers && <OffersSearch initial={offers} compact />}</div>
      </Dialog>
    </div>
  );
}
