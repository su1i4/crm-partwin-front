import { Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { useSession } from '@/entities/session';
import { cn } from '@/shared/lib/cn';
import { emitRemoteScan, pairScanner } from '@/shared/lib/remote';
import { Button, Dialog } from '@/shared/ui';

interface PairState {
  status: 'off' | 'waiting' | 'attached';
  token: string | null;
  codes: number;
  stop: (() => void) | null;
  start: (registerId: string | null) => Promise<void>;
  off: () => void;
}

/** Пара живёт, пока открыта касса: диалог можно закрыть и работать дальше */
export const usePhoneScanner = create<PairState>((set, get) => ({
  status: 'off',
  token: null,
  codes: 0,
  stop: null,
  start: async (registerId) => {
    get().stop?.();
    const { accessToken, storeId } = useSession.getState();
    try {
      const r = await pairScanner({ token: accessToken, storeId }, registerId, {
        onAttached: () => (set({ status: 'attached' }), toast.success('Телефон подключён — сканируйте')),
        onCode: (code) => (set((s) => ({ codes: s.codes + 1 })), emitRemoteScan(code)),
      });
      set({ status: 'waiting', token: r.token, stop: r.stop, codes: 0 });
    } catch (e) {
      toast.error((e as Error).message);
    }
  },
  off: () => (get().stop?.(), set({ status: 'off', token: null, stop: null, codes: 0 })),
}));

/** Кнопка в шапке кассы: точка — статус телефона */
export function PhoneScannerButton({ registerId }: { registerId: string | null }) {
  const [open, setOpen] = useState(false);
  const status = usePhoneScanner((s) => s.status);
  return (
    <>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Телефон как сканер" title="Телефон как сканер" className="relative">
        <Smartphone />
        {status !== 'off' && <span className={cn('absolute top-1.5 right-1.5 size-2 rounded-full', status === 'attached' ? 'bg-ok' : 'animate-pulse bg-warn')} />}
      </Button>
      <PhoneScannerDialog open={open} onOpenChange={setOpen} registerId={registerId} />
    </>
  );
}

export function PhoneScannerDialog({ open, onOpenChange, registerId }: { open: boolean; onOpenChange: (v: boolean) => void; registerId: string | null }) {
  const { status, token, codes, start, off } = usePhoneScanner();
  const [qr, setQr] = useState('');
  const link = token ? `${window.location.origin}/m/scan?t=${encodeURIComponent(token)}` : '';
  useEffect(() => {
    if (open && status === 'off') void start(registerId);
  }, [open, status, start, registerId]);
  useEffect(() => {
    if (link) void QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: '#141414', light: '#ffffff' } }).then(setQr);
  }, [link]);
  useEffect(() => {
    if (status === 'attached' && open) onOpenChange(false);
    // закрываем один раз — когда телефон подключился
  }, [status]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Телефон как сканер" description="Откройте камеру телефона и наведите на код. Телефон должен быть залогинен в этот магазин">
      <div className="mt-4 space-y-4 text-center">
        <div className="mx-auto grid size-60 place-items-center overflow-hidden rounded-[24px] bg-white ring-1 ring-line">
          {qr ? <img src={qr} alt="QR для подключения телефона" className="size-full" /> : <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />}
        </div>
        <div className="text-sm">
          {status === 'attached' ? (
            <span className="text-ok">Подключён · кодов {codes}</span>
          ) : (
            <span className="text-muted">Ждём телефон… QR действует 10 минут</span>
          )}
        </div>
        {link && <div className="truncate rounded-full bg-card-muted px-3 py-1.5 font-mono text-[11px] text-muted">{link}</div>}
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={() => (off(), void start(registerId))}>
            Новый QR
          </Button>
          {status !== 'off' && (
            <Button variant="outline" onClick={() => (off(), onOpenChange(false))}>
              Отключить
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
