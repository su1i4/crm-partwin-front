import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useOffline } from '@/entities/pos-offline';
import { authApi, useSession } from '@/entities/session';
import type { AuthResponse } from '@/shared/api';

/** После входа: один магазин — сразу в систему; несколько — выбор магазина */
export function useAfterAuth() {
  const setAuth = useSession((s) => s.setAuth);
  const qc = useQueryClient();
  const nav = useNavigate();
  return (r: AuthResponse, to = '/') => {
    setAuth(r);
    qc.clear();
    nav(r.currentTenantId ? to : '/select-shop', { replace: true });
  };
}

export function useLogout() {
  const reset = useSession((s) => s.reset);
  const qc = useQueryClient();
  const nav = useNavigate();
  return async () => {
    // Выйти с неотправленными чеками нельзя (ТЗ 16.5)
    const pending = useOffline.getState().pending;
    if (pending > 0) {
      toast.error(`На кассе ${pending} неотправленных операций — дождитесь связи и отправки`);
      return;
    }
    try {
      await authApi.logout();
    } catch {
      /* сессия могла уже истечь */
    }
    reset();
    qc.clear();
    nav('/login', { replace: true });
  };
}
