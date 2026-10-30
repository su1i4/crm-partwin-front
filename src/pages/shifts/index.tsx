import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { posApi, useShifts } from '@/entities/pos';
import { useSession } from '@/entities/session';
import { ReportView } from '@/features/pos-shift';
import { cn } from '@/shared/lib/cn';
import { date, money } from '@/shared/lib/format';
import { Button, Dialog, EmptyState, ErrorState, PageTitle, Pill, Skeleton } from '@/shared/ui';

const LIMIT = 30;
const hasDiff = (d: Record<string, string> | null) => !!d && Object.values(d).some((v) => Number(v) !== 0);

export default function ShiftsPage() {
  const storeId = useSession((s) => s.storeId);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useShifts({ page, limit: LIMIT, ...(storeId ? { storeId } : {}) });
  const rep = useQuery({ queryKey: ['x-report', open], queryFn: () => posApi.xReport(open!), enabled: !!open });
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  return (
    <div className="space-y-6">
      <PageTitle title="Смены" sub="Открытие, закрытие и расхождения наличных по кассам" />
      {isLoading && <div className="space-y-1.5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-[22px]" />)}</div>}
      {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.items.length === 0 && (
        <div className="rounded-[28px] bg-card">
          <EmptyState title="Смен ещё не было" hint="Смена открывается на кассе перед первой продажей" />
        </div>
      )}
      <div className="space-y-1.5">
        {data?.items.map((s) => (
          <button key={s.id} onClick={() => setOpen(s.id)} className="flex w-full flex-wrap items-center gap-3 rounded-[22px] bg-card p-3 text-left ring-1 ring-line hover:ring-line-strong">
            <span className={cn('grid size-11 place-items-center rounded-full text-sm font-semibold', s.status === 'open' ? 'bg-accent text-accent-ink' : 'bg-card-muted text-ink-2')}>№{s.number}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{s.registerName}</span>
              <span className="text-xs text-muted">
                {date(s.openedAt, 'D MMM, HH:mm')} — {s.closedAt ? date(s.closedAt, 'D MMM, HH:mm') : 'сейчас'} · {s.openedByName}
              </span>
            </span>
            {s.status === 'open' ? <Pill tone="accent">открыта</Pill> : s.autoClosed ? <Pill tone="warn">автозакрытие</Pill> : <Pill tone="soft">закрыта</Pill>}
            {hasDiff(s.diff) && <Pill tone="dark">расхождение {Object.entries(s.diff!).filter(([, v]) => Number(v)).map(([k, v]) => money(v, k === 'USD' ? 'USD' : 'KGS')).join(', ')}</Pill>}
          </button>
        ))}
      </div>
      {data && data.total > LIMIT && (
        <div className="flex justify-end gap-1.5">
          <Button size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Назад"><ChevronLeft /></Button>
          <Pill tone="dark" className="h-8 px-3">{page} / {pages}</Pill>
          <Button size="icon-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Вперёд"><ChevronRight /></Button>
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)} className="max-w-2xl" title={rep.data ? `${rep.data.status === 'closed' ? 'Z' : 'X'}-отчёт · смена №${rep.data.number}` : 'Отчёт смены'}>
        <div className="scroll-thin mt-4 max-h-[70vh] overflow-y-auto">{rep.isLoading ? <Skeleton className="h-60 rounded-[22px]" /> : rep.data && <ReportView r={rep.data} />}</div>
      </Dialog>
    </div>
  );
}
