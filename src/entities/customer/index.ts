import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Decimalish, type Page } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const ROLE_LABEL: Record<string, string> = { customer: 'Клиент', sto: 'СТО', master: 'Мастер', supplier: 'Поставщик', neighbor: 'Сосед', consignee: 'Реализатор' };

export interface CustomerListItem {
  id: string;
  name: string;
  kind: 'person' | 'company';
  phone: string | null;
  inn: string | null;
  roles: string[];
  tags: string[];
  groupId: string | null;
  groupName: string | null;
  version: number;
  lastVisit: string | null;
  purchasesTotal: Decimalish | null;
  debtKgs: Decimalish | null;
}

export interface Vehicle {
  id: string;
  title: string;
  vin: string | null;
  bodyCode: string | null;
  year: number | null;
  plate: string | null;
  mileage: number | null;
  note: string | null;
  makeId: string | null;
  modelId: string | null;
  version: number;
}

export interface CustomerCard {
  id: string;
  name: string;
  kind: 'person' | 'company';
  phone: string | null;
  phones: string[];
  inn: string | null;
  address: string | null;
  roles: string[];
  tags: string[];
  note: string | null;
  birthday: string | null;
  groupId: string | null;
  priceTypeId: string | null;
  discountPercent: string | null;
  debtLimit: string | null;
  debtDays: number | null;
  messengers: Record<string, string>;
  version: number;
  createdAt: string;
  group: { id: string; name: string } | null;
  terms: { priceTypeId: string | null; discountPercent: string; debtLimit: string | null; debtDays: number | null; groupName: string | null };
  stats: { receiptsCount: number; purchasesTotal: string; averageReceipt: string; lastVisit: string | null };
  debts: { direction: 'receivable' | 'payable'; currency: string; amount: string; overdue: string | null }[];
  debtsByVehicle: { vehicleId: string | null; title: string; plate: string | null; currency: string; amount: string }[];
  vehicles: Vehicle[];
  contacts: { id: string; name: string; position: string | null; phone: string | null; note: string | null }[];
}

export interface CustomerInput {
  name?: string;
  kind?: 'person' | 'company';
  phone?: string | null;
  inn?: string | null;
  address?: string | null;
  roles?: string[];
  tags?: string[];
  groupId?: string | null;
  birthday?: string | null;
  priceTypeId?: string | null;
  discountPercent?: string | null;
  debtLimit?: string | null;
  debtDays?: number | null;
  note?: string | null;
  messengers?: Record<string, string>;
  confirmDuplicatePhone?: boolean;
}

export interface Group {
  id: string;
  name: string;
  priceTypeId: string | null;
  discountPercent: string;
  debtLimit: string | null;
  debtDays: number | null;
  sort: number;
  version: number;
}

export interface DebtRow {
  counterpartyId: string;
  name: string;
  phone: string | null;
  currency: string;
  amount: string;
  overdue: string;
  age0_30: string;
  age31_60: string;
  age61_90: string;
  age90plus: string;
  oldestAt: string;
}
export interface DebtItem {
  id: string;
  direction: 'receivable' | 'payable';
  kind: string;
  currency: string;
  amount: string;
  remaining: string;
  openedAt: string;
  dueDate: string | null;
  overdue: boolean;
  documentId: string | null;
  documentNumber: string | null;
  vehicleId: string | null;
  vehicleTitle: string | null;
  plate: string | null;
  description: string | null;
  what: string | null;
}
export interface Statement {
  counterparty: { id: string; name: string; phone: string | null };
  items: DebtItem[];
  totals: Record<string, string>;
  text: string;
  whatsappUrl: string;
  telegramUrl: string;
}
export interface DebtPayInput {
  counterpartyId: string;
  direction: 'in' | 'out';
  currency?: string;
  amount: string;
  accountId: string;
  allocation?: { mode: 'oldest' | 'vehicles' | 'items'; vehicleIds?: (string | null)[]; itemIds?: string[] };
  comment?: string;
  idempotencyKey?: string;
}

export interface LoyaltyCard {
  card: { id: string; number: string; issuedAt?: string; createdAt?: string } | null;
  balance: string;
  level: string | null;
  accrualPercent: string;
  expiringSoon: { amount: string; at: string | null };
  history: { id: string; kind: string; amount: string; receiptId: string | null; expiresAt: string | null; comment: string | null; createdAt: string }[];
}

export interface FeedItem {
  type: string;
  id: string;
  at: string;
  text: string;
}

export interface PersonalPrice {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: string;
  currency: string;
  updatedAt: string;
}

