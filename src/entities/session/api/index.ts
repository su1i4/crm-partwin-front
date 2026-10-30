import { useQuery } from '@tanstack/react-query';
import { api, type AuthResponse, type Me } from '@/shared/api';
import { useSession } from '../model/store';

export const authApi = {
  login: (b: { login: string; password: string; totpCode?: string }) => api.post<AuthResponse>('/auth/login', b).then((r) => r.data),
  register: (b: { name: string; login: string; password: string; shopName: string; locale?: string }) =>
    api.post<AuthResponse>('/auth/register', b).then((r) => r.data),
  selectTenant: (tenantId: string) => api.post<AuthResponse>('/auth/select-tenant', { tenantId }).then((r) => r.data),
  me: () => api.get<Me>('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout'),
};

export const meKey = ['me'] as const;

export function useMe() {
  const token = useSession((s) => s.accessToken);
  const tenant = useSession((s) => s.currentTenantId);
  return useQuery({ queryKey: [...meKey, tenant], queryFn: authApi.me, enabled: !!token, staleTime: 60_000 });
}

/** Право из membership.permissions. Права проверяет backend — тут только скрываем недоступное (ТЗ 2.4.11). */
export function useCan() {
  const { data } = useMe();
  const perms = new Set(data?.membership?.permissions ?? []);
  return (p?: string) => !p || data?.membership?.isOwner === true || perms.has(p);
}
