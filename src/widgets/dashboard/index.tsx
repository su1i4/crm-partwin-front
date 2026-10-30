import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Clock,
  CreditCard,
  Hourglass,
  PackageMinus,
  Receipt,
  Repeat,
  Send,
  Smartphone,
  Truck,
  Vault,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Dashboard, DashboardTile } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { compact, dayjs, money, moneyParts, num, pct } from '@/shared/lib/format';
import { Avatar, Card, Delta, Pill, Tray } from '@/shared/ui';

const TILE: Record<DashboardTile['key'], string> = { revenue: 'Выручка', profit: 'Прибыль', receipts: 'Чеков', avg: 'Средний чек' };

/** Главная цифра: выручка крупно, копейки серым, дельта и разница — как «Revenue» на референсе */
export function RevenueHero({ tile, compare }: { tile?: DashboardTile; compare: 'yesterday' | 'weekAgo' }) {
  if (!tile) return null;
  const base = compare === 'yesterday' ? tile.yesterday : tile.weekAgo;
  const delta = compare === 'yesterday' ? tile.vsYesterday : tile.vsWeekAgo;
  const diff = tile.today - base;
  const { int, frac } = moneyParts(tile.today);
  return (
    <div className="min-w-0">
      <div className="text-[17px] font-medium text-ink">Выручка за сегодня</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="text-[40px] leading-none font-semibold tracking-tight text-ink tabular-nums sm:text-[46px]">
          {int}
          <span className="text-faint">,{frac}</span>
          <span className="ml-1.5 text-[22px] font-medium text-faint">с</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Delta value={delta} />
          <Pill tone={diff >= 0 ? 'accent' : 'dark'}>
            {diff >= 0 ? '+' : '−'}
            {money(Math.abs(diff))}
          </Pill>
        </div>
      </div>
      <div className="mt-2.5 text-[13px] text-muted">
        {compare === 'yesterday' ? 'вчера' : 'неделю назад'} {money(base)} · {dayjs().format('D MMMM, dddd')}
      </div>
    </div>
  );
}

