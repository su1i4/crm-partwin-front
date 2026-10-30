import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, MessageCircle, Pencil, Phone, Plus, Search, Send, ShoppingBag, Truck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ORDER_STATUS, purchasingApi, useOrders, usePriceLists, useSupplierCard, useSuppliers, type SupplierCard, type SupplierInput } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { ApiError, errorMessage } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Avatar, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const CURRENCIES = ['KGS', 'USD', 'CNY', 'AED', 'RUB', 'KZT', 'EUR'];

type Form = {
  id?: string;
  version?: number;
  name: string;
  kind: 'person' | 'company';
  phone: string;
  inn: string;
  address: string;
  whatsapp: string;
  telegram: string;
  currency: string;
  paymentDelayDays: string;
  leadTimeDays: string;
  neighbor: boolean;
  note: string;
  roles: string[];
};
const toForm = (c?: SupplierCard, neighbor = false): Form => ({
  id: c?.id,
  version: c?.version,
  name: c?.name ?? '',
  kind: c?.kind ?? 'company',
  phone: c?.phone ?? '',
  inn: c?.inn ?? '',
  address: c?.address ?? '',
  whatsapp: c?.messengers?.whatsapp ?? '',
  telegram: c?.messengers?.telegram ?? '',
  currency: c?.supplierTerms?.currency ?? 'KGS',
  paymentDelayDays: c?.supplierTerms?.paymentDelayDays?.toString() ?? '',
  leadTimeDays: c?.supplierTerms?.leadTimeDays?.toString() ?? '',
  neighbor: c ? c.roles.includes('neighbor') && !c.roles.includes('supplier') : neighbor,
  note: c?.note ?? '',
  roles: c?.roles ?? [],
});

