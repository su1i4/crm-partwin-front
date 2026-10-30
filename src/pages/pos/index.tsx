import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Ban,
  Car,
  ChevronDown,
  Clock3,
  FileText,
  History,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  MonitorSmartphone,
  PauseCircle,
  Percent,
  ScanLine,
  ShoppingCart,
  CloudOff,
  UserRound,
  UserRoundCog,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { posApi, useCurrentShift, useDeferred, useRegisters, type MoneyAccount, type Register, type Shift } from '@/entities/pos';
import { useOffline } from '@/entities/pos-offline';
import { CameraScanDialog } from '@/features/camera-scan';
import { payOffline } from '@/features/pos-cart/offline-sale';
import { useCan, useMe, useSession } from '@/entities/session';
import { CounterpartyPicker } from '@/features/customer-picker';
import { cart, flush, totals, useCart, useDeviceRegister, type AddableProduct, type DraftLine } from '@/features/pos-cart';
import { PaymentDialog } from '@/features/pos-payment';
import { CashOpDialog, OpenShiftPanel, ShiftReportDialog } from '@/features/pos-shift';
import { QuickProductDialog } from '@/features/quick-product';
import { errorMessage } from '@/shared/api';
import { useOnline } from '@/shared/hooks/use-online';
import { useScanner } from '@/shared/hooks/use-scanner';
import { postDisplay } from '@/shared/lib/remote';
import { PhoneScannerButton } from '@/features/phone-scanner';
import { cn } from '@/shared/lib/cn';
import { ago, money, num } from '@/shared/lib/format';
import { Avatar, Button, Dialog, EmptyState, ErrorState, Input, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, PinDialog, Pill, Popover, PopoverContent, PopoverTrigger, Segmented, Skeleton } from '@/shared/ui';
import { OfflineOpenShift, OfflinePanel, OfflineShiftDialog, OfflineStatus, PinSwitchDialog, usePosOfflineBridge, useSellLock } from './offline';
import { AmbiguousDialog, LineDiscountDialog, LineRow, NotFoundDialog, PosSearch, ReceiptDiscountDialog, TilesPanel, useUsdRate, type SearchBoxHandle } from './parts';

function RegisterPicker({ registers, onPick }: { registers: Register[]; onPick: (id: string) => void }) {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-6">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight text-faint">Касса</h1>
        <p className="text-sm text-muted">Выберите, какой кассой будет этот компьютер или телефон. Выбор запомнится на устройстве.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {registers.map((r) => (
          <button key={r.id} onClick={() => onPick(r.id)} className="flex items-center gap-3 rounded-[24px] bg-card p-4 text-left ring-1 ring-line transition hover:ring-ink">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink">
              <MonitorSmartphone className="size-5" />
            </span>
            <span>
              <span className="block font-medium text-ink">{r.name}</span>
              <span className="text-xs text-muted">{me?.stores.find((s) => s.id === r.storeId)?.name ?? r.code}</span>
            </span>
          </button>
        ))}
      </div>
      {!registers.length && <EmptyState title="Касс нет" hint="Кассы создаются в настройках точки (этап 7) — у каждой точки при регистрации уже есть одна." />}
    </div>
  );
}

