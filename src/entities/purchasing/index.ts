import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Decimalish, type Page } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ── Поставщики (контрагенты с ролью supplier / neighbor) ──

export interface SupplierListItem {
  id: string;
  name: string;
  kind: 'person' | 'company';
  phone: string | null;
  inn: string | null;
  roles: string[];
  tags: string[];
  version: number;
}

export interface SupplierTerms {
  currency?: string;
  paymentDelayDays?: number;
  leadTimeDays?: number;
  minOrder?: string;
  [k: string]: unknown;
}

export interface SupplierCard extends SupplierListItem {
  phones: string[];
  address: string | null;
  note: string | null;
  messengers: { whatsapp?: string; telegram?: string; [k: string]: string | undefined };
  supplierTerms: SupplierTerms;
  debts: { direction: 'receivable' | 'payable'; currency: string; amount: string; overdue: string | null }[];
  contacts: { id: string; name: string; position: string | null; phone: string | null; note: string | null }[];
}

export interface SupplierInput {
  name?: string;
  kind?: 'person' | 'company';
  phone?: string | null;
  inn?: string | null;
  address?: string | null;
  roles?: string[];
  messengers?: Record<string, string>;
  supplierTerms?: SupplierTerms;
  note?: string | null;
  confirmDuplicatePhone?: boolean;
}

// ── Прайсы ──────────────────────────────────────────────

export type PriceListStatus = 'empty' | 'loading' | 'ready' | 'failed';
export interface PriceList {
  id: string;
  name: string;
  supplierId: string;
  supplierName: string;
  currency: string;
  url: string | null;
  schedule: 'hourly' | 'every_6h' | 'daily' | null;
  status: PriceListStatus;
  rowsCount: number;
  loadedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  defaultLeadDays: number | null;
  version: number;
}
export interface PriceListLoad {
  id: string;
  source: 'file' | 'url';
  status: 'queued' | 'running' | 'done' | 'failed';
  rows: number;
  added: number;
  updated: number;
  removed: number;
  priceChanges: number;
  skipped: number;
  crossesAdded: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}
export interface PriceListView extends PriceList {
  headerRow: number;
  mapping: Record<string, number>;
  loads: PriceListLoad[];
}
export interface PriceListField {
  key: string;
  label: string;
  required?: boolean;
}
export interface PriceListPreview {
  columns: string[];
  sample: string[][];
  totalRows: number;
  mapping: Record<string, number>;
  mappingSource: 'saved' | 'guessed';
  fields: PriceListField[];
}
export interface PriceRow {
  id: string;
  number: string;
  brand: string | null;
  name: string | null;
  price?: string | null;
  currency: string;
  stockText: string | null;
  leadDays: number | null;
  multiplicity: string | null;
  oem: string | null;
  applicability: string | null;
  productId: string | null;
  updatedAt: string;
}
export interface PriceOffer {
  id: string;
  priceListId: string;
  priceListName: string;
  supplierId: string;
  supplierName: string;
  number: string;
  brand: string | null;
  name: string | null;
  price?: string | null;
  priceKgs?: string | null;
  currency: string;
  stockText: string | null;
  stockQty: string | null;
  leadDays: number | null;
  multiplicity: string | null;
  productId: string | null;
  updatedAt: string | null;
  analog: { via: string } | null;
}
export interface PriceListInput {
  supplierId?: string;
  name?: string;
  currency?: string;
  url?: string | null;
  schedule?: string | null;
  defaultLeadDays?: number | null;
  headerRow?: number;
  isActive?: boolean;
}

// ── Заказы поставщикам ──────────────────────────────────

