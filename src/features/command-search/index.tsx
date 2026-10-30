import * as D from '@radix-ui/react-dialog';
import { ArrowRight, CornerDownLeft, Search, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { ProductThumb, QualityBadge, useSearch } from '@/entities/product';
import { useCan } from '@/entities/session';
import { NAV } from '@/shared/config/navigation';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useHotkey } from '@/shared/hooks/use-hotkey';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { Kbd } from '@/shared/ui';

export const useCommand = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

const COMMANDS = [
  { label: 'Новый товар', to: '/products?new=1', hint: 'Быстрое создание' },
  { label: 'Открыть кассу', to: '/pos', hint: 'Касса точки', permission: 'pos.use' },
  { label: 'Новая приёмка', to: '/documents/new?type=receiving', hint: 'Склад', permission: 'stock.receive' },
  { label: 'Новое перемещение', to: '/documents/new?type=transfer', hint: 'Склад' },
  { label: 'Новое списание', to: '/documents/new?type=writeoff', hint: 'Склад' },
  { label: 'Инвентаризация', to: '/stock/inventory', hint: 'Склад' },
  { label: 'Печать ценников', to: '/labels', hint: 'Товары' },
  { label: 'Новый заказ поставщику', to: '/purchasing/orders/new', hint: 'Закупки', permission: 'purchasing.orders' },
  { label: 'Автозаказ', to: '/purchasing/auto-order', hint: 'Закупки', permission: 'purchasing.orders' },
  { label: 'Найти в прайсах', to: '/purchasing/price-lists', hint: 'Закупки' },
  { label: 'Установить курс $', to: '/prices/rate', hint: 'Цены' },
  { label: 'Новая заявка клиента', to: '/requests/new', hint: 'Заявки', permission: 'requests.write' },
  { label: 'Принять оплату долга', to: '/customers/debts', hint: 'Клиенты', permission: 'customers.debts' },
  { label: 'Сверить переводы', to: '/money/transfers', hint: 'Деньги', permission: 'money.verify_transfers' },
  { label: 'Записать расход', to: '/money/expenses', hint: 'Деньги', permission: 'money.write' },
  { label: 'Отчёт «Продажи»', to: '/reports/sales.by', hint: 'Отчёты', permission: 'reports.sales' },
  { label: 'Отчёт «Прибыль»', to: '/reports/money.pnl', hint: 'Отчёты', permission: 'reports.money' },
  { label: 'Новый заказ покупателя', to: '/sales/orders/new', hint: 'Продажи', permission: 'sales.orders' },
  { label: 'Принять по гарантии', to: '/sales/warranty', hint: 'Продажи', permission: 'sales.warranty' },
  { label: 'Задание на подбор', to: '/stock/tasks', hint: 'Склад', permission: 'stock.tasks' },
  { label: 'Пригласить сотрудника', to: '/settings/staff', hint: 'Настройки', permission: 'settings.manage' },
  { label: 'Импорт из Excel', to: '/settings/import', hint: 'Настройки' },
  { label: 'Добавить синоним', to: '/settings/synonyms', hint: 'Настройки' },
  { label: 'Журнал действий', to: '/settings/audit', hint: 'Настройки', permission: 'audit.read' },
  { label: 'Экран покупателя', to: '/pos/display', hint: 'Касса', permission: 'pos.use' },
];

type Row = { kind: 'cmd' | 'nav' | 'product' | 'all'; id: string; label: string; hint?: string; to: string; item?: ReturnType<typeof flat>[number] };
const flat = (d: ReturnType<typeof useSearch>['data']) => (d ? [...d.groups.here, ...d.groups.elsewhere, ...d.groups.analogs, ...d.groups.noStock] : []);

