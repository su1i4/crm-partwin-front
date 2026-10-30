import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError, type ApiErrorBody } from '@/shared/api';
import { demoAdapter } from '@/shared/api/demo';
import { env } from '@/shared/config/env';

/**
 * Админка платформы (ТЗ 24). Свой вход (пароль + 2FA) и свой токен — не смешивается с токеном магазина:
 * токен магазина в /admin/* даёт 401, токен админки в методах магазина — тоже.
 */

export type AdminRole = 'admin' | 'support';
interface AdminSession {
  token: string | null;
  admin: { id: string; name: string; role: AdminRole } | null;
  set: (token: string, admin: AdminSession['admin']) => void;
  logout: () => void;
}
export const useAdminSession = create<AdminSession>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      set: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: 'ap.admin' },
  ),
);

export const adminHttp = axios.create({ baseURL: env.apiUrl, timeout: 60_000, ...(env.demo ? { adapter: demoAdapter } : {}) });
adminHttp.interceptors.request.use((c) => {
  const t = useAdminSession.getState().token;
  if (t) c.headers.set('Authorization', `Bearer ${t}`);
  return c;
});
adminHttp.interceptors.response.use(
  (r) => r,
  (e: AxiosError<ApiErrorBody>) => {
    const status = e.response?.status ?? 0;
    const body = e.response?.data;
    // Токен истёк (8 часов) — на вход; при входе 401 — просто «неверно»
    if (status === 401 && !e.config?.url?.includes('auth/login')) useAdminSession.getState().logout();
    if (body && typeof body === 'object' && 'code' in body) return Promise.reject(new ApiError(status, body.code, body.message, body.details));
    return Promise.reject(new ApiError(status, status ? 'HTTP_ERROR' : 'NETWORK', status ? `Ошибка ${status}` : 'Нет связи с сервером'));
  },
);
const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'deleted';
export const TENANT_STATUS: Record<string, { label: string; tone: 'warn' | 'ok' | 'dark' | 'muted' }> = {
  trial: { label: 'пробный', tone: 'warn' },
  active: { label: 'активен', tone: 'ok' },
  suspended: { label: 'приостановлен', tone: 'dark' },
  deleted: { label: 'удалён', tone: 'muted' },
};
export const SHOP_TYPE: Record<string, string> = { container: 'Контейнер', city: 'Магазин в городе', wholesale: 'Опт' };

export interface TenantStats {
  stores: number;
  registers: number;
  staff: number;
  products: number;
  lastActivity: string | null;
  receipts30d: number;
}
export interface TenantRow extends TenantStats {
  id: string;
  name: string;
  shopType: string | null;
  city: string | null;
  phone: string | null;
  status: TenantStatus;
  plan: string | null;
  limits: Record<string, number> | null;
  subscriptionUntil: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerPhone: string | null;
}
export interface SupportSession {
  id: string;
  tenantId: string;
  adminId: string;
  status: 'requested' | 'active' | 'ended' | 'declined';
  reason: string;
  emergency: boolean;
  canWrite: boolean;
  showMoney: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  createdAt: string;
}
/** Карточка — строка tenants как есть (snake_case) + статистика + сеансы поддержки */
export interface TenantCard extends TenantStats {
  id: string;
  name: string;
  shop_type: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  inn: string | null;
  status: TenantStatus;
  plan: string | null;
  limits: Record<string, number> | null;
  subscription_until: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  support: SupportSession[];
}
export interface Monitoring {
  outbox: { failed: number | null; pending: number | null };
  problems: { tenantId: string; name: string; offlineUnsent: number; stuckImports: number; stockMismatches: number; ocrFoundRate: string | number | null }[];
  checkedTenants: number;
}
export interface JournalRow {
  id: string;
  created_at: string;
  admin_id: string;
  adminName: string | null;
  action: string;
  tenant_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
}
export type DictKind = 'makes' | 'brands' | 'synonyms' | 'wmi';

