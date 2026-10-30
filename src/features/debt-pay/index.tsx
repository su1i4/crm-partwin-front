import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { customerApi, useDebtItems } from '@/entities/customer';
import { ACCOUNT_TYPE, useMoneyAccounts } from '@/entities/money';
import { useSession } from '@/entities/session';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money } from '@/shared/lib/format';
import { Button, Dialog, Field, Input, Segmented } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';

/**
 * Оплата долга (ТЗ 15): клиент платит нам (in) или мы — поставщику / соседу / мастеру (out).
 * Распределение: сначала старые, по машинам или по выбранным позициям.
 */
export function DebtPayDialog({
  open,
  onOpenChange,
  counterpartyId,
  name,
  direction,
  currency = 'KGS',
  suggested,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  counterpartyId: string;
  name: string;
  direction: 'in' | 'out';
  currency?: string;
  suggested?: string;
  onDone?: () => void;
}) {
  const storeId = useSession((s) => s.storeId);
  const accounts = useMoneyAccounts(storeId ? { storeId } : {});
  const items = useDebtItems(open ? counterpartyId : undefined, { direction: direction === 'in' ? 'receivable' : 'payable', open: true });
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [mode, setMode] = useState<'oldest' | 'items'>('oldest');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const list = useMemo(() => (items.data ?? []).filter((i) => i.currency === currency && Number(i.remaining) > 0 && i.kind !== 'advance'), [items.data, currency]);
  const accs = (accounts.data ?? []).filter((a) => a.isActive !== false && a.currency === currency);
  useEffect(() => {
    if (open) {
      setAmount(suggested ? String(Number(suggested)) : '');
      setPicked(new Set());
      setMode('oldest');
      setComment('');
      setKey(crypto.randomUUID());
    }
  }, [open, suggested]);
  useEffect(() => {
    if (open && !accountId && accs[0]) setAccountId(accs.find((a) => a.type === 'cash')?.id ?? accs[0].id);
  }, [open, accs, accountId]);
  useEffect(() => {
    if (mode === 'items') setAmount(String(list.filter((i) => picked.has(i.id)).reduce((a, i) => a + Number(i.remaining), 0) || ''));
  }, [picked, mode, list]);
  const total = list.reduce((a, i) => a + Number(i.remaining), 0);
  const pay = useMutation({
    mutationFn: () =>
      customerApi.pay({
        counterpartyId,
        direction,
        currency,
        amount: String(Number(amount)),
        accountId,
        allocation: mode === 'items' ? { mode: 'items', itemIds: [...picked] } : { mode: 'oldest' },
        ...(comment ? { comment } : {}),
        idempotencyKey: key,
      }),
    onSuccess: () => {
      toast.success(direction === 'in' ? 'Оплата принята' : 'Оплата проведена');
      for (const k of ['debts', 'debt-items', 'customer', 'supplier', 'money-accounts', 'bonuses']) qc.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const over = Number(amount) > total + 0.001;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={direction === 'in' ? 'Принять оплату долга' : 'Оплатить долг'} description={`${name} · ${direction === 'in' ? 'должен нам' : 'мы должны'} ${money(total, currency)}`} className="max-w-xl">
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Сумма">
            <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => (setMode('oldest'), setAmount(e.target.value.replace(/[^\d.]/g, '')))} className="text-lg font-semibold tabular-nums" />
          </Field>
          <Field label={direction === 'in' ? 'Куда пришли деньги' : 'Откуда платим'}>
            <select className={sel} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>
                  {ACCOUNT_TYPE[a.type]} · {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {over && <div className="rounded-[14px] bg-warn-soft px-3 py-2 text-xs text-ink-2">Больше долга — остаток {direction === 'in' ? 'станет авансом клиента' : 'станет нашим авансом'}</div>}
        <div className="flex items-center justify-between">
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'oldest', label: 'Сначала старые' },
              { value: 'items', label: 'Выбрать позиции' },
            ]}
          />
          <button onClick={() => (setMode('oldest'), setAmount(String(total)))} className="text-xs text-muted hover:text-ink">
            Весь долг
          </button>
        </div>
        <div className="scroll-thin max-h-60 space-y-1 overflow-y-auto">
          {list.map((i) => (
            <label key={i.id} className={cn('flex items-center gap-2 rounded-[14px] px-3 py-2 text-[13px]', mode === 'items' ? 'cursor-pointer bg-card-muted' : 'bg-card-muted/60', picked.has(i.id) && 'ring-1 ring-accent')}>
              {mode === 'items' && (
                <input
                  type="checkbox"
                  checked={picked.has(i.id)}
                  onChange={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(i.id)) n.delete(i.id);
                      else n.add(i.id);
                      return n;
                    })
                  }
                  className="size-4 accent-[var(--accent)]"
                />
              )}
              <span className="w-14 text-muted">{date(i.openedAt, 'DD.MM')}</span>
              <span className="min-w-0 flex-1 truncate">
                {i.what ?? i.description ?? i.documentNumber ?? 'Долг'}
                {i.vehicleTitle && <span className="text-muted"> · {i.vehicleTitle}</span>}
              </span>
              <span className={cn('font-semibold tabular-nums', i.overdue && 'text-accent')}>{money(i.remaining, i.currency)}</span>
            </label>
          ))}
          {items.data && !list.length && <div className="text-sm text-muted">Открытых долгов в {currency} нет — сумма станет авансом</div>}
        </div>
        <Field label="Комментарий">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!(Number(amount) > 0) || !accountId} loading={pay.isPending} onClick={() => pay.mutate()}>
            {direction === 'in' ? 'Принять' : 'Оплатить'} {Number(amount) > 0 && money(amount, currency)}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
