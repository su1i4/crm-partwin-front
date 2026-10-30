import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, PublicUser, UserTenant } from '@/shared/api';

interface SessionState {
  accessToken: string | null;
  /** Refresh из входа по PIN на кассе (cookie у кассы — от прошлого продавца) */
  refreshToken: string | null;
  user: PublicUser | null;
  tenants: UserTenant[];
  currentTenantId: string | null;
  /** Текущая точка (X-Store-Id); null — «Все точки» */
  storeId: string | null;
  setAuth: (r: AuthResponse) => void;
  setToken: (t: string, refresh?: string | null) => void;
  setStore: (id: string | null) => void;
  reset: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenants: [],
      currentTenantId: null,
      storeId: null,
      setAuth: (r) =>
        set((s) => ({
          accessToken: r.accessToken,
          user: r.user,
          tenants: r.tenants,
          currentTenantId: r.currentTenantId,
          storeId: r.currentTenantId === s.currentTenantId ? s.storeId : null,
        })),
      setToken: (accessToken, refreshToken = null) => set({ accessToken, refreshToken }),
      setStore: (storeId) => set({ storeId }),
      reset: () => set({ accessToken: null, refreshToken: null, user: null, tenants: [], currentTenantId: null, storeId: null }),
    }),
    { name: 'ap.session' },
  ),
);
