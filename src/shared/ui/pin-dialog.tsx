import { Delete, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { cn } from '../lib/cn';
import { Dialog } from './dialog';

/** PIN старшего (ТЗ 3.5): askPin('Скидка выше лимита') → Promise<string | null> */
interface PinState {
  open: boolean;
  reason: string;
  resolve: ((v: string | null) => void) | null;
}
const usePin = create<PinState>(() => ({ open: false, reason: '', resolve: null }));

export const askPin = (reason: string) =>
  new Promise<string | null>((resolve) => usePin.setState({ open: true, reason, resolve }));

export function PinDialog() {
  const { open, reason, resolve } = usePin();
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (open) setPin('');
  }, [open]);
  const done = (v: string | null) => {
    resolve?.(v);
    usePin.setState({ open: false, resolve: null });
  };
  const press = (k: string) => setPin((p) => (p.length < 6 ? p + k : p));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      if (e.key === 'Enter' && pin.length >= 4) done(pin);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && done(null)} className="max-w-sm" title="PIN старшего" description={reason}>
      <div className="mt-5 flex justify-center gap-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cn('size-3.5 rounded-full transition', i < pin.length ? 'bg-ink' : 'bg-line-strong', i >= 4 && i >= pin.length && 'opacity-40')} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} onClick={() => press(k)} className="h-14 rounded-2xl bg-card-muted text-xl font-medium text-ink hover:bg-line">
            {k}
          </button>
        ))}
        <button onClick={() => setPin((p) => p.slice(0, -1))} className="grid h-14 place-items-center rounded-2xl text-muted hover:bg-card-muted" aria-label="Стереть">
          <Delete className="size-5" />
        </button>
        <button onClick={() => press('0')} className="h-14 rounded-2xl bg-card-muted text-xl font-medium text-ink hover:bg-line">
          0
        </button>
        <button
          disabled={pin.length < 4}
          onClick={() => done(pin)}
          className="grid h-14 place-items-center rounded-2xl bg-pill text-pill-ink disabled:opacity-30"
          aria-label="Подтвердить"
        >
          <Lock className="size-5" />
        </button>
      </div>
    </Dialog>
  );
}
