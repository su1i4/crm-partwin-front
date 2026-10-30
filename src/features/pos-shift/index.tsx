import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole, Printer, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { posApi, type CurrentShift, type Shift, type ShiftReport } from '@/entities/pos';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money } from '@/shared/lib/format';
import { Button, Dialog, Field, Input, Pill, Segmented, Skeleton } from '@/shared/ui';
import { printHtml } from '../receipt-print';

const CUR = ['KGS', 'USD'] as const;
const cur = (c: string) => (c === 'USD' ? 'USD' : 'KGS');
const METHOD: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Переводы', debt: 'В долг', return_credit: 'Зачёт возврата', advance: 'Аванс', scrap: 'Лом' };
const PURPOSE: Record<string, string> = { safe: 'В сейф', owner: 'Владельцу', bank: 'В банк', other: 'Другое' };

function CashInputs({ value, onChange, hint }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; hint?: Record<string, string> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CUR.map((c) => (
        <Field key={c} label={c === 'KGS' ? 'Сомы' : 'Доллары'} hint={hint?.[c] !== undefined ? `По учёту: ${money(hint[c], c)}` : undefined}>
          <Input
            inputMode="decimal"
            value={value[c] ?? ''}
            onChange={(e) => onChange({ ...value, [c]: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })}
            right={<span className="text-sm text-faint">{c === 'USD' ? '$' : 'с'}</span>}
            className="h-12 [&_input]:text-lg [&_input]:font-semibold"
          />
        </Field>
      ))}
    </div>
  );
}

