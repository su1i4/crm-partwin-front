import { create } from 'zustand';
import { toast } from 'sonner';
import { posApi, type HeaderInput, type LineInput, type Receipt, type ReceiptLine } from '@/entities/pos';
import { ApiError, errorMessage } from '@/shared/api';
import { useNet } from '@/shared/lib/network';
import { calcReceipt, PricingError } from '@/shared/lib/pricing-engine';
import { askPin } from '@/shared/ui';

/**
 * Чек на кассе. Строка появляется сразу (локально), а цены, скидки и итоги считает сервер:
 * изменения копятся и уходят одним PATCH (не чаще раза в 200 мс), ответ сервера — источник правды.
 * Чек живёт на сервере со статусом open — после перезагрузки или отключения света он продолжается (ТЗ 13.8).
 *
 * Без сети (mode = offline) чек считается на кассе тем же движком цен (shared/lib/pricing-engine), хранится в
 * localStorage на случай отключения света и при оплате уходит в очередь офлайн-операций (ТЗ 16).
 */

export interface DraftLine {
  key: string;
  lineId?: string;
  productId?: string;
  name: string;
  sku?: string | null;
  number?: string | null;
  brand?: string | null;
  unitName: string;
  qty: string;
  /** Цена и сумма от сервера; пока не пришли — оценка */
  price: string | null;
  amount: string | null;
  discount: string;
  discountPercent?: string | null;
  discountAmount?: string | null;
  customPrice?: string | null;
  place?: string | null;
  free?: { name: string };
  neighbor?: LineInput['neighbor'];
  pending: boolean;
}

export interface CartCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface CartState {
  registerId: string | null;
  receipt: Receipt | null;
  lines: DraftLine[];
  header: HeaderInput;
  customer: CartCustomer | null;
  vehicleLabel: string;
  rev: number;
  inFlight: boolean;
  /** PIN для следующей отправки (удаление строки по настройке) */
  pin: string | null;
  lastAddedKey: string | null;
  mode: 'online' | 'offline';
  /** Офлайн: скидка на чек */
  offDiscount: { percent: string | null; amount: string | null };
  /** Онлайн-чек, брошенный при потере связи — отменить, когда связь вернётся */
  orphan: { id: string; version: number } | null;
  /** Офлайн: ошибка расчёта (скидка больше суммы и т.п.) */
  calcError: string | null;
}

const empty = {
  receipt: null,
  lines: [] as DraftLine[],
  header: {},
  customer: null,
  vehicleLabel: '',
  rev: 0,
  inFlight: false,
  pin: null,
  lastAddedKey: null,
  offDiscount: { percent: null, amount: null },
  calcError: null,
};

export const useCart = create<CartState>(() => ({ registerId: null, mode: 'online', orphan: null, ...empty }));
const get = useCart.getState;
const set = useCart.setState;

const LS = (registerId: string) => `ap.pos.receipt.${registerId}`;
const saveId = (id: string | null) => {
  const reg = get().registerId;
  if (!reg) return;
  try {
    if (id) localStorage.setItem(LS(reg), id);
    else localStorage.removeItem(LS(reg));
  } catch {
    /* хранилище недоступно — чек всё равно на сервере */
  }
};

let localKey = 0;
const newKey = () => `l${Date.now().toString(36)}${(localKey++).toString(36)}`;

const fromServer = (l: ReceiptLine): DraftLine => ({
  key: l.id,
  lineId: l.id,
  productId: l.productId,
  name: l.free?.name ?? l.name,
  sku: l.sku,
  unitName: l.unitName,
  qty: String(Number(l.qty)),
  price: String(l.price),
  amount: String(l.amount),
  discount: String(Number(l.promoDiscount ?? 0) + Number(l.lineDiscount ?? 0) + Number(l.receiptDiscount ?? 0)),
  discountPercent: l.discountPercent,
  discountAmount: l.discountAmount,
  customPrice: l.customPrice ? String(l.price) : null,
  place: l.place,
  free: l.free ?? undefined,
  neighbor: l.neighbor ? { ...l.neighbor, purchasePrice: '0' } : undefined,
  pending: false,
});

