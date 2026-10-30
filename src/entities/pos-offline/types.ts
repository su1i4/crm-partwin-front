/** Данные кэша кассы — как отдаёт GET /pos-device/cache (backend offline-cache.service.ts) */

export interface DeviceCredentials {
  deviceId: string;
  token: string;
  secret: string;
  series: string;
  numberPrefix: string;
  tenantId: string;
  register: { id: string; code: string; name: string; storeId: string; warehouseId: string };
  registeredAt: string;
}

export interface OfflineRules {
  cash: boolean;
  card: boolean;
  transfer: boolean;
  debt: boolean;
  bonuses: boolean;
  serial: boolean;
  reserved: boolean;
  returnOwnRegister: boolean;
  returnOtherRegisterOrWithoutReceipt: boolean;
  neighbor: boolean;
  createProduct: 'draft' | 'free_item_only';
  newCustomer: boolean;
  shift: boolean;
  ocr: boolean;
}

export interface CacheMeta {
  cursor: string;
  fullAt: string;
  deltaAt: string;
  device: { id: string; series: string; numberPrefix: string; lastNumber: string | null; lastOpSeq: string };
  store: { id: string; name: string; code: string; timezone: string; registerMode: 'single' | 'multi'; address: string | null; phone: string | null };
  register: { id: string; code: string; name: string; warehouseId: string };
  offlineRules: OfflineRules;
  settings: { priceRounding?: number; negativeStock?: string; allowFreeItems?: boolean; repeatScanIncrements?: boolean; quickBanknotes?: number[]; [k: string]: unknown };
  rates: { currency: string; rate: string }[];
  priceTypes: { id: string; name: string; code: string; currency: string; isRetail: boolean }[];
  productIds?: string[];
}

export interface CProduct {
  id: string;
  name: string;
  sku: string;
  kind: string;
  brandName: string | null;
  categoryId: string | null;
  qualityClass: string;
  baseUnit: string;
  isSerial: boolean;
  noStockControl: boolean;
  priceNegotiable: boolean;
  minPrice: string | null;
  searchText: string | null;
  units: { id: string; name: string; factor: string; isBase: boolean; priceMode: 'computed' | 'own' }[] | null;
}
export interface CBarcode { productId: string; unitId: string; barcode: string }
export interface CNumber { productId: string; number: string; normalized: string; skeleton: string; type: string }
export interface CPrice { productId: string; priceTypeId: string; storeId: string | null; unitId: string | null; price: string; currency: string; validFrom: string }
export interface CStock { warehouseId: string; productId: string; qty: string }
export interface CCustomer { id: string; name: string; phone: string | null; phones?: string[]; groupId: string | null; priceTypeId: string | null; discountPercent: string | null; debtLimit: string | null; roles: string[]; debt?: string }
export interface CStaff { membershipId: string; name: string; isOwner: boolean; active: boolean; pinHash: string | null; permissions: string[]; maxDiscountPercent: number }
export interface CAccount { id: string; type: string; name: string; currency: string; registerId: string | null; holderMembershipId: string | null }
export interface CReceipt {
  id: string;
  number: string;
  kind: 'sale' | 'return';
  registerId: string;
  customerId: string | null;
  total: string;
  completedAt: string;
  lines: { id: string; productId: string; unitId: string; qty: string; price: string; amount: string; name: string }[] | null;
  payments: { method: string; currency: string; amount: string; amountKgs: string; accountId: string | null }[] | null;
}

export interface CacheResponse extends Omit<CacheMeta, 'cursor' | 'fullAt' | 'deltaAt'> {
  full: boolean;
  serverTime: string;
  cursor: string;
  products: CProduct[];
  removed: { products: string[] };
  barcodes: CBarcode[];
  numbers: CNumber[];
  crosses: { a: string; b: string; crossType: string }[];
  prices: CPrice[];
  stock: CStock[];
  customers: CCustomer[];
  staff: CStaff[];
  accounts: CAccount[];
  receipts: CReceipt[];
  categories: { id: string; parentId: string | null; name: string }[];
}

export type OpType = 'shift_open' | 'sale' | 'return' | 'cash_op' | 'shift_close' | 'customer' | 'product_draft';

export interface QueuedOp {
  seq: number;
  id: string;
  type: OpType;
  at: string;
  membershipId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  error?: string | null;
  result?: Record<string, unknown> | null;
  /** Что показать в списке очереди */
  title: string;
}

/** Чек, проданный без сети — для печати и истории на устройстве */
export interface LocalReceipt {
  id: string;
  number: string;
  createdAt: string;
  total: string;
  change: string;
  changeCurrency: string;
  debt: string;
  sellerName: string;
  customerName: string | null;
  vehicleLabel: string | null;
  lines: { name: string; qty: string; unit: string; price: string; discount: string; amount: string }[];
  payments: { method: string; account: string | null; currency: string; amount: string }[];
  subtotal: string;
  discount: string;
  rate: string | null;
}
