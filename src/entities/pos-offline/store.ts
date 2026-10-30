import { create } from 'zustand';
import { api, ApiError } from '@/shared/api';
import { useNet } from '@/shared/lib/network';
import { uuid } from '@/shared/lib/uuid';
import { kvGet, kvSet, KV, posDb, type PosDb } from './db';
import { deviceApi } from './device-api';
import type { CacheMeta, CacheResponse, DeviceCredentials, OpType, QueuedOp } from './types';

/**
 * Офлайн-касса устройства (ТЗ 16): привязка к кассе, кэш, очередь операций, синхронизация.
 * Очередь хранится в IndexedDB и дублируется в localStorage (ТЗ 16.5 — «два хранилища»).
 */

const LS_DEVICE = (t: string) => `ap.pos.device.${t}`;
const LS_QUEUE = (t: string) => `ap.pos.queue.${t}`;
const FULL_EVERY_MS = 24 * 3_600_000;

export interface OfflineShift {
  id: string;
  number: number | null;
  openedAt: string;
  /** Смена открыта без сети (UUID с устройства) */
  offline: boolean;
  status: 'open' | 'closed';
  opening?: Record<string, string>;
  /** Наличные по операциям без сети (для подсказки при закрытии) */
  cashDelta?: Record<string, number>;
}

interface OfflineState {
  tenantId: string | null;
  db: PosDb | null;
  device: DeviceCredentials | null;
  meta: CacheMeta | null;
  pending: number;
  rejected: QueuedOp[];
  oldestPendingAt: string | null;
  syncing: boolean;
  cacheLoading: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  persistGranted: boolean | null;
  shift: OfflineShift | null;
  seller: { membershipId: string; name: string } | null;
}

export const useOffline = create<OfflineState>(() => ({
  tenantId: null,
  db: null,
  device: null,
  meta: null,
  pending: 0,
  rejected: [],
  oldestPendingAt: null,
  syncing: false,
  cacheLoading: false,
  lastSyncAt: null,
  lastError: null,
  persistGranted: null,
  shift: null,
  seller: null,
}));
const get = useOffline.getState;
const set = useOffline.setState;

const lsGet = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* переполнено или запрещено — остаётся копия в IndexedDB */
  }
};

async function refreshCounts() {
  const db = get().db;
  if (!db) return;
  const pendingOps = await db.ops.where('status').equals('pending').sortBy('seq');
  const rejected = await db.ops.where('status').equals('rejected').reverse().sortBy('seq');
  set({ pending: pendingOps.length, oldestPendingAt: pendingOps[0]?.at ?? null, rejected: rejected.slice(0, 50) });
  const t = get().tenantId;
  if (t) lsSet(LS_QUEUE(t), pendingOps.length ? pendingOps : null);
}

