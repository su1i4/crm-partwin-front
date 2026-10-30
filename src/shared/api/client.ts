import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { demoAdapter } from './demo';
import { markNetwork } from '../lib/network';

/** Ошибка backend: { code, message, details } */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Слой shared не знает о сессии — её подключает app через configureApi (FSD). */
interface ApiHooks {
  getToken: () => string | null;
  getStoreId: () => string | null;
  getRefresh?: () => string | null;
  onToken: (token: string) => void;
  onAuthLost: () => void;
}
let hooks: ApiHooks = { getToken: () => null, getStoreId: () => null, onToken: () => {}, onAuthLost: () => {} };
export const configureApi = (h: ApiHooks) => {
  hooks = h;
};

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true, // refresh — httpOnly cookie
  timeout: 30_000,
  ...(env.demo ? { adapter: demoAdapter } : {}),
});

api.interceptors.request.use((config) => {
  const token = hooks.getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  const storeId = hooks.getStoreId();
  if (storeId) config.headers.set('X-Store-Id', storeId);
  return config;
});

// Один refresh на все параллельные 401
let refreshing: Promise<string> | null = null;
async function refreshToken(): Promise<string> {
  refreshing ??= api
    .post<{ accessToken: string }>('/auth/refresh', hooks.getRefresh?.() ? { refreshToken: hooks.getRefresh() } : {}, { _skipAuthRetry: true } as AxiosRequestConfig)
    .then((r) => {
      hooks.onToken(r.data.accessToken);
      return r.data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (r) => {
    markNetwork(true);
    return r;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    if (!error.response && error.code !== 'ERR_CANCELED') markNetwork(false);
    else if (error.response) markNetwork(true);
    const cfg = error.config as (InternalAxiosRequestConfig & { _retried?: boolean; _skipAuthRetry?: boolean }) | undefined;
    const status = error.response?.status ?? 0;
    if (status === 401 && cfg && !cfg._retried && !cfg._skipAuthRetry && !cfg.url?.startsWith('/auth/login')) {
      cfg._retried = true;
      try {
        const token = await refreshToken();
        cfg.headers.set('Authorization', `Bearer ${token}`);
        return api(cfg);
      } catch {
        hooks.onAuthLost();
      }
    }
    const body = error.response?.data;
    if (body && typeof body === 'object' && 'code' in body) {
      return Promise.reject(new ApiError(status, body.code, body.message, body.details));
    }
    return Promise.reject(
      new ApiError(status, status ? 'HTTP_ERROR' : 'NETWORK', status ? `Ошибка ${status}` : 'Нет связи с сервером'),
    );
  },
);

export const errorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Что-то пошло не так');

export interface Page<T> {
  items: T[];
  total: number;
}

/** Загрузка файла (фото товара, вложение документа, импорт) → { id, originalName, mime, size } */
export async function uploadFile(file: Blob, purpose: string, name = 'file', entity?: { type: string; id: string }) {
  const fd = new FormData();
  fd.append('file', file, (file as File).name ?? name);
  fd.append('purpose', purpose);
  if (entity) {
    fd.append('entityType', entity.type);
    fd.append('entityId', entity.id);
  }
  return api.post<{ id: string; originalName: string; mime: string; size: number }>('/files', fd).then((r) => r.data);
}

/** Скачать файл с авторизацией (blob) */
export const downloadFile = (id: string) => api.get<Blob>(`/files/${id}`, { responseType: 'blob' }).then((r) => r.data);
