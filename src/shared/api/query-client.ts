import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Сеть отслеживаем сами (касса работает без интернета) — мутации не ставим на паузу
    mutations: { networkMode: 'always' },
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
    },
  },
});
