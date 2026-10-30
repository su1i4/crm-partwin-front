import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { purchasingApi, useDonor, useDonors, type Donor } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';

function Payback({ d, big }: { d: Donor; big?: boolean }) {
  const p = Math.min(100, Number(d.payback ?? 0));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>Окупаемость</span>
        <span className={cn('font-semibold text-ink tabular-nums', big ? 'text-2xl' : 'text-[15px]', p >= 100 && 'text-ok')}>{d.payback != null ? `${num(d.payback, 1)}%` : '—'}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
        <div className={cn('h-full rounded-full', p >= 100 ? 'bg-ok' : 'bg-accent')} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function NewDonorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const whs = useWarehouses();
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', warehouseId: '', year: '', vin: '', engine: '', transmission: '', purchasePrice: '', deliveryCost: '', customsCost: '', otherCost: '', expectedTotal: '' });
  useEffect(() => {
    if (open && !f.warehouseId && whs.data) setF((x) => ({ ...x, warehouseId: physical(whs.data)[0]?.id ?? '' }));
  }, [open, whs.data, f.warehouseId]);
  const m = (v: string) => (v ? { v } : null);
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.createDonor({
        title: f.title.trim(),
        warehouseId: f.warehouseId,
        ...(f.year ? { year: Number(f.year) } : {}),
        ...(f.vin ? { vin: f.vin.trim().toUpperCase() } : {}),
        ...(f.engine ? { engine: f.engine } : {}),
        ...(f.transmission ? { transmission: f.transmission } : {}),
        ...(m(f.purchasePrice) ? { purchasePrice: f.purchasePrice } : {}),
        ...(m(f.deliveryCost) ? { deliveryCost: f.deliveryCost } : {}),
        ...(m(f.customsCost) ? { customsCost: f.customsCost } : {}),
        ...(m(f.otherCost) ? { otherCost: f.otherCost } : {}),
        ...(m(f.expectedTotal) ? { expectedTotal: f.expectedTotal } : {}),
      }),
    onSuccess: (d) => (onOpenChange(false), nav(`/purchasing/donors/${d.id}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const money$ = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
    </Field>
  );
  const total = ['purchasePrice', 'deliveryCost', 'customsCost', 'otherCost'].reduce((a, k) => a + (Number(f[k as keyof typeof f]) || 0), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Новый донор" description="Машина на разбор: стоимость распределяется по деталям пропорционально их ожидаемой цене" className="max-w-2xl">
      <div className="mt-4 space-y-4">
        <Field label="Машина">
          <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Toyota Camry 40 2008, 2AZ, АКПП" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Год">
            <Input inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </Field>
          <div className="sm:col-span-3">
            <Field label="VIN / кузов">
              <Input value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value })} className="font-mono uppercase" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Двигатель">
              <Input value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })} placeholder="2AZ-FE" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="КПП">
              <Input value={f.transmission} onChange={(e) => setF({ ...f, transmission: e.target.value })} placeholder="АКПП U241E" />
            </Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {money$('purchasePrice', 'Покупка')}
          {money$('deliveryCost', 'Доставка')}
          {money$('customsCost', 'Растаможка')}
          {money$('otherCost', 'Прочее')}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          {money$('expectedTotal', 'Ожидаемая выручка со всех деталей', 'Нужна для расчёта себестоимости каждой детали')}
          <Field label="Склад">
            <select className={sel} value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })}>
              {physical(whs.data).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            Вложено: <b className="text-ink">{money(total)}</b>
          </span>
          <Button variant="dark" disabled={!f.title.trim() || !f.warehouseId} loading={create.isPending} onClick={() => create.mutate()}>
            Создать
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Доноры (ТЗ 10.7): разборка машин — вложено, распределено, продано, окупаемость */
export function DonorsPage() {
  const { data, isLoading, error, refetch } = useDonors();
  const can = useCan();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Доноры"
        sub="Машины на разбор: детали приходуются частями, себестоимость — доля стоимости машины"
        actions={
          can('stock.receive') && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> Донор
            </Button>
          )
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((d) => (
          <Link key={d.id} to={`/purchasing/donors/${d.id}`} className={cn('space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line transition hover:ring-line-strong', d.status === 'closed' && 'opacity-70')}>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-card-muted">
                <Car className="size-4 text-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{d.title}</span>
                <span className="block font-mono text-xs text-muted">{d.number}</span>
              </span>
              {d.status === 'closed' && <Pill tone="muted">разобран</Pill>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
              <div className="rounded-[14px] bg-card-muted py-2">
                вложено
                <div className="text-[13px] font-semibold text-ink tabular-nums">{money(d.totalCost)}</div>
              </div>
              <div className="rounded-[14px] bg-card-muted py-2">
                продано
                <div className="text-[13px] font-semibold text-ink tabular-nums">{money(d.sold)}</div>
              </div>
              <div className="rounded-[14px] bg-card-muted py-2">
                на складе
                <div className="text-[13px] font-semibold text-ink tabular-nums">{money(d.inStockCost)}</div>
              </div>
            </div>
            <Payback d={d} />
          </Link>
        ))}
      </div>
      {data && !data.length && (
        <Card>
          <EmptyState icon={<Car />} title="Доноров нет" hint="Купили машину на разбор — заведите её здесь и приходуйте снятые детали частями" />
        </Card>
      )}
      <NewDonorDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

type Part = { key: string; product: PickedProduct; qty: string; expectedPrice: string };

/** Донор: финансы и приход деталей частями */
export function DonorPage() {
  const { id } = useParams();
  const { data: d, isLoading, error, refetch } = useDonor(id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [parts, setParts] = useState<Part[]>([]);
  const [close, setClose] = useState(false);
  const [open, setOpen] = useState(false);
  const add = useMutation({
    mutationFn: () => purchasingApi.donorParts(id!, { close, lines: parts.map((p) => ({ productId: p.product.id, qty: String(Number(p.qty) || 1), ...(p.expectedPrice ? { expectedPrice: p.expectedPrice } : {}) })) }),
    onSuccess: (r) => {
      qc.setQueryData(['donor', id], r.donor);
      qc.invalidateQueries({ queryKey: ['donors'] });
      setParts([]);
      setOpen(false);
      toast.success('Детали оприходованы');
      nav(`/documents/${r.documentId}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !d) return <Skeleton className="h-96 rounded-[28px]" />;
  const factor = Number(d.expectedTotal) > 0 ? Number(d.totalCost) / Number(d.expectedTotal) : 0;
  const batch = parts.reduce((a, p) => a + (Number(p.qty) || 1) * (Number(p.expectedPrice) || 0) * factor, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/purchasing/donors" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-medium">{d.title}</h1>
          <div className="text-sm text-muted">
            <span className="font-mono">{d.number}</span>
            {d.vin && ` · ${d.vin}`}
            {d.engine && ` · ${d.engine}`}
            {d.transmission && ` · ${d.transmission}`} · с {date(d.createdAt, 'D MMM YYYY')}
          </div>
        </div>
        {d.status === 'open' ? (
          <Button variant="dark" onClick={() => setOpen(true)}>
            <PackagePlus /> Оприходовать детали
          </Button>
        ) : (
          <Pill tone="muted" className="h-8 px-3">
            разобран
          </Pill>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="hatch space-y-4 rounded-[24px] bg-pill p-5 text-pill-ink">
          <div>
            <div className="text-xs opacity-60">Вложено</div>
            <div className="text-[34px] leading-tight font-semibold tabular-nums">{money(d.totalCost)}</div>
          </div>
          <div className="[&_*]:!text-pill-ink">
            <Payback d={d} big />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Покупка', d.purchasePrice],
            ['Доставка', d.deliveryCost],
            ['Растаможка', d.customsCost],
            ['Прочее', d.otherCost],
            ['Распределено на детали', d.distributed],
            ['Ещё не распределено', d.undistributed],
            ['Ожидаемая выручка', d.expectedTotal],
            ['Продано деталей на', d.sold],
            ['Деталей на складе (себест.)', d.inStockCost],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[20px] bg-card p-3.5 ring-1 ring-line">
              <div className="text-xs text-muted">{l}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{money(v)}</div>
            </div>
          ))}
        </div>
      </div>
      <Tray className="p-3">
        <div className="px-1 pb-2 text-[14px] font-medium">Приходы деталей · {d.documentIds.length}</div>
        <div className="flex flex-wrap gap-1.5 px-1">
          {d.documentIds.map((x, i) => (
            <Link key={x} to={`/documents/${x}`}>
              <Pill tone="outline" className="h-7 px-3">
                Партия {i + 1}
              </Pill>
            </Link>
          ))}
          {!d.documentIds.length && <span className="text-sm text-muted">Пока ничего не снято</span>}
        </div>
      </Tray>

      <Dialog open={open} onOpenChange={setOpen} title="Оприходовать детали с донора" description="Себестоимость = ожидаемая цена × (вложено / ожидаемая выручка)" className="max-w-3xl">
        <div className="mt-4 space-y-3">
          <ProductAddField
            placeholder="Скан / номер — снятая деталь"
            onPick={(p) => setParts((x) => [...x, { key: crypto.randomUUID(), product: p, qty: '1', expectedPrice: p.price != null ? String(p.price) : '' }])}
          />
          <div className="scroll-thin max-h-[45vh] space-y-1 overflow-y-auto">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{p.product.name}</span>
                <input value={p.qty} inputMode="decimal" onChange={(e) => setParts((x) => x.map((y) => (y.key === p.key ? { ...y, qty: e.target.value.replace(/[^\d.]/g, '') } : y)))} className="h-8 w-14 rounded-lg bg-card px-2 text-right tabular-nums outline-none" title="Кол-во" />
                <input value={p.expectedPrice} inputMode="decimal" placeholder="цена продажи" onChange={(e) => setParts((x) => x.map((y) => (y.key === p.key ? { ...y, expectedPrice: e.target.value.replace(/[^\d.]/g, '') } : y)))} className="h-8 w-28 rounded-lg bg-card px-2 text-right tabular-nums outline-none placeholder:text-faint" />
                <span className="w-24 text-right text-xs text-muted tabular-nums">себ. {money((Number(p.expectedPrice) || 0) * factor)}</span>
                <button onClick={() => setParts((x) => x.filter((y) => y.key !== p.key))} className="text-muted hover:text-accent" aria-label="Убрать">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Switch checked={close} onChange={setClose} label="Последняя партия — забрать весь нераспределённый остаток и закрыть донора" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">
              В себестоимость: <b className="text-ink">{money(close ? d.undistributed : batch)}</b> из {money(d.undistributed)}
            </span>
            <Button variant="dark" disabled={!parts.length} loading={add.isPending} onClick={() => add.mutate()}>
              Оприходовать
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
