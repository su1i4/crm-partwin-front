import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Monitor, MonitorSmartphone, Printer, QrCode, ScanLine, Smartphone, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useDevices, usePosDevices, useRegistersAll, useStores } from '@/entities/admin';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, PageTitle, Pill, Skeleton, Tray } from '@/shared/ui';

/** Кассы и устройства (ТЗ 22): агент печати (принтер чеков, денежный ящик), браузеры-кассы, телефон как сканер, экран покупателя */
export default function DevicesPage() {
  const regs = useRegistersAll();
  const stores = useStores();
  const agents = useDevices();
  const pos = usePosDevices();
  const qc = useQueryClient();
  const [code, setCode] = useState<{ code: string; register: string; until: number } | null>(null);
  const pair = useMutation({
    mutationFn: (registerId: string) => adminApi.pairingCode(registerId),
    onSuccess: (r) => setCode({ code: r.code, register: r.register.name, until: Date.now() + r.expiresInSec * 1000 }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (x: { id: string; kind: 'agent' | 'pos' }) => (x.kind === 'agent' ? adminApi.revokeDevice(x.id) : adminApi.revokePosDevice(x.id)),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['devices'] }), qc.invalidateQueries({ queryKey: ['pos-devices-list'] }), toast.success('Доступ устройства отозван')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: (x: { registerId: string; kind: 'drawer' | 'test' }) => adminApi.printJob(x.registerId, x.kind),
    onSuccess: (_, x) => toast.success(x.kind === 'test' ? 'Тестовый чек отправлен на принтер' : 'Ящик открывается'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const storeName = (id: string) => stores.data?.find((s) => s.id === id)?.name ?? '';
  return (
    <div className="space-y-6">
      <PageTitle title="Кассы и устройства" sub="Агент печати на компьютере кассы печатает чеки и открывает ящик. Браузер или телефон, привязанный к кассе, продаёт без интернета" />
      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/pos" className="rounded-[22px] bg-card p-4 ring-1 ring-line hover:ring-line-strong">
          <ScanLine className="size-5 text-accent" />
          <div className="mt-2 text-[14.5px] font-medium">Телефон как сканер</div>
          <div className="text-xs text-muted">На кассе: «Ещё» → «Телефон как сканер» → наведите камеру телефона на QR. Сканы с телефона попадают в чек на компьютере</div>
        </Link>
        <a href="/pos/display" target="_blank" rel="noreferrer" className="rounded-[22px] bg-card p-4 ring-1 ring-line hover:ring-line-strong">
          <Monitor className="size-5 text-accent" />
          <div className="mt-2 text-[14.5px] font-medium">Экран покупателя</div>
          <div className="text-xs text-muted">Откройте на втором мониторе в этом же браузере — покупатель видит строки чека и сумму</div>
        </a>
        <Link to="/m" className="rounded-[22px] bg-card p-4 ring-1 ring-line hover:ring-line-strong">
          <Smartphone className="size-5 text-accent" />
          <div className="mt-2 text-[14.5px] font-medium">Мобильная версия</div>
          <div className="text-xs text-muted">Для продавца в зале и кладовщика: проверка цены и остатка сканом, приёмка, инвентаризация, места</div>
        </Link>
      </div>
      {regs.isLoading && <Skeleton className="h-48 rounded-[24px]" />}
      {regs.data?.map((r) => {
        const ag = agents.data?.filter((d) => d.registerId === r.id && !d.revokedAt) ?? [];
        const br = pos.data?.filter((d) => d.registerId === r.id && !d.revokedAt) ?? [];
        return (
          <Tray key={r.id} className={cn('p-3', !r.isActive && 'opacity-60')}>
            <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
              <span className="text-[15px] font-medium">{r.name}</span>
              <span className="font-mono text-xs text-muted">{r.code}</span>
              <span className="text-xs text-muted">· {storeName(r.storeId)}</span>
              <span className="flex-1" />
              {ag.some((a) => a.online) && (
                <>
                  <Button size="sm" variant="soft" loading={test.isPending && test.variables?.kind === 'test'} onClick={() => test.mutate({ registerId: r.id, kind: 'test' })}>
                    <Printer /> Тест печати
                  </Button>
                  <Button size="sm" variant="soft" onClick={() => test.mutate({ registerId: r.id, kind: 'drawer' })}>
                    Открыть ящик
                  </Button>
                </>
              )}
              <Button size="sm" variant="dark" loading={pair.isPending && pair.variables === r.id} onClick={() => pair.mutate(r.id)}>
                <QrCode /> Подключить агент
              </Button>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {ag.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-[16px] bg-card px-3 py-2.5">
                  <Cpu className="size-4 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {d.name} {d.agentVersion && <span className="text-xs text-muted">v{d.agentVersion}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{(d.info?.printers ?? []).join(', ') || 'принтеры не найдены'}</span>
                  </span>
                  <Pill tone={d.online ? 'ok' : 'muted'}>
                    {d.online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />} {d.online ? 'онлайн' : d.lastSeenAt ? ago(d.lastSeenAt) : 'не был'}
                  </Pill>
                  <button onClick={() => confirm('Отозвать доступ агента?') && revoke.mutate({ id: d.id, kind: 'agent' })} className="grid size-8 place-items-center rounded-full text-muted hover:text-accent" aria-label="Отозвать">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {br.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-[16px] bg-card px-3 py-2.5">
                  <MonitorSmartphone className="size-4 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {d.name} <span className="font-mono text-xs text-muted">{d.series}</span>
                    </span>
                    <span className="block text-xs text-muted">касса без интернета · синхр. {d.lastSyncAt ? ago(d.lastSyncAt) : '—'}</span>
                  </span>
                  <button onClick={() => confirm('Отвязать браузер от кассы? Неотправленные офлайн-чеки на нём потеряются') && revoke.mutate({ id: d.id, kind: 'pos' })} className="grid size-8 place-items-center rounded-full text-muted hover:text-accent" aria-label="Отвязать">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {!ag.length && !br.length && <div className="rounded-[16px] bg-card px-3 py-2.5 text-sm text-muted">Устройств нет — печать через браузер (PDF)</div>}
            </div>
          </Tray>
        );
      })}
      {regs.data && !regs.data.length && (
        <Card>
          <EmptyState title="Касс нет" hint="Касса создаётся вместе с точкой в «Настройках»" />
        </Card>
      )}
      <Dialog open={!!code} onOpenChange={(v) => !v && setCode(null)} title="Код для агента печати" description={code ? `${code.register} · действует 10 минут` : ''}>
        {code && (
          <div className="mt-4 space-y-4 text-center">
            <div className="rounded-[22px] bg-pill py-6 font-mono text-[44px] font-semibold tracking-[0.3em] text-pill-ink">{code.code}</div>
            <ol className="space-y-1 text-left text-sm text-ink-2">
              <li>1. Скачайте и запустите агент печати на компьютере кассы.</li>
              <li>2. Введите этот код в окне агента.</li>
              <li>3. Агент найдёт принтер чеков и денежный ящик — устройство появится здесь «онлайн».</li>
            </ol>
          </div>
        )}
      </Dialog>
    </div>
  );
}