/** Открытие смены: пересчёт наличных по валютам (ТЗ 13.7) */
export function OpenShiftPanel({ current, canOpen }: { current: CurrentShift; canOpen: boolean }) {
  const qc = useQueryClient();
  const [cash, setCash] = useState<Record<string, string>>({ KGS: current.cashBalance.KGS ?? '0', USD: current.cashBalance.USD ?? '0' });
  const m = useMutation({
    mutationFn: () => posApi.openShift(current.register.id, Object.fromEntries(Object.entries(cash).map(([k, v]) => [k, v || '0']))),
    onSuccess: (s) => {
      toast.success(`Смена №${s.number} открыта`);
      qc.invalidateQueries({ queryKey: ['shift-current'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mx-auto max-w-xl rounded-[32px] bg-card p-6 shadow-card sm:p-8">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink">
        <Unlock className="size-5" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Открыть смену · {current.register.name}</h2>
      <p className="mt-1 text-sm text-muted">
        Пересчитайте наличные в кассе. Расхождение с учётом попадёт в отчёт.
        {current.lastClosed && <> Прошлая смена №{current.lastClosed.number} закрыта {date(current.lastClosed.closedAt, 'D MMM, HH:mm')}.</>}
      </p>
      <div className="mt-6">
        <CashInputs value={cash} onChange={setCash} hint={current.cashBalance} />
      </div>
      <Button variant="dark" size="lg" className="mt-6 w-full justify-center" disabled={!canOpen} loading={m.isPending} onClick={() => m.mutate()}>
        Открыть смену
      </Button>
      {!canOpen && <div className="mt-2 text-center text-xs text-muted">Нет права открывать смену — попросите управляющего</div>}
    </div>
  );
}

function ReportView({ r }: { r: ShiftReport }) {
  const box = 'rounded-[20px] bg-card-muted p-3.5';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={box}>
          <div className="text-xs text-muted">Продаж</div>
          <div className="font-semibold tabular-nums">{r.salesCount}</div>
          <div className="text-sm tabular-nums">{money(r.salesTotal)}</div>
        </div>
        <div className={box}>
          <div className="text-xs text-muted">Возвратов</div>
          <div className="font-semibold tabular-nums">{r.returnsCount}</div>
          <div className="text-sm tabular-nums">{money(r.returnsTotal)}</div>
        </div>
        <div className={box}>
          <div className="text-xs text-muted">Скидки</div>
          <div className="text-sm font-semibold tabular-nums">{money(r.discountsTotal)}</div>
        </div>
        <div className={box}>
          <div className="text-xs text-muted">В долг</div>
          <div className="text-sm font-semibold tabular-nums">{money(r.debtTotal)}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="px-1 text-[13px] font-medium text-ink">По способам оплаты</div>
        {r.byMethod.map((m, i) => (
          <div key={i} className="flex justify-between rounded-full bg-card-muted px-4 py-2 text-[13px]">
            <span>
              {METHOD[m.method] ?? m.method} {m.currency !== 'KGS' && <span className="text-muted">({m.currency})</span>}
            </span>
            <span className="font-medium tabular-nums">{money(m.amount, cur(m.currency))}</span>
          </div>
        ))}
        {!r.byMethod.length && <div className="px-1 text-sm text-muted">Оплат ещё не было</div>}
      </div>
      {r.byAccount.some((a) => a.type === 'wallet') && (
        <div className="space-y-1.5">
          <div className="px-1 text-[13px] font-medium text-ink">По кошелькам</div>
          {r.byAccount
            .filter((a) => a.type === 'wallet')
            .map((a) => (
              <div key={a.accountId} className="flex items-center justify-between gap-2 rounded-full bg-card-muted px-4 py-2 text-[13px]">
                <span className="truncate">{a.name}</span>
                <span className="flex items-center gap-2">
                  {Number(a.unverified) > 0 && <Pill tone="warn">не сверено {money(a.unverified)}</Pill>}
                  <span className="font-medium tabular-nums">{money(a.amount)}</span>
                </span>
              </div>
            ))}
        </div>
      )}
      {Number(r.toOwner.total) > 0 && (
        <div className="rounded-[20px] bg-accent-soft p-3.5 text-sm text-ink ring-1 ring-accent-line">
          <b>Переводы на личный номер продавца:</b> сдать владельцу {money(r.toOwner.total)}
          <div className="mt-1 text-xs text-muted">{r.toOwner.items.map((x) => `${x.holderName}: ${money(x.amount)}`).join(' · ')}</div>
        </div>
      )}
      <div className="space-y-1.5">
        <div className="px-1 text-[13px] font-medium text-ink">Наличные в кассе</div>
        {r.cash.map((c) => (
          <div key={c.accountId} className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-[20px] bg-card-muted px-4 py-3 text-[13px] sm:grid-cols-3">
            <span className="text-muted">Начало: {money(c.opening, cur(c.currency))}</span>
            <span className="text-muted">Продажи: {money(c.sales, cur(c.currency))}</span>
            <span className="text-muted">Возвраты: {money(c.refunds, cur(c.currency))}</span>
            <span className="text-muted">Внесения/изъятия: {money(c.operations, cur(c.currency))}</span>
            <span className="col-span-2 font-semibold sm:col-span-1">Сейчас: {money(c.balance, cur(c.currency))}</span>
          </div>
        ))}
      </div>
      {r.diff && Object.values(r.diff).some((v) => Number(v) !== 0) && (
        <div className="rounded-[20px] bg-warn-soft p-3.5 text-sm">
          Расхождение: {Object.entries(r.diff).map(([k, v]) => `${Number(v) > 0 ? '+' : ''}${money(v, cur(k))}`).join(', ')}
        </div>
      )}
    </div>
  );
}

function reportHtml(r: ShiftReport) {
  const row = (a: string, b: string) => `<div style="display:flex;justify-content:space-between"><span>${a}</span><span>${b}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:3mm}body{font:12px/1.4 monospace;width:74mm}hr{border:0;border-top:1px dashed #000}</style></head><body>
  <b>${r.status === 'closed' ? 'Z' : 'X'}-отчёт · смена №${r.number}</b><br>${r.register}<br>${date(r.openedAt, 'DD.MM.YYYY HH:mm')}${r.closedAt ? ' — ' + date(r.closedAt, 'DD.MM.YYYY HH:mm') : ''}<hr>
  ${row('Продаж', `${r.salesCount} / ${money(r.salesTotal)}`)}${row('Возвратов', `${r.returnsCount} / ${money(r.returnsTotal)}`)}${row('Скидки', money(r.discountsTotal))}${row('В долг', money(r.debtTotal))}<hr>
  ${r.byMethod.map((m) => row(`${METHOD[m.method] ?? m.method} ${m.currency}`, money(m.amount, cur(m.currency)))).join('')}<hr>
  ${r.cash.map((c) => row(`Наличные ${c.currency}`, money(c.balance, cur(c.currency)))).join('')}
  ${Number(r.toOwner.total) ? '<hr>' + row('Сдать владельцу', money(r.toOwner.total)) : ''}
  </body></html>`;
}

/** X-отчёт и закрытие смены (Z-отчёт) */
export function ShiftReportDialog({ open, onOpenChange, shift, mode, cashBalance }: { open: boolean; onOpenChange: (v: boolean) => void; shift: Shift; mode: 'x' | 'close'; cashBalance: Record<string, string> }) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<ShiftReport | null>(null);
  const rep = useQuery({ queryKey: ['x-report', shift.id], queryFn: () => posApi.xReport(shift.id), enabled: open });
  useEffect(() => {
    if (open) {
      setCounted({ KGS: '', USD: '' });
      setClosed(null);
    }
  }, [open]);
  const close = useMutation({
    mutationFn: async () => {
      await posApi.closeShift(shift.id, shift.version, Object.fromEntries(Object.entries(counted).map(([k, v]) => [k, v || '0'])));
      return posApi.xReport(shift.id);
    },
    onSuccess: (z) => {
      setClosed(z);
      toast.success(`Смена №${shift.number} закрыта`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const report = closed ?? rep.data;
  const done = () => {
    onOpenChange(false);
    if (closed) qc.invalidateQueries({ queryKey: ['shift-current'] });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(v) : done())}
      className="max-w-2xl"
      title={closed ? `Z-отчёт · смена №${shift.number}` : mode === 'x' ? `X-отчёт · смена №${shift.number}` : `Закрыть смену №${shift.number}`}
      description={`Открыта ${date(shift.openedAt, 'D MMM, HH:mm')}`}
    >
      <div className="scroll-thin mt-4 max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        {mode === 'close' && !closed && (
          <div className="rounded-[22px] p-4 ring-1 ring-line">
            <div className="mb-3 text-[14px] font-medium">Сколько наличных в кассе по факту?</div>
            <CashInputs value={counted} onChange={setCounted} />
          </div>
        )}
        {rep.isLoading && <Skeleton className="h-60 rounded-[22px]" />}
        {report && <ReportView r={report} />}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {report && (
          <Button onClick={() => printHtml(reportHtml(report))}>
            <Printer /> Печать
          </Button>
        )}
        {mode === 'close' && !closed ? (
          <Button variant="accent" loading={close.isPending} disabled={!counted.KGS} onClick={() => close.mutate()}>
            <LockKeyhole /> Закрыть смену
          </Button>
        ) : (
          <Button variant="dark" onClick={done}>
            Готово
          </Button>
        )}
      </div>
      {mode === 'close' && !closed && !counted.KGS && <div className="mt-2 text-right text-xs text-muted">По учёту в кассе {money(cashBalance.KGS ?? 0)}</div>}
    </Dialog>
  );
}

/** Внесение и изъятие наличных (куда: сейф, владельцу, банк) */
export function CashOpDialog({ open, onOpenChange, shiftId }: { open: boolean; onOpenChange: (v: boolean) => void; shiftId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<'cash_out' | 'cash_in'>('cash_out');
  const [currency, setCurrency] = useState<'KGS' | 'USD'>('KGS');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('safe');
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (open) {
      setAmount('');
      setComment('');
    }
  }, [open]);
  const m = useMutation({
    mutationFn: () => posApi.shiftCash(shiftId, { type, currency, amount, ...(type === 'cash_out' ? { purpose } : {}), ...(comment ? { comment } : {}) }),
    onSuccess: () => {
      toast.success(type === 'cash_out' ? 'Изъятие проведено' : 'Внесение проведено');
      qc.invalidateQueries({ queryKey: ['shift-current'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Наличные в кассе">
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'cash_out', label: <span className="flex items-center gap-1.5"><ArrowUpFromLine className="size-3.5" />Изъятие</span> },
              { value: 'cash_in', label: <span className="flex items-center gap-1.5"><ArrowDownToLine className="size-3.5" />Внесение</span> },
            ]}
          />
          <Segmented value={currency} onChange={setCurrency} options={[{ value: 'KGS', label: 'сом' }, { value: 'USD', label: '$' }]} />
        </div>
        <Field label="Сумма">
          <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className="h-12 [&_input]:text-lg [&_input]:font-semibold" />
        </Field>
        {type === 'cash_out' && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PURPOSE).map(([k, v]) => (
              <button key={k} onClick={() => setPurpose(k)} className={cn('h-9 rounded-full px-3.5 text-[13px] ring-1', purpose === k ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line')}>
                {v}
              </button>
            ))}
          </div>
        )}
        <Field label="Комментарий">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" />
        </Field>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!Number(amount)} loading={m.isPending} onClick={() => m.mutate()}>
            Провести
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export { ReportView };
