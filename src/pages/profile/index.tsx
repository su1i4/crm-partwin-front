import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useMe } from '@/entities/session';
import { useLogout } from '@/features/auth';
import { api, errorMessage } from '@/shared/api';
import { ago } from '@/shared/lib/format';
import { Avatar, Button, Card, PageTitle, Pill, Skeleton } from '@/shared/ui';

interface Session { id: string; userAgent: string | null; ip: string | null; lastUsedAt?: string; createdAt: string; current: boolean }

export default function ProfilePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const logout = useLogout();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<Session[]>('/auth/sessions').then((r) => r.data) });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const all = useMutation({ mutationFn: () => api.post('/auth/logout-all'), onSuccess: logout });
  return (
    <div className="space-y-6">
      <PageTitle title="Профиль" />
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={me?.user.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{me?.user.name}</div>
          <div className="text-sm text-muted">{me?.user.phone ?? me?.user.email}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {me?.membership?.roles.map((r) => <Pill key={r.id} tone="dark">{r.name}</Pill>)}
          <Pill tone={me?.user.telegramLinked ? 'ok' : 'muted'}>Telegram {me?.user.telegramLinked ? 'привязан' : 'не привязан'}</Pill>
          <Pill tone={me?.user.totpEnabled ? 'ok' : 'muted'}>2FA {me?.user.totpEnabled ? 'вкл' : 'выкл'}</Pill>
        </div>
      </Card>
      <div>
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="text-[15px] font-medium">Активные сессии</div>
          <Button size="sm" variant="ghost" onClick={() => all.mutate()} loading={all.isPending}>
            <LogOut /> Выйти на всех устройствах
          </Button>
        </div>
        {sessions.isLoading && <Skeleton className="h-14 rounded-full" />}
        <div className="space-y-1.5">
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-4 ring-1 ring-line">
              <Laptop className="size-4 text-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.userAgent ?? 'Устройство'}</span>
              <span className="hidden text-xs text-muted sm:block">{s.ip} · {ago(s.lastUsedAt ?? s.createdAt)}</span>
              {s.current ? <Pill tone="accent">Это устройство</Pill> : <Button size="sm" onClick={() => revoke.mutate(s.id)}>Завершить</Button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
