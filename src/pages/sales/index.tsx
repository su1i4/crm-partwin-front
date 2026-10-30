import { ChevronLeft, ChevronRight, Search, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReceipts } from '@/entities/pos';
import { useSession } from '@/entities/session';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Avatar, Button, EmptyState, ErrorState, Input, PageTitle, Pill, Segmented, Skeleton } from '@/shared/ui';
import { ReceiptDialog, STATUS } from './receipt-dialog';

const LIMIT = 50;

/** Чеки: история продаж и возвратов, отложенные, отменённые */
export default function SalesPage() {
  const [sp, setSp] = useSearchParams();
  const storeId = useSession((s) => s.storeId);
  const status = sp.get('status') ?? 'completed';
  const page = Number(sp.get('page') ?? 1);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const open = sp.get('id');
  const { data, isLoading, error, refetch, isFetching } = useReceipts({ status, page, limit: LIMIT, q: dq || undefined, ...(storeId ? { storeId } : {}) });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page' && k !== 'id') n.delete('page');
    setSp(n, { replace: true });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const sum = data?.items.reduce((a, r) => a + (r.kind === 'return' ? -1 : 1) * Number(r.total), 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Чеки"
        sub={data ? `${num(data.total)} чеков · на странице ${money(sum)}` : ' '}
        actions={
          <Segmented
            value={status}
            onChange={(v) => set('status', v === 'completed' ? undefined : v)}
            options={[
              { value: 'completed', label: 'Оплаченные' },
              { value: 'deferred', label: 'Отложенные' },
              { value: 'open', label: 'Открытые' },
              { value: 'cancelled', label: 'Отменённые' },
            ]}
          />
        }
      />
      <Input icon={<Search />} placeholder="Номер чека или подпись" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_80px_120px] gap-4 px-4 text-xs text-muted md:grid">
        <span>Чек</span>
        <span>Клиент</span>
        <span>Продавец · касса</span>
        <span>Позиций</span>
        <span className="text-right">Сумма</span>
      </div>
      {isLoading && <div className="space-y-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-full" />)}</div>}
      {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.items.length === 0 && (
        <div className="rounded-[28px] bg-card">
          <EmptyState title="Чеков нет" hint={status === 'completed' ? 'Оплаченные чеки появятся после первой продажи на кассе' : undefined} />
        </div>
      )}
      <div className={cn('space-y-1.5', isFetching && !isLoading && 'opacity-60')}>
        {data?.items.map((r) => {
          const st = STATUS[r.status];
          return (
            <button
              key={r.id}
              onClick={() => set('id', r.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-full bg-card py-2 pr-4 pl-2 text-left ring-1 ring-line transition hover:ring-line-strong md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_80px_120px]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', r.kind === 'return' ? 'bg-accent-soft text-accent' : 'bg-card-muted text-ink-2')}>
                  {r.kind === 'return' ? <Undo2 className="size-4" /> : <span className="text-[11px] font-semibold">{date(r.completedAt ?? r.createdAt, 'HH:mm')}</span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{r.label ?? r.number}</span>
                  <span className="block text-[11px] text-muted">{date(r.completedAt ?? r.createdAt, 'D MMM, HH:mm')}</span>
                </span>
              </span>
              <span className="hidden truncate text-[13px] text-ink-2 md:block">{r.customerName ?? '—'}</span>
              <span className="hidden min-w-0 items-center gap-2 md:flex">
                <Avatar name={r.sellerName} size={22} />
                <span className="truncate text-[13px] text-muted">{r.registerName}</span>
              </span>
              <span className="hidden text-[13px] text-muted md:block">{r.linesCount}</span>
              <span className="flex items-center justify-end gap-2">
                {Number(r.debtAmount) > 0 && <Pill tone="accent-outline" className="hidden sm:inline-flex">долг</Pill>}
                {status !== 'completed' && st && <Pill tone={st.tone}>{st.label}</Pill>}
                <span className={cn('text-[14px] font-semibold tabular-nums', r.kind === 'return' && 'text-accent')}>
                  {r.kind === 'return' ? '−' : ''}
                  {money(r.total)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {data && data.total > LIMIT && (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="icon-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Pill tone="dark" className="h-8 px-3">
            {page} / {pages}
          </Pill>
          <Button size="icon-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
      )}
      <ReceiptDialog id={open} onClose={() => set('id')} />
    </div>
  );
}
