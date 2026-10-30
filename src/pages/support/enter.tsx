import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/entities/session';
import { queryClient } from '@/shared/api';
import { Card } from '@/shared/ui';

/**
 * Вкладка поддержки: админка открывает /support/enter#t=<токен сеанса>&tenant=<id>.
 * Токен сеанса работает как обычный Bearer в методах магазина; обновить его нельзя — сеанс 60 минут.
 */
export default function SupportEnterPage() {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const t = h.get('t');
    const tenant = h.get('tenant');
    if (!t || !tenant) return setErr('Ссылка неполная — откройте магазин заново из админки');
    queryClient.clear();
    useSession.setState({
      accessToken: t,
      refreshToken: null,
      user: { id: 'support', name: 'Поддержка', phone: null, email: null, locale: 'ru', totpEnabled: true, telegramLinked: false, lastLoginAt: null },
      tenants: [{ membershipId: 'support', tenantId: tenant, tenantName: 'Магазин', tenantStatus: 'active', isOwner: false, onboardingCompleted: true }],
      currentTenantId: tenant,
      storeId: null,
    });
    // Токен не должен оставаться в адресе и истории
    history.replaceState(null, '', '/support/enter');
    nav('/', { replace: true });
  }, [nav]);
  return (
    <div className="hatch grid min-h-dvh place-items-center bg-bg p-4">
      <Card className="max-w-sm p-6 text-center text-[15px]">{err || 'Открываем магазин…'}</Card>
    </div>
  );
}
