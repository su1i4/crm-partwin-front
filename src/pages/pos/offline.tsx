import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CloudOff, CloudUpload, Delete, HardDriveDownload, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, UserRoundCog, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Register, Shift } from '@/entities/pos';
import { deviceApi, offline, pinFailed, pinLocked, pinOk, useOffline, verifyPinOffline } from '@/entities/pos-offline';
import { useMe, useSession, meKey } from '@/entities/session';
import { cart, useCart } from '@/features/pos-cart';
import { errorMessage } from '@/shared/api';
import { useOnline } from '@/shared/hooks/use-online';
import { cn } from '@/shared/lib/cn';
import { ago, date, money } from '@/shared/lib/format';
import { uuid } from '@/shared/lib/uuid';
import { Button, Dialog, Field, Input, Pill, Segmented } from '@/shared/ui';

/**
 * Связка кассы с офлайн-режимом: база устройства, кэш (полный раз в сутки, изменения раз в 3 мин),
 * отправка очереди, смена и продавец для работы без сети, переключение чека в офлайн при потере связи.
 */
export function usePosOfflineBridge(register: Register | null, onlineShift: Shift | null | undefined) {
  const tenant = useSession((s) => s.currentTenantId);
  const online = useOnline();
  const { data: me } = useMe();
  const device = useOffline((s) => s.device);
  const mode = useCart((s) => s.mode);
  const lines = useCart((s) => s.lines.length);

  useEffect(() => {
    if (tenant) void offline.init(tenant).then(() => offline.requestPersist());
  }, [tenant]);

  // Кэш и очередь
  useEffect(() => {
    if (!device || !online) return;
    void offline.pullCache();
    void offline.flush();
    const c = setInterval(() => void offline.pullCache(), 3 * 60_000);
    const f = setInterval(() => void offline.flush(), 10_000);
    return () => {
      clearInterval(c);
      clearInterval(f);
    };
  }, [device, online]);

  // Смена с сервера — источник правды, пока не открыли смену без сети, которая ещё не ушла
  useEffect(() => {
    if (!online || onlineShift === undefined) return;
    const cur = useOffline.getState().shift;
    if (onlineShift) {
      if (cur?.id !== onlineShift.id || cur.status !== 'open')
        void offline.setShift({ id: onlineShift.id, number: onlineShift.number, openedAt: onlineShift.openedAt, offline: false, status: 'open', opening: onlineShift.opening });
    } else if (!cur?.offline || useOffline.getState().pending === 0) void offline.setShift(null);
  }, [online, onlineShift]);

  // Продавец по умолчанию — тот, кто вошёл
  useEffect(() => {
    if (online && me?.membership) void offline.setSeller({ membershipId: me.membership.id, name: me.user.name });
  }, [online, me]);

  // Связь пропала — чек продолжается на кассе; вернулась — следующий чек снова онлайн
  useEffect(() => {
    if (!online && device && mode === 'online') cart.goOffline();
    if (online && mode === 'offline') {
      void cart.cancelOrphan();
      if (!lines) cart.goOnlineIfIdle();
    }
  }, [online, device, mode, lines]);

  // Не закрывать вкладку с неотправленными чеками (ТЗ 16.5)
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useOffline.getState().pending > 0 || useCart.getState().mode === 'offline' && useCart.getState().lines.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
  void register;
}

/** На одном устройстве продаёт только одна вкладка кассы, остальные — просмотр (ТЗ 16.4) */
export function useSellLock(): boolean {
  const [has, setHas] = useState(true);
  useEffect(() => {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks) return;
    let release: (() => void) | null = null;
    let alive = true;
    void locks.request('ap-pos-sell', { ifAvailable: true }, (lock) => {
      if (!alive) return;
      setHas(!!lock);
      if (!lock) return;
      return new Promise<void>((r) => (release = r));
    });
    return () => {
      alive = false;
      release?.();
    };
  }, []);
  return has;
}

