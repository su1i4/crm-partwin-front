import { useEffect } from 'react';

/** Горячая клавиша: 'mod+k', 'f2', 'escape'. mod = Ctrl или ⌘ */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop()!;
    const mod = parts.includes('mod');
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      if (mod && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler, enabled]);
}
