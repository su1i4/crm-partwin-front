import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page } from '@/shared/api';

export interface StockRow {
  productId: string;
  name: string;
  sku: string;
  baseUnit: string;
  brandName: string | null;
  mainNumber: string | null;
  qty: string;
  reserved: string;
  available: string;
  inTransit: string;
  expected: string;
  amount: string | null;
  unitCost: string | null;
  warehouses: { warehouseId: string; qty: string; place: string | null }[];
}

export interface Movement {
  id: string;
  movedAt: string;
  kind: string;
  qty: string;
  costAmount: string | null;
  warehouseId: string;
  warehouseName: string;
  documentId: string;
  number: string;
  type: string;
  balance: string;
}

export interface InventoryRow {
  productId: string;
  name: string;
  sku: string;
  baseUnit: string;
  isSerial: boolean;
  place: string | null;
  counted: string;
  countedAt: string | null;
  book: string;
  diff: string;
}

export interface InventoryView {
  id: string;
  number: string;
  status: string;
  docDate: string;
  warehouseId: string;
  comment: string | null;
  version: number;
  extra: Record<string, unknown>;
  sheets: { id: string; name: string; assignedTo: string | null; status: 'open' | 'done' }[];
  rows: InventoryRow[];
  lateMovements: { id: string; productId: string; name: string; qty: string; movedAt: string; receivedAt: string; number: string }[];
  summary: { products: number; counted: number; surplus: number; shortage: number };
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const stockApi = {
  balances: (q: { warehouseId?: string; storeId?: string; categoryId?: string; q?: string; page?: number; limit?: number; onlyNegative?: boolean; onlyPositive?: boolean }) =>
    d(api.get<Page<StockRow> & { costRecalcPending: boolean }>('/stock', { params: q })),
  movements: (productId: string, q: { warehouseId?: string; page?: number; limit?: number } = {}) => d(api.get<Movement[]>(`/products/${productId}/movements`, { params: { limit: 200, ...q } })),
  setPlace: (warehouseId: string, productIds: string[], place: string | null) => d(api.put('/stock/places', { warehouseId, productIds, place })),
  suggestPlaces: (warehouseId: string, q?: string) => d(api.get<{ place: string; products: number }[]>('/stock/places/suggest', { params: { warehouseId, q } })),
  withoutPlace: (warehouseId: string) => d(api.get<{ id: string; name: string; sku: string; qty: string }[]>(`/storage/warehouses/${warehouseId}/without-place`)),
  productLabels: (items: { productId: string; copies: number; warehouseId?: string }[], w = 58, h = 40) =>
    api.post<Blob>('/products/labels.pdf', { items, w, h }, { responseType: 'blob' }).then((r) => r.data),

  createInventory: (b: { warehouseId: string; categoryId?: string; brandId?: string; place?: string; productIds?: string[]; comment?: string; sheetName?: string }) =>
    d(api.post<InventoryView>('/inventories', b)),
  inventory: (id: string) => d(api.get<InventoryView>(`/inventories/${id}`)),
  addSheet: (id: string, name: string) => d(api.post(`/inventories/${id}/sheets`, { name })),
  count: (id: string, b: { sheetId: string; productId?: string; barcode?: string; qty: string; mode?: 'add' | 'set'; scannedAt?: string; place?: string }) =>
    d(api.post<{ productId: string; name: string; counted: string; duplicate?: boolean }>(`/inventories/${id}/counts`, b)),
  finish: (id: string, version: number, uncountedAsZero = true) => d(api.post(`/inventories/${id}/finish`, { version, uncountedAsZero })),
};

export const useStock = (q: Parameters<typeof stockApi.balances>[0]) =>
  useQuery({ queryKey: ['stock', q], queryFn: () => stockApi.balances(q), placeholderData: keepPreviousData });
export const useMovements = (productId?: string) => useQuery({ queryKey: ['movements', productId], queryFn: () => stockApi.movements(productId!), enabled: !!productId });
export const useInventory = (id?: string) => useQuery({ queryKey: ['inventory', id], queryFn: () => stockApi.inventory(id!), enabled: !!id });

/** Открыть PDF (этикетки, ценники) в новой вкладке для печати */
export function openPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labels.pdf';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
