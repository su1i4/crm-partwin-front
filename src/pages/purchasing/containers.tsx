import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Check, Container as ContainerIcon, FileUp, PackageCheck, PackagePlus, Plus, Trash2, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { moneyApi, useMoneyAccounts } from '@/entities/money';
import { CONTAINER_FLOW, CONTAINER_STATUS, purchasingApi, useContainer, useContainers, useSuppliers, type ContainerStatus } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductSelect } from '@/features/product-add';
import { errorMessage, uploadFile } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const DIST: Record<string, string> = { amount: 'по сумме', volume: 'по объёму', weight: 'по весу', manual: 'вручную' };
const CUR = ['USD', 'CNY', 'AED', 'KGS', 'EUR', 'RUB'];

function NewContainerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const sup = useSuppliers('');
  const whs = useWarehouses();
  const nav = useNavigate();
  const [f, setF] = useState({ supplierId: '', warehouseId: '', currency: 'USD', rate: '', expectedOn: '', distribution: 'amount', comment: '' });
  useEffect(() => {
    if (open && !f.warehouseId && whs.data) setF((x) => ({ ...x, warehouseId: physical(whs.data).find((w) => w.type === 'storage')?.id ?? physical(whs.data)[0]?.id ?? '' }));
  }, [open, whs.data, f.warehouseId]);
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.createContainer({
        supplierId: f.supplierId,
        warehouseId: f.warehouseId,
        currency: f.currency,
        distribution: f.distribution,
        ...(f.rate ? { rate: f.rate } : {}),
        ...(f.expectedOn ? { expectedOn: f.expectedOn } : {}),
        ...(f.comment ? { comment: f.comment } : {}),
      }),
    onSuccess: (c) => (onOpenChange(false), nav(`/purchasing/containers/${c.id}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Новый контейнер" description="Потом импортируйте инвойс и добавьте расходы: карго, таможня, доставка">
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Поставщик">
            <select className={sel} value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
              <option value="">—</option>
              {sup.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Склад">
            <select className={sel} value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })}>
              {physical(whs.data).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Валюта инвойса">
            <select className={sel} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {CUR.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Курс к сому" hint="Можно позже, до приёмки">
            <Input inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} placeholder="87.40" />
          </Field>
          <Field label="Ожидаем">
            <Input type="date" value={f.expectedOn} onChange={(e) => setF({ ...f, expectedOn: e.target.value })} />
          </Field>
          <Field label="Расходы распределять">
            <select className={sel} value={f.distribution} onChange={(e) => setF({ ...f, distribution: e.target.value })}>
              {Object.entries(DIST).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Комментарий">
          <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Урумчи → Дордой, 40 футов" />
        </Field>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.supplierId || !f.warehouseId} loading={create.isPending} onClick={() => create.mutate()}>
            Создать
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Контейнеры (ТЗ 10.6): инвойс → оплата → в пути → таможня → приёмка частями, расходы в себестоимость */
export function ContainersPage() {
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useContainers(status || undefined);
  const can = useCan();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Контейнеры"
        sub="Товар в пути виден в остатках как «ожидается». Карго и таможня ложатся в себестоимость каждой детали"
        actions={
          can('purchasing.containers') && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> Контейнер
            </Button>
          )
        }
      />
      <Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'Все' }, ...CONTAINER_FLOW.map((s) => ({ value: s, label: CONTAINER_STATUS[s] }))]} />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => {
          const step = CONTAINER_FLOW.indexOf(c.status);
          return (
            <Link key={c.id} to={`/purchasing/containers/${c.id}`} className="rounded-[24px] bg-card p-4 ring-1 ring-line transition hover:ring-line-strong">
              <div className="flex items-center gap-2">
                <ContainerIcon className="size-5 text-accent" />
                <span className="font-mono text-[14px] font-semibold">{c.number}</span>
                <Pill tone={c.status === 'received' ? 'ok' : c.status === 'draft' ? 'soft' : 'dark'} className="ml-auto">
                  {CONTAINER_STATUS[c.status]}
                </Pill>
              </div>
              <div className="mt-2 truncate text-[14px]">{c.supplier}</div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{c.expectedOn ? `ждём ${date(c.expectedOn, 'D MMM')}` : 'дата не задана'}</span>
                <span className="text-[14px] font-semibold text-ink tabular-nums">{money(c.total, c.currency)}</span>
              </div>
              <div className="mt-3 flex gap-1">
                {CONTAINER_FLOW.map((s, i) => (
                  <span key={s} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
      {data && !data.length && (
        <Card>
          <EmptyState icon={<ContainerIcon />} title="Контейнеров нет" hint="Для закупки контейнерами из Китая / ОАЭ: инвойс, предоплата, расходы, приёмка частями" />
        </Card>
      )}
      <NewContainerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

type Cols = { code: string; name: string; qty: string; price: string; volume: string; weight: string; skip: string };

function InvoiceDialog({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<File | null>(null);
  const [c, setC] = useState<Cols>({ code: '1', name: '2', qty: '3', price: '4', volume: '', weight: '', skip: '1' });
  const run = useMutation({
    mutationFn: async () => {
      const up = await uploadFile(f!, 'import', f!.name, { type: 'container', id });
      const n = (v: string) => (v ? Number(v) : undefined);
      return purchasingApi.containerInvoice(id, { fileId: up.id, skipRows: Number(c.skip) || 0, columns: { code: n(c.code), name: n(c.name), qty: Number(c.qty), price: Number(c.price), volume: n(c.volume), weight: n(c.weight) } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['container', id] });
      toast.success(`Строк: ${r.lines}; сопоставлено ${r.matchedByMemory + r.matchedByNumber}, без товара ${r.unmatched}`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const col = (k: keyof Cols, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input inputMode="numeric" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value.replace(/\D/g, '') })} />
    </Field>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Импорт инвойса" description="Excel / CSV. Укажите номера колонок (с 1). Сопоставление с товарами запоминается для поставщика">
      <div className="mt-4 space-y-4">
        <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => setF(e.target.files?.[0] ?? null)} />
        <button onClick={() => file.current?.click()} className="flex h-20 w-full items-center justify-center gap-2 rounded-[20px] text-sm text-muted ring-2 ring-line ring-dashed hover:text-ink">
          <FileUp className="size-5" /> {f ? f.name : 'Выбрать файл'}
        </button>
        <div className="grid grid-cols-3 gap-3">
          {col('code', 'Код')}
          {col('name', 'Название')}
          {col('qty', 'Кол-во *')}
          {col('price', 'Цена *')}
          {col('volume', 'Объём')}
          {col('weight', 'Вес')}
          {col('skip', 'Пропустить строк', 'Заголовок')}
        </div>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f || !c.qty || !c.price} loading={run.isPending} onClick={() => run.mutate()}>
            Импортировать
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Контейнер: статусы, курс и расходы, строки инвойса, сопоставление, приёмка */
export function ContainerPage() {
  const { id } = useParams();
  const { data: c, isLoading, error, refetch } = useContainer(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [inv, setInv] = useState(false);
  const [costs, setCosts] = useState<{ name: string; amount: string; currency: string }[]>([]);
  const [rate, setRate] = useState('');
  const [recv, setRecv] = useState<Record<string, { qty: string; damaged: string }> | null>(null);
  const [post, setPost] = useState(true);
  const [prepay, setPrepay] = useState<{ accountId: string; amount: string; comment: string } | null>(null);
  const accounts = useMoneyAccounts();
  const pay = useMutation({
    mutationFn: () => moneyApi.containerPrepay(id!, { accountId: prepay!.accountId, amount: prepay!.amount, ...(prepay!.comment ? { comment: prepay!.comment } : {}) }),
    onSuccess: () => (inval(), qc.invalidateQueries({ queryKey: ['money-accounts'] }), setPrepay(null), toast.success('Предоплата проведена')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  useEffect(() => {
    if (c) (setCosts(c.costs), setRate(c.rate ? String(Number(c.rate)) : ''));
  }, [c]);
  const inval = () => (qc.invalidateQueries({ queryKey: ['container', id] }), qc.invalidateQueries({ queryKey: ['containers'] }));
  const save = useMutation({
    mutationFn: () => purchasingApi.updateContainer(id!, { version: c!.version, costs: costs.filter((x) => x.name && Number(x.amount) > 0), ...(rate ? { rate } : {}) }),
    onSuccess: () => (inval(), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = useMutation({
    mutationFn: (s: 'paid' | 'in_transit' | 'customs') => purchasingApi.containerStatus(id!, s),
    onSuccess: inval,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const match = useMutation({
    mutationFn: (x: { lineId: string; productId: string }) => purchasingApi.containerMatch(id!, x.lineId, x.productId),
    onSuccess: inval,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mk = useMutation({
    mutationFn: () => purchasingApi.containerCreateProducts(id!),
    onSuccess: (r) => (inval(), toast.success(`Создано товаров: ${r.created}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const receive = useMutation({
    mutationFn: () =>
      purchasingApi.containerReceive(id!, {
        post,
        lines: Object.entries(recv ?? {})
          .filter(([, v]) => Number(v.qty) > 0 || Number(v.damaged) > 0)
          .map(([lineId, v]) => ({ lineId, qty: String(Number(v.qty) || 0), ...(Number(v.damaged) > 0 ? { damaged: String(Number(v.damaged)) } : {}) })),
      }),
    onSuccess: (r) => {
      inval();
      setRecv(null);
      toast.success('Приёмка создана');
      if (r.damaged.length) toast.warning(`Бой / пересорт: ${r.damaged.length} строк — оформите претензию поставщику`);
      nav(`/documents/${r.documentId}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !c) return <Skeleton className="h-96 rounded-[28px]" />;
  const step = CONTAINER_FLOW.indexOf(c.status);
  const next = CONTAINER_FLOW[step + 1] as ContainerStatus | undefined;
  const totalKgs = c.rate ? Number(c.total) * Number(c.rate) : null;
  const costsKgs = c.costs.reduce((a, x) => a + Number(x.amount) * (x.currency === 'KGS' ? 1 : x.currency === c.currency ? Number(c.rate ?? 0) : 0), 0);
  const left = c.lines.reduce((a, l) => a + Math.max(0, Number(l.qty) - Number(l.received_qty) - Number(l.damaged_qty)), 0);
  const dirty = JSON.stringify(costs) !== JSON.stringify(c.costs) || rate !== (c.rate ? String(Number(c.rate)) : '');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/purchasing/containers" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-medium">
            Контейнер <span className="font-mono text-muted">{c.number}</span>
          </h1>
          <div className="text-sm text-muted">
            {c.comment ?? 'без комментария'}
            {c.expectedOn && ` · ждём ${date(c.expectedOn, 'D MMM YYYY')}`}
          </div>
        </div>
        {c.status !== 'received' && (
          <Button onClick={() => setPrepay({ accountId: accounts.data?.find((a) => a.currency === c.currency)?.id ?? accounts.data?.[0]?.id ?? '', amount: '', comment: '' })}>
            <Wallet /> Предоплата
          </Button>
        )}
        {c.status !== 'received' && (
          <Button onClick={() => setInv(true)}>
            <FileUp /> Инвойс
          </Button>
        )}
        {next && next !== 'received' && (
          <Button variant="dark" loading={status.isPending} onClick={() => status.mutate(next as 'paid' | 'in_transit' | 'customs')}>
            <Check /> {CONTAINER_STATUS[next]}
          </Button>
        )}
        {c.status !== 'received' && left > 0 && (
          <Button variant="accent" disabled={c.unmatched > 0} title={c.unmatched > 0 ? "Сначала сопоставьте все строки" : undefined} onClick={() => setRecv(Object.fromEntries(c.lines.map((l) => [l.id, { qty: String(Math.max(0, Number(l.qty) - Number(l.received_qty) - Number(l.damaged_qty))), damaged: '' }])))}>
            <PackageCheck /> Принять
          </Button>
        )}
      </div>

      <div className="flex gap-1.5">
        {CONTAINER_FLOW.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={cn('h-2 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
            <div className={cn('mt-1 text-xs', i === step ? 'font-medium text-ink' : 'text-muted')}>{CONTAINER_STATUS[s]}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="hatch rounded-[22px] bg-pill p-4 text-pill-ink">
          <div className="text-xs opacity-60">Инвойс</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(c.total, c.currency)}</div>
          {totalKgs != null && <div className="text-xs opacity-60">≈ {money(totalKgs)}</div>}
        </div>
        {[
          ['Предоплата', money(c.prepaid, c.currency)],
          ['Расходы', money(costsKgs)],
          ['Строк / без товара', `${c.lines.length} / ${c.unmatched}`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {c.unmatched > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-warn-soft px-4 py-3 text-sm text-ink-2">
              <AlertTriangle className="size-4 text-warn" />
              <span className="flex-1">{c.unmatched} строк без товара — сопоставьте вручную или создайте новые товары. Сопоставление запомнится</span>
              <Button size="sm" variant="dark" loading={mk.isPending} onClick={() => mk.mutate()}>
                <PackagePlus /> Создать товары
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="w-8 py-2.5 pl-4 font-normal">№</th>
                  <th className="px-2 font-normal">Из инвойса</th>
                  <th className="w-64 px-2 font-normal">Товар</th>
                  <th className="px-2 text-right font-normal">Кол-во</th>
                  <th className="px-2 text-right font-normal">Цена</th>
                  <th className="px-4 text-right font-normal">Принято</th>
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l) => (
                  <tr key={l.id} className={cn('border-b border-line last:border-0', !l.product_id && 'bg-warn-soft/40')}>
                    <td className="py-2 pl-4 text-xs text-faint">{l.line_no}</td>
                    <td className="px-2">
                      <div className="font-mono text-[12.5px]">{l.invoice_code ?? '—'}</div>
                      <div className="max-w-56 truncate text-xs text-muted">{l.invoice_name}</div>
                    </td>
                    <td className="px-2">
                      {c.status === 'received' ? (
                        <span>{l.productName ?? '—'}</span>
                      ) : (
                        <ProductSelect value={l.product_id ? { id: l.product_id, name: l.productName ?? '' } : null} onChange={(p) => match.mutate({ lineId: l.id, productId: p.id })} placeholder="Сопоставить…" />
                      )}
                    </td>
                    <td className="px-2 text-right tabular-nums">{num(l.qty, 3)}</td>
                    <td className="px-2 text-right tabular-nums">{money(l.price, c.currency)}</td>
                    <td className={cn('px-4 text-right tabular-nums', Number(l.received_qty) >= Number(l.qty) ? 'text-ok' : 'text-muted')}>
                      {num(l.received_qty, 3)}
                      {Number(l.damaged_qty) > 0 && <span className="ml-1 text-accent">бой {num(l.damaged_qty, 3)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!c.lines.length && <EmptyState title="Строк нет" hint="Импортируйте инвойс поставщика (Excel / CSV)" />}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-1 2xl:content-start">
          <Card className="h-fit space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium">Курс и расходы</span>
              <span className="text-xs text-muted">распределение {DIST[c.distribution]}</span>
            </div>
            <Field label={`Курс ${c.currency} → сом`}>
              <Input inputMode="decimal" disabled={c.status === 'received'} value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            {costs.map((x, i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={x.name} disabled={c.status === 'received'} onChange={(e) => setCosts(costs.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Карго" className="flex-1" />
                <Input value={x.amount} disabled={c.status === 'received'} inputMode="decimal" onChange={(e) => setCosts(costs.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d.]/g, '') } : y)))} className="w-24" />
                <select value={x.currency} disabled={c.status === 'received'} onChange={(e) => setCosts(costs.map((y, j) => (j === i ? { ...y, currency: e.target.value } : y)))} className="h-11 w-20 rounded-full bg-card px-2 text-sm ring-1 ring-line outline-none">
                  {['KGS', c.currency].filter((v, k, a) => a.indexOf(v) === k).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {c.status !== 'received' && (
                  <button onClick={() => setCosts(costs.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center text-muted hover:text-accent" aria-label="Убрать">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {c.status !== 'received' && (
              <button onClick={() => setCosts([...costs, { name: '', amount: '', currency: 'KGS' }])} className="flex h-9 w-full items-center justify-center gap-1 rounded-full text-[13px] text-muted ring-1 ring-line ring-dashed hover:text-ink">
                <Plus className="size-3.5" /> Расход (карго, таможня, доставка)
              </button>
            )}
            {dirty && (
              <Button variant="dark" className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            )}
          </Card>
          <Tray className="h-fit p-3">
            <div className="px-1 pb-2 text-[14px] font-medium">История</div>
            <div className="space-y-1 px-1">
              {c.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="flex gap-2 text-[12.5px]">
                    <span className="w-24 shrink-0 text-muted">{date(h.at, 'D MMM, HH:mm')}</span>
                    {CONTAINER_STATUS[h.status as ContainerStatus] ?? h.status}
                  </div>
                ))}
            </div>
            {c.receivingDocumentIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 px-1">
                {c.receivingDocumentIds.map((d, i) => (
                  <Link key={d} to={`/documents/${d}`}>
                    <Pill tone="outline">Приёмка {i + 1}</Pill>
                  </Link>
                ))}
              </div>
            )}
          </Tray>
        </div>
      </div>

      <InvoiceDialog id={c.id} open={inv} onOpenChange={setInv} />
      <Dialog open={!!prepay} onOpenChange={(v) => !v && setPrepay(null)} title="Предоплата поставщику" description={`Инвойс ${money(c.total, c.currency)} · уже оплачено ${money(c.prepaid, c.currency)}`}>
        {prepay && (
          <div className="mt-4 space-y-4">
            <Field label="Откуда">
              <select className={sel} value={prepay.accountId} onChange={(e) => setPrepay({ ...prepay, accountId: e.target.value })}>
                {accounts.data?.filter((a) => a.isActive).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Сумма в валюте счёта">
              <Input autoFocus inputMode="decimal" value={prepay.amount} onChange={(e) => setPrepay({ ...prepay, amount: e.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
            <Field label="Комментарий">
              <Input value={prepay.comment} onChange={(e) => setPrepay({ ...prepay, comment: e.target.value })} placeholder="Предоплата 50%" />
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!(Number(prepay.amount) > 0) || !prepay.accountId} loading={pay.isPending} onClick={() => pay.mutate()}>
                Оплатить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!recv} onOpenChange={(v) => !v && setRecv(null)} title="Приёмка контейнера" description="Можно частями. Бой и пересорт — отдельно, на них оформите претензию" className="max-w-3xl">
        {recv && (
          <div className="mt-4 space-y-3">
            <div className="scroll-thin max-h-[50vh] space-y-1 overflow-y-auto">
              {c.lines.map((l) => {
                const rest = Math.max(0, Number(l.qty) - Number(l.received_qty) - Number(l.damaged_qty));
                if (!rest) return null;
                return (
                  <div key={l.id} className="flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{l.productName ?? l.invoice_name}</span>
                    <span className="text-xs text-muted">из {num(rest, 3)}</span>
                    <input value={recv[l.id]?.qty ?? ''} inputMode="decimal" onChange={(e) => setRecv({ ...recv, [l.id]: { ...recv[l.id], qty: e.target.value.replace(/[^\d.]/g, '') } })} className="h-8 w-20 rounded-lg bg-card px-2 text-right tabular-nums outline-none" title="Принято" />
                    <input value={recv[l.id]?.damaged ?? ''} inputMode="decimal" placeholder="бой" onChange={(e) => setRecv({ ...recv, [l.id]: { ...recv[l.id], damaged: e.target.value.replace(/[^\d.]/g, '') } })} className="h-8 w-16 rounded-lg bg-card px-2 text-right text-accent tabular-nums outline-none placeholder:text-faint" title="Бой / пересорт" />
                  </div>
                );
              })}
            </div>
            <Switch checked={post} onChange={setPost} label="Сразу провести приёмку" />
            <div className="flex justify-end">
              <Button variant="dark" loading={receive.isPending} onClick={() => receive.mutate()}>
                <PackageCheck /> Принять
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
