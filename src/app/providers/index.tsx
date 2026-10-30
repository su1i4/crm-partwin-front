import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { useSession } from '@/entities/session';
import { applyTheme, useTheme } from '@/features/theme';
import { configureApi, queryClient } from '@/shared/api';

// Подключаем сессию к API-клиенту (shared не знает про entities — FSD)
configureApi({
  getToken: () => useSession.getState().accessToken,
  getStoreId: () => useSession.getState().storeId,
  getRefresh: () => useSession.getState().refreshToken,
  onToken: (t) => useSession.getState().setToken(t),
  onAuthLost: () => {
    useSession.getState().reset();
    queryClient.clear();
    if (!location.pathname.startsWith('/login')) location.assign('/login');
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const theme = useTheme((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        theme={theme}
        toastOptions={{ style: { borderRadius: 999, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)' } }}
      />
    </QueryClientProvider>
  );
}