/** Создание / правка поставщика или соседа: телефон, мессенджеры, условия (валюта, отсрочка, срок поставки) */
export function SupplierDialog({ open, onOpenChange, card, neighbor, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; card?: SupplierCard; neighbor?: boolean; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Form>(() => toForm(card, neighbor));
  const [dupPhone, setDupPhone] = useState(false);
  const qc = useQueryClient();
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) (setF(toForm(card, neighbor)), setDupPhone(false));
  }
  const save = useMutation({
    mutationFn: async (confirm: boolean) => {
      const keep = f.roles.filter((r) => r !== 'supplier' && r !== 'neighbor');
      const b: SupplierInput = {
        name: f.name.trim(),
        kind: f.kind,
        phone: f.phone.trim() || null,
        inn: f.inn.trim() || null,
        address: f.address.trim() || null,
        roles: [...keep, f.neighbor ? 'neighbor' : 'supplier'],
        messengers: { ...(f.whatsapp ? { whatsapp: f.whatsapp.replace(/\D/g, '') } : {}), ...(f.telegram ? { telegram: f.telegram.trim() } : {}) },
        supplierTerms: {
          currency: f.currency,
          ...(f.paymentDelayDays ? { paymentDelayDays: Number(f.paymentDelayDays) } : {}),
          ...(f.leadTimeDays ? { leadTimeDays: Number(f.leadTimeDays) } : {}),
        },
        note: f.note.trim() || null,
        ...(confirm ? { confirmDuplicatePhone: true } : {}),
      };
      return f.id ? purchasingApi.updateSupplier(f.id, { ...b, version: f.version! }) : purchasingApi.createSupplier(b);
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['supplier', c.id] });
      toast.success('Сохранено');
      onOpenChange(false);
      onSaved?.(c.id);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'DUPLICATE_PHONE') return setDupPhone(true);
      toast.error(errorMessage(e));
    },
  });
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={f.id ? f.name || 'Поставщик' : f.neighbor ? 'Новый сосед' : 'Новый поставщик'} className="max-w-2xl">
      <div className="mt-4 space-y-4">
        <Segmented
          value={f.neighbor ? 'neighbor' : 'supplier'}
          onChange={(v) => set({ neighbor: v === 'neighbor' })}
          options={[
            { value: 'supplier', label: 'Поставщик' },
            { value: 'neighbor', label: 'Сосед по рынку' },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Название / имя">
            <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={f.neighbor ? 'Контейнер 118 — Улан' : 'ОсОО «Азия Партс»'} />
          </Field>
          <Field label="Тип">
            <select className={sel} value={f.kind} onChange={(e) => set({ kind: e.target.value as Form['kind'] })}>
              <option value="company">Организация</option>
              <option value="person">Человек</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Телефон">
            <Input inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="0555 123 456" />
          </Field>
          <Field label="WhatsApp">
            <Input inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="996555123456" />
          </Field>
          <Field label="Telegram">
            <Input value={f.telegram} onChange={(e) => set({ telegram: e.target.value })} placeholder="@azia_parts" />
          </Field>
        </div>
        {!f.neighbor && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Валюта закупки">
              <select className={sel} value={f.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Отсрочка оплаты, дн">
              <Input inputMode="numeric" value={f.paymentDelayDays} onChange={(e) => set({ paymentDelayDays: e.target.value.replace(/\D/g, '') })} placeholder="0" />
            </Field>
            <Field label="Срок поставки, дн" hint="Для автозаказа">
              <Input inputMode="numeric" value={f.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value.replace(/\D/g, '') })} placeholder="7" />
            </Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="ИНН">
            <Input inputMode="numeric" value={f.inn} onChange={(e) => set({ inn: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Адрес">
            <Input value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Дордой, ряд 12, конт. 40" />
          </Field>
        </div>
        <Field label="Заметка">
          <Input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Привозит по вторникам, оплата наличными" />
        </Field>
        {dupPhone && (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-warn-soft px-4 py-3 text-sm text-ink-2">
            <span className="flex-1">Такой телефон уже есть у другого контрагента. Всё равно сохранить?</span>
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

/** Поставщики и соседи (ТЗ 10.1) */
export function SuppliersPage() {
  const [sp, setSp] = useSearchParams();
  const role = (sp.get('role') as 'supplier' | 'neighbor') ?? 'supplier';
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const { data, isLoading, error, refetch } = useSuppliers(dq, role);
  const lists = usePriceLists();
  const can = useCan();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const plCount = (id: string) => lists.data?.filter((l) => l.supplierId === id).length ?? 0;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Поставщики и соседи"
        sub="Сосед по рынку — у кого берёте «под заказ клиента» на час: его прайс тоже ищется на кассе"
        actions={
          (can('purchasing.suppliers') || can('purchasing.orders')) && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> {role === 'neighbor' ? 'Сосед' : 'Поставщик'}
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={role}
          onChange={(v) => setSp(v === 'supplier' ? {} : { role: v })}
          options={[
            { value: 'supplier', label: 'Поставщики' },
            { value: 'neighbor', label: 'Соседи' },
          ]}
        />
        <Input icon={<Search />} placeholder="Имя или телефон" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm flex-1" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((s) => (
          <button key={s.id} onClick={() => nav(`/purchasing/suppliers/${s.id}`)} className="flex items-center gap-3 rounded-[24px] bg-card p-4 text-left ring-1 ring-line transition hover:ring-line-strong">
            <Avatar name={s.name} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{s.name}</span>
              <span className="block truncate text-xs text-muted">{s.phone ?? 'без телефона'}</span>
            </span>
            {plCount(s.id) > 0 && (
              <Pill tone="soft">
                <FileSpreadsheet className="size-3" /> {plCount(s.id)}
              </Pill>
            )}
          </button>
        ))}
      </div>
      {data && !data.items.length && (
        <Card>
          <EmptyState icon={role === 'neighbor' ? <Users /> : <Truck />} title={role === 'neighbor' ? 'Соседей нет' : 'Поставщиков нет'} hint="Добавьте первого — потом загрузите его прайс, и номера из прайса будут искаться на кассе" />
        </Card>
      )}
      <SupplierDialog open={open} onOpenChange={setOpen} neighbor={role === 'neighbor'} onSaved={(id) => nav(`/purchasing/suppliers/${id}`)} />
    </div>
  );
}

/** Карточка поставщика: условия, прайсы, заказы, долг */
export function SupplierPage() {
  const { id } = useParams();
  const { data: c, isLoading, error, refetch } = useSupplierCard(id);
  const lists = usePriceLists(id);
  const orders = useOrders({ supplierId: id, limit: 20 });
  const [edit, setEdit] = useState(false);
  const can = useCan();
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !c) return <Skeleton className="h-96 rounded-[28px]" />;
  const payable = c.debts.filter((d) => d.direction === 'payable');
  const wa = (c.messengers?.whatsapp ?? c.phone ?? '').replace(/\D/g, '');
  const isNeighbor = c.roles.includes('neighbor') && !c.roles.includes('supplier');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/purchasing/suppliers${isNeighbor ? '?role=neighbor' : ''}`} className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar name={c.name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-medium">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Pill tone={isNeighbor ? 'soft' : 'dark'}>{isNeighbor ? 'сосед' : 'поставщик'}</Pill>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
                <Phone className="size-3.5" /> {c.phone}
              </a>
            )}
            {c.address && <span>· {c.address}</span>}
          </div>
        </div>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            <Button>
              <MessageCircle /> WhatsApp
            </Button>
          </a>
        )}
        {c.messengers?.telegram && (
          <a href={`https://t.me/${c.messengers.telegram.replace('@', '')}`} target="_blank" rel="noreferrer">
            <Button>
              <Send /> Telegram
            </Button>
          </a>
        )}
        <Button onClick={() => setEdit(true)}>
          <Pencil /> Изменить
        </Button>
        {can('purchasing.orders') && (
          <Link to={`/purchasing/orders/new?supplier=${c.id}`}>
            <Button variant="dark">
              <ShoppingBag /> Заказ
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="hatch rounded-[22px] bg-pill p-4 text-pill-ink">
          <div className="text-xs opacity-60">Мы должны</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{payable.length ? payable.map((d) => money(d.amount, d.currency)).join(' + ') : '0 с'}</div>
          {payable.some((d) => Number(d.overdue) > 0) && <div className="mt-1 text-xs text-accent">есть просроченное</div>}
        </div>
        {[
          ['Валюта', c.supplierTerms?.currency ?? 'KGS'],
          ['Отсрочка', c.supplierTerms?.paymentDelayDays ? `${c.supplierTerms.paymentDelayDays} дн` : 'нет'],
          ['Срок поставки', c.supplierTerms?.leadTimeDays ? `${c.supplierTerms.leadTimeDays} дн` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      {c.note && <div className="rounded-[20px] bg-warn-soft px-4 py-3 text-sm text-ink-2">{c.note}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tray className="p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[14px] font-medium">Прайсы</span>
            <Link to={`/purchasing/price-lists?supplier=${c.id}`} className="text-xs text-muted hover:text-ink">
              Все прайсы →
            </Link>
          </div>
          <div className="space-y-1">
            {lists.data?.map((l) => (
              <Link key={l.id} to={`/purchasing/price-lists/${l.id}`} className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-2.5 hover:ring-1 hover:ring-line">
                <FileSpreadsheet className="size-4 text-accent" />
                <span className="min-w-0 flex-1 truncate text-[14px]">{l.name}</span>
                <span className="text-xs text-muted">{num(l.rowsCount)} строк</span>
                <span className="w-24 text-right text-xs text-muted">{l.loadedAt ? ago(l.loadedAt) : 'не загружен'}</span>
              </Link>
            ))}
            {lists.data && !lists.data.length && <div className="rounded-[16px] bg-card px-4 py-3 text-sm text-muted">Прайса нет</div>}
          </div>
        </Tray>
        <Tray className="p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[14px] font-medium">Заказы</span>
            <Link to={`/purchasing/orders?supplier=${c.id}`} className="text-xs text-muted hover:text-ink">
              Все заказы →
            </Link>
          </div>
          <div className="space-y-1">
            {orders.data?.items.map((o) => (
              <Link key={o.id} to={`/purchasing/orders/${o.id}`} className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-2.5 hover:ring-1 hover:ring-line">
                <span className="font-mono text-[13px] text-muted">{o.number}</span>
                <span className="min-w-0 flex-1 text-xs text-muted">{date(o.createdAt, 'D MMM')}</span>
                <span className="text-[13px] font-semibold tabular-nums">{money(o.totalAmount, o.currency)}</span>
                <Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill>
              </Link>
            ))}
            {orders.data && !orders.data.items.length && <div className="rounded-[16px] bg-card px-4 py-3 text-sm text-muted">Заказов не было</div>}
          </div>
        </Tray>
      </div>
      {c.contacts.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 text-[14px] font-medium">Контакты</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {c.contacts.map((x) => (
              <div key={x.id} className={cn('rounded-[16px] bg-card-muted px-3 py-2 text-sm')}>
                <b>{x.name}</b> {x.position && <span className="text-muted">· {x.position}</span>}
                {x.phone && <div className="text-xs text-muted">{x.phone}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
      <SupplierDialog open={edit} onOpenChange={setEdit} card={c} />
    </div>
  );
}
