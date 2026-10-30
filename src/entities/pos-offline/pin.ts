import type { CStaff } from './types';

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/**
 * Проверка PIN без сети (ТЗ 3.5): HMAC-SHA256(секрет устройства, base64(PBKDF2-SHA256(PIN, "pin:{tenant}:{membership}", 20000, 32)))
 * — так же считает backend (pos.service / pos-devices.service). Хэш с другого устройства не подойдёт.
 */
async function offlineHash(pin: string, tenantId: string, membershipId: string, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`pin:${tenantId}:${membershipId}`), iterations }, key, 256);
  return b64(bits);
}

async function wrap(secret: string, hash: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(hash)));
}

export async function verifyPinOffline(pin: string, staff: CStaff[], tenantId: string, secret: string, iterations = 20000): Promise<CStaff | null> {
  if (!crypto?.subtle) return null;
  for (const s of staff) {
    if (!s.active || !s.pinHash) continue;
    const h = await wrap(secret, await offlineHash(pin, tenantId, s.membershipId, iterations));
    if (h === s.pinHash) return s;
  }
  return null;
}

/** Для демо-режима: посчитать хэш так же, как сервер */
export const makePinHash = async (pin: string, tenantId: string, membershipId: string, secret: string) => wrap(secret, await offlineHash(pin, tenantId, membershipId, 20000));

/** Блокировка после 5 ошибок на 15 минут — и без сети тоже (ТЗ 3.5) */
const LOCK_KEY = 'ap.pos.pinfail';
export function pinLocked(): number {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') as { n?: number; until?: number };
    return v.until && v.until > Date.now() ? v.until : 0;
  } catch {
    return 0;
  }
}
export function pinFailed() {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') as { n?: number };
    const n = (v.n ?? 0) + 1;
    localStorage.setItem(LOCK_KEY, JSON.stringify(n >= 5 ? { n: 0, until: Date.now() + 15 * 60_000 } : { n }));
  } catch {
    /* хранилище недоступно */
  }
}
export const pinOk = () => {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* хранилище недоступно */
  }
};