export type OrderStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'closed' | 'cancelled';
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'soft' | 'dark' | 'ok' | 'warn' | 'muted' | 'accent-outline' }> = {
  draft: { label: 'Черновик', tone: 'soft' },
  sent: { label: 'Отправлен', tone: 'dark' },
  confirmed: { label: 'Подтверждён', tone: 'accent-outline' },
  partially_received: { label: 'Частично принят', tone: 'warn' },
  received: { label: 'Принят', tone: 'ok' },
  closed: { label: 'Закрыт', tone: 'muted' },
  cancelled: { label: 'Отменён', tone: 'muted' },
};
export interface OrderListItem {
  id: string;
  number: string;
  status: OrderStatus;
  source: 'manual' | 'auto' | 'request';
  supplierId: string;
  supplierName: string;
  storeId: string;
  currency: string;
  totalAmount: Decimalish;
  expectedAt: string | null;
  createdAt: string;
  version: number;
  overdue: boolean;
  linesCount: number;
}
export interface OrderLine {
  id: string;
  lineNo: number;
  productId: string;
  productName: string;
  sku: string;
  brand: string | null;
  number: string | null;
  supplierCode: string | null;
  unitId: string;
  unitName: string;
  factor: Decimalish;
  qty: Decimalish;
  price: Decimalish | null;
  amount: Decimalish | null;
  receivedQty: Decimalish;
  leftQty: Decimalish;
  requestItemId: string | null;
  note: string | null;
  extra: { autoOrder?: Record<string, string | number | null>; [k: string]: unknown };
}
export interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  statusLabel: string;
  source: string;
  supplierId: string;
  storeId: string;
  warehouseId: string | null;
  currency: string;
  totalAmount: Decimalish;
  expectedAt: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  closedAt: string | null;
  comment: string | null;
  version: number;
  createdAt: string;
  history: { at: string; status: string; by: string | null; note?: string }[];
  supplier: { id: string; name: string; phone: string | null; messengers: Record<string, string> | null } | null;
  lines: OrderLine[];
  receivings: { id: string; number: string; status: string; docDate: string; totalAmount: Decimalish | null; priceDiffs: { productId: string; orderPrice: string; price: string }[] | null }[];
}
export interface OrderInput {
  supplierId?: string;
  storeId?: string;
  warehouseId?: string | null;
  currency?: string;
  expectedAt?: string | null;
  comment?: string | null;
  lines?: { productId: string; unitId?: string; qty: string; price?: string | null; note?: string | null }[];
}

// ── Автозаказ ───────────────────────────────────────────

export interface AutoLine {
  productId: string;
  name: string;
  number: string | null;
  sku: string;
  unitId: string;
  supplierId: string | null;
  supplierName: string | null;
  qty: string;
  price: string | null;
  currency: string;
  explain: {
    stock: string;
    expected: string;
    salesLastDays: string;
    salesLastYear: string;
    dailyDemand: string;
    min: string | null;
    max: string | null;
    season: 'summer' | 'winter' | null;
    leadDays: number;
    reorderPoint: string;
    target: string;
    multiplicity: string;
    minQty: string;
  };
}
export interface AutoPreview {
  storeId: string;
  season: 'summer' | 'winter';
  days: number;
  coverDays: number;
  lines: AutoLine[];
  groups: { supplierId: string | null; supplierName: string; lines: AutoLine[]; total: string }[];
}

// ── Контейнеры ──────────────────────────────────────────

export type ContainerStatus = 'draft' | 'paid' | 'in_transit' | 'customs' | 'received';
export const CONTAINER_STATUS: Record<ContainerStatus, string> = { draft: 'Черновик', paid: 'Оплачен', in_transit: 'В пути', customs: 'Таможня', received: 'Принят' };
export const CONTAINER_FLOW: ContainerStatus[] = ['draft', 'paid', 'in_transit', 'customs', 'received'];
export interface ContainerListItem {
  id: string;
  number: string;
  status: ContainerStatus;
  currency: string;
  expectedOn: string | null;
  supplier: string;
  total: Decimalish;
}
/** Строки контейнера приходят из SQL как есть (snake_case) */
export interface ContainerLine {
  id: string;
  line_no: number;
  invoice_code: string | null;
  invoice_name: string | null;
  product_id: string | null;
  productName: string | null;
  qty: string;
  price: string;
  volume: string | null;
  weight: string | null;
  manual_cost: string | null;
  received_qty: string;
  damaged_qty: string;
}
export interface ContainerView {
  id: string;
  number: string;
  supplierId: string;
  storeId: string;
  warehouseId: string;
  currency: string;
  rate: string | null;
  status: ContainerStatus;
  prepayments: { at?: string; amount: string; accountId?: string; comment?: string }[];
  costs: { name: string; amount: string; currency: string }[];
  distribution: 'volume' | 'weight' | 'amount' | 'manual';
  expectedOn: string | null;
  receivingDocumentIds: string[];
  history: { at: string; status: string; by: string | null }[];
  comment: string | null;
  version: number;
  lines: ContainerLine[];
  total: string;
  prepaid: string;
  unmatched: number;
}

