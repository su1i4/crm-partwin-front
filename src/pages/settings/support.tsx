import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, LifeBuoy, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supportApi, useSupportState, type SupportState } from '@/entities/platform';
import { useMe } from '@/entities/session';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date } from '@/shared/lib/format';
import { Button, Card, EmptyState, ErrorState, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const STATUS: Record<string, { label: string; tone: 'warn' | 'ok' | 'muted' | 'accent-outline' }> = {
  requested: { label: 'просит доступ', tone: 'warn' },
  active: { label: 'работает', tone: 'ok' },
  ended: { label: 'завершён', tone: 'muted' },
  declined: { label: 'отклонён', tone: 'accent-outline' },
};

/**
 * Доступ поддержки (ТЗ 24): владелец решает, когда сотрудник сервиса может зайти в магазин.
 * По умолчанию — только просмотр, деньги и закупочные цены скрыты.
 */
export default function SupportSettingsPage() {
  const me = useMe();
  const owner = !!me.data?.membership?.isOwner;
  const { data, isLoading, error, refetch } = useSupportState(owner);
  const qc = useQueryClient();
  const [hours, setHours] = useState('24');
  const [canWrite, setCanWrite] = useState(false);
  const [showMoney, setShowMoney] = useState(false);
  const [perm, setPerm] = useState<Record<string, { canWrite: boolean; showMoney: boolean }>>({});
  const set = (s: SupportState) => qc.setQueryData(['support-state'], s);
  const grant = useMutation({ mutationFn: () => supportApi.grant({ hours: Number(hours), canWrite, showMoney }), onSuccess: (s) => (set(s), toast.success('Доступ разрешён')), onError: (e) => toast.error(errorMessage(e)) });
  const revoke = useMutation({ mutationFn: supportApi.revoke, onSuccess: (s) => (set(s), toast.success('Доступ закрыт, сеансы завершены')), onError: (e) => toast.error(errorMessage(e)) });
  const approve = useMutation({
    mutationFn: (id: string) => supportApi.approve(id, perm[id] ?? { canWrite: false, showMoney: false }),
    onSuccess: (s) => (set(s), toast.success('Поддержка может войти — на 60 минут')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const decline = useMutation({ mutationFn: (id: string) => supportApi.decline(id), onSuccess: set, onError: (e) => toast.error(errorMessage(e)) });
  if (me.data && !owner)
    return (
      <div className="space-y-6">
        <PageTitle title="Доступ поддержки" />
        <Card>
          <EmptyState icon={<LifeBuoy />} title="Только для владельца" hint="Пускать поддержку в магазин может только владелец" />
        </Card>
      </div>
    );
  const requests = data?.sessions.filter((s) => s.status === 'requested') ?? [];
  const live = data?.sessions.filter((s) => s.status === 'active' && s.expiresAt && new Date(s.expiresAt) > new Date()) ?? [];
  return (
    <div className="space-y-6">
      <PageTitle title="Доступ поддержки" sub="Сотрудник сервиса заходит в магазин только с вашего согласия. Всё, что он делает, видно в журнале действий с пометкой «поддержка»" />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <>
          {requests.map((r) => {
            const p = perm[r.id] ?? { canWrite: false, showMoney: false };
            return (
              <Card key={r.id} className="space-y-3 p-5 ring-2 ring-warn">
                <div className="flex items-start gap-3">
                  <LifeBuoy className="mt-0.5 size-5 text-warn" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{r.adminName} просит доступ к магазину</div>
                    <div className="text-sm text-ink-2">{r.reason}</div>
                    <div className="text-xs text-muted">{date(r.createdAt, 'D MMM, HH:mm')}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Switch checked={p.canWrite} onChange={(v) => setPerm({ ...perm, [r.id]: { ...p, canWrite: v } })} label="Разрешить изменения" />
                  <Switch checked={p.showMoney} onChange={(v) => setPerm({ ...perm, [r.id]: { ...p, showMoney: v } })} label="Показывать деньги и закупку" />
                </div>
                <div className="flex gap-2">
                  <Button variant="dark" loading={approve.isPending && approve.variables === r.id} onClick={() => approve.mutate(r.id)}>
                    Разрешить на 60 минут
                  </Button>
                  <Button variant="ghost" loading={decline.isPending && decline.variables === r.id} onClick={() => decline.mutate(r.id)}>
                    Отклонить
                  </Button>
                </div>
              </Card>
            );
          })}
          <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="h-fit space-y-4 p-5">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                {data.grant ? <ShieldCheck className="size-4 text-ok" /> : <ShieldOff className="size-4 text-muted" />}
                {data.grant ? 'Доступ открыт заранее' : 'Заранее доступ не открыт'}
              </div>
              {data.grant ? (
                <>
                  <div className="rounded-[16px] bg-ok-soft px-4 py-3 text-sm">
                    До {date(data.grant.until, 'D MMM, HH:mm')} поддержка может войти без запроса · {data.grant.canWrite ? 'с изменениями' : 'только просмотр'}
                    {data.grant.showMoney ? ' · деньги видны' : ' · деньги скрыты'}
                  </div>
                  <Button variant="accent" className="w-full" loading={revoke.isPending} onClick={() => revoke.mutate()}>
                    Закрыть доступ и завершить сеансы
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted">Удобно, когда вы сами написали в поддержку: не придётся подтверждать запрос</div>
                  <Segmented
                    value={hours}
                    onChange={setHours}
                    options={[
                      { value: '4', label: '4 часа' },
                      { value: '24', label: '24 часа' },
                      { value: '72', label: '3 дня' },
                    ]}
                  />
                  <Switch checked={canWrite} onChange={setCanWrite} label="Разрешить изменения" />
                  <Switch checked={showMoney} onChange={setShowMoney} label="Показывать деньги, закупку и маржу" />
                  <Button variant="dark" className="w-full" loading={grant.isPending} onClick={() => grant.mutate()}>
                    Разрешить доступ поддержке
                  </Button>
                </>
              )}
              {live.length > 0 && !data.grant && (
                <Button variant="ghost" className="w-full" loading={revoke.isPending} onClick={() => revoke.mutate()}>
                  Завершить текущий сеанс
                </Button>
              )}
            </Card>
            <Tray className="h-fit p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">История</div>
              <div className="space-y-1.5">
                {data.sessions.map((s) => {
                  const alive = s.status === 'active' && s.expiresAt && new Date(s.expiresAt) > new Date();
                  const st = s.status === 'active' && !alive ? { label: 'истёк', tone: 'muted' as const } : STATUS[s.status];
                  return (
                    <div key={s.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] bg-card px-4 py-2.5', s.emergency && 'ring-1 ring-accent-line')}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px]">
                          {s.emergency && <AlertTriangle className="mr-1 inline size-3.5 text-accent" />}
                          {s.adminName}: {s.reason}
                        </span>
                        <span className="block text-xs text-muted">
                          {date(s.createdAt, 'DD.MM HH:mm')}
                          {s.expiresAt && ` · до ${date(s.expiresAt, 'HH:mm')}`} · {s.canWrite ? 'с изменениями' : 'просмотр'}
                          {s.emergency ? ' · аварийный' : ''}
                        </span>
                      </span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                  );
                })}
                {!data.sessions.length && <div className="rounded-[16px] bg-card px-4 py-3 text-sm text-muted">Поддержка в магазин не заходила</div>}
              </div>
            </Tray>
          </div>
        </>
      )}
    </div>
  );
}