export const customerApi = {
  list: (q: { q?: string; role?: string; groupId?: string; hasDebt?: boolean; noPurchaseDays?: number; page?: number; limit?: number }) => d(api.get<Page<CustomerListItem>>('/counterparties', { params: q })),
  card: (id: string) => d(api.get<CustomerCard>(`/counterparties/${id}/card`)),
  create: (b: CustomerInput) => d(api.post<CustomerCard>('/counterparties', b)),
  update: (id: string, b: CustomerInput & { version: number }) => d(api.patch<CustomerCard>(`/counterparties/${id}`, b)),
  duplicates: () => d(api.get<{ phone: string; items: { id: string; name: string }[] }[]>('/counterparties/duplicates')),
  merge: (id: string, duplicateIds: string[]) => d(api.post(`/counterparties/${id}/merge`, { duplicateIds })),
  addVehicle: (id: string, b: { title: string; vin?: string; year?: number; plate?: string; mileage?: number; note?: string }) => d(api.post<Vehicle>(`/counterparties/${id}/vehicles`, b)),
  updateVehicle: (id: string, b: { version: number; title?: string; vin?: string | null; year?: number | null; plate?: string | null; mileage?: number | null; note?: string | null }) => d(api.patch<Vehicle>(`/customer-vehicles/${id}`, b)),
  removeVehicle: (id: string, version: number) => api.delete(`/customer-vehicles/${id}`, { params: { version } }),
  vehicleHistory: (id: string) => d(api.get<{ id: string; number: string; completedAt: string; total: string; lines: { name: string; qty: string }[] }[]>(`/customer-vehicles/${id}/history`)),
  groups: () => d(api.get<Group[]>('/counterparty-groups')),
  createGroup: (b: Partial<Group>) => d(api.post<Group>('/counterparty-groups', b)),
  updateGroup: (id: string, b: Partial<Group> & { version: number }) => d(api.patch<Group>(`/counterparty-groups/${id}`, b)),
  feed: (id: string) => d(api.get<FeedItem[]>(`/counterparties/${id}/feed`)),
  addActivity: (id: string, kind: 'call' | 'note', text: string) => d(api.post(`/counterparties/${id}/activities`, { kind, text })),
  personalPrices: (id: string) => d(api.get<PersonalPrice[]>(`/counterparties/${id}/personal-prices`)),
  setPersonalPrice: (id: string, productId: string, price: string | null) => d(api.put(`/counterparties/${id}/personal-prices`, { productId, price })),
  priceListLink: (id: string) => d(api.get<{ link: string }>(`/counterparties/${id}/price-list/link`)),
  priceListFile: (id: string, format: 'xlsx' | 'pdf') => api.get<Blob>(`/counterparties/${id}/price-list`, { params: { format }, responseType: 'blob' }).then((r) => r.data),

  debts: (q: { direction?: 'receivable' | 'payable'; overdueOnly?: boolean; q?: string; page?: number; limit?: number }) => d(api.get<Page<DebtRow>>('/debts', { params: q })),
  debtItems: (id: string, q: { direction?: 'receivable' | 'payable'; vehicleId?: string; open?: boolean } = {}) => d(api.get<DebtItem[]>(`/counterparties/${id}/debts`, { params: q })),
  statement: (id: string, vehicleId?: string) => d(api.get<Statement>(`/counterparties/${id}/debts/statement`, { params: vehicleId ? { vehicleId } : {} })),
  statementPdf: (id: string) => api.get<Blob>(`/counterparties/${id}/debts/statement.pdf`, { responseType: 'blob' }).then((r) => r.data),
  pay: (b: DebtPayInput) => d(api.post<{ payment: unknown; allocations: unknown[]; balance: unknown }>('/debts/payments', b)),
  offset: (counterpartyId: string, currency = 'KGS') => d(api.post<{ amount: string; currency: string }>('/debts/offset', { counterpartyId, currency })),

  loyalty: (id: string) => d(api.get<LoyaltyCard>(`/loyalty/customers/${id}`)),
  issueCard: (id: string, number?: string) => d(api.post<LoyaltyCard>(`/loyalty/customers/${id}/card`, number ? { number } : {})),
  adjustBonus: (id: string, amount: string, comment: string) => d(api.post<LoyaltyCard>(`/loyalty/customers/${id}/adjust`, { amount, comment })),
};

export const useCustomers = (q: Parameters<typeof customerApi.list>[0]) => useQuery({ queryKey: ['customers', q], queryFn: () => customerApi.list(q), placeholderData: keepPreviousData });
export const useCustomerCard = (id?: string | null) => useQuery({ queryKey: ['customer', id], queryFn: () => customerApi.card(id!), enabled: !!id });
export const useGroups = () => useQuery({ queryKey: ['counterparty-groups'], queryFn: customerApi.groups, staleTime: 5 * 60_000 });
export const useDebts = (q: Parameters<typeof customerApi.debts>[0]) => useQuery({ queryKey: ['debts', q], queryFn: () => customerApi.debts(q), placeholderData: keepPreviousData });
export const useDebtItems = (id?: string, q: Parameters<typeof customerApi.debtItems>[1] = {}) => useQuery({ queryKey: ['debt-items', id, q], queryFn: () => customerApi.debtItems(id!, q), enabled: !!id });
export const useFeed = (id?: string) => useQuery({ queryKey: ['feed', id], queryFn: () => customerApi.feed(id!), enabled: !!id });
export const useLoyalty = (id?: string) => useQuery({ queryKey: ['loyalty', id], queryFn: () => customerApi.loyalty(id!), enabled: !!id, retry: false });
