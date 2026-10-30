import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSession } from '@/entities/session';

/** Касса этого устройства — запоминается в браузере (на одном устройстве работает одна касса) */
export const useDeviceRegister = create<{ byTenant: Record<string, string>; set: (tenant: string, id: string | null) => void }>()(
  persist(
    (set) => ({
      byTenant: {},
      set: (tenant, id) =>
        set((s) => {
          const byTenant = { ...s.byTenant };
          if (id) byTenant[tenant] = id;
          else delete byTenant[tenant];
          return { byTenant };
        }),
    }),
    { name: 'ap.pos.device' },
  ),
);

export const useMyRegisterId = () => {
  const tenant = useSession((s) => s.currentTenantId) ?? '';
  return useDeviceRegister((s) => s.byTenant[tenant] ?? null);
};
