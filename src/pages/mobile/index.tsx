import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Camera, ClipboardCheck, ClipboardList, Grid3x3, PackagePlus, ScanBarcode, Search, Send, ShoppingCart, Smartphone, Tag, Truck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { productApi, QualityBadge } from '@/entities/product';
import { useCan, useMe, useSession } from '@/entities/session';
import { CameraScanDialog } from '@/features/camera-scan';
import { StoreSwitch } from '@/features/store-switch';
import type { SearchItem } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { attachScanner, listenDisplay, type DisplayState } from '@/shared/lib/remote';
import { Button, Input, Pill } from '@/shared/ui';

/** Мобильная оболочка (ТЗ 23.6): крупные плитки, одна рука, камера вместо сканера */
function MShell({ title, back = '/m', children }: { title: string; back?: string | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg pb-10">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-bg/90 px-3 backdrop-blur">
        {back !== null ? (
          <Link to={back} className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line" aria-label="Назад">
            <ArrowLeft className="size-4" />
          </Link>
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-pill text-pill-ink">
            <Smartphone className="size-4" />
          </span>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-medium">{title}</h1>
      </header>
      <main className="mx-auto max-w-lg space-y-3 px-3">{children}</main>
    </div>
  );
}

const TILES: { to: string; label: string; hint: string; icon: ReactNode; perm?: string; accent?: boolean }[] = [
  { to: '/m/check', label: 'Цена и остаток', hint: 'Скан или номер', icon: <Tag />, accent: true },
  { to: '/m/scan', label: 'Сканер для кассы', hint: 'По QR с экрана кассы', icon: <ScanBarcode />, perm: 'pos.use' },
  { to: '/documents/new?type=receiving', label: 'Приёмка', hint: 'Товар от поставщика', icon: <PackagePlus />, perm: 'stock.receive' },
  { to: '/stock/inventory', label: 'Инвентаризация', hint: 'Пересчёт камерой', icon: <ClipboardCheck />, perm: 'stock.inventory' },
  { to: '/stock/tasks', label: 'Задания склада', hint: 'Размещение и подбор', icon: <ClipboardList />, perm: 'stock.tasks' },
  { to: '/stock/places', label: 'Места', hint: 'Где лежит', icon: <Grid3x3 />, perm: 'stock.locations' },
  { to: '/sales/deliveries', label: 'Доставки', hint: 'Мои заказы', icon: <Truck /> },
  { to: '/pos', label: 'Касса', hint: 'Продажа с телефона', icon: <ShoppingCart />, perm: 'pos.use' },
];

export default function MobileHome() {
  const can = useCan();
  const me = useMe();
  return (
    <MShell title={me.data?.tenant?.name ?? 'Магазин'} back={null}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{me.data?.user.name}</span>
        <StoreSwitch compact />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {TILES.filter((t) => !t.perm || can(t.perm)).map((t) => (
          <Link key={t.to} to={t.to} className={cn('flex aspect-[5/4] flex-col justify-between rounded-[26px] p-4 shadow-card transition active:scale-[0.98] [&_svg]:size-6', t.accent ? 'bg-accent text-accent-ink' : 'bg-card')}>
            {t.icon}
            <span>
              <span className="block text-[16px] leading-tight font-medium">{t.label}</span>
              <span className={cn('block text-xs', t.accent ? 'opacity-75' : 'text-muted')}>{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>
      <Link to="/" className="block pt-2 text-center text-sm text-muted underline">
        Полная версия
      </Link>
    </MShell>
  );
}

// ── Цена и остаток ──────────────────────────────────────

export function PriceCheckPage() {
  const [q, setQ] = useState('');
  const [camera, setCamera] = useState(false);
  const [res, setRes] = useState<SearchItem[] | null>(null);
  const nav = useNavigate();
  const find = useMutation({
    mutationFn: (s: string) => productApi.search(s, 'global', 10),
    onSuccess: (r) => setRes([...r.groups.here, ...r.groups.elsewhere, ...r.groups.noStock, ...r.groups.analogs].slice(0, 10)),
  });
  const go = (s: string) => {
    if (!s.trim()) return;
    setQ(s);
    find.mutate(s.trim());
  };
  return (
    <MShell title="Цена и остаток">
      <form onSubmit={(e) => (e.preventDefault(), go(q))} className="flex gap-2">
        <Input autoFocus icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер, название, штрихкод" className="flex-1" />
        <Button type="button" size="icon" variant="dark" onClick={() => setCamera(true)} aria-label="Камера" className="size-11">
          <Camera />
        </Button>
      </form>
      {find.isPending && <div className="h-28 animate-pulse rounded-[24px] bg-card" />}
      {res?.map((p, i) => (
        <button key={p.id} onClick={() => nav(`/products/${p.id}`)} className={cn('block w-full rounded-[24px] bg-card p-4 text-left shadow-card', i === 0 && 'ring-2 ring-ink')}>
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[15px] leading-snug font-medium">{p.name}</span>
              <span className="block text-xs text-muted">
                {p.brandName} · {p.mainNumber ?? p.sku}
              </span>
            </span>
            <QualityBadge value={p.qualityClass} />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-2xl font-semibold tabular-nums">{p.price != null ? money(p.price, p.currency ?? 'KGS') : '—'}</span>
            <span className="text-right text-[13px]">
              <span className={cn('block font-medium', Number(p.stockHere) > 0 ? 'text-ok' : 'text-accent')}>
                здесь {num(p.stockHere, 3)} {p.baseUnit}
              </span>
              {Number(p.stockTotal) > Number(p.stockHere) && <span className="block text-xs text-muted">всего {num(p.stockTotal, 3)}</span>}
            </span>
          </div>
          {p.analog && <Pill tone="soft" className="mt-2">аналог</Pill>}
        </button>
      ))}
      {res && !res.length && <div className="rounded-[24px] bg-card p-6 text-center text-sm text-muted">Ничего не нашли</div>}
      <CameraScanDialog open={camera} onOpenChange={setCamera} allowOcr single onCode={(c) => go(c)} onProduct={(p) => (setCamera(false), nav(`/products/${p.id}`))} />
    </MShell>
  );
}

// ── Телефон как сканер ──────────────────────────────────

/** Открывается по QR с экрана кассы: /m/scan?t=… — коды летят в кассу на ПК */
export function PhoneScanPage() {
  const [sp] = useSearchParams();
  const token = sp.get('t');
  const [state, setState] = useState<'idle' | 'connecting' | 'ready' | 'error'>(token ? 'connecting' : 'idle');
  const [err, setErr] = useState('');
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState('');
  const [sent, setSent] = useState<{ code: string; ok: boolean }[]>([]);
  const link = useRef<{ send: (c: string, k?: 'barcode' | 'number') => Promise<void>; stop: () => void } | null>(null);
  const accessToken = useSession((s) => s.accessToken);
  const storeId = useSession((s) => s.storeId);
  useEffect(() => {
    if (!token) return;
    let off = false;
    attachScanner({ token: accessToken, storeId }, token)
      .then((l) => {
        if (off) return l.stop();
        link.current = l;
        setState('ready');
        setCamera(true);
      })
      .catch((e: Error) => (setErr(e.message), setState('error')));
    return () => ((off = true), link.current?.stop());
    // подключаемся один раз на токен
  }, [token]);
  const send = async (code: string, kind: 'barcode' | 'number' = 'barcode') => {
    try {
      await link.current!.send(code, kind);
      setSent((s) => [{ code, ok: true }, ...s].slice(0, 20));
    } catch (e) {
      setSent((s) => [{ code, ok: false }, ...s].slice(0, 20));
      toast.error((e as Error).message);
    }
  };
  return (
    <MShell title="Сканер для кассы">
      {state === 'idle' && (
        <div className="rounded-[24px] bg-card p-6 text-center text-[15px]">
          На кассе нажмите <Smartphone className="inline size-4" /> «Телефон как сканер» и отсканируйте QR обычной камерой телефона
        </div>
      )}
      {state === 'connecting' && <div className="h-28 animate-pulse rounded-[24px] bg-card" />}
      {state === 'error' && <div className="rounded-[24px] bg-accent-soft p-6 text-center text-[15px] text-accent">{err}</div>}
      {state === 'ready' && (
        <>
          <div className="flex items-center gap-2 rounded-[24px] bg-ok-soft px-4 py-3 text-[15px]">
            <span className="size-2.5 rounded-full bg-ok" /> Подключено к кассе
          </div>
          <Button variant="accent" size="lg" className="h-16 w-full text-[16px]" onClick={() => setCamera(true)}>
            <Camera /> Сканировать
          </Button>
          <form onSubmit={(e) => (e.preventDefault(), manual.trim() && (void send(manual.trim(), 'number'), setManual('')))} className="flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Или введите номер" className="flex-1" />
            <Button type="submit" size="icon" variant="dark" className="size-11" aria-label="Отправить">
              <Send />
            </Button>
          </form>
          <div className="space-y-1">
            {sent.map((s, i) => (
              <div key={i} className="flex justify-between rounded-[14px] bg-card px-3 py-2 font-mono text-[13px]">
                {s.code} <span className={s.ok ? 'text-ok' : 'text-accent'}>{s.ok ? '✓' : '✕'}</span>
              </div>
            ))}
          </div>
          <CameraScanDialog open={camera} onOpenChange={setCamera} allowOcr onCode={(c) => send(c)} onProduct={(p) => void send(p.mainNumber ?? p.sku, 'number')} />
        </>
      )}
    </MShell>
  );
}

// ── Экран покупателя ────────────────────────────────────

/** Второй монитор у кассы (ТЗ 13.11): что пробито, итог, «Спасибо» после оплаты */
export function CustomerDisplayPage() {
  const [s, setS] = useState<DisplayState>({ kind: 'idle' });
  const shop = useMe().data?.tenant?.name;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => listenDisplay(setS), []);
  useEffect(() => {
    if (s.kind !== 'paid') return;
    const t = setTimeout(() => setS({ kind: 'idle' }), 8000);
    return () => clearTimeout(t);
  }, [s]);
  useEffect(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }), [s.lines?.length]);
  return (
    <div className="hatch flex h-dvh flex-col bg-bg p-6 text-ink sm:p-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-2xl font-semibold tracking-tight">{shop ?? 'Автозапчасти'}</span>
        <span className="text-sm text-muted">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
      </div>
      {s.kind === 'cart' && s.lines?.length ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div ref={box} className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[32px] bg-card p-5 shadow-card">
            {s.lines.map((l, i) => (
              <div key={i} className={cn('flex items-baseline gap-4 rounded-[18px] px-3 py-2.5 text-[22px]', i === s.lines!.length - 1 && 'bg-card-muted')}>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="text-muted tabular-nums">× {num(l.qty, 3)}</span>
                <span className="w-40 text-right font-medium tabular-nums">{l.amount != null ? money(l.amount) : '…'}</span>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 flex-col justify-end gap-3 rounded-[32px] bg-pill p-8 text-pill-ink lg:w-[420px]">
            {s.customer && <div className="text-lg opacity-70">{s.customer}</div>}
            {s.discount && Number(s.discount) > 0 && <div className="text-xl opacity-80">Скидка {money(s.discount)}</div>}
            <div className="text-lg opacity-60">К оплате</div>
            <div className="text-6xl font-semibold tracking-tight tabular-nums">{money(s.total)}</div>
          </div>
        </div>
      ) : s.kind === 'paid' ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <div className="text-6xl font-semibold tracking-tight">Спасибо за покупку!</div>
            {s.total && <div className="mt-4 text-2xl text-muted">Оплачено {money(s.total)}</div>}
            <div className="mt-2 text-xl text-muted">Чек сохраните — по нему гарантия и возврат</div>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-faint">Добро пожаловать</div>
            <div className="mt-3 text-xl text-muted">Подберём запчасть по номеру, VIN или машине</div>
          </div>
        </div>
      )}
    </div>
  );
}
