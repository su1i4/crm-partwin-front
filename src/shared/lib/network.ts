import { create } from 'zustand';
import { env } from '../config/env';

/**
 * Состояние сети для кассы: navigator.onLine врёт (Wi-Fi есть, интернета нет),
 * поэтому «нет сети» = браузер офлайн ИЛИ запросы к API падают без ответа. Возврат — по успешному запросу или /health.
 */
interface NetState {
  online: boolean;
  since: number;
  set: (online: boolean) => void;
}
export const useNet = create<NetState>((set, get) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  since: Date.now(),
  set: (online) => {
    if (get().online !== online) set({ online, since: Date.now() });
  },
}));

let probe: ReturnType<typeof setInterval> | null = null;
async function ping() {
  if (!navigator.onLine) return;
  if (env.demo) return useNet.getState().set(true);
  try {
    const r = await fetch(`${env.apiUrl}/health`, { cache: 'no-store' });
    if (r.ok) useNet.getState().set(true);
  } catch {
    /* всё ещё нет связи */
  }
}

export function markNetwork(ok: boolean) {
  useNet.getState().set(ok);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void ping());
  window.addEventListener('offline', () => useNet.getState().set(false));
  useNet.subscribe((s) => {
    if (!s.online && !probe) probe = setInterval(() => void ping(), 15_000);
    if (s.online && probe) {
      clearInterval(probe);
      probe = null;
    }
  });
}