const toInput = (l: DraftLine): LineInput => ({
  ...(l.lineId ? { lineId: l.lineId } : {}),
  ...(l.productId && !l.free && !l.neighbor ? { productId: l.productId } : {}),
  qty: l.qty,
  ...(l.customPrice ? { price: l.customPrice } : {}),
  ...(l.discountPercent ? { discountPercent: l.discountPercent } : {}),
  ...(l.discountAmount ? { discountAmount: l.discountAmount } : {}),
  ...(l.free && !l.lineId ? { free: l.free, price: l.customPrice ?? l.price ?? '0' } : {}),
  ...(l.neighbor && !l.lineId ? { neighbor: l.neighbor, price: l.customPrice ?? l.price ?? '0' } : {}),
});

let timer: ReturnType<typeof setTimeout> | null = null;
const schedule = (ms = 200) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sync(), ms);
};
const DRAFT = (registerId: string) => `ap.pos.offline-draft.${registerId}`;
function saveDraft() {
  const s = get();
  if (!s.registerId) return;
  try {
    if (s.mode === 'offline' && s.lines.length)
      localStorage.setItem(DRAFT(s.registerId), JSON.stringify({ lines: s.lines, customer: s.customer, vehicleLabel: s.vehicleLabel, offDiscount: s.offDiscount, orphan: s.orphan }));
    else localStorage.removeItem(DRAFT(s.registerId));
  } catch {
    /* хранилище недоступно */
  }
}

/** Офлайн: пересчитать строки тем же движком, что на сервере */
function recalcOffline() {
  const s = get();
  try {
    const c = calcReceipt({
      lines: s.lines.map((l) => ({
        key: l.key,
        qty: l.qty,
        price: l.customPrice ?? l.price ?? '0',
        discountPercent: l.discountPercent ?? null,
        discountAmount: l.discountAmount ?? null,
      })),
      receiptDiscountPercent: s.offDiscount.percent,
      receiptDiscountAmount: s.offDiscount.amount,
    });
    set({
      calcError: null,
      lines: s.lines.map((l, i) => {
        const x = c.lines[i];
        return { ...l, pending: false, amount: x.total, discount: String(Number(x.lineDiscount) + Number(x.receiptDiscount) + Number(x.promoDiscount ?? 0)) };
      }),
    });
  } catch (e) {
    set({ calcError: e instanceof PricingError ? e.message : 'Ошибка расчёта' });
  }
  saveDraft();
}

const bump = (patch: Partial<CartState>) => {
  set((s) => ({ ...patch, rev: s.rev + 1 }));
  if (get().mode === 'offline') recalcOffline();
  else schedule();
};

function applyServer(r: Receipt, sentRev: number, sentKeys: string[]) {
  const cur = get();
  if (r.status === 'completed' || r.status === 'cancelled') return;
  if (cur.rev === sentRev) {
    // Номер и бренд сервер в строке чека не возвращает — сохраняем то, что знали при добавлении
    const known = new Map(cur.lines.map((l, i) => [l.lineId ?? sentKeys[i] ?? l.key, l]));
    set({
      receipt: r,
      lines: r.lines.map((l, i) => {
        const prev = known.get(l.id) ?? cur.lines.find((x) => x.key === sentKeys[i]);
        return { ...fromServer(l), number: prev?.number ?? null, brand: prev?.brand ?? null };
      }),
      inFlight: false,
      customer: r.customerId ? { id: r.customerId, name: r.customerName ?? cur.customer?.name ?? 'Клиент', phone: r.customerPhone ?? null } : null,
      vehicleLabel: r.vehicleLabel ?? '',
    });
  } else {
    // Пока ждали ответ, кассир что-то поменял — берём только id новых строк, остальное отправим следующим запросом
    const lines = cur.lines.map((l) => {
      const i = sentKeys.indexOf(l.key);
      return i >= 0 && r.lines[i] && !l.lineId ? { ...l, lineId: r.lines[i].id } : l;
    });
    set({ receipt: r, lines, inFlight: false });
  }
}