function DeferredPopover({ registerId, storeId }: { registerId: string; storeId: string }) {
  const { data } = useDeferred(registerId, storeId);
  const qc = useQueryClient();
  const hasLines = useCart((s) => s.lines.length > 0);
  const [open, setOpen] = useState(false);
  const resume = useMutation({
    mutationFn: (id: string) => posApi.resume(id, registerId),
    onSuccess: (r) => {
      cart.load(r);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['receipts', 'deferred'] });
      toast.success(`Чек «${r.label ?? r.number}» продолжен`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const n = data?.total ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-medium text-ink ring-1 ring-line outline-none hover:ring-line-strong">
        <PauseCircle className="size-4" /> <span className="hidden sm:inline">Отложенные</span>
        <Pill tone={n ? 'accent' : 'muted'} className="h-5 min-w-5 px-1.5">{n}</Pill>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-32px))] p-2">
        <div className="px-3 pt-2 pb-1 text-sm font-medium">Отложенные чеки точки</div>
        {!data?.items.length && <div className="px-3 py-6 text-center text-sm text-muted">Нет отложенных</div>}
        {data?.items.map((r) => (
          <button
            key={r.id}
            disabled={resume.isPending}
            onClick={() => (hasLines ? toast('Сначала оплатите или отложите текущий чек') : resume.mutate(r.id))}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-card-muted"
          >
            <Clock3 className="size-4 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{r.label || r.customerName || r.number}</span>
              <span className="text-xs text-muted">
                {r.linesCount} поз. · {r.registerName} · {ago(r.createdAt)}
              </span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{money(r.total)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function PosPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const can = useCan();
  const { data: me } = useMe();
  const tenant = useSession((s) => s.currentTenantId) ?? '';
  const sessionStore = useSession((s) => s.storeId);
  const deviceReg = useDeviceRegister((s) => s.byTenant[tenant]);
  const setDeviceReg = useDeviceRegister((s) => s.set);
  const online = useOnline();
  const off = useOffline();
  const registers = useRegisters();
  const regList = registers.data ?? [];
  // Без сети касса берётся из привязки устройства
  const offReg: Register | null = off.device ? { ...off.device.register, isActive: true } : null;
  const registerId = sp.get('register') ?? off.device?.register.id ?? deviceReg ?? (regList.length === 1 ? regList[0].id : null);
  const register = regList.find((r) => r.id === registerId) ?? (offReg?.id === registerId ? offReg : null);
  const current = useCurrentShift(register && online ? registerId : null);
  usePosOfflineBridge(register, online ? (current.isLoading || current.error ? undefined : (current.data?.shift ?? null)) : undefined);

  useEffect(() => {
    if (registerId && register) void cart.attach(registerId);
  }, [registerId, register]);

  if (!can('pos.use') && online) return <EmptyState title="Нет доступа к кассе" hint="Попросите управляющего выдать роль «Продавец»" />;

  // ── Без сети ──
  if (!online) {
    if (!off.device || !off.meta || !offReg)
      return (
        <EmptyState
          icon={<CloudOff />}
          title="Нет связи с сервером"
          hint="Эта касса не подготовлена к работе без интернета. Когда связь появится: меню кассы → «Работа без интернета» → «Подготовить»."
        />
      );
    if (!off.shift || off.shift.status !== 'open') return <div className="py-6"><OfflineOpenShift register={offReg} /></div>;
    const pseudo = { id: off.shift.id, number: off.shift.number ?? 0, status: 'open', registerId: offReg.id, storeId: offReg.storeId, openedAt: off.shift.openedAt, closedAt: null, opening: off.shift.opening ?? {}, counted: null, expected: null, diff: null, currentMembershipId: '', version: 0 } as Shift;
    return <Cashier register={offReg} shift={pseudo} cashBalance={{}} sellerName={off.seller?.name ?? me?.user.name ?? ''} onChangeRegister={() => toast('Сменить кассу можно, когда появится связь')} />;
  }

  if (registers.isLoading) return <Skeleton className="h-64 rounded-[32px]" />;
  if (registers.error) return <ErrorState error={registers.error} onRetry={() => registers.refetch()} />;
  if (!register)
    return (
      <RegisterPicker
        registers={sessionStore ? regList.filter((r) => r.storeId === sessionStore) : regList}
        onPick={(id) => {
          setDeviceReg(tenant, id);
          nav('/pos', { replace: true });
        }}
      />
    );
  if (current.isLoading) return <Skeleton className="h-64 rounded-[32px]" />;
  if (current.error) return <ErrorState error={current.error} onRetry={() => current.refetch()} />;
  if (!current.data?.shift)
    return (
      <div className="py-6">
        <OpenShiftPanel current={current.data!} canOpen={can('pos.shift')} />
        <div className="mt-4 text-center">
          <button onClick={() => setDeviceReg(tenant, null)} className="text-xs text-muted hover:text-ink">
            Это другая касса? Выбрать
          </button>
        </div>
      </div>
    );

  return <Cashier register={register} shift={current.data.shift} cashBalance={current.data.cashBalance} sellerName={me?.user.name ?? ''} onChangeRegister={() => setDeviceReg(tenant, null)} />;
}

function Cashier({
  register,
  shift,
  cashBalance,
  sellerName,
  onChangeRegister,
}: {
  register: Register;
  shift: NonNullable<ReturnType<typeof useCurrentShift>['data']>['shift'] & object;
  cashBalance: Record<string, string>;
  sellerName: string;
  onChangeRegister: () => void;
}) {
  const nav = useNavigate();
  const can = useCan();
  const qc = useQueryClient();
  const online = useOnline();
  const rateQ = useUsdRate();
  const off = useOffline();
  const offRate = off.meta?.rates.find((r) => r.currency === 'USD')?.rate ?? null;
  const rate = { data: rateQ.data ?? offRate };
  const search = useRef<SearchBoxHandle>(null);
  const { lines, receipt, customer, vehicleLabel, rev, inFlight, mode: cartMode, calcError } = useCart();
  const isOff = cartMode === 'offline';
  const t = totals({ receipt, lines, rev, inFlight, mode: cartMode, rate: rate.data ? Number(rate.data) : null });
  const canSell = useSellLock();
  // Экран покупателя (второй монитор, /pos/display): чек в реальном времени
  useEffect(() => {
    postDisplay(
      lines.length
        ? { kind: 'cart', lines: lines.map((l) => ({ name: l.name, qty: l.qty, amount: l.amount })), total: String(t.total), discount: t.discount ? String(t.discount) : undefined, customer: customer?.name ?? null }
        : { kind: 'idle' },
    );
  }, [lines, t.total, t.discount, customer]);
  const [offlinePanel, setOfflinePanel] = useState(false);
  const [offShift, setOffShift] = useState<'x' | 'close' | 'cash' | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [offAccounts, setOffAccounts] = useState<{ wallets: MoneyAccount[]; acquiring: MoneyAccount[] }>({ wallets: [], acquiring: [] });
  useEffect(() => {
    if (!isOff || !off.db) return;
    void off.db.accounts.toArray().then((a) => {
      const m = (x: (typeof a)[number]) => ({ ...x, type: x.type as MoneyAccount['type'], storeId: null, details: {} });
      setOffAccounts({ wallets: a.filter((x) => x.type === 'wallet').map(m), acquiring: a.filter((x) => x.type === 'acquiring').map(m) });
    });
  }, [isOff, off.db]);
  const sellerShown = off.seller?.name ?? sellerName;
  const [mode, setMode] = useState<'scan' | 'tiles'>('scan');
  const [payOpen, setPayOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lineDiscount, setLineDiscount] = useState<DraftLine | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<AddableProduct[] | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [report, setReport] = useState<'x' | 'close' | null>(null);
  const [cashOp, setCashOp] = useState(false);

  useScanner((code) => void search.current?.handleCode(code));

  const openPay = useCallback(async () => {
    if (!lines.length || !canSell) return;
    if (useCart.getState().mode === 'offline') {
      if (useCart.getState().calcError) return toast.error(useCart.getState().calcError!);
      setPayOpen(true);
      return;
    }
    setPreparing(true);
    const r = await flush();
    setPreparing(false);
    if (!r || !r.lines.length) return toast.error('Чек не сохранился — проверьте связь');
    setPayOpen(true);
  }, [lines.length, canSell]);

  // Горячие клавиши кассы (ТЗ 13.1): F2 поиск, F4 оплата, F8 скидка, Esc; Ctrl+K / Ctrl+Enter / Ctrl+D на ноутбуках
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (payOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F2' || (mod && e.key.toLowerCase() === 'k')) (e.preventDefault(), search.current?.focus());
      else if (e.key === 'F4' || (mod && e.key === 'Enter')) (e.preventDefault(), void openPay());
      else if (e.key === 'F8' || (mod && e.key.toLowerCase() === 'd')) (e.preventDefault(), lines.length && setDiscountOpen(true));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [payOpen, openPay, lines.length]);

  const defer = useMutation({
    mutationFn: async (label: string) => {
      const r = await flush();
      if (!r) throw new Error('Чек пустой');
      return posApi.defer(r.id, r.version, label || undefined);
    },
    onSuccess: () => {
      cart.reset();
      setDeferOpen(false);
      qc.invalidateQueries({ queryKey: ['receipts', 'deferred'] });
      toast.success('Чек отложен — его видят все кассы точки');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (useCart.getState().mode === 'offline') return;
      const r = await flush();
      if (r) await posApi.cancel(r.id, r.version);
    },
    onSuccess: () => {
      cart.reset();
      setCancelOpen(false);
      toast('Чек отменён');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const count = lines.reduce((a, l) => a + Number(l.qty), 0);

  return (
    <div className="flex min-h-full flex-col gap-4 pb-28 lg:pb-0">
      {/* Шапка: касса · смена · продавец · сеть · курс */}
      <div className="flex flex-wrap items-center gap-2">
        <Menu>
          <MenuTrigger className="flex h-10 items-center gap-2 rounded-full bg-pill pr-3 pl-1.5 text-[13px] font-medium text-pill-ink outline-none">
            <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-ink">
              <ShoppingCart className="size-3.5" />
            </span>
            {register.name} · смена {shift.number ? `№${shift.number}` : 'без сети'}
            <ChevronDown className="size-3.5 opacity-60" />
          </MenuTrigger>
          <MenuContent align="start" className="w-64">
            <MenuLabel>Смена {shift.number ? `№${shift.number}` : 'без сети'}</MenuLabel>
            <MenuItem onSelect={() => (online ? setReport('x') : setOffShift('x'))}>
              <FileText /> X-отчёт
            </MenuItem>
            {(can('pos.cash_in_out') || !online) && (
              <MenuItem onSelect={() => (online ? setCashOp(true) : setOffShift('cash'))}>
                <ArrowDownUp /> Внесение / изъятие
              </MenuItem>
            )}
            {(can('pos.shift') || !online) && (
              <MenuItem onSelect={() => (online ? setReport('close') : off.pending && online ? null : setOffShift('close'))}>
                <LockKeyhole /> Закрыть смену
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem onSelect={() => setPinOpen(true)}>
              <UserRoundCog /> Сменить продавца (PIN)
            </MenuItem>
            <MenuItem onSelect={() => setOfflinePanel(true)}>
              <CloudOff /> Работа без интернета
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => nav('/sales')}>
              <History /> История чеков
            </MenuItem>
            <MenuItem onSelect={() => nav('/sales/returns')}>
              <ArrowDownUp /> Возврат по чеку
            </MenuItem>
            <MenuItem onSelect={() => window.open('/pos/display', 'ap-display', 'popup,width=1024,height=700')}>
              <Monitor /> Экран покупателя
            </MenuItem>
            <MenuItem onSelect={onChangeRegister}>
              <MonitorSmartphone /> Сменить кассу устройства
            </MenuItem>
          </MenuContent>
        </Menu>
        <span className="flex h-10 items-center gap-2 rounded-full bg-card px-3 text-[13px] text-ink-2 ring-1 ring-line">
          <Avatar name={sellerShown} size={24} />
          <span className="hidden sm:inline">{sellerShown.split(' ')[0]}</span>
        </span>
        <OfflineStatus onOpen={() => setOfflinePanel(true)} />
        {rate.data && (
          <span className="flex h-10 items-center rounded-full bg-card px-3 text-[13px] text-ink-2 ring-1 ring-line">
            $ <b className="ml-1 font-semibold text-ink tabular-nums">{num(rate.data, 2)}</b>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {online && !isOff && <PhoneScannerButton registerId={register.id} />}
          {online && !isOff && <DeferredPopover registerId={register.id} storeId={register.storeId} />}
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            className="hidden sm:inline-flex"
            options={[
              { value: 'scan', label: <span className="flex items-center gap-1.5"><ScanLine className="size-3.5" />Сканер</span> },
              { value: 'tiles', label: <span className="flex items-center gap-1.5"><LayoutGrid className="size-3.5" />Плитки</span> },
            ]}
          />
        </div>
      </div>

      {!canSell && (
        <div className="rounded-[20px] bg-warn-soft px-4 py-3 text-sm text-ink">Касса уже открыта в другой вкладке этого устройства — здесь только просмотр.</div>
      )}
      {isOff && (
        <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-accent-soft px-4 py-3 text-sm text-accent ring-1 ring-accent-line">
          <WifiOff className="size-4" />
          {online ? 'Связь вернулась — этот чек доведите без сети, следующий будет онлайн.' : 'Нет связи: продаём по кэшу кассы. Чеки уйдут на сервер, когда появится интернет.'}
          {off.pending > 0 && <span className="font-medium">Неотправленных: {off.pending}</span>}
          {calcError && <span className="w-full font-medium">{calcError}</span>}
        </div>
      )}
      {!isOff && !online && !off.device && (
        <div className="rounded-[20px] bg-accent-soft px-4 py-3 text-sm text-accent">Нет связи, а касса не подготовлена к работе без интернета.</div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <PosSearch ref={search} onNotFound={setNotFound} onAmbiguous={setAmbiguous} onCamera={() => setCamera(true)} />

          {lines.length === 0 && mode === 'scan' && (
            <div className="hatch flex flex-col items-center justify-center gap-2 rounded-[28px] bg-card/60 px-6 py-16 text-center ring-1 ring-line">
              <ScanLine className="size-8 text-faint" />
              <div className="font-medium text-ink">Сканируйте товар или начните вводить номер</div>
              <div className="text-sm text-muted">
                <Kbd>F2</Kbd> поиск · <Kbd>F4</Kbd> оплата · <Kbd>F8</Kbd> скидка
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {lines.map((l) => (
              <LineRow key={l.key} line={l} onDiscount={setLineDiscount} />
            ))}
          </div>
          {(mode === 'tiles' || lines.length === 0) && (
            <div className={cn(mode === 'scan' && 'hidden sm:block')}>
              {mode === 'tiles' && <TilesPanel />}
            </div>
          )}
          <button onClick={() => setMode(mode === 'scan' ? 'tiles' : 'scan')} className="w-full rounded-full py-2 text-center text-xs text-muted sm:hidden">
            {mode === 'scan' ? 'Показать плитки' : 'Скрыть плитки'}
          </button>
        </div>

        {/* Правая панель: клиент, машина, итоги, оплата */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="space-y-3 rounded-[28px] bg-card-muted p-2">
            <div className="space-y-1.5 rounded-[22px] bg-card p-3">
              <button onClick={() => setCustomerOpen(true)} className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-card-muted">
                {customer ? <Avatar name={customer.name} size={34} /> : <span className="grid size-[34px] place-items-center rounded-full bg-card-muted"><UserRound className="size-4 text-muted" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">Клиент</span>
                  <span className="block truncate text-sm font-medium text-ink">{customer?.name ?? 'Добавить'}</span>
                </span>
                {customer && (
                  <span
                    role="button"
                    onClick={(e) => (e.stopPropagation(), cart.setCustomer(null))}
                    className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted"
                    aria-label="Убрать клиента"
                  >
                    <X className="size-3.5" />
                  </span>
                )}
              </button>
              <label className="flex items-center gap-3 rounded-2xl p-1.5">
                <span className="grid size-[34px] place-items-center rounded-full bg-card-muted">
                  <Car className="size-4 text-muted" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">Машина / госномер / заказ-наряд</span>
                  <input value={vehicleLabel} onChange={(e) => cart.setVehicleLabel(e.target.value)} placeholder="01KG123ABC" className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-faint" />
                </span>
              </label>
            </div>

            <div className="rounded-[22px] bg-pill p-4 text-pill-ink">
              <div className="flex justify-between text-sm opacity-70">
                <span>Подытог · {num(count, 3)} шт</span>
                <span className="tabular-nums">{money(t.subtotal)}</span>
              </div>
              {t.discount > 0 && (
                <div className="mt-1 flex justify-between text-sm">
                  <span className="opacity-70">Скидка</span>
                  <span className="text-accent tabular-nums">−{money(t.discount)}</span>
                </div>
              )}
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="text-sm opacity-70">ИТОГО</span>
                <span className={cn('text-[34px] leading-none font-semibold tracking-tight tabular-nums transition-opacity', t.pending && 'opacity-60')}>{money(t.total)}</span>
              </div>
              <div className="mt-1 text-right text-sm opacity-60 tabular-nums">{t.usd !== null ? `≈ ${money(t.usd, 'USD')}` : rate.data ? `≈ ${money(t.total / Number(rate.data), 'USD')}` : ''}</div>
              <button
                disabled={!lines.length || preparing || !canSell || (!online && !isOff)}
                onClick={() => void openPay()}
                className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-[20px] bg-accent text-lg font-semibold text-accent-ink shadow-[0_10px_24px_-10px_var(--accent)] transition hover:brightness-95 disabled:opacity-40"
              >
                {preparing ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : 'ОПЛАТА'}
                <Kbd className="border-white/20 bg-white/15 text-white/80">F4</Kbd>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" className="h-11 justify-center" disabled={!lines.length} onClick={() => setDiscountOpen(true)}>
                <Percent /> Скидка
              </Button>
              <Button size="sm" className="h-11 justify-center" disabled={!lines.length} onClick={() => setDeferOpen(true)}>
                <PauseCircle /> Отложить
              </Button>
              <Button size="sm" className="h-11 justify-center" disabled={!lines.length && !receipt} onClick={() => setCancelOpen(true)}>
                <Ban /> Отмена
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Телефон: оплата в нижней трети экрана */}
      {lines.length > 0 && (
        <div className="fixed inset-x-3 bottom-[76px] z-30 lg:hidden md:bottom-4">
          <button onClick={() => void openPay()} disabled={preparing || !canSell || (!online && !isOff)} className="flex h-16 w-full items-center justify-between rounded-[24px] bg-accent px-5 text-accent-ink shadow-2xl disabled:opacity-60">
            <span className="text-sm opacity-80">{num(count, 3)} шт</span>
            <span className="text-lg font-semibold">Оплата {money(t.total)}</span>
          </button>
        </div>
      )}

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        receipt={receipt}
        registerId={register.id}
        storeId={register.storeId}
        hasCustomer={!!customer}
        onPaid={() => {
          postDisplay({ kind: 'paid', total: String(t.total) });
          cart.reset();
          setTimeout(() => search.current?.focus(), 50);
        }}
        offline={
          isOff && off.meta
            ? {
                total: t.total,
                rate: rate.data ? Number(rate.data) : null,
                wallets: offAccounts.wallets,
                acquiring: offAccounts.acquiring,
                allowDebt: off.meta.offlineRules.debt,
                pay: payOffline,
                store: { name: off.meta.store.name, address: off.meta.store.address, phone: off.meta.store.phone, register: register.name },
              }
            : null
        }
      />
      <CameraScanDialog
        open={camera}
        onOpenChange={setCamera}
        allowOcr={online && !isOff}
        onCode={(code) => search.current?.handleCode(code)}
        onProduct={(p) => cart.add({ id: p.id, name: p.name, sku: p.sku, mainNumber: p.mainNumber, brandName: p.brandName, baseUnit: p.baseUnit, price: p.price })}
        onUndo={() => {
          const k = useCart.getState().lastAddedKey;
          const l = useCart.getState().lines.find((x) => x.key === k);
          if (l) cart.setQty(l.key, Number(l.qty) - 1);
        }}
      />
      <OfflinePanel open={offlinePanel} onOpenChange={setOfflinePanel} register={register} canManage={can('devices.manage')} />
      {offShift && <OfflineShiftDialog open onOpenChange={(v) => !v && setOffShift(null)} mode={offShift} />}
      <PinSwitchDialog open={pinOpen} onOpenChange={setPinOpen} />
      <ReceiptDiscountDialog open={discountOpen} onOpenChange={setDiscountOpen} />
      <LineDiscountDialog line={lineDiscount} onClose={() => setLineDiscount(null)} />
      <NotFoundDialog query={notFound} onClose={() => setNotFound(null)} onCreate={(q) => setQuick(q)} allowCreate={!isOff} />
      <AmbiguousDialog items={ambiguous} onClose={() => setAmbiguous(null)} />
      <QuickProductDialog
        open={quick !== null}
        onOpenChange={(v) => !v && setQuick(null)}
        onCreated={(p) => {
          cart.add({ id: p.id, name: p.name, sku: p.sku, mainNumber: p.mainNumber, brandName: p.brandName, baseUnit: p.baseUnit, price: p.retailPrice });
        }}
        initial={quick ?? undefined}
      />
      <CounterpartyPicker open={customerOpen} onOpenChange={setCustomerOpen} onPick={(c) => cart.setCustomer({ id: c.id, name: c.name, phone: c.phone })} />
      <DeferDialog open={deferOpen} onOpenChange={setDeferOpen} defaultLabel={customer?.name ?? ''} loading={defer.isPending} onSubmit={(l) => defer.mutate(l)} />
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen} title="Отменить чек?" description="Строки удалятся, действие попадёт в журнал.">
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>Нет</Button>
          <Button variant="accent" loading={cancel.isPending} onClick={() => cancel.mutate()}>Отменить чек</Button>
        </div>
      </Dialog>
      {report && <ShiftReportDialog open onOpenChange={(v) => !v && setReport(null)} shift={shift} mode={report} cashBalance={cashBalance} />}
      <CashOpDialog open={cashOp} onOpenChange={setCashOp} shiftId={shift.id} />
      <PinDialog />
    </div>
  );
}

function DeferDialog({ open, onOpenChange, defaultLabel, loading, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; defaultLabel: string; loading: boolean; onSubmit: (label: string) => void }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (open) setLabel(defaultLabel);
  }, [open, defaultLabel]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Отложить чек" description="Подпишите, чтобы найти его на любой кассе точки">
      <Input className="mt-4" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSubmit(label)} placeholder="Азамат, Камри" />
      <div className="mt-4 flex justify-end">
        <Button variant="dark" loading={loading} onClick={() => onSubmit(label)}>
          Отложить
        </Button>
      </div>
    </Dialog>
  );
}
