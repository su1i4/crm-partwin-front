import * as Tabs from '@radix-ui/react-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, ChevronLeft, ChevronRight, ClipboardList, FileDown, Gift, MessageCircle, NotebookPen, Pencil, Phone, PhoneCall, Plus, Search, Send, Trash2, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { customerApi, ROLE_LABEL, useCustomerCard, useCustomers, useDebtItems, useFeed, useGroups, useLoyalty, type CustomerCard, type CustomerInput, type Vehicle } from '@/entities/customer';
import { DEBT_KIND } from '@/entities/money';
import { usePriceTypes } from '@/entities/pricing';
import { useCan } from '@/entities/session';
import { openPdf } from '@/entities/stock';
import { DebtPayDialog } from '@/features/debt-pay';
import { ProductAddField } from '@/features/product-add';
import { ApiError, errorMessage } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Avatar, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const LIMIT = 50;
const CUSTOMER_ROLES = ['customer', 'sto', 'master', 'consignee'];

// ── Создание / правка ────────────────────────────────────

type Form = { name: string; kind: 'person' | 'company'; phone: string; whatsapp: string; inn: string; address: string; roles: string[]; groupId: string; priceTypeId: string; discountPercent: string; debtLimit: string; debtDays: string; birthday: string; note: string; tags: string };
const toForm = (c?: CustomerCard, role = 'customer'): Form => ({
  name: c?.name ?? '',
  kind: c?.kind ?? 'person',
  phone: c?.phone ?? '',
  whatsapp: c?.messengers?.whatsapp ?? '',
  inn: c?.inn ?? '',
  address: c?.address ?? '',
  roles: c?.roles ?? [role],
  groupId: c?.groupId ?? '',
  priceTypeId: c?.priceTypeId ?? '',
  discountPercent: c?.discountPercent ? String(Number(c.discountPercent)) : '',
  debtLimit: c?.debtLimit != null ? String(Number(c.debtLimit)) : '',
  debtDays: c?.debtDays?.toString() ?? '',
  birthday: c?.birthday ?? '',
  note: c?.note ?? '',
  tags: (c?.tags ?? []).join(', '),
});

