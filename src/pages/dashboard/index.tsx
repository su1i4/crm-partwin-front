import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useDashboard, type DashboardPeriod } from '@/entities/dashboard';
import { useMe } from '@/entities/session';
import { ErrorState, PageTitle, Segmented, Skeleton, Switch } from '@/shared/ui';
import { AttentionList, KpiTiles, MoneyCard, MyRequests, QuickActions, RevenueChart, RevenueHero, StoreSplit, TopProducts } from '@/widgets/dashboard';

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-4">
        <Skeleton className="h-28 w-80" />
        <div className="hidden gap-2.5 sm:flex">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-32 rounded-[22px]" />)}</div>
      </div>
      <Skeleton className="h-14 rounded-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </div>
    </div>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [weekCompare, setWeekCompare] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useDashboard(period);
  const { data: me } = useMe();
  const compare = weekCompare ? 'weekAgo' : 'yesterday';

  return (
    <div className="space-y-6">
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuickActions data={data} />
          <div className="hidden items-center gap-2 sm:flex">
            <button onClick={() => refetch()} className="grid size-10 place-items-center rounded-full bg-card text-ink ring-1 ring-line hover:ring-line-strong" title="Обновить">
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            </button>
            <button className="grid size-10 place-items-center rounded-full bg-card text-ink ring-1 ring-line hover:ring-line-strong" title="Настроить блоки">
              <SlidersHorizontal className="size-4" />
            </button>
            <button className="grid size-10 place-items-center rounded-full bg-card text-ink ring-1 ring-line hover:ring-line-strong" title="Выгрузить">
              <Download className="size-4" />
            </button>
          </div>
        </div>
      )}

      <PageTitle
        title={`${greeting()}, ${me?.user.name.split(' ')[0] ?? ''}`}
        actions={
          <>
            <Switch checked={weekCompare} onChange={setWeekCompare} label="С прошлой неделей" />
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'today', label: 'Сегодня' },
                { value: 'week', label: 'Неделя' },
                { value: 'month', label: 'Месяц' },
              ]}
            />
          </>
        }
      />

      {isLoading && <DashboardSkeleton />}
      {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <>
          {data.tiles && (
            <div className="flex flex-col gap-5 min-[1200px]:flex-row min-[1200px]:items-start min-[1200px]:justify-between">
              <RevenueHero tile={data.tiles.find((t) => t.key === 'revenue')} compare={compare} />
              <KpiTiles data={data} compare={compare} />
            </div>
          )}
          <StoreSplit data={data} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
            <AttentionList data={data} />
            {data.topProducts ? <TopProducts data={data} /> : <div className="hidden md:block" />}
            <div className="space-y-4 md:col-span-2 xl:col-span-1 xl:row-span-2">
              {data.myRequests && (
                <div>
                  <div className="px-1 pb-3 text-[15px] font-medium text-ink">Мои заявки</div>
                  <MyRequests data={data} />
                </div>
              )}
              <MoneyCard data={data} />
            </div>
            {data.chart && (
              <div className="md:col-span-2">
                <RevenueChart data={data} period={period} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
