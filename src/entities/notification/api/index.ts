import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AppNotification, type Page } from '@/shared/api';

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Page<AppNotification> & { unread: number }>('/notifications', { params: { limit: 20 } }).then((r) => r.data),
    refetchInterval: 60_000,
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | 'all') => api.post('/notifications/read', ids === 'all' ? {} : { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};
