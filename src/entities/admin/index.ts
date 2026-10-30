import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ── Магазин и настройки ─────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  legalForm: string | null;
  inn: string | null;
  address: string | null;
  phone: string | null;
  city: string | null;
  requisites: { bank?: string; account?: string; bik?: string; [k: string]: unknown } | null;
  language: 'ru' | 'ky';
  shopType: 'container' | 'city' | 'wholesale' | null;
  status: string;
  subscriptionUntil: string | null;
  onboardingCompletedAt: string | null;
}

export interface ShopSettings {
  negativeStock: 'forbid' | 'warn';
  editOldDocumentsDays: number;
  reserveDays: number;
  periodCloseReminder: boolean;
  writeoffApprovalAmount: number;
  transferStaleDays: number;
  belowCostSale: 'forbid' | 'confirm' | 'allow';
  allowFreeItems: boolean;
  allowQuickCreateAtPos: boolean;
  allowOcr: boolean;
  deleteLineRequiresPin: boolean;
  cashHandover: boolean;
  shiftAutoCloseTime: string | null;
  returnInOtherStore: boolean;
  repeatScanIncrements: boolean;
  selectionIssueDays: number;
  creditBlockOverdueDays: number | null;
  transferMatchWindowMinutes: number;
  quickBanknotes: number[];
  summerMonths: number[];
  autoOrderSalesDays: number;
  autoOrderCoverDays: number;
  priceRounding: 1 | 5 | 10;
  priceTagCurrency: 'KGS' | 'USD' | 'both';
  minPriceCipher: string | null;
  catalogDefaultView: 'groups' | 'makes';
  ourMakes: string[];
  makeTreeDepth: 'make' | 'model' | 'generation' | 'modification';
  defaultStorageLevel: 1 | 2 | 3;
  offlineProductLimit: number;
  eveningSummaryTime: string;
  loyaltyEnabled: boolean;
  bonusAccrualPercent: number;
  bonusMaxPayPercent: number;
  bonusExpireDays: number;
  loyaltyLevels: { name: string; threshold: string; percent: string }[];
  selectionDays: number;
  [k: string]: unknown;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  registerMode?: 'single' | 'multi';
  isActive: boolean;
  version: number;
}
export interface Register {
  id: string;
  storeId: string;
  code: string;
  name: string;
  warehouseId: string;
  isActive: boolean;
  version: number;
}
export interface Device {
  id: string;
  kind: 'agent' | 'pos';
  registerId: string;
  storeId: string;
  name: string;
  agentVersion: string | null;
  info: { printers?: string[]; drawer?: boolean; [k: string]: unknown };
  lastSeenAt: string | null;
  revokedAt: string | null;
  series: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  online: boolean;
}

// ── Сотрудники и роли ───────────────────────────────────

export interface Member {
  id: string;
  userId: string;
  status: 'active' | 'disabled';
  isOwner: boolean;
  allStores: boolean;
  position: string | null;
  joinedAt: string;
  disabledAt: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  lastLoginAt: string | null;
  totpEnabled: boolean;
  roles: { id: string; name: string; code: string | null }[];
  storeIds: string[];
  warehouseIds: string[];
}
export interface Invitation {
  id: string;
  login: string | null;
  name: string | null;
  position: string | null;
  roleIds: string[];
  allStores: boolean;
  storeIds: string[];
  expiresAt: string;
  createdAt: string;
  code?: string;
  link?: string;
}
export interface Role {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isSystem: boolean;
  maxDiscountPercent: number;
  permissions: string[];
  membersCount: number;
  version: number;
}
export interface PermissionGroup {
  group: string;
  permissions: { code: string; label: string }[];
}

// ── Журнал, синонимы, импорт, мастер ────────────────────

export interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  important: boolean;
  storeId: string | null;
  ip: string | null;
  userAgent: string | null;
  userId: string | null;
  userName: string | null;
  supportSessionId: string | null;
}
export interface Synonyms {
  own: { id: string; word: string; target: string; version: number }[];
  global: { word: string; target: string }[];
}
export interface Unfound {
  normalized: string;
  example: string;
  times: number;
  lastAt: string;
  notFound: number;
  noStock: number;
  vehicles: string[];
}