/** Маленькие плитки: Чеков, Средний чек, Прибыль (выделена), Моя смена (чёрная) */
export function KpiTiles({ data, compare }: { data: Dashboard; compare: 'yesterday' | 'weekAgo' }) {
  const tiles = (data.tiles ?? []).filter((t) => t.key !== 'revenue');
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end">
      {data.myShift && (
        <Link to="/pos" className="col-span-2 flex min-w-[164px] flex-col justify-between rounded-[22px] bg-pill p-3.5 text-pill-ink sm:col-span-1">
          <div className="flex items-center justify-between text-xs opacity-60">
            Моя смена №{data.myShift.number}
            <Clock className="size-3.5" />
          </div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{money(data.myShift.revenue)}</div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate opacity-80">{data.myShift.register} · {data.myShift.receipts} чеков</span>
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-pill-ink text-pill">
              <ChevronRight className="size-3.5" />
            </span>
          </div>
        </Link>
      )}
      {tiles.map((t) => {
        const d = compare === 'yesterday' ? t.vsYesterday : t.vsWeekAgo;
        const hl = t.key === 'profit';
        return (
          <div
            key={t.key}
            className={cn(
              'flex min-w-[112px] flex-col items-center justify-between gap-2 rounded-[22px] bg-card p-3.5 text-center ring-1',
              hl ? 'ring-2 ring-accent' : 'ring-line',
            )}
          >
            <div className="text-[13px] text-ink-2">{TILE[t.key]}</div>
            <Pill tone={hl ? 'accent' : 'muted'} className="h-7 px-2.5 text-[13px]">
              {t.key === 'receipts' ? num(t.today) : compact(t.today)}
            </Pill>
            <div className={cn('flex items-center gap-0.5 text-xs font-medium tabular-nums', d !== null && d < 0 ? 'text-muted' : 'text-ink-2')}>
              {d === null ? '—' : <>{d >= 0 ? '⌃' : '⌄'} {pct(d)}</>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Полоса «продажи по точкам» — сегменты с долей, как строка с аватарами на референсе */
export function StoreSplit({ data }: { data: Dashboard }) {
  const rows = data.byStore ?? [];
  const total = rows.reduce((a, r) => a + r.revenue, 0);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[26px] bg-card p-1.5 ring-1 ring-line sm:flex-row">
        {rows.map((r, i) => {
          const share = total ? (r.revenue / total) * 100 : 0;
          return (
            <div
              key={r.id}
              className={cn('flex min-w-0 items-center gap-2.5 rounded-full px-2 py-1.5', i === 0 ? 'bg-card-muted' : 'hover:bg-card-muted')}
              style={{ flexGrow: Math.max(share, 12), flexBasis: 'auto' }}
            >
              <Avatar name={r.name} size={26} />
              <span className="text-[13.5px] font-medium whitespace-nowrap text-ink tabular-nums">{money(r.revenue)}</span>
              <span className="hidden min-w-0 truncate text-xs text-muted 2xl:block">{r.name}</span>
              <span className="ml-auto shrink-0 pr-1 text-xs text-muted tabular-nums">{pct(share, 1)}</span>
            </div>
          );
        })}
      </div>
      <Link to="/reports" className="inline-flex h-12 items-center justify-center rounded-full bg-pill px-6 text-[14px] font-medium text-pill-ink hover:opacity-90">
        Подробнее
      </Link>
    </div>
  );
}

const ATTN_ICON: Record<string, typeof AlertTriangle> = {
  below_min: PackageMinus,
  overdue_debts: Clock,
  unverified_transfers: Smartphone,
  requests_new: Send,
  hanging_selection: Hourglass,
  stuck_transfers: Truck,
  open_shifts: Receipt,
  offline_unsent: Repeat,
};

/** «Требует внимания» — белые строки в серой полке, как список источников на референсе */
export function AttentionList({ data }: { data: Dashboard }) {
  return (
    <Tray className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-2 pb-3">
        <div className="text-[15px] font-medium text-ink">Требует внимания</div>
        <Pill tone={data.attention.length ? 'accent' : 'ok'}>{data.attention.length || 'Всё ок'}</Pill>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {data.attention.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-[20px] bg-card px-4 py-10 text-center text-sm text-muted">Ничего не горит — можно работать спокойно</div>
        )}
        {data.attention.map((a) => {
          const Icon = ATTN_ICON[a.key] ?? AlertTriangle;
          return (
            <Link key={a.key} to={a.link} className="group flex items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 transition hover:shadow-card">
              <Icon className="size-[18px] shrink-0 text-accent" strokeWidth={1.8} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink-2">{a.title}</span>
                {a.amount !== undefined && <span className="block text-xs font-semibold text-ink tabular-nums">{money(a.amount)}</span>}
              </span>
              <Pill tone="soft">{a.count}</Pill>
            </Link>
          );
        })}
      </div>
    </Tray>
  );
}

/** Топ товаров дня — столбики со штриховкой, как «Deals amount by referrer» */
export function TopProducts({ data }: { data: Dashboard }) {
  const items = (data.topProducts ?? []).slice(0, 5);
  const max = Math.max(1, ...items.map((i) => i.revenue));
  return (
    <Tray className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-2 pb-3">
        <div className="text-[15px] font-medium text-ink">Топ товаров дня</div>
        <Link to="/reports" className="grid size-8 place-items-center rounded-full bg-card text-muted ring-1 ring-line hover:text-ink">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-[20px] bg-card py-10 text-sm text-muted">Сегодня продаж ещё нет</div>
      ) : (
        <div className="flex flex-1 items-end gap-2 px-1 pt-2" style={{ minHeight: 190 }}>
          {items.map((p, i) => (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              title={`${p.name}: ${money(p.revenue)} · ${num(p.qty, 3)} шт`}
              className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="text-[11px] font-medium text-muted tabular-nums opacity-0 transition group-hover:opacity-100">{compact(p.revenue)}</span>
              <span
                className={cn('relative w-full rounded-[18px] transition', i === 0 ? 'bg-card shadow-card' : 'hatch bg-card/70 ring-1 ring-line')}
                style={{ height: `${28 + (p.revenue / max) * 130}px` }}
              >
                <span className="absolute top-2.5 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-card text-[11px] font-semibold text-accent ring-1 ring-line">
                  {i + 1}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {items[0] && (
        <div className="px-3 pt-3 pb-1 text-xs text-muted">
          Лидер: <span className="font-medium text-ink-2">{items[0].name}</span>
        </div>
      )}
    </Tray>
  );
}

/** График выручки: малиновая панель средних слева + столбики со штриховкой (как «Platform value») */
export function RevenueChart({ data, period }: { data: Dashboard; period: 'today' | 'week' | 'month' }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = data.chart ?? [];
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const sum = points.reduce((a, p) => a + p.revenue, 0);
  const avg = points.length ? sum / points.length : 0;
  const peaks = new Set([...points].map((p, i) => ({ v: p.revenue, i })).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.i));
  const label = (x: number | string) => (period === 'today' ? `${x}:00` : dayjs(String(x)).format(period === 'week' ? 'dd' : 'D'));
  const revenueTile = data.tiles?.find((t) => t.key === 'revenue');
  const receipts = data.tiles?.find((t) => t.key === 'receipts');
  const avgCheck = data.tiles?.find((t) => t.key === 'avg');
  const ticks = [1, 0.75, 0.5, 0.25].map((k) => max * k);

  return (
    <Tray className="flex flex-col p-0 lg:flex-row">
      <div className="flex shrink-0 flex-col justify-between gap-4 rounded-[28px] bg-accent p-5 text-accent-ink lg:w-[200px]">
        <div className="text-[11px] tracking-wider uppercase opacity-70">{period === 'today' ? 'По часам' : 'В среднем за день'}</div>
        <div className="space-y-4">
          <div>
            <div className="text-xs opacity-70">Выручка</div>
            <div className="text-lg font-semibold tabular-nums">{money(period === 'today' ? revenueTile?.today : avg)}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Чеков сегодня</div>
            <div className="text-lg font-semibold tabular-nums">
              {num(receipts?.today)} <span className="text-sm font-normal opacity-70">/ {num(receipts?.yesterday)} вчера</span>
            </div>
          </div>
          <div>
            <div className="text-xs opacity-70">Средний чек</div>
            <div className="text-lg font-semibold tabular-nums">{money(avgCheck?.today)}</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="relative flex h-[220px] gap-3">
          <div className="relative min-w-0 flex-1">
            {ticks.map((t, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
              {points.map((p, i) => {
                const h = Math.max(4, (p.revenue / max) * 100);
                const on = hover === i;
                const peak = peaks.has(i) && p.revenue > 0;
                return (
                  <div
                    key={String(p.x)}
                    className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {(peak || on) && (
                      <span className="absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-accent-ink tabular-nums" style={{ bottom: `calc(${h}% + 6px)` }}>
                        {on ? `${label(p.x)} · ${money(p.revenue)}` : compact(p.revenue)}
                      </span>
                    )}
                    <div
                      className={cn('w-full rounded-t-[10px] rounded-b-[4px] transition-colors', peak || on ? 'bg-ink/85' : i % 3 === 0 ? 'hatch bg-card ring-1 ring-line' : 'bg-line-strong/70')}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="hidden w-14 flex-col justify-between text-right text-[11px] text-faint tabular-nums sm:flex">
            {ticks.map((t, i) => (
              <span key={i}>{compact(t)}</span>
            ))}
            <span>0</span>
          </div>
        </div>
        <div className="mt-2 flex justify-between pr-0 text-[11px] text-faint sm:pr-[68px]">
          {points
            .filter((_, i) => i % Math.ceil(points.length / 8 || 1) === 0)
            .map((p) => (
              <span key={String(p.x)}>{label(p.x)}</span>
            ))}
        </div>
      </div>
    </Tray>
  );
}

const MONEY: Record<string, { label: string; icon: typeof Wallet }> = {
  cash: { label: 'Наличные в кассах', icon: Banknote },
  safe: { label: 'Сейф', icon: Vault },
  bank: { label: 'Банк', icon: CreditCard },
  wallet: { label: 'Кошельки продавцов', icon: Smartphone },
  acquiring: { label: 'Эквайринг', icon: CreditCard },
  accountable: { label: 'Подотчёт', icon: Wallet },
};

/** «У кого сколько денег» + заявки — правая колонка, как карточка «Mikasa» с розовым градиентом */
export function MoneyCard({ data }: { data: Dashboard }) {
  if (!data.money) return null;
  const entries = Object.entries(data.money.byType).sort((a, b) => b[1] - a[1]);
  const total = data.money.totalKgs || 1;
  const [first, ...rest] = entries;
  return (
    <Card className="overflow-hidden bg-[linear-gradient(160deg,var(--card)_40%,var(--accent-soft))] p-4 ring-1 ring-accent-line/60">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium text-ink">Деньги бизнеса</div>
        <Pill tone="accent">{money(data.money.totalKgs)}</Pill>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {first && (
          <div className="row-span-2 flex flex-col justify-between rounded-[20px] bg-card p-3.5 ring-1 ring-line">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              {(() => {
                const I = MONEY[first[0]]?.icon ?? Wallet;
                return <I className="size-4 text-accent" />;
              })()}
              {MONEY[first[0]]?.label ?? first[0]}
            </div>
            <div className="mt-6">
              <div className="text-2xl font-semibold text-ink tabular-nums">{pct((first[1] / total) * 100)}</div>
              <div className="text-sm text-faint tabular-nums">{money(first[1])}</div>
            </div>
          </div>
        )}
        {rest.slice(0, 2).map(([k, v]) => {
          const I = MONEY[k]?.icon ?? Wallet;
          return (
            <div key={k} className="hatch rounded-[20px] bg-card p-3 ring-1 ring-line">
              <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <I className="size-3.5 text-accent" /> {MONEY[k]?.label ?? k}
              </div>
              <div className="mt-2 text-[13px] font-medium text-ink tabular-nums">
                {pct((v / total) * 100)} <span className="font-normal text-faint">{money(v)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {rest.length > 2 && (
        <div className="mt-2 space-y-1.5">
          {rest.slice(2).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-full bg-card px-3.5 py-2 text-[12.5px] ring-1 ring-line">
              <span className="text-ink-2">{MONEY[k]?.label ?? k}</span>
              <span className="font-medium text-ink tabular-nums">
                {pct((v / total) * 100)} <span className="font-normal text-faint">{money(v)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const REQ_STATUS: Record<string, { label: string; tone: 'accent' | 'dark' | 'soft' | 'ok' | 'warn' }> = {
  new: { label: 'Новая', tone: 'accent' },
  selecting: { label: 'Подбирается', tone: 'warn' },
  offered: { label: 'Предложено', tone: 'soft' },
  ordered: { label: 'Заказано', tone: 'dark' },
  arrived: { label: 'Привезли', tone: 'ok' },
};

/** Мои заявки — таблица-строки с чёрными «таблетками», как «Sales / Revenue / Leads» */
export function MyRequests({ data }: { data: Dashboard }) {
  const rows = data.myRequests ?? [];
  if (!data.myRequests) return null;
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] gap-3 px-4 pb-2 text-xs text-muted sm:grid-cols-[1.2fr_1fr_auto_auto]">
        <span>Заявка</span>
        <span className="hidden sm:block">Машина</span>
        <span className="hidden sm:block">Срок</span>
        <span>Статус</span>
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 && <div className="rounded-full bg-card px-4 py-3 text-sm text-muted">Заявок на вас нет</div>}
        {rows.map((r) => {
          const st = REQ_STATUS[r.status] ?? { label: r.status, tone: 'soft' as const };
          const overdue = r.dueAt && dayjs(r.dueAt).isBefore(dayjs());
          return (
            <Link
              key={r.id}
              to={`/requests/${r.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-full bg-card py-2 pr-2 pl-2 ring-1 ring-line transition hover:ring-line-strong sm:grid-cols-[1.2fr_1fr_auto_auto]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={r.customer} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{r.customer || 'Без имени'}</span>
                  <span className="block text-[11px] text-muted">{r.number}</span>
                </span>
              </span>
              <span className="hidden truncate text-[13px] text-ink-2 sm:block">{r.vehicle ?? '—'}</span>
              <span className={cn('hidden text-xs tabular-nums sm:block', overdue ? 'font-medium text-accent' : 'text-muted')}>{r.dueAt ? dayjs(r.dueAt).format('D MMM') : '—'}</span>
              <Pill tone={st.tone}>{st.label}</Pill>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function QuickActions({ data }: { data: Dashboard }) {
  return (
    <div className="scroll-thin -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {data.quickActions.map((a, i) => (
        <Link
          key={a.key}
          to={a.key === 'product' ? '/products?new=1' : a.link}
          className={cn(
            'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13.5px] font-medium ring-1 transition',
            i === 0 ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink ring-line hover:ring-line-strong',
          )}
        >
          <span className={cn('grid size-6 place-items-center rounded-full text-sm leading-none', i === 0 ? 'bg-accent text-accent-ink' : 'bg-card-muted text-ink-2')}>+</span>
          {a.title}
        </Link>
      ))}
    </div>
  );
}

export { TILE };
