import Dexie, { type Table } from 'dexie';
import type { CacheMeta, CAccount, CBarcode, CCustomer, CNumber, CPrice, CProduct, CReceipt, CStaff, CStock, DeviceCredentials, LocalReceipt, QueuedOp } from './types';

/**
 * IndexedDB кассы (ТЗ 16.3): кэш товаров, цен, клиентов, сотрудников и очередь неотправленных операций.
 * Одна база на магазин (имя содержит tenantId), чтобы касса двух магазинов на одном ПК не смешивалась.
 */
export class PosDb extends Dexie {
  kv!: Table<{ key: string; value: unknown }, string>;
  products!: Table<CProduct, string>;
  barcodes!: Table<CBarcode, [string, string]>;
  numbers!: Table<CNumber & { key: string }, string>;
  prices!: Table<CPrice & { key: string }, string>;
  stock!: Table<CStock & { key: string }, string>;
  customers!: Table<CCustomer, string>;
  staff!: Table<CStaff, string>;
  accounts!: Table<CAccount, string>;
  receipts!: Table<CReceipt, string>;
  ops!: Table<QueuedOp, number>;
  local!: Table<LocalReceipt, string>;

  constructor(tenantId: string) {
    super(`ap-pos-${tenantId}`);
    this.version(1).stores({
      kv: 'key',
      products: 'id, sku',
      barcodes: '[barcode+productId], barcode, productId',
      numbers: 'key, normalized, skeleton, productId',
      prices: 'key, productId',
      stock: 'key, productId',
      customers: 'id, phone, name',
      staff: 'membershipId',
      accounts: 'id, type',
      receipts: 'id, number, completedAt',
      ops: 'seq, id, status',
      local: 'id, number, createdAt',
    });
  }
}

const dbs = new Map<string, PosDb>();
export const posDb = (tenantId: string) => {
  let d = dbs.get(tenantId);
  if (!d) {
    d = new PosDb(tenantId);
    dbs.set(tenantId, d);
  }
  return d;
};

export async function kvGet<T>(db: PosDb, key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export const kvSet = (db: PosDb, key: string, value: unknown) => db.kv.put({ key, value });

export const KV = {
  device: 'device',
  meta: 'meta',
  shift: 'shift',
  seller: 'seller',
  counter: 'counter',
} as const;

export type { CacheMeta, DeviceCredentials };