export type ImportType = 'products' | 'crosses' | 'applicability';
export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}
export interface ImportJob {
  id: string;
  type: ImportType;
  status: 'uploaded' | 'previewed' | 'queued' | 'running' | 'done' | 'failed' | 'rolled_back';
  fileName: string;
  columns: string[];
  mapping: Record<string, number>;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors?: { row: number; field?: string; message: string }[];
  failReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
export interface ImportPreview {
  jobId: string;
  checkedRows: number;
  totalRows: number;
  partial: boolean;
  validRows: number;
  errorRows: number;
  errors: { row: number; field?: string; message: string }[];
  wouldUpdate: number | null;
  wouldCreate: number | null;
}
export interface ImportTemplate {
  code: string;
  title: string;
  type: string;
  howTo: string;
  columns: string[];
}
export interface OnboardingState {
  completed: boolean;
  tenant: { name: string; city: string | null; language: string; shopType: string | null };
  shopTypes: { type: 'container' | 'city' | 'wholesale'; name: string; description: string; suggestedRoles: string[] }[];
  makes: { code: string; name: string; country: string | null; popular: number | null }[];
  checklist: { key: string; title: string; done: boolean }[];
}

export const adminApi = {
  tenant: () => d(api.get<Tenant>('/tenant')),
  updateTenant: (b: Partial<Pick<Tenant, 'name' | 'legalForm' | 'inn' | 'address' | 'phone' | 'city' | 'requisites'>>) => d(api.patch<Tenant>('/tenant', b)),
  settings: () => d(api.get<{ version: number; settings: ShopSettings }>('/settings')),
  updateSettings: (version: number, patch: Partial<ShopSettings>) => d(api.patch<{ version: number; settings: ShopSettings }>('/settings', { version, ...patch })),

  stores: (includeInactive = true) => d(api.get<Store[]>('/stores', { params: { includeInactive } })),
  createStore: (b: { name: string; code?: string; address?: string; phone?: string; createDefaults?: boolean }) => d(api.post<Store>('/stores', b)),
  updateStore: (id: string, b: { version: number; name?: string; code?: string; address?: string; phone?: string; isActive?: boolean }) => d(api.patch<Store>(`/stores/${id}`, b)),
  createWarehouse: (b: { storeId?: string; name: string; code?: string; type: string; storageLevel?: number }) => d(api.post('/warehouses', b)),
  updateWarehouse: (id: string, b: { version: number; name?: string; code?: string; isActive?: boolean }) => d(api.patch(`/warehouses/${id}`, b)),
  registers: (storeId?: string) => d(api.get<Register[]>('/registers', { params: { ...(storeId ? { storeId } : {}), includeInactive: true } })),
  createRegister: (b: { storeId: string; name?: string; code?: string; warehouseId?: string }) => d(api.post<Register>('/registers', b)),
  updateRegister: (id: string, b: { version: number; name?: string; warehouseId?: string; isActive?: boolean }) => d(api.patch<Register>(`/registers/${id}`, b)),
  devices: () => d(api.get<Device[]>('/devices')),
  pairingCode: (registerId: string) => d(api.post<{ code: string; expiresInSec: number; register: { id: string; name: string } }>('/devices/pairing-code', { registerId })),
  revokeDevice: (id: string) => api.delete(`/devices/${id}`),
  posDevices: () => d(api.get<Device[]>('/pos-devices')),
  revokePosDevice: (id: string) => api.delete(`/pos-devices/${id}`),
  printJob: (registerId: string, kind: 'drawer' | 'test') => d(api.post('/print-jobs', { registerId, kind })),

  staff: (q: { status?: string; storeId?: string; roleId?: string; page?: number; limit?: number }) => d(api.get<Page<Member>>('/staff', { params: q })),
  member: (id: string) => d(api.get<Member>(`/staff/${id}`)),
  updateMember: (id: string, b: { roleIds?: string[]; allStores?: boolean; storeIds?: string[]; warehouseIds?: string[]; position?: string }) => d(api.patch<Member>(`/staff/${id}`, b)),
  disableMember: (id: string) => d(api.post(`/staff/${id}/disable`, {})),
  enableMember: (id: string) => d(api.post(`/staff/${id}/enable`, {})),
  resetPassword: (id: string) => d(api.post<{ temporaryPassword: string }>(`/staff/${id}/reset-password`, {})),
  invitations: () => d(api.get<Invitation[]>('/staff/invitations')),
  invite: (b: { login?: string; name?: string; roleIds: string[]; allStores?: boolean; storeIds?: string[]; position?: string; expiresInDays?: number }) => d(api.post<Invitation>('/staff/invitations', b)),
  cancelInvitation: (id: string) => api.delete(`/staff/invitations/${id}`),
  roles: () => d(api.get<Role[]>('/roles')),
  permissions: () => d(api.get<PermissionGroup[]>('/roles/permissions')),
  createRole: (b: { name: string; description?: string; permissions: string[]; maxDiscountPercent?: number }) => d(api.post<Role>('/roles', b)),
  updateRole: (id: string, b: { version: number; name?: string; description?: string; permissions?: string[]; maxDiscountPercent?: number }) => d(api.patch<Role>(`/roles/${id}`, b)),
  removeRole: (id: string) => api.delete(`/roles/${id}`),

  audit: (q: { action?: string; userId?: string; important?: boolean; from?: string; to?: string; page?: number; limit?: number }) => d(api.get<Page<AuditRow>>('/audit', { params: q })),
  synonyms: () => d(api.get<Synonyms>('/search/synonyms')),
  addSynonym: (word: string, target: string) => d(api.post('/search/synonyms', { word, target })),
  removeSynonym: (id: string) => api.delete(`/search/synonyms/${id}`),
  unfound: (q: { from?: string; to?: string } = {}) => d(api.get<Unfound[]>('/search/unfound', { params: q })),

  imports: () => d(api.get<ImportJob[]>('/imports')),
  importTemplates: () => d(api.get<ImportTemplate[]>('/imports/templates')),
  createImport: (type: ImportType, fileId: string, headerRow?: number) =>
    d(api.post<{ job: ImportJob; columns: string[]; sample: string[][]; suggestedMapping: Record<string, number>; fields: ImportField[] }>('/imports', { type, fileId, ...(headerRow ? { headerRow } : {}) })),
  previewImport: (id: string, mapping: Record<string, number>, options: { updateExisting?: boolean; createCategories?: boolean; headerRow?: number }) => d(api.post<ImportPreview>(`/imports/${id}/preview`, { mapping, options })),
  runImport: (id: string) => d(api.post<ImportJob>(`/imports/${id}/run`, {})),
  importJob: (id: string) => d(api.get<ImportJob>(`/imports/${id}`)),
  rollbackImport: (id: string) => d(api.post<{ removedProducts: number; removedCrosses: number; notReverted: string | null }>(`/imports/${id}/rollback`, {})),
  exportFull: () => api.get<Blob>('/export/full', { responseType: 'blob' }).then((r) => r.data),

  onboarding: () => d(api.get<OnboardingState>('/onboarding')),
  checklist: () => d(api.get<OnboardingState['checklist']>('/onboarding/checklist')),
  completeOnboarding: (b: { shopName?: string; city?: string; shopType: string; ourMakes?: string[]; storeName?: string; storeCode?: string; storeAddress?: string; shopRateUsd?: string; wallets?: { provider: string; holderName: string; phone: string }[] }) =>
    d(api.post<{ ok: true; checklist: OnboardingState['checklist'] }>('/onboarding/complete', b)),
};

export const useTenant = () => useQuery({ queryKey: ['tenant'], queryFn: adminApi.tenant });
export const useShopSettings = () => useQuery({ queryKey: ['shop-settings'], queryFn: adminApi.settings });
export const useStores = () => useQuery({ queryKey: ['stores'], queryFn: () => adminApi.stores() });
export const useRegistersAll = () => useQuery({ queryKey: ['registers-all'], queryFn: () => adminApi.registers() });
export const useDevices = () => useQuery({ queryKey: ['devices'], queryFn: adminApi.devices, refetchInterval: 30_000 });
export const usePosDevices = () => useQuery({ queryKey: ['pos-devices-list'], queryFn: adminApi.posDevices });
export const useStaff = (q: Parameters<typeof adminApi.staff>[0]) => useQuery({ queryKey: ['staff', q], queryFn: () => adminApi.staff(q), placeholderData: keepPreviousData });
export const useInvitations = () => useQuery({ queryKey: ['invitations'], queryFn: adminApi.invitations });
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: adminApi.roles });
export const usePermissionCatalog = () => useQuery({ queryKey: ['permission-catalog'], queryFn: adminApi.permissions, staleTime: Infinity });
export const useAudit = (q: Parameters<typeof adminApi.audit>[0]) => useQuery({ queryKey: ['audit', q], queryFn: () => adminApi.audit(q), placeholderData: keepPreviousData });
export const useSynonyms = () => useQuery({ queryKey: ['synonyms'], queryFn: adminApi.synonyms });
export const useUnfound = () => useQuery({ queryKey: ['unfound'], queryFn: () => adminApi.unfound() });
export const useImports = () => useQuery({ queryKey: ['imports'], queryFn: adminApi.imports, refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'running' || j.status === 'queued') ? 2500 : false) });
export const useImportTemplates = () => useQuery({ queryKey: ['import-templates'], queryFn: adminApi.importTemplates, staleTime: Infinity });
export const useOnboarding = () => useQuery({ queryKey: ['onboarding'], queryFn: adminApi.onboarding });