export const offline = {
  /** Подключить базу магазина; восстановить привязку и очередь из localStorage, если IndexedDB очистили */
  async init(tenantId: string) {
    if (get().tenantId === tenantId && get().db) return;
    const db = posDb(tenantId);
    let device = (await kvGet<DeviceCredentials>(db, KV.device)) ?? null;
    const lsDevice = lsGet<DeviceCredentials>(LS_DEVICE(tenantId));
    if (!device && lsDevice) {
      device = lsDevice;
      await kvSet(db, KV.device, device);
    } else if (device && !lsDevice) lsSet(LS_DEVICE(tenantId), device);
    // Очередь: всё, что есть в зеркале, но пропало из IndexedDB — вернуть
    const mirror = lsGet<QueuedOp[]>(LS_QUEUE(tenantId)) ?? [];
    for (const op of mirror) if (!(await db.ops.get(op.seq))) await db.ops.put(op);
    const meta = (await kvGet<CacheMeta>(db, KV.meta)) ?? null;
    const shift = (await kvGet<OfflineShift>(db, KV.shift)) ?? null;
    const seller = (await kvGet<{ membershipId: string; name: string }>(db, KV.seller)) ?? null;
    set({ tenantId, db, device, meta, shift, seller });
    await refreshCounts();
  },

  /** Привязать этот браузер к кассе (нужно право devices.manage). Токен и секрет сервер показывает один раз */
  async register(registerId: string, name?: string) {
    const { db, tenantId } = get();
    if (!db || !tenantId) throw new Error('База кассы не готова');
    const info = { platform: navigator.platform, ua: navigator.userAgent.slice(0, 200), pwa: matchMedia('(display-mode: standalone)').matches };
    const r = await api
      .post<Omit<DeviceCredentials, 'tenantId' | 'registeredAt'>>('/pos-devices', { registerId, ...(name ? { name } : {}), info })
      .then((x) => x.data);
    const device: DeviceCredentials = { ...r, tenantId, registeredAt: new Date().toISOString() };
    await kvSet(db, KV.device, device);
    lsSet(LS_DEVICE(tenantId), device);
    set({ device });
    await offline.pullCache(true);
    return device;
  },

  /** Отвязать (после отзыва токена или смены кассы). Неотправленные операции не теряем — блокируем */
  async forget() {
    const { db, tenantId, pending } = get();
    if (pending > 0) throw new Error(`Есть неотправленные операции: ${pending}. Сначала дождитесь отправки.`);
    if (!db || !tenantId) return;
    await db.delete();
    lsSet(LS_DEVICE(tenantId), null);
    lsSet(LS_QUEUE(tenantId), null);
    set({ device: null, meta: null, db: null, tenantId: null, shift: null, seller: null });
    await offline.init(tenantId);
  },

  /** Кэш: полностью при входе и раз в сутки, иначе — изменения по курсору */
  async pullCache(forceFull = false) {
    const { db, device, meta, cacheLoading } = get();
    if (!db || !device || cacheLoading || !useNet.getState().online) return;
    const full = forceFull || !meta || Date.now() - Date.parse(meta.fullAt) > FULL_EVERY_MS;
    set({ cacheLoading: true });
    try {
      const c = await deviceApi.cache(device.token, full ? null : meta!.cursor);
      await applyCache(db, c, meta);
      set({ meta: (await kvGet<CacheMeta>(db, KV.meta)) ?? null, lastError: null });
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'DEVICE_REVOKED' || e.code === 'DEVICE_UNAUTHORIZED')) set({ lastError: 'Устройство отключено администратором — привяжите заново' });
      else set({ lastError: e instanceof Error ? e.message : 'Ошибка загрузки кэша' });
    } finally {
      set({ cacheLoading: false });
    }
  },

  /** Поставить операцию в очередь (seq — строго по порядку) */
  async enqueue(type: OpType, payload: Record<string, unknown>, membershipId: string, title: string, id = uuid()): Promise<QueuedOp> {
    const db = get().db!;
    const op = await db.transaction('rw', db.ops, async () => {
      const last = await db.ops.orderBy('seq').last();
      const seq = Math.max(last?.seq ?? 0, Number(get().meta?.device.lastOpSeq ?? 0)) + 1;
      const o: QueuedOp = { seq, id, type, at: new Date().toISOString(), membershipId, payload, status: 'pending', title };
      await db.ops.put(o);
      return o;
    });
    await refreshCounts();
    void offline.flush();
    return op;
  },

  /** Отправить очередь: по 200, по порядку; «retry» — остановиться и прийти снова */
  async flush() {
    const { db, device, syncing } = get();
    if (!db || !device || syncing || !useNet.getState().online) return;
    const ops = await db.ops.where('status').equals('pending').sortBy('seq');
    if (!ops.length) return;
    set({ syncing: true });
    try {
      const r = await deviceApi.sync(
        device.token,
        ops.slice(0, 200).map(({ seq, id, type, at, membershipId, payload }) => ({ seq, id, type, at, membershipId, payload })),
      );
      for (const x of r.results) {
        if (x.status === 'retry') break;
        await db.ops.update(x.seq, { status: x.status, error: x.message ?? null, result: x.result ?? null });
        // Смена, открытая без сети, получила номер на сервере
        if (x.status === 'accepted' && x.result?.shiftId && get().shift?.id === x.id) {
          const s = { ...get().shift!, number: (x.result.number as number) ?? get().shift!.number };
          await kvSet(db, KV.shift, s);
          set({ shift: s });
        }
      }
      // Принятые старше 7 дней чистим, отклонённые оставляем для разбора
      const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
      await db.ops.where('status').equals('accepted').filter((o) => o.at < week).delete();
      set({ lastSyncAt: new Date().toISOString(), lastError: r.warnings[0]?.message ?? null });
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : 'Ошибка отправки' });
    } finally {
      set({ syncing: false });
      await refreshCounts();
    }
    if (get().pending && useNet.getState().online) setTimeout(() => void offline.flush(), 1500);
  },

  async setShift(s: OfflineShift | null) {
    const db = get().db;
    if (db) await kvSet(db, KV.shift, s);
    set({ shift: s });
  },

  async setSeller(s: { membershipId: string; name: string } | null) {
    const db = get().db;
    if (db) await kvSet(db, KV.seller, s);
    set({ seller: s });
  },

  /** Следующий номер чека на устройстве: код кассы + серия + счётчик (К1А-000457) */
  async nextNumber(): Promise<string> {
    const { db, device, meta } = get();
    const prefix = meta?.device.numberPrefix ?? device!.numberPrefix;
    return db!.transaction('rw', db!.kv, async () => {
      const local = (await kvGet<number>(db!, KV.counter)) ?? 0;
      const server = Number((meta?.device.lastNumber ?? '').split('-')[1] ?? 0) || 0;
      const n = Math.max(local, server) + 1;
      await kvSet(db!, KV.counter, n);
      return `${prefix}-${String(n).padStart(6, '0')}`;
    });
  },

  async requestPersist() {
    try {
      const ok = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.());
      set({ persistGranted: !!ok });
    } catch {
      set({ persistGranted: false });
    }
  },
};

