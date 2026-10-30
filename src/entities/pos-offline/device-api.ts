import axios from 'axios';
import { env } from '@/shared/config/env';
import { demoAdapter } from '@/shared/api/demo';
import { ApiError } from '@/shared/api';
import { markNetwork } from '@/shared/lib/network';
import type { CacheResponse, QueuedOp } from './types';

/** API кассового устройства: авторизация заголовком X-Device-Token (работает, даже если токен продавца истёк) */
const http = axios.create({ baseURL: env.apiUrl, timeout: 60_000, ...(env.demo ? { adapter: demoAdapter } : {}) });
http.interceptors.response.use(
  (r) => (markNetwork(true), r),
  (e) => {
    if (!e.response) markNetwork(false);
    const b = e.response?.data;
    return Promise.reject(b?.code ? new ApiError(e.response.status, b.code, b.message, b.details) : new ApiError(e.response?.status ?? 0, e.response ? 'HTTP_ERROR' : 'NETWORK', e.response ? `Ошибка ${e.response.status}` : 'Нет связи с сервером'));
  },
);

const h = (token: string) => ({ headers: { 'X-Device-Token': token } });

export interface SyncResult {
  results: { seq: number; id: string; status: 'accepted' | 'rejected' | 'retry'; duplicate?: boolean; result?: Record<string, unknown>; code?: string; message?: string }[];
  lastOpSeq: number;
  serverTime: string;
  clockSkewSec: number;
  warnings: { code: string; message: string }[];
}

export const deviceApi = {
  cache: (token: string, cursor?: string | null) => http.get<CacheResponse>('/pos-device/cache', { ...h(token), params: cursor ? { cursor } : {} }).then((r) => r.data),
  sync: (token: string, ops: Omit<QueuedOp, 'status' | 'error' | 'result' | 'title'>[]) =>
    http.post<SyncResult>('/pos-device/sync', { deviceTime: new Date().toISOString(), ops }, h(token)).then((r) => r.data),
  state: (token: string) => http.get<{ lastOpSeq: number; lastSyncAt: string | null; rejected: { id: string; seq: number; type: string; error: string }[] }>('/pos-device/sync/state', h(token)).then((r) => r.data),
  pinLogin: (token: string, pin: string) =>
    http.post<{ accessToken: string; refreshToken: string; membershipId: string; name: string }>('/pos-device/pin-login', { pin }, h(token)).then((r) => r.data),
};
