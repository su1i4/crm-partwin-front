import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, Bell, Check, CheckCircle2, ChevronLeft, ChevronRight, Gift, Handshake, Hourglass, Percent, Plus, QrCode, Scale, Search, Tag, Ticket, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { customerApi, useDebts } from '@/entities/customer';
import { useCounterparties } from '@/entities/pos';
import { requestApi, useWaitlist, type WaitlistEntry } from '@/entities/request';
import { useCan } from '@/entities/session';
import { stoApi, useBonuses, useBonusRules, useLiability, usePromotions, useSelections, useTasks, type BonusRule, type Promotion } from '@/entities/sto';
import { DebtPayDialog } from '@/features/debt-pay';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const LIMIT = 50;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthStart = () => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const today = () => ymd(new Date());

// ── Долги и взаиморасчёты ───────────────────────────────

/** Долги (ТЗ 15): нам должны / мы должны, возраст долга, оплата, зачёт встречных */
export function DebtsPage({ defaultDirection = 'receivable' }: { defaultDirection?: 'receivable' | 'payable' }) {
  const [sp, setSp] = useSearchParams();
  const direction = (sp.get('dir') as 'receivable' | 'payable') ?? defaultDirection;
  const overdueOnly = sp.get('overdue') === '1';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const { data, isLoading, error, refetch } = useDebts({ direction, overdueOnly: overdueOnly || undefined, q: dq || undefined, page, limit: LIMIT });
  const [pay, setPay] = useState<{ id: string; name: string; currency: string; amount: string } | null>(null);
  const qc = useQueryClient();
  const can = useCan();
  const offset = useMutation({
    mutationFn: (x: { id: string; currency: string }) => customerApi.offset(x.id, x.currency),
    onSuccess: (r) => (qc.invalidateQueries({ queryKey: ['debts'] }), toast.success(Number(r.amount) > 0 ? `Зачтено ${money(r.amount, r.currency)}` : 'Встречных долгов нет')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  const totals = (data?.items ?? []).reduce<Record<string, { amount: number; overdue: number }>>((a, r) => {
    const t = (a[r.currency] ??= { amount: 0, overdue: 0 });
    t.amount += Number(r.amount);
    t.overdue += Number(r.overdue);
    return a;
  }, {});
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const age = (v: string, cls: string) => <td className={cn('px-2 text-right tabular-nums', Number(v) > 0 ? cls : 'text-faint')}>{Number(v) > 0 ? num(v) : '—'}</td>;
  return (
    <div className="space-y-6">
      <PageTitle
        title={direction === 'receivable' ? 'Долги клиентов' : 'Взаиморасчёты'}
        sub={direction === 'receivable' ? 'Кто сколько должен и как давно. Оплата гасит сначала старые долги или выбранные позиции' : 'Сколько мы должны поставщикам, соседям и мастерам. Зачёт встречных — одной кнопкой'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={direction}
          onChange={(v) => set('dir', v === defaultDirection ? undefined : v)}
          options={[
            { value: 'receivable', label: 'Нам должны' },
            { value: 'payable', label: 'Мы должны' },
          ]}
        />
        <Input icon={<Search />} placeholder="Имя или телефон" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs flex-1" />
        <Switch checked={overdueOnly} onChange={(v) => set('overdue', v ? '1' : undefined)} label="Только просроченные" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(totals).map(([cur, t]) => (
          <div key={cur} className="hatch min-w-56 rounded-[22px] bg-pill p-4 text-pill-ink">
            <div className="text-xs opacity-60">{direction === 'receivable' ? 'Нам должны' : 'Мы должны'} · {cur}</div>
            <div className="mt-1 text-[28px] font-semibold tabular-nums">{money(t.amount, cur)}</div>
            {t.overdue > 0 && <div className="text-xs text-accent">просрочено {money(t.overdue, cur)}</div>}
          </div>
        ))}
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">Контрагент</th>
                <th className="px-2 text-right font-normal">Всего</th>
                <th className="px-2 text-right font-normal">Просрочено</th>
                <th className="px-2 text-right font-normal">0–30</th>
                <th className="px-2 text-right font-normal">31–60</th>
                <th className="px-2 text-right font-normal">61–90</th>
                <th className="px-2 text-right font-normal">90+</th>
                <th className="w-44" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.counterpartyId + r.currency} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <Link to={direction === 'receivable' ? `/customers/${r.counterpartyId}` : `/purchasing/suppliers/${r.counterpartyId}`} className="font-medium hover:text-accent">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.phone ?? '—'} · с {date(r.oldestAt, 'D MMM')}
                    </div>
                  </td>
                  <td className="px-2 text-right font-semibold tabular-nums">{money(r.amount, r.currency)}</td>
                  {age(r.overdue, 'font-medium text-accent')}
                  {age(r.age0_30, '')}
                  {age(r.age31_60, '')}
                  {age(r.age61_90, 'text-warn')}
                  {age(r.age90plus, 'text-accent')}
                  <td className="pr-3 text-right whitespace-nowrap">
                    {direction === 'payable' && (
                      <Button size="sm" variant="ghost" loading={offset.isPending && offset.variables?.id === r.counterpartyId} onClick={() => offset.mutate({ id: r.counterpartyId, currency: r.currency })} title="Зачесть встречные долги">
                        <Scale />
                      </Button>
                    )}
                    {can('customers.debts') && (
                      <Button size="sm" variant={direction === 'receivable' ? 'accent' : 'dark'} onClick={() => setPay({ id: r.counterpartyId, name: r.name, currency: r.currency, amount: r.amount })}>
                        {direction === 'receivable' ? 'Принять' : 'Оплатить'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && !data.items.length && (
        <Card>
          <EmptyState icon={<Handshake />} title="Долгов нет" hint={direction === 'receivable' ? 'Долг появляется при продаже «в долг» на кассе' : 'Долг поставщику — из проведённых приёмок без оплаты'} />
        </Card>
      )}
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
      {pay && <DebtPayDialog open onOpenChange={(v) => !v && setPay(null)} counterpartyId={pay.id} name={pay.name} direction={direction === 'receivable' ? 'in' : 'out'} currency={pay.currency} suggested={pay.amount} />}
    </div>
  );
}

// ── Мастера и бонусы ────────────────────────────────────

const RULE_KIND: Record<BonusRule['kind'], string> = { percent_sales: '% от продаж', percent_margin: '% от маржи', fixed: 'фикс. сумма с чека' };

/** Мастера и бонусы (ТЗ 14.6): правила, начислено / выплачено / должны за период */
export function MastersPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const bonuses = useBonuses({ from, to });
  const rules = useBonusRules();
  const cats = useCategories();
  const masters = useCounterparties('', 'master');
  const qc = useQueryClient();
  const [rule, setRule] = useState<Partial<BonusRule> | null>(null);
  const [pay, setPay] = useState<{ id: string; name: string; amount: string } | null>(null);
  const save = useMutation({
    mutationFn: () => stoApi.saveRule(rule!.id ?? null, { ...(rule!.id ? { version: rule!.version } : {}), masterId: rule!.masterId || null, categoryId: rule!.categoryId || null, kind: rule!.kind, value: rule!.value, isActive: rule!.isActive ?? true }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['bonus-rules'] }), setRule(null), toast.success('Правило сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mName = (id: string | null) => (id ? (masters.data?.items.find((m) => m.id === id)?.name ?? 'мастер') : 'Все мастера');
  const cName = (id: string | null) => (id ? (cats.data?.find((c) => c.id === id)?.name ?? 'группа') : 'все группы');
  const total = (bonuses.data ?? []).reduce((a, b) => ({ accrued: a.accrued + Number(b.accrued), owed: a.owed + Number(b.owed) }), { accrued: 0, owed: 0 });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Мастера и бонусы"
        sub="Мастер привёл клиента — с чека начисляется бонус. Выплата — деньгами или зачётом его долга"
        actions={
          <Button variant="dark" onClick={() => setRule({ kind: 'percent_sales', value: '5', masterId: null, categoryId: null, isActive: true })}>
            <Plus /> Правило
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="С">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="По">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div className="ml-auto flex gap-3">
              <div className="rounded-[18px] bg-card px-4 py-2 ring-1 ring-line">
                <div className="text-xs text-muted">Начислено</div>
                <div className="text-lg font-semibold tabular-nums">{money(total.accrued)}</div>
              </div>
              <div className="rounded-[18px] bg-pill px-4 py-2 text-pill-ink">
                <div className="text-xs opacity-60">Должны мастерам</div>
                <div className="text-lg font-semibold tabular-nums">{money(total.owed)}</div>
              </div>
            </div>
          </div>
          {bonuses.isLoading && <Skeleton className="h-40 rounded-[24px]" />}
          <div className="space-y-1.5">
            {bonuses.data?.map((b) => (
              <div key={b.masterId} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line">
                <Wrench className="size-4 text-accent" />
                <Link to={`/customers/${b.masterId}`} className="min-w-0 flex-1 truncate text-[14.5px] font-medium hover:text-accent">
                  {b.name}
                </Link>
                <span className="text-xs text-muted">{b.receipts} чеков</span>
                <span className="w-28 text-right text-[13px] tabular-nums">+{money(b.accrued)}</span>
                <span className="w-28 text-right text-[13px] text-ok tabular-nums">выпл. {money(b.paid)}</span>
                <span className={cn('w-28 text-right font-semibold tabular-nums', Number(b.owed) > 0 && 'text-accent')}>{money(b.owed)}</span>
                <Button size="sm" variant="dark" disabled={!(Number(b.owed) > 0)} onClick={() => setPay({ id: b.masterId, name: b.name, amount: b.owed })}>
                  Выплатить
                </Button>
              </div>
            ))}
            {bonuses.data && !bonuses.data.length && (
              <Card>
                <EmptyState icon={<Wrench />} title="За период бонусов нет" hint="Бонус начисляется, когда на кассе в чеке выбран мастер" />
              </Card>
            )}
          </div>
        </div>
        <Tray className="h-fit p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">Правила начисления</div>
          <div className="space-y-1">
            {rules.data?.map((r) => (
              <button key={r.id} onClick={() => setRule(r)} className={cn('flex w-full items-center gap-2 rounded-[14px] bg-card px-3 py-2.5 text-left text-[13px]', !r.isActive && 'opacity-50')}>
                <Percent className="size-3.5 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {r.kind === 'fixed' ? money(r.value) : `${num(r.value, 2)}%`} {RULE_KIND[r.kind]}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {mName(r.masterId)} · {cName(r.categoryId)}
                  </span>
                </span>
              </button>
            ))}
            {rules.data && !rules.data.length && <div className="rounded-[14px] bg-card px-3 py-2 text-sm text-muted">Правил нет — бонусы не начисляются</div>}
          </div>
        </Tray>
      </div>
      <Dialog open={!!rule} onOpenChange={(v) => !v && setRule(null)} title={rule?.id ? 'Правило бонуса' : 'Новое правило'} description="Частное правило (мастер, группа) важнее общего">
        {rule && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Вид">
                <select className={sel} value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value as BonusRule['kind'] })}>
                  {Object.entries(RULE_KIND).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={rule.kind === 'fixed' ? 'Сумма, сом' : 'Процент'}>
                <Input inputMode="decimal" value={rule.value ?? ''} onChange={(e) => setRule({ ...rule, value: e.target.value.replace(/[^\d.]/g, '') })} />
              </Field>
              <Field label="Мастер">
                <select className={sel} value={rule.masterId ?? ''} onChange={(e) => setRule({ ...rule, masterId: e.target.value || null })}>
                  <option value="">Все мастера</option>
                  {masters.data?.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Группа товаров">
                <select className={sel} value={rule.categoryId ?? ''} onChange={(e) => setRule({ ...rule, categoryId: e.target.value || null })}>
                  <option value="">Все группы</option>
                  {cats.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'— '.repeat(c.level)}
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Switch checked={rule.isActive ?? true} onChange={(v) => setRule({ ...rule, isActive: v })} label="Действует" />
            <div className="flex justify-end">
              <Button variant="dark" disabled={!Number(rule.value)} loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      {pay && <DebtPayDialog open onOpenChange={(v) => !v && setPay(null)} counterpartyId={pay.id} name={pay.name} direction="out" suggested={pay.amount} />}
    </div>
  );
}

// ── Лояльность и акции ──────────────────────────────────

const PROMO_KIND: Record<Promotion['kind'], string> = { percent: 'Скидка %', receipt_amount: 'Скидка от суммы чека', second_item: 'Второй товар со скидкой' };

/** Лояльность (ТЗ 16): бонусы на картах, акции и промокоды, QR для бота */
export function LoyaltyPage() {
  const liab = useLiability();
  const promos = usePromotions();
  const cats = useCategories();
  const qc = useQueryClient();
  const [p, setP] = useState<{ id?: string; version?: number; name: string; kind: Promotion['kind']; percent: string; minAmount: string; categoryIds: string[]; startsOn: string; endsOn: string; byCode: boolean; stackable: boolean; isActive: boolean } | null>(null);
  const [codes, setCodes] = useState<{ id: string; code: string; generate: string } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      stoApi.savePromotion(p!.id ?? null, {
        ...(p!.id ? { version: p!.version } : {}),
        name: p!.name,
        kind: p!.kind,
        percent: p!.percent || '0',
        ...(p!.minAmount ? { minAmount: p!.minAmount } : {}),
        categoryIds: p!.categoryIds,
        ...(p!.startsOn ? { startsOn: p!.startsOn } : {}),
        ...(p!.endsOn ? { endsOn: p!.endsOn } : {}),
        byCode: p!.byCode,
        stackable: p!.stackable,
        isActive: p!.isActive,
      }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['promotions'] }), setP(null), toast.success('Акция сохранена')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addCodes = useMutation({
    mutationFn: () => stoApi.addCodes(codes!.id, codes!.generate ? { generate: Number(codes!.generate), maxUses: 1 } : { codes: [codes!.code.trim().toUpperCase()] }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['promotions'] }), setCodes(null), toast.success('Коды добавлены')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bot = useMutation({ mutationFn: stoApi.botLink, onSuccess: (r) => navigator.clipboard.writeText(r.link).then(() => toast.success('Ссылка на бот скопирована — сделайте из неё QR на кассе')), onError: (e) => toast.error(errorMessage(e)) });
  const toForm = (x?: Promotion) => ({
    id: x?.id,
    version: x?.version,
    name: x?.name ?? '',
    kind: x?.kind ?? 'percent',
    percent: x ? String(Number(x.percent)) : '10',
    minAmount: x?.min_amount ? String(Number(x.min_amount)) : '',
    categoryIds: x?.category_ids ?? [],
    startsOn: x?.starts_on ?? '',
    endsOn: x?.ends_on ?? '',
    byCode: x?.by_code ?? false,
    stackable: x?.stackable ?? false,
    isActive: x?.is_active ?? true,
  });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Лояльность и акции"
        sub="Бонусы на картах — обязательство магазина. Акции применяются на кассе сами, по промокоду — после ввода кода"
        actions={
          <>
            <Button onClick={() => bot.mutate()} loading={bot.isPending}>
              <QrCode /> Ссылка на бот
            </Button>
            <Button variant="dark" onClick={() => setP(toForm())}>
              <Plus /> Акция
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="hatch rounded-[22px] bg-pill p-4 text-pill-ink">
          <div className="text-xs opacity-60">Бонусов на картах</div>
          <div className="mt-1 text-[28px] font-semibold tabular-nums">{liab.data ? money(liab.data.onCards) : '…'}</div>
          <div className="text-xs opacity-60">{liab.data?.customers ?? 0} клиентов</div>
        </div>
        {[
          ['Начислено за месяц', liab.data?.thisMonth.accrued],
          ['Оплачено бонусами', liab.data?.thisMonth.spent],
          ['Сгорело', liab.data?.thisMonth.expired],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v != null ? money(v) : '…'}</div>
          </div>
        ))}
      </div>
      {promos.isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {promos.data?.map((x) => {
          const live = x.is_active && (!x.ends_on || x.ends_on >= today());
          return (
            <div key={x.id} className={cn('space-y-2 rounded-[24px] bg-card p-4 ring-1 ring-line', !live && 'opacity-60')}>
              <button onClick={() => setP(toForm(x))} className="flex w-full items-start gap-2 text-left">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Tag className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium">{x.name}</span>
                  <span className="block text-xs text-muted">
                    {PROMO_KIND[x.kind]} · {num(x.percent, 1)}%{x.min_amount && ` от ${money(x.min_amount)}`}
                  </span>
                </span>
                <Pill tone={live ? 'ok' : 'muted'}>{live ? 'идёт' : 'выкл'}</Pill>
              </button>
              <div className="text-xs text-muted">
                {x.starts_on || x.ends_on ? `${x.starts_on ? date(x.starts_on, 'D MMM') : '…'} — ${x.ends_on ? date(x.ends_on, 'D MMM') : '…'}` : 'бессрочно'}
                {x.category_ids.length > 0 && ` · ${x.category_ids.map((c) => cats.data?.find((k) => k.id === c)?.name).filter(Boolean).join(', ')}`}
              </div>
              {x.by_code && (
                <div className="flex flex-wrap items-center gap-1">
                  {(x.codes ?? []).slice(0, 6).map((c) => (
                    <Pill key={c.id} tone="outline" className="font-mono">
                      {c.code}
                      {c.maxUses ? ` ${c.usedCount}/${c.maxUses}` : ''}
                    </Pill>
                  ))}
                  {(x.codes?.length ?? 0) > 6 && <span className="text-xs text-muted">+{x.codes!.length - 6}</span>}
                  <button onClick={() => setCodes({ id: x.id, code: '', generate: '' })} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs text-muted ring-1 ring-line ring-dashed hover:text-ink">
                    <Ticket className="size-3" /> коды
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {promos.data && !promos.data.length && (
        <Card>
          <EmptyState icon={<Gift />} title="Акций нет" hint="Например: зима −10% на аккумуляторы или промокод для такси" />
        </Card>
      )}
      <Dialog open={!!p} onOpenChange={(v) => !v && setP(null)} title={p?.id ? 'Акция' : 'Новая акция'} className="max-w-xl">
        {p && (
          <div className="mt-4 space-y-4">
            <Field label="Название">
              <Input autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Зима: −10% на аккумуляторы" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Вид">
                <select className={sel} value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Promotion['kind'] })}>
                  {Object.entries(PROMO_KIND).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Скидка, %">
                <Input inputMode="decimal" value={p.percent} onChange={(e) => setP({ ...p, percent: e.target.value.replace(/[^\d.]/g, '') })} />
              </Field>
              {p.kind === 'receipt_amount' && (
                <Field label="От суммы, сом">
                  <Input inputMode="numeric" value={p.minAmount} onChange={(e) => setP({ ...p, minAmount: e.target.value.replace(/\D/g, '') })} />
                </Field>
              )}
            </div>
            <Field label="Группы товаров" hint="Пусто — на всё">
              <div className="flex flex-wrap gap-1.5">
                {cats.data?.filter((c) => c.level === 0).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setP({ ...p, categoryIds: p.categoryIds.includes(c.id) ? p.categoryIds.filter((x) => x !== c.id) : [...p.categoryIds, c.id] })}
                    className={cn('h-7 rounded-full px-3 text-xs ring-1', p.categoryIds.includes(c.id) ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink-2 ring-line')}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="С">
                <Input type="date" value={p.startsOn} onChange={(e) => setP({ ...p, startsOn: e.target.value })} />
              </Field>
              <Field label="По">
                <Input type="date" value={p.endsOn} onChange={(e) => setP({ ...p, endsOn: e.target.value })} />
              </Field>
            </div>
            <div className="flex flex-col gap-2.5">
              <Switch checked={p.byCode} onChange={(v) => setP({ ...p, byCode: v })} label="Только по промокоду" />
              <Switch checked={p.stackable} onChange={(v) => setP({ ...p, stackable: v })} label="Суммируется с другими скидками" />
              <Switch checked={p.isActive} onChange={(v) => setP({ ...p, isActive: v })} label="Включена" />
            </div>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!p.name.trim() || !Number(p.percent)} loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={!!codes} onOpenChange={(v) => !v && setCodes(null)} title="Промокоды" description="Свой код или пачка одноразовых">
        {codes && (
          <div className="mt-4 space-y-4">
            <Field label="Свой код">
              <Input value={codes.code} onChange={(e) => setCodes({ ...codes, code: e.target.value, generate: '' })} placeholder="TAXI10" className="font-mono uppercase" />
            </Field>
            <Field label="Или сгенерировать одноразовых, шт">
              <Input inputMode="numeric" value={codes.generate} onChange={(e) => setCodes({ ...codes, generate: e.target.value.replace(/\D/g, ''), code: '' })} placeholder="100" />
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!codes.code.trim() && !codes.generate} loading={addCodes.isPending} onClick={() => addCodes.mutate()}>
                Добавить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Лист ожидания ───────────────────────────────────────

const WL: Record<WaitlistEntry['status'], { label: string; tone: 'soft' | 'ok' | 'muted' | 'accent-outline' }> = {
  waiting: { label: 'ждёт', tone: 'soft' },
  notified: { label: 'уведомлён', tone: 'accent-outline' },
  done: { label: 'купил', tone: 'ok' },
  cancelled: { label: 'отменён', tone: 'muted' },
};

/** Лист ожидания (ТЗ 13.6): клиент ждёт товар — придёт уведомление при приёмке */
export function WaitlistPage() {
  const [status, setStatus] = useState('waiting,notified');
  const { data, isLoading, error, refetch } = useWaitlist(status || undefined);
  const qc = useQueryClient();
  const [add, setAdd] = useState<{ product: PickedProduct | null; query: string; name: string; phone: string; qty: string; note: string } | null>(null);
  const create = useMutation({
    mutationFn: () =>
      requestApi.addWaitlist({
        ...(add!.product ? { productId: add!.product.id } : { query: add!.query.trim() }),
        ...(add!.name ? { customerName: add!.name } : {}),
        ...(add!.phone ? { customerPhone: add!.phone } : {}),
        qty: add!.qty || '1',
        ...(add!.note ? { note: add!.note } : {}),
      }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['waitlist'] }), setAdd(null), toast.success('Добавлено в лист ожидания')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const st = useMutation({
    mutationFn: (x: { e: WaitlistEntry; s: 'done' | 'cancelled' | 'waiting' }) => requestApi.waitlistStatus(x.e.id, x.e.version, x.s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Лист ожидания"
        sub="Нет в наличии — запишите клиента. При приёмке этого товара придёт уведомление, клиенту — сообщение"
        actions={
          <Button variant="dark" onClick={() => setAdd({ product: null, query: '', name: '', phone: '', qty: '1', note: '' })}>
            <Plus /> Записать
          </Button>
        }
      />
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'waiting,notified', label: 'Ждут' },
          { value: 'done', label: 'Купили' },
          { value: 'cancelled', label: 'Отменены' },
          { value: '', label: 'Все' },
        ]}
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line">
            <Hourglass className="size-4 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium">{e.productName ?? e.query}</span>
              <span className="block truncate text-xs text-muted">
                {e.customerName ?? 'без имени'} {e.customerPhone && `· ${e.customerPhone}`} · {num(e.qty)} шт · {ago(e.createdAt)}
                {e.note && ` · ${e.note}`}
              </span>
            </span>
            {e.notifiedAt && (
              <span className="flex items-center gap-1 text-xs text-ok">
                <Bell className="size-3.5" /> пришло {date(e.notifiedAt, 'D MMM')}
              </span>
            )}
            <Pill tone={WL[e.status].tone}>{WL[e.status].label}</Pill>
            {(e.status === 'waiting' || e.status === 'notified') && (
              <span className="flex gap-1">
                {e.customerPhone && (
                  <a href={`https://wa.me/${e.customerPhone.replace(/\D/g, '').replace(/^0/, '996')}`} target="_blank" rel="noreferrer">
                    <Button size="sm">WhatsApp</Button>
                  </a>
                )}
                <Button size="sm" variant="dark" onClick={() => st.mutate({ e, s: 'done' })}>
                  <Check /> Купил
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => st.mutate({ e, s: 'cancelled' })} aria-label="Отменить">
                  <X />
                </Button>
              </span>
            )}
          </div>
        ))}
        {data && !data.length && (
          <Card>
            <EmptyState icon={<Hourglass />} title="Никто не ждёт" hint="Запись в лист ожидания — и с кассы, когда товара нет" />
          </Card>
        )}
      </div>
      <Dialog open={!!add} onOpenChange={(v) => !v && setAdd(null)} title="Записать в лист ожидания">
        {add && (
          <div className="mt-4 space-y-4">
            {add.product ? (
              <div className="flex items-center gap-2 rounded-[16px] bg-card-muted px-4 py-2.5 text-sm">
                <span className="flex-1">{add.product.name}</span>
                <button onClick={() => setAdd({ ...add, product: null })} className="text-muted hover:text-accent" aria-label="Убрать">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <ProductAddField autoFocus placeholder="Товар из каталога" onPick={(p) => setAdd({ ...add, product: p })} />
                <Field label="Или словами, если товара нет в каталоге">
                  <Input value={add.query} onChange={(e) => setAdd({ ...add, query: e.target.value })} placeholder="Фара левая Ipsum 2003" />
                </Field>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
              <Field label="Клиент">
                <Input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
              </Field>
              <Field label="Телефон">
                <Input inputMode="tel" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} />
              </Field>
              <Field label="Шт">
                <Input inputMode="numeric" value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Field label="Заметка">
              <Input value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={(!add.product && !add.query.trim()) || (!add.phone && !add.name)} loading={create.isPending} onClick={() => create.mutate()}>
                Записать
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Выдачи на подбор ────────────────────────────────────

/** Выдачи на подбор (ТЗ 14.3): мастер забрал детали примерить — что не подошло, вернёт */
export function SelectionsPage() {
  const [status, setStatus] = useState('open');
  const { data, isLoading, error, refetch } = useSelections(status || undefined);
  return (
    <div className="space-y-6">
      <PageTitle title="Выдачи на подбор" sub="Товар числится на складе «У клиента». Закрытие — с кассы: подошедшее продаётся, остальное возвращается" />
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'На руках' },
          { value: 'closed', label: 'Закрытые' },
          { value: '', label: 'Все' },
        ]}
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((s) => (
          <div key={s.id} className={cn('space-y-2 rounded-[24px] bg-card p-4 ring-1', s.overdue ? 'ring-accent' : 'ring-line')}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-muted">{s.number}</span>
              <Link to={`/customers/${s.counterpartyId}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">
                {s.customer}
              </Link>
              {s.overdue ? <Pill tone="accent">просрочено</Pill> : <Pill tone={s.status === 'open' ? 'dark' : 'muted'}>{s.status === 'open' ? 'на руках' : 'закрыто'}</Pill>}
            </div>
            <div className="space-y-0.5 text-[13px]">
              {s.lines.slice(0, 4).map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate">{l.name ?? 'товар'}</span>
                  <span className="text-muted tabular-nums">{num(l.qty, 3)}</span>
                </div>
              ))}
              {s.lines.length > 4 && <div className="text-xs text-muted">ещё {s.lines.length - 4}</div>}
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>выдано {date(s.createdAt, 'D MMM')}</span>
              {s.dueDate && (
                <span className={cn(s.overdue && 'font-medium text-accent')}>
                  <AlarmClock className="mr-1 inline size-3.5" />
                  до {date(s.dueDate, 'D MMM')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {data && !data.length && (
        <Card>
          <EmptyState title="Ничего не выдано" hint="Выдать на подбор можно с кассы — кнопка «На подбор» в чеке" />
        </Card>
      )}
    </div>
  );
}

// ── Мои задачи ──────────────────────────────────────────

/** Задачи (ТЗ 14.9): перезвонить, напомнить о замене масла, вернуть подбор */
export function TasksPage() {
  const [mine, setMine] = useState(true);
  const [status, setStatus] = useState('open');
  const { data, isLoading, error, refetch } = useTasks({ status, mine: mine || undefined });
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const create = useMutation({
    mutationFn: () => stoApi.createTask({ title: title.trim(), ...(due ? { dueAt: new Date(due).toISOString() } : {}) }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['tasks'] }), setTitle(''), setDue('')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const done = useMutation({
    mutationFn: (t: { id: string; version: number; status: 'done' | 'open' }) => stoApi.updateTask(t.id, { version: t.version, status: t.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const now = Date.now();
  return (
    <div className="space-y-6">
      <PageTitle title="Мои задачи" sub="Напоминания о клиентах: перезвонить, замена масла, забрать подбор, долг" />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Открытые' },
            { value: 'done', label: 'Сделано' },
          ]}
        />
        <Switch checked={mine} onChange={setMine} label="Только мои" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && title.trim() && create.mutate()} placeholder="Новая задача — Enter" className="min-w-60 flex-1" />
        <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="w-56" />
        <Button variant="dark" disabled={!title.trim()} loading={create.isPending} onClick={() => create.mutate()}>
          <Plus /> Добавить
        </Button>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.map((t) => {
          const late = t.status === 'open' && t.dueAt && new Date(t.dueAt).getTime() < now;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line">
              <button onClick={() => done.mutate({ id: t.id, version: t.version, status: t.status === 'done' ? 'open' : 'done' })} className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-2', t.status === 'done' ? 'bg-ok text-white ring-ok' : 'ring-line-strong hover:ring-ink')} aria-label="Сделано">
                {t.status === 'done' && <CheckCircle2 className="size-4" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[14.5px]', t.status === 'done' && 'text-muted line-through')}>{t.title}</span>
                <span className="block truncate text-xs text-muted">
                  {t.customerName && (
                    <Link to={`/customers/${t.counterpartyId}`} className="hover:text-ink">
                      {t.customerName}
                    </Link>
                  )}
                  {t.customerName && t.assigneeName && ' · '}
                  {t.assigneeName}
                </span>
              </span>
              {t.dueAt && <span className={cn('text-xs whitespace-nowrap', late ? 'font-medium text-accent' : 'text-muted')}>{date(t.dueAt, 'D MMM, HH:mm')}</span>}
            </div>
          );
        })}
        {data && !data.length && (
          <Card>
            <EmptyState icon={<CheckCircle2 />} title={status === 'open' ? 'Задач нет' : 'Пока ничего не сделано'} />
          </Card>
        )}
      </div>
    </div>
  );
}