export async function sync(): Promise<void> {
  const s = get();
  if (s.inFlight || !s.registerId || s.mode === 'offline') return;
  const hasHeader = Object.keys(s.header).length > 0;
  if (!s.receipt && !s.lines.length) return;
  if (s.receipt && !hasHeader && s.rev === 0) return;
  const sentRev = s.rev;
  const sentKeys = s.lines.map((l) => l.key);
  const header = s.header;
  const pin = s.pin;
  set({ inFlight: true, header: {}, pin: null });
  try {
    const lines = s.lines.map(toInput);
    const r = s.receipt
      ? await posApi.updateReceipt(s.receipt.id, { version: s.receipt.version, lines, ...header, ...(pin ? { pin } : {}) })
      : await posApi.createReceipt({ registerId: s.registerId, lines, ...header });
    saveId(r.id);
    applyServer(r, sentRev, sentKeys);
    if (get().rev !== sentRev) {
      set({ rev: get().rev });
      schedule(0);
    } else set({ rev: 0 });
  } catch (e) {
    set((st) => ({ inFlight: false, header: { ...header, ...st.header } }));
    if (e instanceof ApiError && e.code === 'NETWORK') {
      // Связь пропала посреди чека — продолжаем без сети, строки не теряем
      cart.goOffline();
      return;
    }
    if (e instanceof ApiError && (e.details as { requiresPin?: boolean } | undefined)?.requiresPin) {
      const p = await askPin(e.message);
      if (p) {
        set({ pin: p, rev: get().rev + 1 });
        return sync();
      }
    } else if (e instanceof ApiError && e.code === 'VERSION_CONFLICT' && s.receipt) {
      toast('Чек изменён на другой кассе — обновили');
    } else {
      toast.error(errorMessage(e));
    }
    // Откат к состоянию сервера
    const id = get().receipt?.id;
    if (id) {
      try {
        const r = await posApi.receipt(id);
        set({ receipt: r, lines: r.lines.map(fromServer), rev: 0, header: {} });
      } catch {
        /* нет связи — оставляем как есть */
      }
    } else set({ lines: [], rev: 0 });
  }
}

/** Дождаться, пока все изменения уйдут на сервер (перед оплатой) */
export async function flush(): Promise<Receipt | null> {
  if (timer) clearTimeout(timer);
  for (let i = 0; i < 20; i++) {
    const s = get();
    if (!s.inFlight && s.rev === 0 && !Object.keys(s.header).length) return s.receipt;
    if (!s.inFlight) await sync();
    else await new Promise((r) => setTimeout(r, 120));
  }
  return get().receipt;
}

// ── Действия кассира ────────────────────────────────────

export interface AddableProduct {
  id: string;
  name: string;
  sku?: string | null;
  mainNumber?: string | null;
  brandName?: string | null;
  baseUnit?: string;
  price?: string | number | null;
}