/** Общий поиск Ctrl+K: товары по номеру, разделы, команды (ТЗ 23.1) */
export function CommandSearch() {
  const { open, set } = useCommand();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const nav = useNavigate();
  const can = useCan();
  const dq = useDebounce(q, 200);
  const { data, isFetching } = useSearch(dq);

  // На кассе Ctrl+K — поиск товара в чеке (ТЗ 13.1), общий поиск там не открываем
  useHotkey('mod+k', () => !location.pathname.startsWith('/pos') && set(!useCommand.getState().open));
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const rows: Row[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    const cmds = COMMANDS.filter((c) => can(c.permission) && (!t || c.label.toLowerCase().includes(t))).map((c) => ({ kind: 'cmd' as const, id: c.to, label: c.label, hint: c.hint, to: c.to }));
    const navs = t
      ? NAV.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => ({ ...i, section: s.label }))))
          .filter((i) => i.label.toLowerCase().includes(t) || i.section.toLowerCase().includes(t))
          .slice(0, 5)
          .map((i) => ({ kind: 'nav' as const, id: i.to, label: i.label, hint: i.section, to: i.to }))
      : [];
    const products = t.length >= 2 ? flat(data).slice(0, 7).map((p) => ({ kind: 'product' as const, id: p.id, label: p.name, to: `/products/${p.id}`, item: p })) : [];
    const all = t.length >= 2 ? [{ kind: 'all' as const, id: 'all', label: `Все результаты для «${q.trim()}»`, to: `/search?q=${encodeURIComponent(q.trim())}` }] : [];
    return [...products, ...all, ...cmds, ...navs];
  }, [q, data, can]);

  useEffect(() => setIdx(0), [q, data]);

  const go = (r?: Row) => {
    if (!r) return;
    set(false);
    nav(r.to);
  };

  return (
    <D.Root open={open} onOpenChange={set}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
        <D.Content className="fixed top-[9vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-[28px] bg-card shadow-2xl ring-1 ring-line outline-none">
          <D.Title className="sr-only">Поиск</D.Title>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-5 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(rows.length - 1, i + 1)));
                if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
                if (e.key === 'Enter') (e.preventDefault(), go(rows[idx]));
              }}
              placeholder="Номер детали, название, «колодки камри 40», раздел…"
              className="h-16 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
            />
            {isFetching && <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />}
            <Kbd>Esc</Kbd>
          </div>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
            {rows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted">{q.trim().length >= 2 && !isFetching ? 'Ничего не найдено' : 'Начните вводить номер или название'}</div>
            )}
            {rows.map((r, i) => (
              <button
                key={r.kind + r.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(r)}
                className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === idx && 'bg-card-muted')}
              >
                {r.kind === 'product' && r.item ? (
                  <>
                    <ProductThumb fileId={r.item.photoFileId} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{r.label}</div>
                      <div className="truncate text-xs text-muted">
                        {r.item.brandName} · {r.item.mainNumber ?? r.item.sku}
                      </div>
                    </div>
                    <QualityBadge value={r.item.qualityClass} className="hidden sm:inline-flex" />
                    <div className="w-24 text-right">
                      <div className="text-sm font-semibold text-ink tabular-nums">{money(r.item.price, r.item.currency ?? 'KGS')}</div>
                      <div className={cn('text-xs tabular-nums', Number(r.item.stockHere) > 0 ? 'text-ok' : 'text-muted')}>{num(r.item.stockHere, 3)} {r.item.baseUnit}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={cn('grid size-10 place-items-center rounded-full', r.kind === 'cmd' ? 'bg-accent-soft text-accent' : 'bg-card-muted text-muted')}>
                      {r.kind === 'cmd' ? <Zap className="size-4" /> : r.kind === 'all' ? <Search className="size-4" /> : <ArrowRight className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{r.label}</div>
                      {r.hint && <div className="text-xs text-muted">{r.hint}</div>}
                    </div>
                  </>
                )}
                {i === idx && <CornerDownLeft className="size-4 text-faint" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-xs text-muted">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> выбор</span>
            <span className="flex items-center gap-1"><Kbd>Enter</Kbd> открыть</span>
            {data && <span className="ml-auto">{data.total} найдено · {data.tookMs} мс</span>}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
