import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Dashboard } from '@/shared/api';
import { useSession } from '@/entities/session';

export type DashboardPeriod = 'today' | 'week' | 'month';

export const useDashboard = (period: DashboardPeriod) => {
  const storeId = useSession((s) => s.storeId);
  return useQuery({
    queryKey: ['dashboard', period, storeId],
    queryFn: () => api.get<Dashboard>('/dashboard', { params: { period, ...(storeId ? { storeId } : {}) } }).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
};
