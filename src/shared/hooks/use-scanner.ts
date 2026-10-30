import { useEffect, useRef } from 'react';
import { REMOTE_SCAN } from '../lib/remote';

/**
 * Сканер-пистолет работает как клавиатура (ТЗ 11.1): символы идут быстрее ~35 мс друг за другом и заканчиваются Enter.
 * Ловим такие серии, пока фокус НЕ в поле ввода (в поле поиска кассы Enter обрабатывает само поле).
 * Порог можно поменять в настройках устройства (F7).
 */
export function useScanner(onScan: (code: string) => void, opts: { enabled?: boolean; threshold?: number; minLength?: number } = {}) {
  const { enabled = true, threshold = 35, minLength = 4 } = opts;
  const buf = useRef('');
  const last = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Открыт диалог (PIN, оплата) — цифры принадлежат ему, а не сканеру
      if (document.querySelector('[role="dialog"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      const gap = now - last.current;
      last.current = now;
      if (e.key === 'Enter') {
        if (buf.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          cb.current(buf.current);
        }
        buf.current = '';
        return;
      }
      if (e.key.length !== 1) return;
      buf.current = gap > threshold * 3 ? e.key : buf.current + e.key;
    };
    // Код с телефона-сканера (ТЗ 11.4) — тот же путь, что у пистолета
    const onRemote = (e: Event) => {
      if (document.querySelector('[role="dialog"]')) return;
      cb.current(String((e as CustomEvent<string>).detail));
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener(REMOTE_SCAN, onRemote);
    return () => (window.removeEventListener('keydown', onKey, true), window.removeEventListener(REMOTE_SCAN, onRemote));
  }, [enabled, threshold, minLength]);
}
