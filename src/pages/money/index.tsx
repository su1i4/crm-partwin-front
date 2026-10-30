import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Ban, Banknote, Building2, Check, CheckCheck, ChevronLeft, ChevronRight, CreditCard, FileUp, Landmark, Plus, Repeat, Smartphone, Vault, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ACCOUNT_TYPE, MOVE_KIND, moneyApi, useArticles, useExpenses, useMoneyAccounts, useMovements, useRecurring, useTransfers, useTransferSummary, type Account, type AccountType, type Transfer } from '@/entities/money';
import { useCan, useSession } from '@/entities/session';
import { errorMessage, uploadFile } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const LIMIT = 50;
const ICON: Record<AccountType, typeof Wallet> = { cash: Banknote, safe: Vault, bank: Landmark, wallet: Smartphone, acquiring: CreditCard, accountable: Building2 };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthStart = () => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const today = () => ymd(new Date());
const accLabel = (a: Account) => `${ACCOUNT_TYPE[a.type]} · ${a.name}`;

function Pager({ page, pages, set }: { page: number; pages: number; set: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <Button size="icon-sm" disabled={page <= 1} onClick={() => set(page - 1)} aria-label="Назад">
        <ChevronLeft />
      </Button>
      <span className="text-sm text-muted tabular-nums">
        {page} / {pages}
      </span>
      <Button size="icon-sm" disabled={page >= pages} onClick={() => set(page + 1)} aria-label="Вперёд">
        <ChevronRight />
      </Button>
    </div>
  );
}

// ── Счета и кошельки ────────────────────────────────────

type Op = { type: 'cash_in' | 'cash_out' | 'transfer' | 'exchange'; fromAccountId: string; toAccountId: string; amount: string; toAmount: string; purpose: string; comment: string };

