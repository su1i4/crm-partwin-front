import * as D from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, CreditCard, DollarSign, HandCoins, MessageCircle, Plus, Printer, Smartphone, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { posApi, useAccounts, type MoneyAccount, type PaymentInput, type PaymentMethod, type Receipt } from '@/entities/pos';
import type { LocalReceipt } from '@/entities/pos-offline';
import { ApiError, errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { sound } from '@/shared/lib/sound';
import { askPin, Button, Kbd, Pill } from '@/shared/ui';
import { printLocalReceipt, printReceipt, shareWhatsApp } from '../receipt-print';

/** Итог оплаты для экрана «Сдача» — онлайн-чек или чек, проданный без сети */
interface Done {
  id: string;
  number: string;
  total: string | number;
  change: string | number;
  changeCurrency: string;
  debtAmount: string | number;
  local?: LocalReceipt;
}

export interface OfflinePay {
  total: number;
  rate: number | null;
  wallets: MoneyAccount[];
  acquiring: MoneyAccount[];
  allowDebt: boolean;
  pay: (payments: PaymentInput[], changeCurrency: 'KGS' | 'USD') => Promise<LocalReceipt>;
  store: { name: string; address: string | null; phone: string | null; register: string };
}

type Kind = 'cash' | 'usd' | 'card' | 'transfer' | 'debt';
interface Row {
  id: number;
  kind: Kind;
  amount: string;
  accountId?: string;
}

const KINDS: { kind: Kind; label: string; icon: typeof Banknote; hint: string }[] = [
  { kind: 'cash', label: 'Наличные', icon: Banknote, hint: 'сом' },
  { kind: 'usd', label: 'Доллары', icon: DollarSign, hint: 'по курсу' },
  { kind: 'card', label: 'Карта', icon: CreditCard, hint: 'терминал' },
  { kind: 'transfer', label: 'Перевод', icon: Smartphone, hint: 'на кошелёк' },
  { kind: 'debt', label: 'В долг', icon: HandCoins, hint: 'клиенту' },
];
const BILLS = [500, 1000, 2000, 5000];

let rowId = 0;
const toNum = (v: string) => Number(String(v).replace(',', '.')) || 0;

/**
 * Оплата (ТЗ 13.5): наличные сомы и доллары, карта, перевод на кошелёк, долг, смешанная.
 * Сдача — крупно. PIN старшего — если сервер ответил requiresPin.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  receipt,
  registerId,
  storeId,
  hasCustomer,
  onPaid,
  offline,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receipt: Receipt | null;
  registerId: string;
  storeId: string | null;
  hasCustomer: boolean;
  onPaid: () => void;
  /** Касса без сети: итог, курс и счета — из кэша, проведение — в очередь */
  offline?: OfflinePay | null;
}) {
  const total = offline ? offline.total : Number(receipt?.total ?? 0);
  const rate = offline ? offline.rate : receipt?.rate ? Number(receipt.rate) : null;
  const walletsQ = useAccounts('wallet', offline ? undefined : storeId);
  const acquiringQ = useAccounts('acquiring', offline ? undefined : storeId);
  const wallets = { data: offline ? offline.wallets : walletsQ.data };
  const acquiring = { data: offline ? offline.acquiring : acquiringQ.data };
  const [rows, setRows] = useState<Row[]>([]);
  const [changeCurrency, setChangeCurrency] = useState<'KGS' | 'USD'>('KGS');
  const [done, setDone] = useState<Done | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setRows([{ id: ++rowId, kind: 'cash', amount: String(total) }]);
      setDone(null);
      setChangeCurrency('KGS');
      setTimeout(() => firstInput.current?.select(), 50);
    }
  }, [open, total]);

  const kgs = (r: Row) => (r.kind === 'usd' ? toNum(r.amount) * (rate ?? 0) : toNum(r.amount));
  const paid = rows.reduce((a, r) => a + kgs(r), 0);
  const cashKgs = rows.filter((r) => r.kind === 'cash' || r.kind === 'usd').reduce((a, r) => a + kgs(r), 0);
  const rest = Math.round((total - paid) * 100) / 100;
  const change = rest < 0 ? Math.min(-rest, cashKgs) : 0;
  const overNonCash = rest < 0 && -rest > cashKgs + 0.001;
  const needsWallet = rows.some((r) => r.kind === 'transfer' && !r.accountId);
  const debtNoCustomer = rows.some((r) => r.kind === 'debt') && !hasCustomer;
  const debtBlocked = !!offline && !offline.allowDebt && rows.some((r) => r.kind === 'debt');
  const canPay = (!!receipt || !!offline) && !debtBlocked && rest <= 0.001 && !overNonCash && !needsWallet && !debtNoCustomer && rows.every((r) => toNum(r.amount) > 0);

  const setRow = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addKind = (kind: Kind) => {
    const left = Math.max(0, rest);
    const amount = kind === 'usd' ? (rate ? (Math.ceil((left / rate) * 100) / 100).toString() : '0') : String(left);
    const accountId = kind === 'transfer' ? wallets.data?.[0]?.id : kind === 'card' ? acquiring.data?.[0]?.id : undefined;
    // Один способ и он «весь чек» — заменяем, а не добавляем
    if (rows.length === 1 && toNum(rows[0].amount) === total && rows[0].kind !== kind) {
      setRows([{ id: ++rowId, kind, amount: kind === 'usd' ? (rate ? (Math.ceil((total / rate) * 100) / 100).toString() : '0') : String(total), accountId }]);
      return;
    }
    setRows((rs) => [...rs, { id: ++rowId, kind, amount, accountId }]);
  };

  const payments = useMemo<PaymentInput[]>(
    () =>
      rows.map((r) => {
        const amount = toNum(r.amount).toFixed(2);
        if (r.kind === 'cash') return { method: 'cash', amount, currency: 'KGS' };
        if (r.kind === 'usd') return { method: 'cash', amount, currency: 'USD' };
        if (r.kind === 'card') return { method: 'card', amount, ...(r.accountId ? { accountId: r.accountId } : {}) };
        if (r.kind === 'transfer') return { method: 'transfer', amount, accountId: r.accountId };
        return { method: 'debt' as PaymentMethod, amount };
      }),
    [rows],
  );

  const pay = useMutation({
    mutationFn: async (pin?: string): Promise<Done> => {
      if (offline) {
        const l = await offline.pay(payments, changeCurrency);
        return { id: l.id, number: l.number, total: l.total, change: l.change, changeCurrency: l.changeCurrency, debtAmount: l.debt, local: l };
      }
      try {
        return await posApi.pay(receipt!.id, { version: receipt!.version, payments, changeCurrency, ...(pin ? { pin } : {}) });
      } catch (e) {
        if (e instanceof ApiError && (e.details as { requiresPin?: boolean } | undefined)?.requiresPin) {
          const p = await askPin(e.message);
          if (p) return posApi.pay(receipt!.id, { version: receipt!.version, payments, changeCurrency, pin: p });
        }
        throw e;
      }
    },
    onSuccess: (r: Done) => {
      sound.ok();
      setDone(r);
      qc.invalidateQueries({ queryKey: ['shift-current'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
    onError: (e) => {
      sound.error();
      toast.error(errorMessage(e));
    },
  });

  const finish = () => {
    onOpenChange(false);
    onPaid();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (done && (e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        finish();
      } else if (!done && (e.key === 'F4' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) && canPay && !pay.isPending) {
        e.preventDefault();
        pay.mutate(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <D.Root open={open} onOpenChange={(v) => (done ? finish() : onOpenChange(v))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
        <D.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[94vh] overflow-y-auto rounded-t-[32px] bg-card shadow-2xl outline-none sm:inset-x-auto sm:top-[6vh] sm:bottom-auto sm:left-1/2 sm:w-[min(760px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-[32px]">
          <D.Title className="sr-only">Оплата</D.Title>
          {done ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <CheckCircle2 className="size-14 text-ok" strokeWidth={1.6} />
              <div className="mt-3 text-sm text-muted">
                Чек {done.number} {done.local ? 'сохранён на кассе — уйдёт на сервер, когда появится связь' : 'оплачен'}
              </div>
              {Number(done.change) > 0 ? (
                <>
                  <div className="mt-6 text-sm font-medium text-ink-2">Сдача</div>
                  <div className="text-[64px] leading-none font-semibold tracking-tight text-ink tabular-nums">{money(done.change, done.changeCurrency)}</div>
                </>
              ) : (
                <div className="mt-6 text-[40px] leading-none font-semibold tracking-tight text-ink tabular-nums">{money(done.total)}</div>
              )}
              {Number(done.debtAmount) > 0 && <Pill tone="accent-outline" className="mt-3">в долг {money(done.debtAmount)}</Pill>}
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <Button size="lg" onClick={() => (done.local && offline ? printLocalReceipt(done.local, offline.store) : printReceipt(done.id, registerId))}>
                  <Printer /> Печать
                </Button>
                {!done.local && (
                  <Button size="lg" onClick={() => shareWhatsApp(done.id)}>
                    <MessageCircle /> WhatsApp
                  </Button>
                )}
                <Button size="lg" variant="dark" onClick={finish}>
                  Новый чек <Kbd className="border-white/20 bg-white/10 text-white/70">Enter</Kbd>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-[1fr_250px]">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg font-semibold text-ink">
                    Оплата {offline && <Pill tone="warn">без сети</Pill>}
                  </div>
                  <D.Close className="grid size-9 place-items-center rounded-full text-muted hover:bg-card-muted sm:hidden" aria-label="Закрыть">
                    <X className="size-4" />
                  </D.Close>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.kind}
                      onClick={() => addKind(k.kind)}
                      disabled={k.kind === 'usd' && !rate}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-[18px] px-1 py-3 text-center ring-1 transition disabled:opacity-40',
                        rows.some((r) => r.kind === k.kind) ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink ring-line hover:ring-line-strong',
                      )}
                    >
                      <k.icon className="size-5" strokeWidth={1.8} />
                      <span className="text-[12.5px] font-medium">{k.label}</span>
                      <span className="hidden text-[10.5px] opacity-60 sm:block">{k.hint}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {rows.map((r, i) => {
                    const k = KINDS.find((x) => x.kind === r.kind)!;
                    return (
                      <div key={r.id} className="rounded-[22px] bg-card-muted p-3">
                        <div className="flex items-center gap-2">
                          <k.icon className="size-4 text-accent" />
                          <span className="text-[13.5px] font-medium text-ink">{k.label}</span>
                          {r.kind === 'usd' && rate && <span className="text-xs text-muted">курс {num(rate, 2)} · ≈ {money(kgs(r))}</span>}
                          {rows.length > 1 && (
                            <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="ml-auto text-muted hover:text-accent" aria-label="Убрать">
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="flex h-14 min-w-0 flex-1 items-center rounded-2xl bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
                            <input
                              ref={i === 0 ? firstInput : undefined}
                              inputMode="decimal"
                              value={r.amount}
                              onChange={(e) => setRow(r.id, { amount: e.target.value.replace(/[^\d.,]/g, '') })}
                              className="w-full bg-transparent text-2xl font-semibold text-ink tabular-nums outline-none"
                            />
                            <span className="text-lg text-faint">{r.kind === 'usd' ? '$' : 'с'}</span>
                          </label>
                          {r.kind === 'cash' && (
                            <div className="flex flex-wrap gap-1.5">
                              {BILLS.map((b) => (
                                <button key={b} onClick={() => setRow(r.id, { amount: String(b) })} className="h-10 rounded-full bg-card px-3 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-ink">
                                  {num(b)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {(r.kind === 'transfer' || r.kind === 'card') && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(r.kind === 'transfer' ? wallets.data : acquiring.data)?.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => setRow(r.id, { accountId: a.id })}
                                className={cn('h-9 rounded-full px-3 text-[12.5px] ring-1', r.accountId === a.id ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink-2 ring-line')}
                              >
                                {a.name}
                              </button>
                            ))}
                            {r.kind === 'transfer' && !wallets.data?.length && <span className="text-xs text-accent">Нет кошельков — добавьте в «Деньги → Счета»</span>}
                          </div>
                        )}
                        {r.kind === 'transfer' && <div className="mt-1.5 text-[11.5px] text-muted">Статус «не сверено» — владелец сверит по уведомлению банка</div>}
                        {r.kind === 'debt' && !hasCustomer && <div className="mt-1.5 text-xs text-accent">В долг — только клиенту из базы. Выберите клиента в чеке.</div>}
                        {r.kind === 'debt' && debtBlocked && <div className="mt-1.5 text-xs text-accent">Без интернета в режиме «несколько касс» в долг продавать нельзя</div>}
                      </div>
                    );
                  })}
                  <button onClick={() => addKind(rows.at(-1)?.kind === 'cash' ? 'transfer' : 'cash')} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13px] text-muted ring-1 ring-line ring-dashed hover:text-ink">
                    <Plus className="size-4" /> Ещё способ (смешанная оплата)
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-6 rounded-b-[32px] bg-pill p-6 text-pill-ink sm:rounded-r-[32px] sm:rounded-bl-none">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs opacity-60">К оплате</div>
                    <div className="text-[34px] leading-tight font-semibold tabular-nums">{money(total)}</div>
                    {rate && <div className="text-sm opacity-60">≈ {money(total / rate, 'USD')}</div>}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Внесено</span>
                    <span className="tabular-nums">{money(paid)}</span>
                  </div>
                  {rest > 0.001 && (
                    <div className="flex justify-between text-sm">
                      <span className="opacity-60">Осталось</span>
                      <span className="font-semibold text-accent tabular-nums">{money(rest)}</span>
                    </div>
                  )}
                  {change > 0 && (
                    <div className="rounded-2xl bg-white/10 p-3">
                      <div className="flex items-center justify-between text-xs opacity-70">
                        Сдача
                        {rows.some((r) => r.kind === 'usd') && rate && (
                          <span className="flex gap-1">
                            {(['KGS', 'USD'] as const).map((c) => (
                              <button key={c} onClick={() => setChangeCurrency(c)} className={cn('rounded-full px-2 py-0.5', changeCurrency === c ? 'bg-pill-ink text-pill' : 'opacity-70')}>
                                {c === 'KGS' ? 'сом' : '$'}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="text-[30px] font-semibold tabular-nums">{changeCurrency === 'USD' && rate ? money(change / rate, 'USD') : money(change)}</div>
                    </div>
                  )}
                  {overNonCash && <div className="text-xs text-accent">Переплата картой, переводом или долгом невозможна — сдача только с наличных</div>}
                </div>
                <button
                  disabled={!canPay || pay.isPending}
                  onClick={() => pay.mutate(undefined)}
                  className="flex h-16 items-center justify-center gap-2 rounded-[22px] bg-accent text-lg font-semibold text-accent-ink shadow-[0_10px_24px_-10px_var(--accent)] transition disabled:opacity-40"
                >
                  {pay.isPending ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : 'Провести'}
                  <Kbd className="border-white/20 bg-white/15 text-white/80">F4</Kbd>
                </button>
              </div>
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