export const cart = {
  /** Касса устройства; подхватывает незавершённый чек этой кассы */
  async attach(registerId: string) {
    if (get().registerId === registerId && (get().receipt || get().lines.length)) return;
    set({ registerId, ...empty, mode: useNet.getState().online ? 'online' : 'offline' });
    // Офлайн-черновик (свет выключился посреди чека без сети)
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT(registerId)) ?? 'null');
      if (d?.lines?.length) {
        set({ mode: 'offline', lines: d.lines, customer: d.customer, vehicleLabel: d.vehicleLabel ?? '', offDiscount: d.offDiscount ?? empty.offDiscount, orphan: d.orphan ?? null });
        recalcOffline();
        toast('Восстановлен чек, начатый без сети');
        return;
      }
    } catch {
      /* битый черновик — игнорируем */
    }
    let id: string | null = null;
    try {
      id = localStorage.getItem(LS(registerId));
    } catch {
      /* нет доступа к хранилищу */
    }
    if (!id) return;
    try {
      const r = await posApi.receipt(id);
      if (r.status === 'open') {
        set({ receipt: r, lines: r.lines.map(fromServer), customer: r.customerId ? { id: r.customerId, name: r.customerName ?? 'Клиент', phone: r.customerPhone ?? null } : null, vehicleLabel: r.vehicleLabel ?? '' });
        if (r.lines.length) toast('Восстановлен незавершённый чек');
      } else saveId(null);
    } catch {
      saveId(null);
    }
  },

  add(p: AddableProduct, qty = 1) {
    const s = get();
    // Повторный скан — +1 к строке (настройка устройства, по умолчанию так)
    const existing = s.lines.find((l) => l.productId === p.id && !l.free && !l.neighbor && !l.customPrice);
    if (existing) {
      const q = String(Number(existing.qty) + qty);
      bump({ lines: s.lines.map((l) => (l.key === existing.key ? { ...l, qty: q, amount: l.price ? String(Number(l.price) * Number(q)) : null, pending: true } : l)), lastAddedKey: existing.key });
      return;
    }
    const key = newKey();
    const price = p.price !== null && p.price !== undefined ? String(p.price) : null;
    bump({
      lines: [
        ...s.lines,
        {
          key,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          number: p.mainNumber,
          brand: p.brandName,
          unitName: p.baseUnit ?? 'шт',
          qty: String(qty),
          price,
          amount: price ? String(Number(price) * qty) : null,
          discount: '0',
          pending: true,
        },
      ],
      lastAddedKey: key,
    });
  },

  addFree(name: string, price: string) {
    const key = newKey();
    bump({ lines: [...get().lines, { key, name, unitName: 'шт', qty: '1', price, amount: price, discount: '0', customPrice: price, free: { name }, pending: true }], lastAddedKey: key });
  },

  addNeighbor(n: { neighborId: string; neighborName: string; name: string; partNumber?: string; purchasePrice: string; salePrice: string }) {
    const key = newKey();
    bump({
      lines: [
        ...get().lines,
        {
          key,
          name: n.name,
          number: n.partNumber ?? null,
          brand: `у соседа: ${n.neighborName}`,
          unitName: 'шт',
          qty: '1',
          price: n.salePrice,
          amount: n.salePrice,
          discount: '0',
          customPrice: n.salePrice,
          neighbor: { neighborId: n.neighborId, name: n.name, partNumber: n.partNumber, purchasePrice: n.purchasePrice },
          pending: true,
        },
      ],
      lastAddedKey: key,
    });
  },

  setQty(key: string, qty: number) {
    if (qty <= 0) return cart.remove(key);
    bump({ lines: get().lines.map((l) => (l.key === key ? { ...l, qty: String(Math.round(qty * 1000) / 1000), amount: l.price ? String(Number(l.price) * qty) : null, pending: true } : l)) });
  },

  setLine(key: string, patch: Pick<DraftLine, 'discountPercent' | 'discountAmount' | 'customPrice'>) {
    bump({ lines: get().lines.map((l) => (l.key === key ? { ...l, ...patch, pending: true } : l)) });
  },

  remove(key: string) {
    bump({ lines: get().lines.filter((l) => l.key !== key) });
  },

  setCustomer(c: CartCustomer | null) {
    set((s) => ({ customer: c, header: { ...s.header, customerId: c?.id ?? null } }));
    if (get().mode === 'offline') saveDraft();
    else schedule();
  },
  setVehicleLabel(v: string) {
    set((s) => ({ vehicleLabel: v, header: { ...s.header, vehicleLabel: v || null } }));
    if (get().mode === 'offline') saveDraft();
    else schedule(600);
  },
  setReceiptDiscount(p: { percent?: string | null; amount?: string | null }) {
    if (get().mode === 'offline') {
      set({ offDiscount: { percent: p.percent ?? null, amount: p.amount ?? null } });
      recalcOffline();
      return;
    }
    set((s) => ({ header: { ...s.header, receiptDiscountPercent: p.percent ?? null, receiptDiscountAmount: p.amount ?? null } }));
    schedule(0);
  },

  /** Связь пропала: чек продолжается на кассе. Брошенный онлайн-чек отменим, когда связь вернётся */
  goOffline() {
    const s = get();
    if (s.mode === 'offline') return;
    if (timer) clearTimeout(timer);
    const r = s.receipt;
    set({
      mode: 'offline',
      receipt: null,
      orphan: r ? { id: r.id, version: r.version } : s.orphan,
      offDiscount: { percent: r?.receiptDiscountPercent ?? null, amount: r?.receiptDiscountAmount ? String(r.receiptDiscountAmount) : null },
      lines: s.lines.map((l) => ({ ...l, lineId: undefined })),
      inFlight: false,
      rev: 0,
    });
    saveId(null);
    recalcOffline();
  },

  /** Пустой чек и связь есть — следующий чек снова онлайн */
  goOnlineIfIdle() {
    const s = get();
    if (s.mode === 'offline' && !s.lines.length) set({ mode: 'online' });
  },

  /** Отменить брошенный при потере связи онлайн-чек */
  async cancelOrphan() {
    const o = get().orphan;
    if (!o) return;
    try {
      const r = await posApi.receipt(o.id);
      if (r.status === 'open') await posApi.cancel(r.id, r.version);
      set({ orphan: null });
      saveDraft();
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) set({ orphan: null });
    }
  },

  /** Чек оплачен / отменён / отложен — начинаем новый */
  reset() {
    saveId(null);
    set({ ...empty, mode: useNet.getState().online ? 'online' : 'offline' });
    saveDraft();
  },

  load(r: Receipt) {
    saveId(r.id);
    set({ ...empty, receipt: r, lines: r.lines.map(fromServer), customer: r.customerId ? { id: r.customerId, name: r.customerName ?? 'Клиент', phone: r.customerPhone ?? null } : null, vehicleLabel: r.vehicleLabel ?? '' });
  },
};