/** Пилюля статуса: онлайн/без сети, неотправленные, предупреждения 24 и 72 часа */
export function OfflineStatus({ onOpen }: { onOpen: () => void }) {
  const online = useOnline();
  const { pending, oldestPendingAt, syncing, device, rejected } = useOffline();
  const hours = oldestPendingAt ? (Date.now() - Date.parse(oldestPendingAt)) / 3_600_000 : 0;
  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition',
        !online ? 'bg-accent text-accent-ink ring-accent' : pending ? 'bg-warn-soft text-warn ring-transparent' : 'bg-ok-soft text-ok ring-transparent',
      )}
    >
      {!online ? <WifiOff className="size-4" /> : syncing ? <RefreshCw className="size-4 animate-spin" /> : pending ? <CloudUpload className="size-4" /> : <CheckCircle2 className="size-4" />}
      {!online ? 'Без сети' : 'Онлайн'}
      {pending > 0 && <span className="rounded-full bg-black/10 px-1.5 tabular-nums">{pending}</span>}
      {rejected.length > 0 && <AlertTriangle className="size-3.5" />}
      {!device && online && <span className="hidden opacity-70 lg:inline">· без офлайна</span>}
      {hours > 24 && <span className="hidden lg:inline">· {hours > 72 ? 'больше 3 суток!' : 'больше суток'}</span>}
    </button>
  );
}

const OP_LABEL: Record<string, string> = { shift_open: 'Открытие смены', sale: 'Чек', return: 'Возврат', cash_op: 'Внесение/изъятие', shift_close: 'Закрытие смены', customer: 'Клиент', product_draft: 'Товар' };

