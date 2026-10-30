import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';

/**
 * Связь «телефон-сканер ↔ касса на ПК» (ТЗ 11.4) и «касса → экран покупателя».
 * С сервером — socket.io (scanner:pair / attach / scan). В демо и для экрана покупателя на том же ПК — BroadcastChannel.
 */

export const REMOTE_SCAN = 'ap:remote-scan';
/** Код пришёл с телефона — отдаём в тот же конвейер, что и сканер-пистолет (useScanner) */
export const emitRemoteScan = (code: string) => window.dispatchEvent(new CustomEvent(REMOTE_SCAN, { detail: code }));

let socket: Socket | null = null;
export type SocketAuth = { token: string | null; storeId: string | null };
/** Слой shared не знает о сессии — токен передаёт вызывающий */
export function realtime(auth: SocketAuth): Socket {
  if (socket?.connected || socket?.active) return socket;
  const { token: accessToken, storeId } = auth;
  const origin = /^https?:/.test(env.apiUrl) ? new URL(env.apiUrl).origin : window.location.origin;
  socket = io(origin, { path: '/socket.io', auth: { token: accessToken, storeId }, transports: ['websocket'] });
  return socket;
}
const ack = <T>(s: Socket, ev: string, body: unknown) => new Promise<T>((res, rej) => s.timeout(8000).emit(ev, body, (err: unknown, r: T) => (err ? rej(new Error('Нет связи с сервером')) : res(r))));

type PairCb = { onAttached: () => void; onCode: (code: string) => void };

/** ПК: создать пару, вернуть токен для QR и функцию отключения */
export async function pairScanner(auth: SocketAuth, registerId: string | null, cb: PairCb): Promise<{ token: string; stop: () => void }> {
  if (env.demo) {
    const token = `demo.${Math.random().toString(36).slice(2, 10)}`;
    const ch = new BroadcastChannel('ap-scanner');
    ch.onmessage = (e) => {
      if (e.data?.token !== token) return;
      if (e.data.type === 'attach') cb.onAttached();
      if (e.data.type === 'scan') cb.onCode(String(e.data.code));
    };
    return { token, stop: () => ch.close() };
  }
  const s = realtime(auth);
  const r = await ack<{ ok: boolean; token: string }>(s, 'scanner:pair', { registerId });
  const onA = () => cb.onAttached();
  const onC = (d: { code: string }) => cb.onCode(d.code);
  s.on('scanner:attached', onA);
  s.on('scanner:code', onC);
  return { token: r.token, stop: () => (s.off('scanner:attached', onA), s.off('scanner:code', onC)) };
}

/** Телефон: подключиться к кассе по токену из QR, вернуть функцию отправки кода */
export async function attachScanner(auth: SocketAuth, token: string): Promise<{ send: (code: string, kind?: 'barcode' | 'number') => Promise<void>; stop: () => void }> {
  if (env.demo || token.startsWith('demo.')) {
    const ch = new BroadcastChannel('ap-scanner');
    ch.postMessage({ type: 'attach', token });
    return { send: async (code) => ch.postMessage({ type: 'scan', token, code }), stop: () => ch.close() };
  }
  const s = realtime(auth);
  const r = await ack<{ ok: boolean; message?: string }>(s, 'scanner:attach', { token });
  if (!r.ok) throw new Error(r.message ?? 'QR устарел — обновите его на кассе');
  return {
    send: async (code, kind = 'barcode') => {
      const x = await ack<{ ok: boolean; code?: string }>(s, 'scanner:scan', { code, kind });
      if (!x.ok) throw new Error(x.code === 'NOT_PAIRED' ? 'Касса отключилась — отсканируйте QR заново' : 'Не отправилось');
    },
    stop: () => undefined,
  };
}

// ── Экран покупателя ────────────────────────────────────

export interface DisplayState {
  kind: 'cart' | 'paid' | 'idle';
  shop?: string;
  lines?: { name: string; qty: string; amount: string | null }[];
  total?: string;
  discount?: string;
  customer?: string | null;
  bonus?: string | null;
  change?: string | null;
}
const DISPLAY = 'ap-display';
let dch: BroadcastChannel | null = null;
export const postDisplay = (s: DisplayState) => {
  try {
    dch ??= new BroadcastChannel(DISPLAY);
    dch.postMessage(s);
    localStorage.setItem(DISPLAY, JSON.stringify(s));
  } catch {
    /* второй экран необязателен */
  }
};
export const listenDisplay = (cb: (s: DisplayState) => void) => {
  const ch = new BroadcastChannel(DISPLAY);
  ch.onmessage = (e) => cb(e.data as DisplayState);
  try {
    const last = localStorage.getItem(DISPLAY);
    if (last) cb(JSON.parse(last) as DisplayState);
  } catch {
    /* нет хранилища */
  }
  return () => ch.close();
};