export const platformApi = {
  login: (b: { email: string; password: string; code: string }) => d(adminHttp.post<{ accessToken: string; admin: { id: string; name: string; role: AdminRole } }>('/admin/auth/login', b)),
  tenants: (q: { search?: string; status?: string }) => d(adminHttp.get<TenantRow[]>('/admin/tenants', { params: q })),
  tenant: (id: string) => d(adminHttp.get<TenantCard>(`/admin/tenants/${id}`)),
  subscription: (id: string, b: { status?: string; subscriptionUntil?: string | null; plan?: string; limits?: Record<string, number>; note?: string }) => d(adminHttp.patch<TenantCard>(`/admin/tenants/${id}/subscription`, b)),
  requestSupport: (id: string, b: { reason: string; emergency?: boolean; canWrite?: boolean }) =>
    d(adminHttp.post<{ session: SupportSession; supportToken?: string; expiresAt?: string }>(`/admin/tenants/${id}/support`, b)),
  enterSupport: (sessionId: string) => d(adminHttp.post<{ supportToken: string; expiresAt: string; canWrite: boolean; showMoney: boolean }>(`/admin/support/${sessionId}/enter`)),
  endSupport: (sessionId: string) => d(adminHttp.post<{ ended: true }>(`/admin/support/${sessionId}/end`)),
  dictionary: (kind: DictKind, q?: string) => d(adminHttp.get<Record<string, any>[]>(`/admin/dictionaries/${kind}`, { params: q ? { q } : {} })), // eslint-disable-line @typescript-eslint/no-explicit-any
  saveDictionary: (kind: DictKind, row: Record<string, unknown>) => d(adminHttp.put(`/admin/dictionaries/${kind}`, row)),
  importVehicles: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return d(adminHttp.post<{ rows: number; models: number; generations: number; modifications: number; skipped: number }>('/admin/dictionaries/vehicles/import', fd));
  },
  monitoring: () => d(adminHttp.get<Monitoring>('/admin/monitoring')),
  journal: (q: { adminId?: string; tenantId?: string }) => d(adminHttp.get<JournalRow[]>('/admin/journal', { params: q })),
};

const on = () => !!useAdminSession.getState().token;
export const useAdminTenants = (q: { search?: string; status?: string }) => useQuery({ queryKey: ['adm', 'tenants', q], queryFn: () => platformApi.tenants(q), placeholderData: keepPreviousData, enabled: on() });
export const useAdminTenant = (id?: string) => useQuery({ queryKey: ['adm', 'tenant', id], queryFn: () => platformApi.tenant(id!), enabled: !!id && on() });
export const useMonitoring = () => useQuery({ queryKey: ['adm', 'monitoring'], queryFn: platformApi.monitoring, refetchInterval: 60_000, enabled: on() });
export const useJournal = (q: { adminId?: string; tenantId?: string }) => useQuery({ queryKey: ['adm', 'journal', q], queryFn: () => platformApi.journal(q), enabled: on() });
export const useDictionary = (kind: DictKind, q: string) => useQuery({ queryKey: ['adm', 'dict', kind, q], queryFn: () => platformApi.dictionary(kind, q || undefined), placeholderData: keepPreviousData, enabled: on() });

// ── Поддержка со стороны владельца магазина (обычный токен магазина) ──
export interface SupportState {
  grant: { id: string; until: string; canWrite: boolean; showMoney: boolean } | null;
  sessions: { id: string; status: SupportSession['status']; reason: string; emergency: boolean; canWrite: boolean; showMoney: boolean; startedAt: string | null; expiresAt: string | null; createdAt: string; adminName: string }[];
  activeSession: SupportState['sessions'][number] | null;
}

export const supportApi = {
  state: () => d(api.get<SupportState>('/support')),
  grant: (b: { hours?: number; canWrite?: boolean; showMoney?: boolean }) => d(api.post<SupportState>('/support/grant', b)),
  revoke: () => d(api.post<SupportState>('/support/revoke', {})),
  approve: (id: string, b: { canWrite?: boolean; showMoney?: boolean }) => d(api.post<SupportState>(`/support/requests/${id}/approve`, b)),
  decline: (id: string) => d(api.post<SupportState>(`/support/requests/${id}/decline`, {})),
};
/** Только владельцу: баннер «Сеанс поддержки» и запросы доступа */
export const useSupportState = (enabled: boolean) => useQuery({ queryKey: ['support-state'], queryFn: supportApi.state, enabled, refetchInterval: 60_000, retry: false });