/** Касса без интернета: привязка устройства, кэш, очередь, отклонённые операции */
export function OfflinePanel({ open, onOpenChange, register, canManage }: { open: boolean; onOpenChange: (v: boolean) => void; register: Register; canManage: boolean }) {
  const online = useOnline();
  const s = useOffline();
  const [name, setName] = useState('');
  const ops = useQuery({
    queryKey: ['offline-ops', s.pending, s.lastSyncAt, open],
    queryFn: async () => (s.db ? (await s.db.ops.orderBy('seq').reverse().limit(30).toArray()) : []),
    enabled: open && !!s.db,
    networkMode: 'always',
  });
  const counts = useQuery({
    queryKey: ['offline-counts', s.meta?.deltaAt, open],
    queryFn: async () => (s.db ? { products: await s.db.products.count(), customers: await s.db.customers.count(), staff: await s.db.staff.count() } : null),
    enabled: open && !!s.db,
    networkMode: 'always',
  });
  const reg = useMutation({
    mutationFn: () => offline.register(register.id, name || undefined),
    onSuccess: (d) => toast.success(`Касса готова к работе без интернета. Серия чеков ${d.numberPrefix}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hours = s.oldestPendingAt ? (Date.now() - Date.parse(s.oldestPendingAt)) / 3_600_000 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl" title="Работа без интернета" description={s.device ? `${s.device.register.name} · серия ${s.meta?.device.numberPrefix ?? s.device.numberPrefix}` : register.name}>
      <div className="scroll-thin mt-4 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {!s.device ? (
          <div className="space-y-4 rounded-[22px] bg-card-muted p-4">
            <div className="flex gap-3">
              <CloudOff className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="text-sm text-ink-2">
                Привяжите этот браузер к кассе — тогда без интернета можно продавать: товары, цены, клиенты и сотрудники хранятся на устройстве, чеки уходят на сервер, когда связь вернётся.
                Номера чеков: код кассы + серия устройства (например, {register.code}А-000001).
              </div>
            </div>
            {!canManage && <div className="rounded-2xl bg-warn-soft p-3 text-sm">Привязать устройство может администратор или владелец (право «Устройства»).</div>}
            <Field label="Название устройства">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`ПК ${register.name}`} />
            </Field>
            <Button variant="dark" disabled={!canManage || !online} loading={reg.isPending} onClick={() => reg.mutate()}>
              <HardDriveDownload /> Подготовить кассу к работе без интернета
            </Button>
          </div>
        ) : (
          <>
            {hours > 24 && (
              <div className={cn('flex gap-2 rounded-[20px] p-3 text-sm', hours > 72 ? 'bg-accent text-accent-ink' : 'bg-warn-soft text-ink')}>
                <AlertTriangle className="size-4 shrink-0" />
                {hours > 72 ? `Нет связи больше 3 суток, неотправленных операций: ${s.pending}. Найдите интернет — цены и остатки устарели.` : 'Больше суток без связи — цены и остатки могли устареть.'}
              </div>
            )}
            {s.persistGranted === false && (
              <div className="flex gap-2 rounded-[20px] bg-warn-soft p-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warn" />
                Браузер не дал постоянное хранилище — при нехватке места он может удалить данные кассы. На iPhone/iPad установите кассу на экран «Домой».
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Неотправлено', s.pending],
                ['Товаров в кэше', counts.data?.products ?? '—'],
                ['Клиентов', counts.data?.customers ?? '—'],
                ['Сотрудников', counts.data?.staff ?? '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-[18px] bg-card-muted p-3">
                  <div className="text-xs text-muted">{k}</div>
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Кэш: полный {s.meta ? ago(s.meta.fullAt) : '—'}, изменения {s.meta ? ago(s.meta.deltaAt) : '—'}</span>
              <span>· отправка {s.lastSyncAt ? ago(s.lastSyncAt) : '—'}</span>
              {s.meta && <span>· режим точки: {s.meta.store.registerMode === 'single' ? 'одна касса' : 'несколько касс'}</span>}
            </div>
            {s.lastError && <div className="rounded-2xl bg-accent-soft px-3 py-2 text-sm text-accent">{s.lastError}</div>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="dark" disabled={!online || !s.pending} loading={s.syncing} onClick={() => void offline.flush()}>
                <CloudUpload /> Отправить сейчас
              </Button>
              <Button size="sm" disabled={!online} loading={s.cacheLoading} onClick={() => void offline.pullCache(true)}>
                <RefreshCw /> Обновить кэш полностью
              </Button>
            </div>
            {s.meta && (
              <div className="rounded-[20px] p-3 text-[13px] ring-1 ring-line">
                <div className="mb-1.5 font-medium">Без сети на этой точке можно</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['Наличные, карта, перевод', true],
                    ['В долг', s.meta.offlineRules.debt],
                    ['Взял у соседа', s.meta.offlineRules.neighbor],
                    ['Возврат без чека', s.meta.offlineRules.returnOtherRegisterOrWithoutReceipt],
                    ['Распознавание номера', false],
                  ].map(([k, v]) => (
                    <Pill key={String(k)} tone={v ? 'ok' : 'muted'}>
                      {v ? '✓' : '✗'} {k}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="px-1 text-[13px] font-medium">Очередь операций</div>
              {!ops.data?.length && <div className="px-1 text-sm text-muted">Пусто</div>}
              {ops.data?.map((o) => (
                <div key={o.seq} className="flex items-center gap-3 rounded-[18px] bg-card-muted px-3 py-2 text-[13px]">
                  <span className="w-8 text-xs text-faint tabular-nums">№{o.seq}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.title || OP_LABEL[o.type]}</span>
                    {o.error && <span className="block truncate text-xs text-accent">{o.error}</span>}
                  </span>
                  <span className="hidden text-xs text-muted sm:inline">{date(o.at, 'D MMM, HH:mm')}</span>
                  <Pill tone={o.status === 'accepted' ? 'ok' : o.status === 'rejected' ? 'accent' : 'warn'}>{o.status === 'accepted' ? 'принято' : o.status === 'rejected' ? 'отклонено' : 'ждёт'}</Pill>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Открыть смену без сети: операция shift_open уйдёт первой в очереди */
export function OfflineOpenShift({ register }: { register: Register }) {
  const seller = useOffline((s) => s.seller);
  const [cash, setCash] = useState({ KGS: '', USD: '' });
  const m = useMutation({
    mutationFn: async () => {
      if (!seller) throw new Error('Войдите по PIN');
      const id = uuid();
      const c = { KGS: cash.KGS || '0', USD: cash.USD || '0' };
      await offline.enqueue('shift_open', { cash: c }, seller.membershipId, 'Открытие смены', id);
      await offline.setShift({ id, number: null, openedAt: new Date().toISOString(), offline: true, status: 'open', opening: c, cashDelta: {} });
    },
    onSuccess: () => toast.success('Смена открыта без сети'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mx-auto max-w-xl rounded-[32px] bg-card p-6 shadow-card sm:p-8">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink">
        <WifiOff className="size-5" />
      </span>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">Открыть смену без сети · {register.name}</h2>
      <p className="mt-1 text-sm text-muted">Смена откроется на кассе и придёт на сервер вместе с чеками. Продавец: {seller?.name ?? '— войдите по PIN'}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(['KGS', 'USD'] as const).map((c) => (
          <Field key={c} label={c === 'KGS' ? 'Сомы' : 'Доллары'}>
            <Input inputMode="decimal" value={cash[c]} onChange={(e) => setCash({ ...cash, [c]: e.target.value.replace(/[^\d.]/g, '') })} className="h-12" />
          </Field>
        ))}
      </div>
      <Button variant="dark" size="lg" className="mt-6 w-full justify-center" disabled={!seller} loading={m.isPending} onClick={() => m.mutate()}>
        Открыть смену
      </Button>
    </div>
  );
}

/** Смена без сети: сводка по чекам с устройства, внесение/изъятие, закрытие */
export function OfflineShiftDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (v: boolean) => void; mode: 'x' | 'close' | 'cash' }) {
  const s = useOffline();
  const shift = s.shift;
  const [counted, setCounted] = useState({ KGS: '', USD: '' });
  const [op, setOp] = useState<{ type: 'cash_in' | 'cash_out'; currency: 'KGS' | 'USD'; amount: string }>({ type: 'cash_out', currency: 'KGS', amount: '' });
  const sum = useQuery({
    queryKey: ['offline-shift-sum', shift?.id, open, s.pending],
    enabled: open && !!s.db && !!shift,
    networkMode: 'always',
    queryFn: async () => {
      const rows = await s.db!.local.where('createdAt').aboveOrEqual(shift!.openedAt).toArray();
      const by: Record<string, number> = {};
      for (const r of rows) for (const p of r.payments) by[`${p.method}${p.currency === 'USD' ? ' $' : ''}`] = (by[`${p.method}${p.currency === 'USD' ? ' $' : ''}`] ?? 0) + Number(p.amount);
      return { count: rows.length, total: rows.reduce((a, r) => a + Number(r.total), 0), by };
    },
  });
  const expected = (c: 'KGS' | 'USD') => Number(shift?.opening?.[c] ?? 0) + (shift?.cashDelta?.[c] ?? 0);

  const close = useMutation({
    mutationFn: async () => {
      if (!shift || !s.seller) throw new Error('Нет смены или продавца');
      await offline.enqueue('shift_close', { shiftId: shift.id, counted: { KGS: counted.KGS || '0', USD: counted.USD || '0' } }, s.seller.membershipId, `Закрытие смены ${shift.number ?? ''}`.trim());
      await offline.setShift({ ...shift, status: 'closed' });
    },
    onSuccess: () => {
      toast.success('Смена закрыта на кассе — Z-отчёт сформирует сервер, когда придут операции');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cash = useMutation({
    mutationFn: async () => {
      if (!shift || !s.seller) throw new Error('Нет смены или продавца');
      await offline.enqueue('cash_op', { shiftId: shift.id, type: op.type, currency: op.currency, amount: op.amount, purpose: op.type === 'cash_out' ? 'safe' : undefined }, s.seller.membershipId, `${op.type === 'cash_out' ? 'Изъятие' : 'Внесение'} ${op.amount} ${op.currency}`);
      const d = { ...(shift.cashDelta ?? {}) };
      d[op.currency] = (d[op.currency] ?? 0) + (op.type === 'cash_out' ? -1 : 1) * Number(op.amount);
      await offline.setShift({ ...shift, cashDelta: d });
    },
    onSuccess: () => {
      toast.success('Проведено на кассе');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={mode === 'close' ? 'Закрыть смену без сети' : mode === 'cash' ? 'Внесение / изъятие без сети' : 'Сводка смены (с устройства)'} description={shift ? `Открыта ${date(shift.openedAt, 'D MMM, HH:mm')}${shift.offline ? ' · без сети' : ''}` : undefined}>
      <div className="mt-4 space-y-4">
        {mode !== 'cash' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-card-muted p-3">
              <div className="text-xs text-muted">Чеков без сети</div>
              <div className="font-semibold">{sum.data?.count ?? 0} · {money(sum.data?.total ?? 0)}</div>
            </div>
            <div className="rounded-[18px] bg-card-muted p-3">
              <div className="text-xs text-muted">Наличные по учёту кассы</div>
              <div className="font-semibold">{money(expected('KGS'))} · {money(expected('USD'), 'USD')}</div>
            </div>
            {Object.entries(sum.data?.by ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-full bg-card-muted px-3.5 py-2 text-[13px]">
                <span>{k}</span>
                <span className="tabular-nums">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        {mode === 'close' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(['KGS', 'USD'] as const).map((c) => (
              <Field key={c} label={`Пересчитали: ${c === 'KGS' ? 'сомы' : 'доллары'}`}>
                <Input inputMode="decimal" value={counted[c]} onChange={(e) => setCounted({ ...counted, [c]: e.target.value.replace(/[^\d.]/g, '') })} className="h-12" />
              </Field>
            ))}
          </div>
        )}
        {mode === 'cash' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Segmented value={op.type} onChange={(type) => setOp({ ...op, type })} options={[{ value: 'cash_out', label: 'Изъятие' }, { value: 'cash_in', label: 'Внесение' }]} />
              <Segmented value={op.currency} onChange={(currency) => setOp({ ...op, currency })} options={[{ value: 'KGS', label: 'сом' }, { value: 'USD', label: '$' }]} />
            </div>
            <Input autoFocus inputMode="decimal" value={op.amount} onChange={(e) => setOp({ ...op, amount: e.target.value.replace(/[^\d.]/g, '') })} className="h-12" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          {mode === 'close' && (
            <Button variant="accent" disabled={!counted.KGS} loading={close.isPending} onClick={() => close.mutate()}>
              <LockKeyhole /> Закрыть смену
            </Button>
          )}
          {mode === 'cash' && (
            <Button variant="dark" disabled={!Number(op.amount)} loading={cash.isPending} onClick={() => cash.mutate()}>
              Провести
            </Button>
          )}
          {mode === 'x' && <Button variant="dark" onClick={() => onOpenChange(false)}>Готово</Button>}
        </div>
      </div>
    </Dialog>
  );
}

/** Быстрое переключение продавца по PIN без выхода (ТЗ 3.6) — онлайн через сервер, без сети по хэшу */
export function PinSwitchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const online = useOnline();
  const { device, db, tenantId } = useOffline();
  const qc = useQueryClient();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPin('');
  }, [open]);

  const submit = async (p: string) => {
    const until = pinLocked();
    if (until) return toast.error(`PIN заблокирован до ${date(new Date(until), 'HH:mm')} — слишком много ошибок`);
    if (!device) return toast.error('Вход по PIN работает только на привязанной кассе');
    setBusy(true);
    try {
      if (online) {
        const r = await deviceApi.pinLogin(device.token, p);
        // Сессия прошлого продавца на этой кассе больше не нужна
        try {
          const { api } = await import('@/shared/api');
          await api.post('/auth/logout');
        } catch {
          /* уже истекла */
        }
        useSession.getState().setToken(r.accessToken, r.refreshToken);
        await offline.setSeller({ membershipId: r.membershipId, name: r.name });
        qc.invalidateQueries({ queryKey: meKey });
        toast.success(`Продаёт: ${r.name}`);
      } else {
        const staff = await db!.staff.toArray();
        const s = await verifyPinOffline(p, staff, tenantId!, device.secret);
        if (!s) throw new Error('Неверный PIN');
        if (!s.isOwner && !s.permissions.includes('pos.use') && !s.permissions.includes('*')) throw new Error('Нет права работать на кассе');
        await offline.setSeller({ membershipId: s.membershipId, name: s.name });
        toast.success(`Продаёт: ${s.name} (без сети)`);
      }
      pinOk();
      onOpenChange(false);
    } catch (e) {
      pinFailed();
      toast.error(errorMessage(e));
      setPin('');
    } finally {
      setBusy(false);
    }
  };
  const press = (k: string) => {
    if (busy) return;
    const n = (pin + k).slice(0, 6);
    setPin(n);
  };
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((x) => x.slice(0, -1));
      else if (e.key === 'Enter' && pin.length >= 4) void submit(pin);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-sm" title="Сменить продавца" description={device ? 'Введите свой PIN' : 'Сначала подготовьте кассу к работе без интернета'}>
      <div className="mt-5 flex justify-center gap-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cn('size-3.5 rounded-full', i < pin.length ? 'bg-ink' : 'bg-line-strong', i >= 4 && i >= pin.length && 'opacity-40')} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} onClick={() => press(k)} className="h-14 rounded-2xl bg-card-muted text-xl font-medium hover:bg-line">
            {k}
          </button>
        ))}
        <button onClick={() => setPin((x) => x.slice(0, -1))} className="grid h-14 place-items-center rounded-2xl text-muted" aria-label="Стереть">
          <Delete className="size-5" />
        </button>
        <button onClick={() => press('0')} className="h-14 rounded-2xl bg-card-muted text-xl font-medium hover:bg-line">
          0
        </button>
        <button disabled={pin.length < 4 || busy || !device} onClick={() => void submit(pin)} className="grid h-14 place-items-center rounded-2xl bg-pill text-pill-ink disabled:opacity-30" aria-label="Войти">
          {busy ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <UserRoundCog className="size-5" />}
        </button>
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        {online ? <ShieldCheck className="size-3.5" /> : <Smartphone className="size-3.5" />} {online ? 'Проверка на сервере' : 'Без сети — проверка на устройстве'}
      </div>
    </Dialog>
  );
}