// ── Доноры ──────────────────────────────────────────────

export interface Donor {
  id: string;
  number: string;
  title: string;
  warehouseId: string;
  year: number | null;
  vin: string | null;
  bodyCode: string | null;
  engine: string | null;
  transmission: string | null;
  purchasePrice: string;
  deliveryCost: string;
  customsCost: string;
  otherCost: string;
  expectedTotal: string;
  distributed: string;
  documentIds: string[];
  status: 'open' | 'closed';
  createdAt: string;
  version: number;
  totalCost: string;
  undistributed: string;
  sold: string;
  inStockCost: string;
  payback: string | null;
}

// ── Поставщики товара и запас ───────────────────────────

export interface ProductSupplier {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string | null;
  multiplicity: string;
  minQty: string;
  leadDays: number | null;
  preferred: boolean;
  lastPrice: string | null;
  lastCurrency: string | null;
  lastPurchaseAt: string | null;
}
export interface StockRule {
  id?: string;
  storeId: string | null;
  minQty: string | null;
  maxQty: string | null;
  summerMin: string | null;
  summerMax: string | null;
  winterMin: string | null;
  winterMax: string | null;
  supplierId: string | null;
}
export interface PurchaseHistoryRow {
  documentId: string;
  number: string;
  date: string;
  supplier: string | null;
  price: string | null;
  currency: string;
  unitCostKgs: string | null;
  orderPrice: string | null;
  qty: string;
}

