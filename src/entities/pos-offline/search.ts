import { resolvePrice } from '@/shared/lib/pricing-engine';
import type { PosDb } from './db';
import type { CacheMeta, CProduct } from './types';

/** Нормализация номера — как на сервере (common/utils/part-number.ts) */
const CYR: Record<string, string> = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', Ё: 'E', У: 'Y' };
export function normalizePartNumber(s: string) {
  let out = '';
  for (const ch of s.toUpperCase()) {
    const m = CYR[ch] ?? ch;
    if (/[\p{L}\p{N}]/u.test(m)) out += m;
  }
  return out;
}
const GROUPS = [['0', 'O', 'Q', 'D'], ['1', 'I', 'L'], ['5', 'S'], ['8', 'B'], ['2', 'Z'], ['6', 'G']];
export const skeleton = (n: string) => [...n].map((c) => GROUPS.find((g) => g.includes(c))?.[0] ?? c).join('');

export interface OfflineItem {
  id: string;
  name: string;
  sku: string;
  mainNumber: string | null;
  brandName: string | null;
  baseUnit: string;
  qualityClass: string;
  price: string | null;
  stockHere: string;
  matchKind: 'barcode' | 'sku' | 'number' | 'text';
  unitId?: string;
}

/** Цена товара на кассе без сети — тот же движок, что на сервере (ТЗ 17.3) */
export async function offlinePrice(db: PosDb, meta: CacheMeta, productId: string, customerPriceTypeId?: string | null): Promise<string | null> {
  const p = await db.products.get(productId);
  const retail = meta.priceTypes.find((t) => t.isRetail) ?? meta.priceTypes[0];
  if (!p || !retail) return null;
  const now = new Date().toISOString();
  const all = (await db.prices.where('productId').equals(productId).toArray()).filter((x) => x.validFrom <= now);
  // Действующая цена = последняя по дате начала в каждой группе (тип, точка, единица)
  const latest = new Map<string, (typeof all)[number]>();
  for (const x of all) {
    const k = `${x.priceTypeId}|${x.storeId ?? ''}|${x.unitId ?? ''}`;
    if (!latest.has(k) || latest.get(k)!.validFrom < x.validFrom) latest.set(k, x);
  }
  try {
    const r = resolvePrice({
      candidates: [...latest.values()].map((x) => ({ priceTypeId: x.priceTypeId, storeId: x.storeId, unitId: x.unitId, price: String(x.price), currency: x.currency })),
      storeId: meta.store.id,
      unitId: null,
      unitFactor: '1',
      unitPriceMode: 'computed',
      retailPriceTypeId: retail.id,
      customerPriceTypeId: customerPriceTypeId ?? null,
      rates: Object.fromEntries(meta.rates.map((r) => [r.currency, String(r.rate)])),
      rounding: Number(meta.settings.priceRounding ?? 1) || 1,
      negotiable: p.priceNegotiable,
    });
    return r.price;
  } catch {
    return null;
  }
}

async function stockHere(db: PosDb, productId: string) {
  const rows = await db.stock.where('productId').equals(productId).toArray();
  return String(rows.reduce((a, r) => a + Number(r.qty), 0));
}

async function toItem(db: PosDb, meta: CacheMeta, p: CProduct, matchKind: OfflineItem['matchKind'], unitId?: string): Promise<OfflineItem> {
  const nums = await db.numbers.where('productId').equals(p.id).toArray();
  const main = nums.find((n) => n.type === 'manufacturer') ?? nums[0];
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    mainNumber: main?.number ?? null,
    brandName: p.brandName,
    baseUnit: p.baseUnit,
    qualityClass: p.qualityClass,
    price: await offlinePrice(db, meta, p.id),
    stockHere: await stockHere(db, p.id),
    matchKind,
    unitId,
  };
}

/** Поиск без сети: штрихкод → артикул → номер (в т.ч. «скелет» 0/O, 1/I) → слова в названии */
export async function offlineSearch(db: PosDb, meta: CacheMeta, q: string, limit = 12): Promise<OfflineItem[]> {
  const raw = q.trim();
  if (!raw) return [];
  const out = new Map<string, OfflineItem>();
  const add = async (p: CProduct | undefined, kind: OfflineItem['matchKind'], unitId?: string) => {
    if (p && !out.has(p.id) && out.size < limit) out.set(p.id, await toItem(db, meta, p, kind, unitId));
  };
  for (const b of await db.barcodes.where('barcode').equals(raw).toArray()) await add(await db.products.get(b.productId), 'barcode', b.unitId);
  for (const p of await db.products.where('sku').equals(raw).toArray()) await add(p, 'sku');
  const norm = normalizePartNumber(raw);
  if (norm.length >= 3) {
    for (const n of await db.numbers.where('normalized').startsWith(norm).limit(30).toArray()) await add(await db.products.get(n.productId), 'number');
    if (out.size < 3) for (const n of await db.numbers.where('skeleton').startsWith(skeleton(norm)).limit(30).toArray()) await add(await db.products.get(n.productId), 'number');
  }
  if (out.size < limit) {
    const tokens = raw.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean).slice(0, 6);
    const hits = await db.products
      .filter((p) => {
        const t = (p.searchText ?? p.name).toLowerCase();
        return tokens.every((x) => t.includes(x));
      })
      .limit(limit)
      .toArray();
    for (const p of hits) await add(p, 'text');
  }
  return [...out.values()];
}