export function CustomerDialog({ open, onOpenChange, card, role, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; card?: CustomerCard; role?: string; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Form>(() => toForm(card, role));
  const [dup, setDup] = useState<string | null>(null);
  const groups = useGroups();
  const types = usePriceTypes();
  const qc = useQueryClient();
  useEffect(() => {
    if (open) (setF(toForm(card, role)), setDup(null));
  }, [open, card, role]);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const save = useMutation({
    mutationFn: (confirm: boolean) => {
      const b: CustomerInput = {
        name: f.name.trim(),
        kind: f.kind,
        phone: f.phone.trim() || null,
        inn: f.inn.trim() || null,
        address: f.address.trim() || null,
        roles: f.roles.length ? f.roles : ['customer'],
        groupId: f.groupId || null,
        priceTypeId: f.priceTypeId || null,
        discountPercent: f.discountPercent || null,
        debtLimit: f.debtLimit || null,
        debtDays: f.debtDays ? Number(f.debtDays) : null,
        birthday: f.birthday || null,
        note: f.note.trim() || null,
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
        messengers: { ...(card?.messengers ?? {}), ...(f.whatsapp ? { whatsapp: f.whatsapp.replace(/\D/g, '') } : {}) },
        ...(confirm ? { confirmDuplicatePhone: true } : {}),
      };
      return card ? customerApi.update(card.id, { ...b, version: card.version }) : customerApi.create(b);
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', c.id] });
      toast.success('Сохранено');
      onOpenChange(false);
      onSaved?.(c.id);
    },
    onError: (e) => (e instanceof ApiError && e.code === 'DUPLICATE_PHONE' ? setDup(e.message) : toast.error(errorMessage(e))),
  });
  const toggleRole = (r: string) => set({ roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={card ? card.name : 'Новый клиент'} className="max-w-2xl">
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {CUSTOMER_ROLES.map((r) => (
            <button key={r} onClick={() => toggleRole(r)} className={cn('h-8 rounded-full px-3.5 text-[13px] font-medium ring-1 transition', f.roles.includes(r) ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink-2 ring-line')}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
          <Field label="Имя / название">
            <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Азамат, СТО «Ак-Жол»" />
          </Field>
          <Field label="Тип">
            <select className={sel} value={f.kind} onChange={(e) => set({ kind: e.target.value as Form['kind'] })}>
              <option value="person">Человек</option>
              <option value="company">Организация</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Телефон">
            <Input inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="0555 123 456" />
          </Field>
          <Field label="WhatsApp">
            <Input inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="если другой" />
          </Field>
          <Field label="День рождения">
            <Input type="date" value={f.birthday} onChange={(e) => set({ birthday: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Группа" hint="Тип цены, скидка и лимит долга группы">
            <select className={sel} value={f.groupId} onChange={(e) => set({ groupId: e.target.value })}>
              <option value="">Без группы</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Свой тип цены" hint="Пусто — как в группе">
            <select className={sel} value={f.priceTypeId} onChange={(e) => set({ priceTypeId: e.target.value })}>
              <option value="">Как в группе</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Скидка, %">
            <Input inputMode="decimal" value={f.discountPercent} onChange={(e) => set({ discountPercent: e.target.value.replace(/[^\d.]/g, '') })} placeholder="как в группе" />
          </Field>
          <Field label="Лимит долга, сом" hint="0 — в долг нельзя">
            <Input inputMode="numeric" value={f.debtLimit} onChange={(e) => set({ debtLimit: e.target.value.replace(/[^\d.]/g, '') })} placeholder="как в группе" />
          </Field>
          <Field label="Срок долга, дн">
            <Input inputMode="numeric" value={f.debtDays} onChange={(e) => set({ debtDays: e.target.value.replace(/\D/g, '') })} placeholder="как в группе" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="ИНН">
            <Input inputMode="numeric" value={f.inn} onChange={(e) => set({ inn: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Адрес">
            <Input value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Теги" hint="Через запятую">
            <Input value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="такси, опт" />
          </Field>
          <Field label="Заметка">
            <Input value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
        </div>
        {dup && (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-warn-soft px-4 py-3 text-sm text-ink-2">
            <span className="flex-1">{dup}. Всё равно сохранить?</span>
            <Button size="sm" variant="dark" loading={save.isPending} onClick={() => save.mutate(true)}>
              Сохранить
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate(false)}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Список ───────────────────────────────────────────────

const SEGMENTS = [
  { value: '', label: 'Все' },
  { value: 'customer', label: 'Клиенты' },
  { value: 'sto', label: 'СТО' },
  { value: 'master', label: 'Мастера' },
];

/** Клиенты и СТО (ТЗ 14): поиск по имени, телефону, госномеру; сегменты */
export function CustomersPage() {
  const [sp, setSp] = useSearchParams();
  const role = sp.get('role') ?? '';
  const hasDebt = sp.get('debt') === '1';
  const lapsed = sp.get('lapsed') === '1';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounce(q, 250);
  const { data, isLoading, error, refetch } = useCustomers({ q: dq || undefined, role: role || undefined, hasDebt: hasDebt || undefined, noPurchaseDays: lapsed ? 90 : undefined, page, limit: LIMIT });
  const nav = useNavigate();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const list = data?.items.filter((c) => role || c.roles.some((r) => CUSTOMER_ROLES.includes(r))) ?? [];
  return (
    <div className="space-y-6">
      <PageTitle
        title="Клиенты и СТО"
        sub={data ? `${num(data.total)} карточек — поиск по имени, телефону или госномеру машины` : ' '}
        actions={
          can('customers.write') && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> Клиент
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={role} onChange={(v) => set('role', v || undefined)} options={SEGMENTS} />
        <Input icon={<Search />} placeholder="Имя, телефон, 01 KG 123…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm flex-1" />
        <Switch checked={hasDebt} onChange={(v) => set('debt', v ? '1' : undefined)} label="С долгом" />
        <Switch checked={lapsed} onChange={(v) => set('lapsed', v ? '1' : undefined)} label="Не покупали 90 дн" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
          {list.map((c) => (
            <button key={c.id} onClick={() => nav(`/customers/${c.id}`)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-card-muted">
              <Avatar name={c.name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted">
                  {c.phone ?? 'без телефона'}
                  {c.groupName && ` · ${c.groupName}`}
                </span>
              </span>
              <span className="hidden gap-1 md:flex">
                {c.roles.filter((r) => r !== 'customer').map((r) => (
                  <Pill key={r} tone={r === 'sto' ? 'dark' : 'soft'}>
                    {ROLE_LABEL[r]}
                  </Pill>
                ))}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted sm:block">{c.lastVisit ? ago(c.lastVisit) : 'не покупал'}</span>
              <span className="w-28 text-right text-[13px] tabular-nums">{c.purchasesTotal && Number(c.purchasesTotal) ? money(c.purchasesTotal) : '—'}</span>
              <span className="w-24 text-right">{Number(c.debtKgs) > 0 ? <Pill tone="accent-outline">{money(c.debtKgs)}</Pill> : <span className="text-xs text-faint">без долга</span>}</span>
            </button>
          ))}
        </div>
      )}
      {data && !list.length && (
        <Card>
          <EmptyState title="Никого не нашли" hint="Клиент создаётся и прямо на кассе — по телефону" />
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
      <CustomerDialog open={open} onOpenChange={setOpen} role={role || 'customer'} onSaved={(id) => nav(`/customers/${id}`)} />
    </div>
  );
}

// ── Карточка ─────────────────────────────────────────────

function VehicleDialog({ open, onOpenChange, customerId, v }: { open: boolean; onOpenChange: (v: boolean) => void; customerId: string; v?: Vehicle | null }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: '', vin: '', year: '', plate: '', mileage: '', note: '' });
  useEffect(() => {
    if (open) setF({ title: v?.title ?? '', vin: v?.vin ?? '', year: v?.year?.toString() ?? '', plate: v?.plate ?? '', mileage: v?.mileage?.toString() ?? '', note: v?.note ?? '' });
  }, [open, v]);
  const save = useMutation({
    mutationFn: () => {
      const b = { title: f.title.trim(), vin: f.vin.trim().toUpperCase() || null, year: f.year ? Number(f.year) : null, plate: f.plate.trim().toUpperCase() || null, mileage: f.mileage ? Number(f.mileage) : null, note: f.note || null };
      if (v) return customerApi.updateVehicle(v.id, { ...b, version: v.version });
      return customerApi.addVehicle(customerId, Object.fromEntries(Object.entries(b).filter(([, x]) => x != null)) as { title: string });
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['customer', customerId] }), onOpenChange(false)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={v ? 'Машина' : 'Новая машина в гараж'}>
      <div className="mt-4 space-y-4">
        <Field label="Машина" hint="Как называет клиент">
          <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Камри 40 белая" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Госномер">
            <Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="01 KG 123 ABC" className="uppercase" />
          </Field>
          <Field label="Год">
            <Input inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </Field>
        </div>
        <Field label="VIN / номер кузова">
          <Input value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value })} className="font-mono uppercase" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Пробег, км">
            <Input inputMode="numeric" value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Заметка">
            <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.title.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DebtsTab({ c }: { c: CustomerCard }) {
  const items = useDebtItems(c.id, { open: true });
  const [pay, setPay] = useState<{ direction: 'in' | 'out'; currency: string } | null>(null);
  const [stmt, setStmt] = useState<Awaited<ReturnType<typeof customerApi.statement>> | null>(null);
  const statement = useMutation({ mutationFn: () => customerApi.statement(c.id), onSuccess: setStmt, onError: (e) => toast.error(errorMessage(e)) });
  const pdf = useMutation({ mutationFn: () => customerApi.statementPdf(c.id), onSuccess: openPdf, onError: (e) => toast.error(errorMessage(e)) });
  const can = useCan();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {c.debts.map((d) => (
          <div key={d.direction + d.currency} className={cn('min-w-48 rounded-[22px] p-4', d.direction === 'receivable' ? 'hatch bg-pill text-pill-ink' : 'bg-card ring-1 ring-line')}>
            <div className="text-xs opacity-60">{d.direction === 'receivable' ? 'Должен нам' : 'Мы должны'}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{money(d.amount, d.currency)}</div>
            {Number(d.overdue) > 0 && <div className="mt-0.5 text-xs text-accent">просрочено {money(d.overdue, d.currency)}</div>}
            {can('customers.debts') && (
              <Button size="sm" variant={d.direction === 'receivable' ? 'accent' : 'dark'} className="mt-3" onClick={() => setPay({ direction: d.direction === 'receivable' ? 'in' : 'out', currency: d.currency })}>
                <Wallet /> {d.direction === 'receivable' ? 'Принять оплату' : 'Оплатить'}
              </Button>
            )}
          </div>
        ))}
        {!c.debts.length && <div className="rounded-[20px] bg-card px-4 py-3 text-sm text-muted ring-1 ring-line">Долгов нет</div>}
        {c.debts.some((d) => d.direction === 'receivable') && (
          <div className="flex flex-col justify-center gap-2">
            <Button size="sm" onClick={() => statement.mutate()} loading={statement.isPending}>
              <MessageCircle /> Сверка в WhatsApp
            </Button>
            <Button size="sm" onClick={() => pdf.mutate()} loading={pdf.isPending}>
              <FileDown /> Сверка PDF
            </Button>
          </div>
        )}
      </div>
      {c.debtsByVehicle.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {c.debtsByVehicle.map((v) => (
            <Pill key={(v.vehicleId ?? 'none') + v.currency} tone="outline" className="h-8 px-3">
              <Car className="size-3.5" /> {v.title} {v.plate && `· ${v.plate}`} — <b>{money(v.amount, v.currency)}</b>
            </Pill>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-normal">Дата</th>
              <th className="px-2 font-normal">Что</th>
              <th className="px-2 font-normal">Машина</th>
              <th className="px-2 font-normal">Срок</th>
              <th className="px-2 text-right font-normal">Было</th>
              <th className="px-4 text-right font-normal">Осталось</th>
            </tr>
          </thead>
          <tbody>
            {items.data?.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-muted">{date(i.openedAt, 'DD.MM.YY')}</td>
                <td className="px-2">
                  <div className="max-w-72 truncate">{i.what ?? i.description ?? DEBT_KIND[i.kind] ?? i.kind}</div>
                  <div className="text-xs text-muted">
                    {i.direction === 'payable' ? 'мы должны · ' : ''}
                    {DEBT_KIND[i.kind] ?? i.kind}
                    {i.documentNumber && ` · ${i.documentNumber}`}
                  </div>
                </td>
                <td className="px-2 text-ink-2">{i.vehicleTitle ?? '—'}</td>
                <td className={cn('px-2 whitespace-nowrap', i.overdue ? 'font-medium text-accent' : 'text-muted')}>{i.dueDate ? date(i.dueDate, 'DD.MM.YY') : '—'}</td>
                <td className="px-2 text-right text-muted tabular-nums">{money(i.amount, i.currency)}</td>
                <td className="px-4 text-right font-semibold tabular-nums">{money(i.remaining, i.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.data && !items.data.length && <EmptyState title="Открытых позиций нет" />}
      </div>
      {pay && <DebtPayDialog open={!!pay} onOpenChange={(v) => !v && setPay(null)} counterpartyId={c.id} name={c.name} direction={pay.direction} currency={pay.currency} />}
      <Dialog open={!!stmt} onOpenChange={(v) => !v && setStmt(null)} title="Сверка долга" description={c.name}>
        {stmt && (
          <div className="mt-4 space-y-3">
            <pre className="scroll-thin max-h-72 overflow-auto rounded-[18px] bg-card-muted p-4 font-sans text-[13px] whitespace-pre-wrap">{stmt.text}</pre>
            <div className="grid grid-cols-3 gap-2">
              <a href={stmt.whatsappUrl} target="_blank" rel="noreferrer">
                <Button variant="dark" className="w-full">
                  <MessageCircle /> WhatsApp
                </Button>
              </a>
              <a href={stmt.telegramUrl} target="_blank" rel="noreferrer">
                <Button className="w-full">
                  <Send /> Telegram
                </Button>
              </a>
              <Button onClick={() => navigator.clipboard.writeText(stmt.text).then(() => toast.success('Скопировано'))}>Копировать</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function LoyaltyTab({ id }: { id: string }) {
  const { data, isLoading, error } = useLoyalty(id);
  const qc = useQueryClient();
  const [adj, setAdj] = useState<{ amount: string; comment: string } | null>(null);
  const issue = useMutation({
    mutationFn: () => customerApi.issueCard(id),
    onSuccess: (r) => (qc.setQueryData(['loyalty', id], r), toast.success('Карта выдана')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const adjust = useMutation({
    mutationFn: () => customerApi.adjustBonus(id, adj!.amount, adj!.comment),
    onSuccess: (r) => (qc.setQueryData(['loyalty', id], r), setAdj(null), toast.success('Бонусы изменены')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <Skeleton className="h-40 rounded-[24px]" />;
  if (error || !data) return <EmptyState title="Программа лояльности выключена" hint="Включается в настройках магазина" />;
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="hatch space-y-3 rounded-[24px] bg-pill p-5 text-pill-ink">
        <div className="flex items-center justify-between text-sm opacity-70">
          <span className="flex items-center gap-1.5">
            <Gift className="size-4" /> {data.card ? `Карта ${data.card.number}` : 'Карты нет'}
          </span>
          {data.level && <Pill tone="accent">{data.level}</Pill>}
        </div>
        <div className="text-[40px] leading-none font-semibold tabular-nums">{num(data.balance, 2)}</div>
        <div className="text-xs opacity-60">бонусов · начисление {num(data.accrualPercent, 1)}%</div>
        {Number(data.expiringSoon.amount) > 0 && (
          <div className="text-xs text-accent">
            сгорит {num(data.expiringSoon.amount)} до {date(data.expiringSoon.at, 'D MMM')}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {!data.card && (
            <Button size="sm" variant="accent" loading={issue.isPending} onClick={() => issue.mutate()}>
              Выдать карту
            </Button>
          )}
          <Button size="sm" variant="soft" onClick={() => setAdj({ amount: '', comment: '' })}>
            Начислить / списать
          </Button>
        </div>
      </div>
      <Tray className="p-3">
        <div className="px-1 pb-2 text-[14px] font-medium">История бонусов</div>
        <div className="space-y-1">
          {data.history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-[14px] bg-card px-3 py-2 text-[13px]">
              <span className="w-20 text-muted">{date(h.createdAt, 'DD.MM.YY')}</span>
              <span className="min-w-0 flex-1 truncate">{h.comment ?? { accrue: 'Начисление за покупку', spend: 'Оплата бонусами', expire: 'Сгорели', manual: 'Вручную' }[h.kind] ?? h.kind}</span>
              <span className={cn('font-semibold tabular-nums', Number(h.amount) > 0 ? 'text-ok' : 'text-accent')}>
                {Number(h.amount) > 0 ? '+' : ''}
                {num(h.amount, 2)}
              </span>
            </div>
          ))}
          {!data.history.length && <div className="rounded-[14px] bg-card px-3 py-2 text-sm text-muted">Пока пусто</div>}
        </div>
      </Tray>
      <Dialog open={!!adj} onOpenChange={(v) => !v && setAdj(null)} title="Начислить или списать бонусы" description="Минус — списать">
        {adj && (
          <div className="mt-4 space-y-4">
            <Field label="Сколько">
              <Input autoFocus inputMode="decimal" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value.replace(/[^\d.-]/g, '') })} placeholder="500 или -200" />
            </Field>
            <Field label="Причина">
              <Input value={adj.comment} onChange={(e) => setAdj({ ...adj, comment: e.target.value })} placeholder="Подарок на день рождения" />
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!Number(adj.amount) || !adj.comment.trim()} loading={adjust.isPending} onClick={() => adjust.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function FeedTab({ id }: { id: string }) {
  const { data, isLoading } = useFeed(id);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'note' | 'call'>('note');
  const add = useMutation({
    mutationFn: () => customerApi.addActivity(id, kind, text.trim()),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['feed', id] }), setText('')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const icon = (t: string) => (t === 'call' ? <PhoneCall className="size-3.5" /> : t === 'receipt' ? <Wallet className="size-3.5" /> : t === 'request' ? <ClipboardList className="size-3.5" /> : <NotebookPen className="size-3.5" />);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'note', label: 'Заметка' },
            { value: 'call', label: 'Звонок' },
          ]}
        />
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text.trim() && add.mutate()} placeholder={kind === 'call' ? 'О чём говорили' : 'Что важно помнить о клиенте'} className="min-w-60 flex-1" />
        <Button variant="dark" disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate()}>
          Добавить
        </Button>
      </div>
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="space-y-1">
        {data?.map((f) => (
          <div key={f.type + f.id} className="flex items-start gap-3 rounded-[16px] bg-card px-4 py-2.5 ring-1 ring-line">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-card-muted text-muted">{icon(f.type)}</span>
            <span className="min-w-0 flex-1 text-[13.5px]">{f.text}</span>
            <span className="text-xs whitespace-nowrap text-muted">{date(f.at, 'D MMM YY, HH:mm')}</span>
          </div>
        ))}
        {data && !data.length && <EmptyState title="Лента пуста" hint="Покупки, заявки, звонки и заметки появятся здесь" />}
      </div>
    </div>
  );
}

function PersonalPricesTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['personal-prices', id], queryFn: () => customerApi.personalPrices(id) });
  const set = useMutation({
    mutationFn: (x: { productId: string; price: string | null }) => customerApi.setPersonalPrice(id, x.productId, x.price),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-prices', id] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const link = useMutation({
    mutationFn: () => customerApi.priceListLink(id),
    onSuccess: (r) => navigator.clipboard.writeText(r.link).then(() => toast.success('Ссылка на прайс скопирована — отправьте мастеру')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const file = useMutation({ mutationFn: () => customerApi.priceListFile(id, 'pdf'), onSuccess: openPdf, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-72 flex-1">
          <ProductAddField autoFocus={false} placeholder="Товар — задать персональную цену" onPick={(p) => set.mutate({ productId: p.id, price: p.price != null ? String(p.price) : '0' })} />
        </div>
        <Button onClick={() => link.mutate()} loading={link.isPending}>
          <Send /> Ссылка на прайс
        </Button>
        <Button onClick={() => file.mutate()} loading={file.isPending}>
          <FileDown /> Прайс PDF
        </Button>
      </div>
      {isLoading && <Skeleton className="h-24 rounded-[20px]" />}
      <div className="space-y-1">
        {data?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-2 ring-1 ring-line">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]">{p.name}</span>
              <span className="font-mono text-xs text-muted">{p.sku}</span>
            </span>
            <input
              defaultValue={String(Number(p.price))}
              inputMode="decimal"
              onBlur={(e) => e.target.value !== String(Number(p.price)) && set.mutate({ productId: p.productId, price: e.target.value || null })}
              className="h-9 w-28 rounded-xl bg-card-muted px-3 text-right font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink"
            />
            <button onClick={() => set.mutate({ productId: p.productId, price: null })} className="grid size-8 place-items-center rounded-full text-muted hover:text-accent" aria-label="Убрать">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {data && !data.length && <div className="rounded-[16px] bg-card px-4 py-3 text-sm text-muted ring-1 ring-line">Персональных цен нет — действует тип цены группы</div>}
      </div>
    </div>
  );
}

/** Карточка клиента: условия, гараж, долги, бонусы, лента, персональные цены */
export function CustomerPage() {
  const { id } = useParams();
  const { data: c, isLoading, error, refetch } = useCustomerCard(id);
  const [edit, setEdit] = useState(false);
  const [veh, setVeh] = useState<Vehicle | null | undefined>(undefined);
  const qc = useQueryClient();
  const removeVeh = useMutation({
    mutationFn: (v: Vehicle) => customerApi.removeVehicle(v.id, v.version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', id] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !c) return <Skeleton className="h-96 rounded-[28px]" />;
  const debt = c.debts.filter((d) => d.direction === 'receivable');
  const wa = (c.messengers?.whatsapp ?? c.phone ?? '').replace(/\D/g, '');
  const isSto = c.roles.includes('sto') || c.roles.includes('master');
  const tabs = [
    { value: 'main', label: 'Обзор' },
    { value: 'garage', label: `Гараж · ${c.vehicles.length}` },
    { value: 'debts', label: 'Долги' },
    { value: 'bonus', label: 'Бонусы' },
    { value: 'feed', label: 'Лента' },
    ...(isSto ? [{ value: 'prices', label: 'Персональные цены' }] : []),
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/customers" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar name={c.name} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-medium">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {c.roles.map((r) => (
              <Pill key={r} tone={r === 'sto' ? 'dark' : 'soft'}>
                {ROLE_LABEL[r] ?? r}
              </Pill>
            ))}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
                <Phone className="size-3.5" /> {c.phone}
              </a>
            )}
            {c.group && <span>· {c.group.name}</span>}
          </div>
        </div>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            <Button>
              <MessageCircle /> WhatsApp
            </Button>
          </a>
        )}
        <Link to={`/requests/new?customer=${c.id}`}>
          <Button>
            <ClipboardList /> Заявка
          </Button>
        </Link>
        <Button variant="dark" onClick={() => setEdit(true)}>
          <Pencil /> Изменить
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hatch rounded-[22px] bg-pill p-4 text-pill-ink">
          <div className="text-xs opacity-60">Должен</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{debt.length ? debt.map((d) => money(d.amount, d.currency)).join(' + ') : '0 с'}</div>
          <div className="text-xs opacity-60">лимит {c.terms.debtLimit != null ? money(c.terms.debtLimit) : 'без лимита'}</div>
        </div>
        {[
          ['Покупок', `${num(c.stats.receiptsCount)} на ${money(c.stats.purchasesTotal)}`],
          ['Средний чек', money(c.stats.averageReceipt)],
          ['Последний визит', c.stats.lastVisit ? ago(c.stats.lastVisit) : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 truncate text-xl font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <Tabs.Root defaultValue="main">
        <Tabs.List className="scroll-thin flex gap-1 overflow-x-auto rounded-full bg-card p-1 ring-1 ring-line">
          {tabs.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value} className="h-9 shrink-0 rounded-full px-4 text-[13px] font-medium text-ink-2 transition hover:bg-card-muted data-[state=active]:bg-pill data-[state=active]:text-pill-ink">
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="main" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-2 text-[15px] font-medium">Условия</div>
            {[
              ['Группа', c.terms.groupName ?? '—'],
              ['Скидка', `${num(c.terms.discountPercent, 2)}%`],
              ['Лимит долга', c.terms.debtLimit != null ? (Number(c.terms.debtLimit) === 0 ? 'в долг нельзя' : money(c.terms.debtLimit)) : 'без лимита'],
              ['Срок долга', c.terms.debtDays ? `${c.terms.debtDays} дн` : '—'],
              ['День рождения', c.birthday ? date(c.birthday, 'D MMMM') : '—'],
              ['ИНН', c.inn ?? '—'],
              ['Адрес', c.address ?? '—'],
              ['Клиент с', date(c.createdAt, 'D MMM YYYY')],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4 border-b border-line py-2 text-[13.5px] last:border-0">
                <span className="text-muted">{l}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </Card>
          <div className="space-y-4">
            {c.note && <div className="rounded-[22px] bg-warn-soft p-4 text-sm text-ink-2">{c.note}</div>}
            {c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Pill key={t} tone="outline">
                    #{t}
                  </Pill>
                ))}
              </div>
            )}
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">Контакты</div>
              {c.contacts.map((x) => (
                <div key={x.id} className="rounded-[14px] bg-card px-3 py-2 text-sm">
                  <b>{x.name}</b> {x.position && <span className="text-muted">· {x.position}</span>} {x.phone && <span className="text-muted">· {x.phone}</span>}
                </div>
              ))}
              {!c.contacts.length && <div className="rounded-[14px] bg-card px-3 py-2 text-sm text-muted">Дополнительных контактов нет</div>}
            </Tray>
          </div>
        </Tabs.Content>
        <Tabs.Content value="garage" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {c.vehicles.map((v) => (
              <div key={v.id} className="group rounded-[22px] bg-card p-4 ring-1 ring-line">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-full bg-card-muted">
                    <Car className="size-4 text-accent" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{v.title}</span>
                  <button onClick={() => setVeh(v)} className="grid size-8 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 hover:bg-card-muted" aria-label="Изменить">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => confirm('Убрать машину из гаража?') && removeVeh.mutate(v)} className="grid size-8 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 hover:text-accent" aria-label="Убрать">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {v.plate && <Pill tone="dark">{v.plate}</Pill>}
                  {v.year && <Pill tone="soft">{v.year}</Pill>}
                  {v.vin && <Pill tone="outline" className="font-mono">{v.vin}</Pill>}
                  {v.mileage != null && <Pill tone="soft">{num(v.mileage)} км</Pill>}
                </div>
                {c.debtsByVehicle.find((x) => x.vehicleId === v.id) && <div className="mt-2 text-xs text-accent">долг по машине {money(c.debtsByVehicle.find((x) => x.vehicleId === v.id)!.amount)}</div>}
              </div>
            ))}
            <button onClick={() => setVeh(null)} className="flex min-h-28 items-center justify-center gap-2 rounded-[22px] text-sm text-muted ring-2 ring-line ring-dashed hover:text-ink">
              <Plus className="size-4" /> Машина
            </button>
          </div>
        </Tabs.Content>
        <Tabs.Content value="debts" className="mt-4">
          <DebtsTab c={c} />
        </Tabs.Content>
        <Tabs.Content value="bonus" className="mt-4">
          <LoyaltyTab id={c.id} />
        </Tabs.Content>
        <Tabs.Content value="feed" className="mt-4">
          <FeedTab id={c.id} />
        </Tabs.Content>
        {isSto && (
          <Tabs.Content value="prices" className="mt-4">
            <PersonalPricesTab id={c.id} />
          </Tabs.Content>
        )}
      </Tabs.Root>
      <CustomerDialog open={edit} onOpenChange={setEdit} card={c} />
      <VehicleDialog open={veh !== undefined} onOpenChange={(v) => !v && setVeh(undefined)} customerId={c.id} v={veh} />
    </div>
  );
}