export const purchasingApi = {
  suppliers: (q: { q?: string; role?: string; page?: number; limit?: number }) => d(api.get<Page<SupplierListItem>>('/counterparties', { params: { role: 'supplier', limit: 50, ...q } })),
  supplierCard: (id: string) => d(api.get<SupplierCard>(`/counterparties/${id}/card`)),
  createSupplier: (b: SupplierInput) => d(api.post<SupplierCard>('/counterparties', b)),
  updateSupplier: (id: string, b: SupplierInput & { version: number }) => d(api.patch<SupplierCard>(`/counterparties/${id}`, b)),

  priceLists: (supplierId?: string) => d(api.get<PriceList[]>('/price-lists', { params: supplierId ? { supplierId } : {} })),
  priceList: (id: string) => d(api.get<PriceListView>(`/price-lists/${id}`)),
  createPriceList: (b: PriceListInput) => d(api.post<PriceListView>('/price-lists', b)),
  updatePriceList: (id: string, b: PriceListInput & { version: number }) => d(api.patch<PriceListView>(`/price-lists/${id}`, b)),
  removePriceList: (id: string, version: number) => api.delete(`/price-lists/${id}`, { params: { version } }),
  previewPriceList: (id: string, fileId: string, headerRow?: number) => d(api.post<PriceListPreview>(`/price-lists/${id}/preview`, { fileId, ...(headerRow ? { headerRow } : {}) })),
  loadPriceList: (id: string, b: { fileId?: string; mapping?: Record<string, number>; headerRow?: number }) => d(api.post<PriceListLoad>(`/price-lists/${id}/load`, b)),
  priceRows: (id: string, q: { q?: string; page?: number; limit?: number }) => d(api.get<Page<PriceRow>>(`/price-lists/${id}/rows`, { params: q })),
  rowHistory: (rowId: string) => d(api.get<{ oldPrice: string | null; newPrice: string | null; currency: string; at: string }[]>(`/price-list-rows/${rowId}/history`)),
  rowCreateProduct: (rowId: string, b: { name?: string; categoryId?: string; retailPrice?: string }) => d(api.post<{ id: string }>(`/price-list-rows/${rowId}/create-product`, b)),
  searchOffers: (q: string) => d(api.get<PriceOffer[]>('/price-lists/search', { params: { q } })),

  orders: (q: { status?: string; supplierId?: string; storeId?: string; page?: number; limit?: number }) => d(api.get<Page<OrderListItem>>('/purchase-orders', { params: q })),
  order: (id: string) => d(api.get<OrderView>(`/purchase-orders/${id}`)),
  createOrder: (b: OrderInput) => d(api.post<OrderView>('/purchase-orders', b)),
  updateOrder: (id: string, b: OrderInput & { version: number }) => d(api.patch<OrderView>(`/purchase-orders/${id}`, b)),
  orderStatus: (id: string, version: number, status: 'sent' | 'confirmed' | 'closed' | 'cancelled', note?: string) =>
    d(api.post<OrderView>(`/purchase-orders/${id}/status`, { version, status, ...(note ? { note } : {}) })),
  orderReceiving: (id: string, warehouseId?: string) => d(api.post<{ id: string }>(`/purchase-orders/${id}/receiving`, warehouseId ? { warehouseId } : {})),
  orderMessage: (id: string) => d(api.get<{ text: string; whatsappUrl: string; telegramUrl: string }>(`/purchase-orders/${id}/message`)),
  orderPdf: (id: string) => api.get<Blob>(`/purchase-orders/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  orderXlsx: (id: string) => api.get<Blob>(`/purchase-orders/${id}/xlsx`, { responseType: 'blob' }).then((r) => r.data),

  autoPreview: (b: { storeId?: string; supplierId?: string; categoryId?: string; days?: number; coverDays?: number; includeWithoutRules?: boolean }) => d(api.post<AutoPreview>('/auto-order/preview', b)),
  autoCreate: (b: { storeId?: string; warehouseId?: string; lines: { productId: string; supplierId: string; qty: string; price?: string | null; unitId?: string; currency?: string; explain?: Record<string, unknown> }[] }) =>
    d(api.post<OrderView[]>('/auto-order/create', b)),

  productSuppliers: (id: string) => d(api.get<ProductSupplier[]>(`/products/${id}/suppliers`)),
  setProductSuppliers: (id: string, items: { supplierId: string; supplierCode?: string | null; multiplicity?: string; minQty?: string; leadDays?: number | null; preferred?: boolean }[]) =>
    d(api.put(`/products/${id}/suppliers`, { items })),
  stockRules: (id: string) => d(api.get<StockRule[]>(`/products/${id}/stock-rules`)),
  setStockRules: (id: string, rules: Omit<StockRule, 'id'>[]) => d(api.put(`/products/${id}/stock-rules`, { rules })),
  purchaseHistory: (id: string) => d(api.get<PurchaseHistoryRow[]>(`/products/${id}/purchase-history`)),

  containers: (status?: string) => d(api.get<ContainerListItem[]>('/containers', { params: status ? { status } : {} })),
  container: (id: string) => d(api.get<ContainerView>(`/containers/${id}`)),
  createContainer: (b: { supplierId: string; warehouseId: string; currency?: string; rate?: string; expectedOn?: string; distribution?: string; comment?: string }) => d(api.post<ContainerView>('/containers', b)),
  updateContainer: (id: string, b: { version: number; rate?: string; expectedOn?: string; distribution?: string; costs?: { name: string; amount: string; currency: string }[]; comment?: string }) =>
    d(api.patch<ContainerView>(`/containers/${id}`, b)),
  containerInvoice: (id: string, b: { fileId: string; columns: { code?: number; name?: number; qty: number; price: number; volume?: number; weight?: number }; skipRows?: number }) =>
    d(api.post<{ lines: number; matchedByMemory: number; matchedByNumber: number; unmatched: number }>(`/containers/${id}/invoice`, b)),
  containerMatch: (id: string, lineId: string, productId: string) => d(api.post(`/containers/${id}/lines/${lineId}/match`, { productId })),
  containerCreateProducts: (id: string, categoryId?: string) => d(api.post<{ created: number }>(`/containers/${id}/create-products`, categoryId ? { categoryId } : {})),
  containerStatus: (id: string, status: 'paid' | 'in_transit' | 'customs') => d(api.post(`/containers/${id}/status`, { status })),
  containerReceive: (id: string, b: { lines?: { lineId: string; qty: string; damaged?: string }[]; post?: boolean }) => d(api.post<{ documentId: string; damaged: { lineNo: number; productId: string; qty: string }[] }>(`/containers/${id}/receive`, b)),

  donors: () => d(api.get<Donor[]>('/donors')),
  donor: (id: string) => d(api.get<Donor>(`/donors/${id}`)),
  createDonor: (b: { warehouseId: string; title: string; year?: number; vin?: string; bodyCode?: string; engine?: string; transmission?: string; purchasePrice?: string; deliveryCost?: string; customsCost?: string; otherCost?: string; expectedTotal?: string; counterpartyId?: string }) =>
    d(api.post<Donor>('/donors', b)),
  donorParts: (id: string, b: { lines: { productId: string; qty: string; expectedPrice?: string; cost?: string }[]; close?: boolean }) => d(api.post<{ donor: Donor; documentId: string }>(`/donors/${id}/parts`, b)),
};

export const useSuppliers = (q: string, role: 'supplier' | 'neighbor' = 'supplier') =>
  useQuery({ queryKey: ['suppliers', q, role], queryFn: () => purchasingApi.suppliers({ q: q || undefined, role }), placeholderData: keepPreviousData });
export const useSupplierCard = (id?: string | null) => useQuery({ queryKey: ['supplier', id], queryFn: () => purchasingApi.supplierCard(id!), enabled: !!id });
export const usePriceLists = (supplierId?: string) =>
  useQuery({ queryKey: ['price-lists', supplierId ?? null], queryFn: () => purchasingApi.priceLists(supplierId), refetchInterval: (q) => (q.state.data?.some((l) => l.status === 'loading') ? 3000 : false) });
export const usePriceList = (id?: string) =>
  useQuery({ queryKey: ['price-list', id], queryFn: () => purchasingApi.priceList(id!), enabled: !!id, refetchInterval: (q) => (q.state.data?.status === 'loading' ? 2500 : false) });
export const usePriceRows = (id: string | undefined, q: { q?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: ['price-rows', id, q], queryFn: () => purchasingApi.priceRows(id!, q), enabled: !!id, placeholderData: keepPreviousData });
export const useOffers = (q: string) => useQuery({ queryKey: ['offers', q], queryFn: () => purchasingApi.searchOffers(q), enabled: q.trim().length >= 3 });
export const useOrders = (q: { status?: string; supplierId?: string; storeId?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: ['purchase-orders', q], queryFn: () => purchasingApi.orders(q), placeholderData: keepPreviousData });
export const useOrder = (id?: string | null) => useQuery({ queryKey: ['purchase-order', id], queryFn: () => purchasingApi.order(id!), enabled: !!id });
export const useContainers = (status?: string) => useQuery({ queryKey: ['containers', status ?? null], queryFn: () => purchasingApi.containers(status) });
export const useContainer = (id?: string) => useQuery({ queryKey: ['container', id], queryFn: () => purchasingApi.container(id!), enabled: !!id });
export const useDonors = () => useQuery({ queryKey: ['donors'], queryFn: purchasingApi.donors });
export const useDonor = (id?: string) => useQuery({ queryKey: ['donor', id], queryFn: () => purchasingApi.donor(id!), enabled: !!id });

/** Скачать blob файлом (Excel заказа и т.п.) */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
