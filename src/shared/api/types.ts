/** Контракты API backend (autoparts-crm-backend). Суммы приходят строками или числами — выводим через shared/lib/format. */

export type Decimalish = string | number;

// ── Вход ────────────────────────────────────────────────
export interface PublicUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  locale: 'ru' | 'ky';
  totpEnabled: boolean;
  telegramLinked: boolean;
  lastLoginAt: string | null;
}

export interface UserTenant {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  isOwner: boolean;
  onboardingCompleted: boolean;
}

export interface AuthResponse {
  accessToken: string;
  sessionId: string;
  user: PublicUser;
  tenants: UserTenant[];
  currentTenantId: string | null;
}

export interface MeStore {
  id: string;
  name: string;
  code: string;
  timezone: string;
  registerMode: 'single' | 'multi';
  isActive: boolean;
}

export interface Me {
  user: PublicUser;
  tenant: {
    id: string;
    name: string;
    status: string;
    shopType: 'container' | 'city' | 'wholesale' | null;
    language: string;
    subscriptionUntil: string | null;
    onboardingCompleted: boolean;
  } | null;
  membership: {
    id: string;
    isOwner: boolean;
    allStores: boolean;
    storeIds: string[] | null;
    roles: { id: string; name: string; code: string }[];
    permissions: string[];
    maxDiscountPercent: Decimalish | null;
  } | null;
  stores: MeStore[];
}

// ── Дашборд ─────────────────────────────────────────────
export interface DashboardTile {
  key: 'revenue' | 'profit' | 'receipts' | 'avg';
  today: number;
  yesterday: number;
  weekAgo: number;
  vsYesterday: number | null;
  vsWeekAgo: number | null;
}

export interface Dashboard {
  today: string;
  role: 'owner' | 'manager' | 'storekeeper' | 'seller';
  tiles?: DashboardTile[];
  chart?: { x: number | string; revenue: number }[];
  topProducts?: { id: string; name: string; qty: number; revenue: number }[];
  byStore?: { id: string; name: string; revenue: number; receipts: number }[];
  attention: { key: string; title: string; count: number; amount?: number; link: string }[];
  myShift?: { id: string; number: number; openedAt: string; register: string; receipts: number; revenue: number } | null;
  myRequests?: { id: string; number: string; status: string; customer: string; vehicle: string | null; dueAt: string | null }[];
  warehouse?: { draftReceivings: number; incomingTransfers: number; inventorySheets: number };
  money?: { byType: Record<string, number>; totalKgs: number };
  quickActions: { key: string; title: string; link: string }[];
}

// ── Каталог ─────────────────────────────────────────────
export type QualityClass = 'original' | 'oem' | 'aftermarket' | 'copy' | 'used';

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  kind: 'goods' | 'service' | 'kit';
  qualityClass: QualityClass;
  qualityLabel: string;
  status: string;
  noStockControl: boolean;
  isSerial: boolean;
  priceNegotiable: boolean;
  quickCreated: boolean;
  baseUnit: string;
  tags: string[];
  version: number;
  updatedAt: string;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  mainNumber: string | null;
  photoFileId: string | null;
  retailPrice: Decimalish | null;
  retailCurrency: 'KGS' | 'USD' | null;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  level: number;
  sort: number;
  productsCount: number;
  version?: number;
  settings?: { warrantyDays?: number | null; returnDays?: number | null; returnConditions?: string | null; pairHint?: boolean; negativeStock?: 'forbid' | 'warn' | null; noStockControl?: boolean; universal?: boolean };
}

export interface Brand {
  id: string | null;
  globalBrandId?: string | null;
  name: string;
  country?: string | null;
  isCarMaker?: boolean;
  isNoBrand?: boolean;
  aliases?: string[];
  version?: number;
  source: 'tenant' | 'global';
}

export interface ProductCard {
  id: string;
  sku: string;
  name: string;
  kind: 'goods' | 'service' | 'kit';
  qualityClass: QualityClass;
  qualityLabel: string;
  status: string;
  version: number;
  baseUnit: string;
  description: string | null;
  sellerNote: string | null;
  noStockControl: boolean;
  isSerial: boolean;
  priceNegotiable: boolean;
  minPrice: Decimalish | null;
  recommendedPrice: Decimalish | null;
  tags: string[];
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string; path: string } | null;
  partType: { id: string; name: string } | null;
  attributeDefs: { code: string; name: string; unit?: string | null }[];
  mainNumber: string | null;
  numbers: { id: string; type: 'manufacturer' | 'oem' | 'supplier'; number: string; brandName: string | null }[];
  units: { id: string; name: string; factor: Decimalish; isBase: boolean; barcodes: { id: string; barcode: string; isInternal?: boolean }[] }[];
  photos: { id: string; fileId: string; sort: number }[];
  prices: { priceTypeId: string; priceTypeName?: string; storeId: string | null; unitId: string | null; price: Decimalish; currency: string }[];
  applicability: { id: string; title?: string; makeName?: string; modelName?: string | null; generationName?: string | null; precision?: string }[];
  stock: { warehouseId: string; warehouseName?: string; storeId: string | null; qty: Decimalish }[];
  fitWarning: string | null;
  effective: { warrantyDays: number | null; returnDays: number | null; returnConditions: string | null; pairHint: boolean };
}

// ── Поиск ───────────────────────────────────────────────
export interface SearchItem {
  id: string;
  sku: string;
  name: string;
  qualityClass: QualityClass;
  qualityLabel: string;
  brandName: string | null;
  mainNumber: string | null;
  photoFileId: string | null;
  price: Decimalish | null;
  currency: string | null;
  baseUnit: string;
  stockHere: string;
  stockTotal: string;
  availableHere: boolean;
  availableElsewhere: boolean;
  matchKind: string;
  applicabilityUnverified?: boolean;
  analog?: { level: number; throughAnalog: boolean };
}

export interface SearchResult {
  query: string;
  selection: { title?: string | null } | null;
  clarify: { key: string; question: string; options: { value: string; label: string }[] }[];
  groups: {
    here: SearchItem[];
    elsewhere: SearchItem[];
    analogs: SearchItem[];
    noStock: SearchItem[];
    suppliers: { supplierName: string; brand: string | null; number: string; name: string | null; price: Decimalish; currency: string; deliveryDays: number | null }[];
  };
  ladder: { qualityClass: QualityClass; label: string; count: number; minPrice: string | null; stockTotal: string }[];
  total: number;
  actions: string[];
  tookMs: number;
}

// ── Уведомления ─────────────────────────────────────────
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
