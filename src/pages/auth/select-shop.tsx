import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, useSession } from '@/entities/session';
import { useAfterAuth, useLogout } from '@/features/auth';
import { errorMessage } from '@/shared/api';
import { Avatar, Pill } from '@/shared/ui';
import { AuthLayout } from './auth-layout';

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'dark' }> = {
  active: { label: 'Активен', tone: 'ok' },
  trial: { label: 'Пробный', tone: 'warn' },
  suspended: { label: 'Приостановлен', tone: 'dark' },
};

export default function SelectShopPage() {
  const tenants = useSession((s) => s.tenants);
  const after = useAfterAuth();
  const logout = useLogout();
  const m = useMutation({ mutationFn: authApi.selectTenant, onSuccess: (r) => after(r), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <AuthLayout
      title="Выберите магазин"
      sub="Вы сотрудник нескольких магазинов. Сменить можно в любой момент."
      footer={
        <button onClick={logout} className="hover:text-ink">
          Войти под другим логином
        </button>
      }
    >
      <div className="space-y-2">
        {tenants.map((t) => {
          const st = STATUS[t.tenantStatus] ?? { label: t.tenantStatus, tone: 'dark' as const };
          return (
            <button
              key={t.tenantId}
              disabled={m.isPending}
              onClick={() => m.mutate(t.tenantId)}
              className="flex w-full items-center gap-3 rounded-[22px] bg-card p-3 text-left ring-1 ring-line transition hover:ring-ink disabled:opacity-60"
            >
              <Avatar name={t.tenantName} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate font-medium text-ink">
                  {t.tenantName} {t.isOwner && <Crown className="size-3.5 text-accent" />}
                </span>
                <span className="text-xs text-muted">{t.isOwner ? 'Владелец' : 'Сотрудник'}</span>
              </span>
              <Pill tone={st.tone}>{st.label}</Pill>
              {m.isPending && m.variables === t.tenantId ? (
                <span className="size-4 animate-spin rounded-full border-2 border-ink border-r-transparent" />
              ) : (
                <ChevronRight className="size-4 text-muted" />
              )}
            </button>
          );
        })}
      </div>
    </AuthLayout>
  );
}