function OperationDialog({ op, onClose, accounts }: { op: Op | null; onClose: () => void; accounts: Account[] }) {
  const [f, setF] = useState<Op | null>(op);
  const qc = useQueryClient();
  useEffect(() => setF(op), [op]);
  const run = useMutation({
    mutationFn: () =>
      moneyApi.operation({
        type: f!.type,
        amount: f!.amount,
        ...(f!.type !== 'cash_in' ? { fromAccountId: f!.fromAccountId } : {}),
        ...(f!.type !== 'cash_out' ? { toAccountId: f!.toAccountId } : {}),
        ...(f!.type === 'exchange' ? { toAmount: f!.toAmount } : {}),
        ...(f!.type === 'cash_out' && f!.purpose ? { purpose: f!.purpose } : {}),
        ...(f!.comment ? { comment: f!.comment } : {}),
      }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['money-accounts'] }), qc.invalidateQueries({ queryKey: ['money-movements'] }), onClose(), toast.success('Проведено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!f) return null;
  const from = accounts.find((a) => a.id === f.fromAccountId);
  const to = accounts.find((a) => a.id === f.toAccountId);
  const titles = { cash_in: 'Внесение', cash_out: 'Изъятие', transfer: 'Перемещение денег', exchange: 'Обмен валюты' };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={titles[f.type]} description={f.type === 'transfer' ? 'Касса → сейф, кошелёк → банк и т. п.' : f.type === 'exchange' ? 'Отдали в одной валюте, получили в другой' : undefined}>
      <div className="mt-4 space-y-4">
        <Segmented
          size="sm"
          value={f.type}
          onChange={(t) => setF({ ...f, type: t })}
          options={[
            { value: 'transfer', label: 'Перемещение' },
            { value: 'cash_in', label: 'Внесение' },
            { value: 'cash_out', label: 'Изъятие' },
            { value: 'exchange', label: 'Обмен' },
          ]}
        />
        {f.type !== 'cash_in' && (
          <Field label="Откуда">
            <select className={sel} value={f.fromAccountId} onChange={(e) => setF({ ...f, fromAccountId: e.target.value })}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accLabel(a)} {a.balance != null ? `(${money(a.balance, a.currency)})` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {f.type !== 'cash_out' && (
          <Field label="Куда">
            <select className={sel} value={f.toAccountId} onChange={(e) => setF({ ...f, toAccountId: e.target.value })}>
              <option value="">—</option>
              {accounts.filter((a) => a.id !== f.fromAccountId && (f.type !== 'transfer' || !from || a.currency === from.currency)).map((a) => (
                <option key={a.id} value={a.id}>
                  {accLabel(a)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={f.type === 'exchange' ? `Отдали${from ? `, ${from.currency}` : ''}` : 'Сумма'}>
            <Input autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} className="text-lg font-semibold" />
          </Field>
          {f.type === 'exchange' && (
            <Field label={`Получили${to ? `, ${to.currency}` : ''}`} hint={Number(f.amount) && Number(f.toAmount) ? `курс ${num(Math.max(Number(f.amount), Number(f.toAmount)) / Math.min(Number(f.amount), Number(f.toAmount)), 2)}` : undefined}>
              <Input inputMode="decimal" value={f.toAmount} onChange={(e) => setF({ ...f, toAmount: e.target.value.replace(/[^\d.]/g, '') })} className="text-lg font-semibold" />
            </Field>
          )}
          {f.type === 'cash_out' && (
            <Field label="Куда ушли">
              <select className={sel} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>
                <option value="owner">Владельцу</option>
                <option value="bank">В банк</option>
                <option value="safe">В сейф</option>
                <option value="other">Другое</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Комментарий">
          <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} />
        </Field>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!(Number(f.amount) > 0) || (f.type !== 'cash_in' && !f.fromAccountId) || (f.type !== 'cash_out' && !f.toAccountId) || (f.type === 'exchange' && !(Number(f.toAmount) > 0))} loading={run.isPending} onClick={() => run.mutate()}>
            Провести
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AccountDialog({ acc, onClose }: { acc: Partial<Account> | null; onClose: () => void }) {
  const [f, setF] = useState({ type: 'wallet' as AccountType, name: '', currency: 'KGS', provider: '', phone: '', commissionPercent: '', isActive: true });
  const storeId = useSession((s) => s.storeId);
  const qc = useQueryClient();
  useEffect(() => {
    if (acc) setF({ type: acc.type ?? 'wallet', name: acc.name ?? '', currency: acc.currency ?? 'KGS', provider: acc.details?.provider ?? '', phone: acc.details?.phone ?? '', commissionPercent: acc.details?.commissionPercent ?? '', isActive: acc.isActive ?? true });
  }, [acc]);
  const save = useMutation({
    mutationFn: () => {
      const details = { ...(acc?.details ?? {}), ...(f.provider ? { provider: f.provider } : {}), ...(f.phone ? { phone: f.phone } : {}), ...(f.commissionPercent ? { commissionPercent: f.commissionPercent } : {}) };
      return acc?.id ? moneyApi.updateAccount(acc.id, { version: acc.version!, name: f.name, details, isActive: f.isActive }) : moneyApi.createAccount({ type: f.type, name: f.name, currency: f.currency, details, ...(storeId ? { storeId } : {}) });
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['money-accounts'] }), onClose(), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!acc} onOpenChange={(v) => !v && onClose()} title={acc?.id ? 'Счёт' : 'Новый счёт или кошелёк'}>
      <div className="mt-4 space-y-4">
        {!acc?.id && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Вид">
              <select className={sel} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as AccountType })}>
                {(['wallet', 'bank', 'safe', 'acquiring', 'accountable'] as AccountType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Валюта">
              <select className={sel} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
                {['KGS', 'USD', 'CNY', 'RUB', 'EUR', 'KZT'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Название" hint="Как видит продавец на кассе">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="MBank — Бакыт — 0555 123 456" />
        </Field>
        {(f.type === 'wallet' || f.type === 'acquiring' || f.type === 'bank') && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Банк / сервис">
              <Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="MBank" />
            </Field>
            <Field label="Телефон / счёт">
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="Комиссия, %">
              <Input inputMode="decimal" value={f.commissionPercent} onChange={(e) => setF({ ...f, commissionPercent: e.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
          </div>
        )}
        {acc?.id && <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Используется" />}
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Счета и кошельки (ТЗ 17.1): кассы, сейф, банк, кошельки продавцов, эквайринг — остатки по валютам */
export function AccountsPage() {
  const storeId = useSession((s) => s.storeId);
  const [inactive, setInactive] = useState(false);
  const { data, isLoading, error, refetch } = useMoneyAccounts({ ...(storeId ? { storeId } : {}), includeInactive: inactive || undefined });
  const can = useCan();
  const [op, setOp] = useState<Op | null>(null);
  const [acc, setAcc] = useState<Partial<Account> | null>(null);
  const accounts = data ?? [];
  const totals = useMemo(() => accounts.reduce<Record<string, number>>((a, x) => ((a[x.currency] = (a[x.currency] ?? 0) + Number(x.balance ?? 0)), a), {}), [accounts]);
  const groups = (Object.keys(ACCOUNT_TYPE) as AccountType[]).map((t) => ({ t, list: accounts.filter((a) => a.type === t) })).filter((g) => g.list.length);
  const newOp = (type: Op['type'], from = '') => setOp({ type, fromAccountId: from, toAccountId: '', amount: '', toAmount: '', purpose: 'owner', comment: '' });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Счета и кошельки"
        sub="Деньги видны там, где они лежат: касса, сейф, кошелёк продавца, банк. Переводы «на карту продавца» — с отметкой сверки"
        actions={
          can('money.write') && (
            <>
              <Button onClick={() => setAcc({})}>
                <Plus /> Счёт
              </Button>
              <Button variant="dark" onClick={() => newOp('transfer')}>
                <ArrowLeftRight /> Переместить
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap gap-3">
        {Object.entries(totals).map(([cur, v], i) => (
          <div key={cur} className={cn('min-w-56 rounded-[22px] p-4', i === 0 ? 'hatch bg-pill text-pill-ink' : 'bg-card ring-1 ring-line')}>
            <div className="text-xs opacity-60">Всего · {cur}</div>
            <div className="mt-1 text-[28px] font-semibold tabular-nums">{money(v, cur)}</div>
          </div>
        ))}
        <div className="ml-auto self-end">
          <Switch checked={inactive} onChange={setInactive} label="Показать отключённые" />
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {groups.map(({ t, list }) => {
        const I = ICON[t];
        return (
          <Tray key={t} className="p-3">
            <div className="flex items-center gap-2 px-1 pb-2 text-[14px] font-medium">
              <I className="size-4 text-accent" /> {ACCOUNT_TYPE[t]}
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => (
                <div key={a.id} className={cn('group rounded-[20px] bg-card p-4', !a.isActive && 'opacity-50')}>
                  <div className="flex items-start gap-2">
                    <button onClick={() => setAcc(a)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14px] font-medium">{a.name}</span>
                      <span className="block text-xs text-muted">{a.currency}{a.details?.commissionPercent ? ` · комиссия ${a.details.commissionPercent}%` : ''}</span>
                    </button>
                    <Link to={`/money/payments?account=${a.id}`} className="text-xs text-muted hover:text-ink">
                      движения →
                    </Link>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <span className={cn('text-2xl font-semibold tabular-nums', Number(a.balance) < 0 && 'text-accent')}>{a.balance != null ? money(a.balance, a.currency) : '—'}</span>
                    {Number(a.unverified) > 0 && (
                      <Link to={`/money/transfers?account=${a.id}`}>
                        <Pill tone="warn">не сверено {money(a.unverified, a.currency)}</Pill>
                      </Link>
                    )}
                  </div>
                  {can('money.write') && (
                    <div className="mt-3 flex gap-1 opacity-60 transition group-hover:opacity-100">
                      <Button size="sm" variant="soft" onClick={() => newOp('transfer', a.id)}>
                        <ArrowLeftRight /> Переместить
                      </Button>
                      <Button size="sm" variant="soft" onClick={() => newOp('cash_out', a.id)}>
                        <ArrowUpRight /> Изъять
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Tray>
        );
      })}
      {data && !data.length && (
        <Card>
          <EmptyState icon={<Wallet />} title="Счетов нет" hint="Касса создаётся вместе с точкой; кошельки продавцов и банк добавьте здесь" />
        </Card>
      )}
      <OperationDialog op={op} onClose={() => setOp(null)} accounts={accounts.filter((a) => a.isActive)} />
      <AccountDialog acc={acc} onClose={() => setAcc(null)} />
    </div>
  );
}

// ── Платежи (движения денег) ────────────────────────────

/** Платежи: все движения денег по счетам с фильтром по счёту и периоду */
export function PaymentsPage() {
  const [sp, setSp] = useSearchParams();
  const accountId = sp.get('account') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const accounts = useMoneyAccounts();
  const { data, isLoading, error, refetch } = useMovements({ accountId: accountId || undefined, from, to: `${to}T23:59:59`, page, limit: LIMIT });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  const sum = (data?.items ?? []).reduce((a, m) => ({ in: a.in + Math.max(0, Number(m.amountKgs)), out: a.out + Math.min(0, Number(m.amountKgs)) }), { in: 0, out: 0 });
  return (
    <div className="space-y-6">
      <PageTitle title="Платежи" sub="Каждое движение денег: продажа, оплата долга, расход, перемещение, обмен — с документом и автором" />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Счёт">
          <select className={cn(sel, 'w-72')} value={accountId} onChange={(e) => set('account', e.target.value || undefined)}>
            <option value="">Все счета</option>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {accLabel(a)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="С">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="По">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="ml-auto flex gap-2">
          <Pill tone="ok" className="h-9 px-3 text-[13px]">
            <ArrowDownLeft className="size-3.5" /> {money(sum.in)}
          </Pill>
          <Pill tone="accent-outline" className="h-9 px-3 text-[13px]">
            <ArrowUpRight className="size-3.5" /> {money(Math.abs(sum.out))}
          </Pill>
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">Когда</th>
                <th className="px-2 font-normal">Что</th>
                <th className="px-2 font-normal">Счёт</th>
                <th className="px-2 font-normal">Кто / документ</th>
                <th className="px-4 text-right font-normal">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{date(m.movedAt, 'DD.MM HH:mm')}</td>
                  <td className="px-2">
                    {MOVE_KIND[m.kind] ?? m.kind}
                    {m.verifyStatus === 'unverified' && <Pill tone="warn" className="ml-1 h-5">не сверено</Pill>}
                    {m.comment && <div className="max-w-64 truncate text-xs text-muted">{m.comment}</div>}
                  </td>
                  <td className="px-2 text-ink-2">{m.accountName}</td>
                  <td className="px-2 text-xs text-muted">
                    {m.counterpartyName}
                    {m.documentNumber && <div className="font-mono">{m.documentNumber}</div>}
                  </td>
                  <td className={cn('px-4 text-right font-semibold whitespace-nowrap tabular-nums', Number(m.amount) > 0 ? 'text-ok' : 'text-accent')}>
                    {Number(m.amount) > 0 ? '+' : ''}
                    {money(m.amount, m.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && <EmptyState title="Движений нет" />}
        </div>
      )}
      <Pager page={page} pages={data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1} set={(p) => set('page', String(p))} />
    </div>
  );
}

// ── Сверка переводов ────────────────────────────────────

/** Сверка переводов (ТЗ 17.3): «пришло» по одному или пачкой, «не поступило» → долг или отмена, сопоставление с выпиской */
export function TransfersPage() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? 'unverified';
  const accountId = sp.get('account') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const accounts = useMoneyAccounts({ type: 'wallet' });
  const { data, isLoading, error, refetch } = useTransfers({ status, accountId: accountId || undefined, page, limit: LIMIT });
  const summary = useTransferSummary();
  const qc = useQueryClient();
  const [sel2, setSel2] = useState<Set<string>>(new Set());
  const [nr, setNr] = useState<Transfer | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const inval = () => ['transfers', 'transfers-summary', 'money-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const verify = useMutation({
    mutationFn: (ids: string[]) => moneyApi.verify(ids),
    onSuccess: (r) => (inval(), setSel2(new Set()), toast.success(`Сверено: ${r.verified}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const notRec = useMutation({
    mutationFn: (x: { id: string; action: 'debt' | 'cancel' }) => moneyApi.notReceived(x.id, x.action),
    onSuccess: () => (inval(), setNr(null), toast.success('Отмечено «не поступило»')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const match = useMutation({
    mutationFn: async (f: File) => {
      const up = await uploadFile(f, 'import', f.name);
      return moneyApi.matchStatement(accountId, up.id);
    },
    onSuccess: (r) => {
      setSel2(new Set(r.matches.map((m) => m.transferId)));
      toast.success(`Совпало с выпиской: ${r.matches.length}. Проверьте отмеченные и нажмите «Пришло»`);
      if (r.unmatchedTransfers.length) toast.warning(`Нет в выписке: ${r.unmatchedTransfers.length} переводов`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
    setSel2(new Set());
  };
  const items = data?.items ?? [];
  const all = items.length > 0 && items.every((t) => sel2.has(t.id));
  const selSum = items.filter((t) => sel2.has(t.id)).reduce((a, t) => a + Number(t.amount), 0);
  return (
    <div className="space-y-6">
      <PageTitle title="Сверка переводов" sub="Клиент перевёл продавцу на MBank / O!Деньги — пока владелец не увидел деньги, перевод «не сверен»" />
      {summary.data && summary.data.byWallet.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Tray className="p-3">
            <div className="px-1 pb-2 text-[13px] font-medium">По кошелькам</div>
            {summary.data.byWallet.map((w) => (
              <button key={w.accountId} onClick={() => set('account', w.accountId)} className="flex w-full justify-between gap-2 rounded-[12px] px-2 py-1.5 text-left text-[13px] hover:bg-card">
                <span className="truncate">{w.wallet}</span>
                <b className="tabular-nums">{money(w.amount)}</b>
              </button>
            ))}
          </Tray>
          <Tray className="p-3">
            <div className="px-1 pb-2 text-[13px] font-medium">По продавцам</div>
            {summary.data.bySeller.map((s) => (
              <div key={s.seller} className="flex justify-between gap-2 px-2 py-1.5 text-[13px]">
                <span className="truncate">{s.seller}</span>
                <span className="tabular-nums">
                  {s.count} · <b>{money(s.amount)}</b>
                </span>
              </div>
            ))}
          </Tray>
          <Tray className="p-3">
            <div className="px-1 pb-2 text-[13px] font-medium">По дням</div>
            {summary.data.byDay.slice(0, 6).map((d) => (
              <div key={d.day} className="flex justify-between gap-2 px-2 py-1.5 text-[13px]">
                <span>{date(d.day, 'D MMM, dd')}</span>
                <span className="tabular-nums">
                  {d.count} · <b>{money(d.amount)}</b>
                </span>
              </div>
            ))}
          </Tray>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={status}
          onChange={(v) => set('status', v === 'unverified' ? undefined : v)}
          options={[
            { value: 'unverified', label: 'Не сверено' },
            { value: 'verified', label: 'Пришло' },
            { value: 'not_received', label: 'Не поступило' },
          ]}
        />
        <select className="h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={accountId} onChange={(e) => set('account', e.target.value || undefined)}>
          <option value="">Все кошельки</option>
          {accounts.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && match.mutate(e.target.files[0])} />
        <Button disabled={!accountId || status !== 'unverified'} title={!accountId ? 'Сначала выберите кошелёк' : undefined} loading={match.isPending} onClick={() => file.current?.click()}>
          <FileUp /> Сопоставить с выпиской
        </Button>
      </div>
      {sel2.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-pill px-5 py-3 text-pill-ink">
          <CheckCheck className="size-5 text-accent" />
          <span className="flex-1 text-sm">
            Выбрано <b>{sel2.size}</b> на <b className="tabular-nums">{money(selSum)}</b>
          </span>
          <Button variant="accent" loading={verify.isPending} onClick={() => verify.mutate([...sel2])}>
            <Check /> Пришло
          </Button>
        </div>
      )}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
          {status === 'unverified' && (
            <label className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-xs text-muted">
              <input type="checkbox" checked={all} onChange={() => setSel2(all ? new Set() : new Set(items.map((t) => t.id)))} className="size-4 accent-[var(--accent)]" />
              Выбрать все на странице
            </label>
          )}
          {items.map((t) => (
            <div key={t.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-0', sel2.has(t.id) && 'bg-accent-soft')}>
              {status === 'unverified' && (
                <input
                  type="checkbox"
                  checked={sel2.has(t.id)}
                  onChange={() =>
                    setSel2((s) => {
                      const n = new Set(s);
                      if (n.has(t.id)) n.delete(t.id);
                      else n.add(t.id);
                      return n;
                    })
                  }
                  className="size-4 accent-[var(--accent)]"
                />
              )}
              <span className="w-24 text-[13px] text-muted">{date(t.movedAt, 'DD.MM HH:mm')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{t.accountName}</span>
                <span className="block truncate text-xs text-muted">
                  {t.sellerName ?? '—'}
                  {t.receiptNumber && ` · чек ${t.receiptNumber}`}
                  {t.customerName && ` · ${t.customerName}`}
                </span>
              </span>
              <span className="w-28 text-right text-[15px] font-semibold tabular-nums">{money(t.amount, t.currency)}</span>
              {status === 'unverified' ? (
                <span className="flex gap-1">
                  <Button size="sm" variant="dark" loading={verify.isPending && verify.variables?.[0] === t.id && verify.variables.length === 1} onClick={() => verify.mutate([t.id])}>
                    Пришло
                  </Button>
                  <Button size="sm" variant="ghost" className="text-accent" onClick={() => setNr(t)}>
                    Не пришло
                  </Button>
                </span>
              ) : (
                <Pill tone={t.status === 'verified' ? 'ok' : 'accent-outline'}>{t.status === 'verified' ? 'пришло' : 'не поступило'}</Pill>
              )}
            </div>
          ))}
        </div>
      )}
      {data && !items.length && (
        <Card>
          <EmptyState icon={<CheckCheck />} title={status === 'unverified' ? 'Всё сверено' : 'Пусто'} hint={status === 'unverified' ? 'Новые переводы появятся после продаж с оплатой «перевод»' : undefined} />
        </Card>
      )}
      <Pager page={page} pages={data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1} set={(p) => set('page', String(p))} />
      <Dialog open={!!nr} onOpenChange={(v) => !v && setNr(null)} title="Перевод не поступил" description={nr ? `${money(nr.amount)} · ${nr.accountName}${nr.customerName ? ` · ${nr.customerName}` : ''}` : ''}>
        {nr && (
          <div className="mt-4 grid gap-2">
            <Button variant="dark" disabled={!nr.customerName} loading={notRec.isPending && notRec.variables?.action === 'debt'} onClick={() => notRec.mutate({ id: nr.id, action: 'debt' })}>
              <Wallet /> Записать в долг клиенту
            </Button>
            {!nr.customerName && <div className="text-xs text-muted">У чека нет клиента — долг записать некому</div>}
            <Button variant="ghost" className="text-accent" loading={notRec.isPending && notRec.variables?.action === 'cancel'} onClick={() => notRec.mutate({ id: nr.id, action: 'cancel' })}>
              <Ban /> Отменить чек
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Расходы ─────────────────────────────────────────────

/** Расходы (ТЗ 17.4): аренда, свет, зарплата — по статьям; повторяющиеся проводятся сами */
export function ExpensesPage() {
  const [tab, setTab] = useState<'list' | 'recurring'>('list');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [articleId, setArticleId] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useExpenses({ from, to, articleId: articleId || undefined, page, limit: LIMIT });
  const articles = useArticles();
  const accounts = useMoneyAccounts();
  const rec = useRecurring();
  const can = useCan();
  const qc = useQueryClient();
  const [f, setF] = useState<{ articleId: string; accountId: string; amount: string; date: string; comment: string; newArticle: string; recurring: boolean; dayOfMonth: string } | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      let aid = f!.articleId;
      if (aid === '__new') aid = (await moneyApi.createArticle(f!.newArticle.trim())).id;
      if (f!.recurring) return moneyApi.createRecurring({ articleId: aid, accountId: f!.accountId, amount: f!.amount, dayOfMonth: Number(f!.dayOfMonth) || 1, ...(f!.comment ? { comment: f!.comment } : {}) });
      return moneyApi.createExpense({ articleId: aid, accountId: f!.accountId, amount: f!.amount, date: f!.date, ...(f!.comment ? { comment: f!.comment } : {}) });
    },
    onSuccess: () => {
      ['expenses', 'expense-articles', 'recurring', 'money-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setF(null);
      toast.success('Сохранено');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => moneyApi.cancelExpense(id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['expenses'] }), qc.invalidateQueries({ queryKey: ['money-accounts'] })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (r: { id: string; version: number; isActive: boolean }) => moneyApi.updateRecurring(r.id, { version: r.version, isActive: r.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const byArticle = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data?.items ?? []) if (e.status === 'posted') m.set(e.articleName, (m.get(e.articleName) ?? 0) + Number(e.amountKgs));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const max = byArticle[0]?.[1] ?? 1;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Расходы"
        sub="Расход уменьшает деньги на счёте и прибыль в отчёте «Прибыль». Аренда и зарплата — повторяющимися"
        actions={
          can('money.write') && (
            <Button variant="dark" onClick={() => setF({ articleId: articles.data?.[0]?.id ?? '', accountId: accounts.data?.[0]?.id ?? '', amount: '', date: today(), comment: '', newArticle: '', recurring: tab === 'recurring', dayOfMonth: '1' })}>
              <Plus /> Расход
            </Button>
          )
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'list', label: 'Расходы' },
          { value: 'recurring', label: 'Повторяющиеся' },
        ]}
      />
      {tab === 'list' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="С">
              <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
            </Field>
            <Field label="По">
              <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
            </Field>
            <Field label="Статья">
              <select className={cn(sel, 'w-56')} value={articleId} onChange={(e) => (setArticleId(e.target.value), setPage(1))}>
                <option value="">Все</option>
                {articles.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              {error && <ErrorState error={error} onRetry={refetch} />}
              {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
              <div className="space-y-1.5">
                {data?.items.map((e) => (
                  <div key={e.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[18px] bg-card px-4 py-2.5 ring-1 ring-line', e.status === 'cancelled' && 'opacity-50')}>
                    <span className="w-16 text-[13px] text-muted">{date(e.date, 'DD.MM')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">
                        {e.articleName}
                        {e.recurringId && <Repeat className="ml-1 inline size-3 text-muted" />}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {e.accountName}
                        {e.memberName && ` · ${e.memberName}`}
                        {e.counterpartyName && ` · ${e.counterpartyName}`}
                        {e.comment && ` · ${e.comment}`}
                      </span>
                    </span>
                    <span className={cn('w-28 text-right font-semibold tabular-nums', e.status === 'cancelled' && 'line-through')}>{money(e.amount, e.currency)}</span>
                    {e.status === 'posted' && can('money.write') && (
                      <button onClick={() => confirm('Отменить расход? Деньги вернутся на счёт.') && cancel.mutate(e.id)} className="grid size-8 place-items-center rounded-full text-muted hover:text-accent" aria-label="Отменить">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {data && !data.items.length && (
                  <Card>
                    <EmptyState title="Расходов за период нет" />
                  </Card>
                )}
              </div>
              <Pager page={page} pages={data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1} set={setPage} />
            </div>
            <div className="space-y-3">
              <div className="hatch rounded-[22px] bg-pill p-4 text-pill-ink">
                <div className="text-xs opacity-60">За период</div>
                <div className="mt-1 text-[28px] font-semibold tabular-nums">{data ? money(data.totalKgs) : '…'}</div>
              </div>
              <Tray className="space-y-2 p-3">
                <div className="px-1 text-[13px] font-medium">По статьям</div>
                {byArticle.map(([n, v]) => (
                  <div key={n} className="px-1">
                    <div className="flex justify-between text-[13px]">
                      <span className="truncate">{n}</span>
                      <b className="tabular-nums">{money(v)}</b>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(v / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </Tray>
            </div>
          </div>
        </>
      )}
      {tab === 'recurring' && (
        <div className="space-y-1.5">
          {rec.data?.map((r) => (
            <div key={r.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[18px] bg-card px-4 py-3 ring-1 ring-line', !r.isActive && 'opacity-50')}>
              <Repeat className="size-4 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{r.articleName}</span>
                <span className="block text-xs text-muted">
                  каждое {r.dayOfMonth} число · {r.accountName} · следующий {date(r.nextDate, 'D MMM')}
                </span>
              </span>
              <span className="w-28 text-right font-semibold tabular-nums">{money(r.amount, r.currency)}</span>
              <Switch checked={r.isActive} onChange={(v) => toggle.mutate({ id: r.id, version: r.version, isActive: v })} />
            </div>
          ))}
          {rec.data && !rec.data.length && (
            <Card>
              <EmptyState icon={<Repeat />} title="Повторяющихся нет" hint="Аренда 1-го числа, свет, интернет — проводятся сами" />
            </Card>
          )}
        </div>
      )}
      <Dialog open={!!f} onOpenChange={(v) => !v && setF(null)} title={f?.recurring ? 'Повторяющийся расход' : 'Расход'}>
        {f && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Статья">
                <select className={sel} value={f.articleId} onChange={(e) => setF({ ...f, articleId: e.target.value })}>
                  {articles.data?.filter((a) => a.isActive).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  <option value="__new">+ новая статья…</option>
                </select>
              </Field>
              {f.articleId === '__new' ? (
                <Field label="Название статьи">
                  <Input value={f.newArticle} onChange={(e) => setF({ ...f, newArticle: e.target.value })} placeholder="Охрана" />
                </Field>
              ) : (
                <Field label="Сумма">
                  <Input autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} className="font-semibold" />
                </Field>
              )}
            </div>
            {f.articleId === '__new' && (
              <Field label="Сумма">
                <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Откуда платим">
                <select className={sel} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                  {accounts.data?.filter((a) => a.isActive).map((a) => (
                    <option key={a.id} value={a.id}>
                      {accLabel(a)}
                    </option>
                  ))}
                </select>
              </Field>
              {f.recurring ? (
                <Field label="Число месяца">
                  <Input inputMode="numeric" value={f.dayOfMonth} onChange={(e) => setF({ ...f, dayOfMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                </Field>
              ) : (
                <Field label="Дата">
                  <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                </Field>
              )}
            </div>
            <Field label="Комментарий">
              <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} />
            </Field>
            <Switch checked={f.recurring} onChange={(v) => setF({ ...f, recurring: v })} label="Повторять каждый месяц" />
            <div className="flex justify-end">
              <Button variant="dark" disabled={!(Number(f.amount) > 0) || !f.accountId || !f.articleId || (f.articleId === '__new' && !f.newArticle.trim())} loading={create.isPending} onClick={() => create.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