/** Итоги: серверные, а пока строки в пути — оценка по локальным ценам */
export function totals(s: Pick<CartState, 'receipt' | 'lines' | 'rev' | 'inFlight'> & { mode?: CartState['mode']; rate?: number | null }) {
  if (s.mode === 'offline') {
    const subtotal = s.lines.reduce((a, l) => a + Number(l.customPrice ?? l.price ?? 0) * Number(l.qty), 0);
    const total = s.lines.reduce((a, l) => a + Number(l.amount ?? 0), 0);
    const rate = s.rate ?? null;
    return { subtotal, discount: Math.round((subtotal - total) * 100) / 100, total: Math.round(total * 100) / 100, usd: rate ? total / rate : null, rate, pending: false };
  }
  const pending = s.rev > 0 || s.inFlight || s.lines.some((l) => l.pending);
  if (s.receipt && !pending) {
    return {
      subtotal: Number(s.receipt.subtotal),
      discount: Number(s.receipt.discountTotal),
      total: Number(s.receipt.total),
      usd: s.receipt.totalUsd ? Number(s.receipt.totalUsd) : null,
      rate: s.receipt.rate ? Number(s.receipt.rate) : null,
      pending: false,
    };
  }
  const subtotal = s.lines.reduce((a, l) => a + (l.price ? Number(l.price) * Number(l.qty) : 0), 0);
  const discount = s.lines.reduce((a, l) => a + Number(l.discount || 0), 0);
  const rate = s.receipt?.rate ? Number(s.receipt.rate) : null;
  return { subtotal, discount, total: subtotal - discount, usd: rate ? (subtotal - discount) / rate : null, rate, pending: true };
}