async function applyCache(db: PosDb, c: CacheResponse, prev: CacheMeta | null) {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.kv, db.products, db.barcodes, db.numbers, db.prices, db.stock, db.customers, db.staff, db.accounts, db.receipts], async () => {
    if (c.full) {
      await Promise.all([db.products.clear(), db.barcodes.clear(), db.numbers.clear(), db.prices.clear(), db.stock.clear(), db.customers.clear(), db.staff.clear(), db.accounts.clear(), db.receipts.clear()]);
    }
    if (c.removed?.products?.length) {
      await db.products.bulkDelete(c.removed.products);
      await db.barcodes.where('productId').anyOf(c.removed.products).delete();
      await db.numbers.where('productId').anyOf(c.removed.products).delete();
    }
    await db.products.bulkPut(c.products);
    await db.barcodes.bulkPut(c.barcodes);
    await db.numbers.bulkPut(c.numbers.map((n) => ({ ...n, key: `${n.productId}|${n.normalized}|${n.type}` })));
    // Цены по ключу (товар, тип, точка, единица, дата начала): будущие цены лежат рядом и включаются сами
    await db.prices.bulkPut(c.prices.map((p) => ({ ...p, key: `${p.productId}|${p.priceTypeId}|${p.storeId ?? ''}|${p.unitId ?? ''}|${p.validFrom}` })));
    await db.stock.bulkPut(c.stock.map((s) => ({ ...s, key: `${s.warehouseId}|${s.productId}` })));
    await db.customers.bulkPut(c.customers);
    await db.staff.clear();
    await db.staff.bulkPut(c.staff);
    await db.accounts.clear();
    await db.accounts.bulkPut(c.accounts);
    await db.receipts.bulkPut(c.receipts);
    const meta: CacheMeta = {
      cursor: c.cursor,
      fullAt: c.full ? now : (prev?.fullAt ?? now),
      deltaAt: now,
      device: c.device,
      store: c.store,
      register: c.register,
      offlineRules: c.offlineRules,
      settings: c.settings,
      rates: c.rates,
      priceTypes: c.priceTypes,
    };
    await kvSet(db, KV.meta, meta);
  });
}
