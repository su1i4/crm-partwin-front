import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Decimalish, type Page } from '@/shared/api';

// ── Типы ответов backend (pos, shifts, money) ───────────

export interface Register {
  id: string;
  storeId: string;
  code: string;
  name: string;
  warehouseId: string;
  isActive: boolean;
}

export type CashByCurrency = Record<string, string>;

export interface Shift {
  id: string;
  number: number;
  status: 'open' | 'closed';
  registerId: string;
  storeId: string;
  openedAt: string;
  closedAt: string | null;
  opening: CashByCurrency;
  counted: CashByCurrency | null;
  expected: CashByCurrency | null;
  diff: CashByCurrency | null;
  currentMembershipId: string;
  version: number;
}

export interface CurrentShift {
  register: Register;
  shift: Shift | null;
  lastClosed: Shift | null;
  cashBalance: CashByCurrency;
}

export interface ShiftReport {
  shiftId: string;
  number: number;
  register: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  salesCount: number;
  salesTotal: Decimalish;
  returnsCount: number;
  returnsTotal: Decimalish;
  discountsTotal: Decimalish;
  debtTotal: Decimalish;
  byMethod: { method: string; currency: string; amount: Decimalish; amountKgs: Decimalish }[];
  byAccount: { accountId: string; name: string; type: string; currency: string; amount: Decimalish; unverified: Decimalish | null }[];
  toOwner: { items: { holderName: string; accountName: string; amount: Decimalish }[]; total: string };
  operations: { id: string; type: string; amount: Decimalish; purpose: string | null; comment: string | null; at: string; fromCurrency: string | null; toCurrency: string | null }[];
  cash: { accountId: string; currency: string; opening: string; sales: Decimalish; refunds: Decimalish; debts: Decimalish; operations: Decimalish; diffs: Decimalish; balance: string }[];
  counted: CashByCurrency | null;
  expected: CashByCurrency | null;
  diff: CashByCurrency | null;
}

export interface ShiftListItem {
  id: string;
  number: number;
  status: 'open' | 'closed';
  registerId: string;
  registerName: string;
  openedAt: string;
  closedAt: string | null;
  opening: CashByCurrency;
  counted: CashByCurrency | null;
  expected: CashByCurrency | null;
  diff: CashByCurrency | null;
  autoClosed: boolean;
  openedByName: string | null;
  closedByName: string | null;
}

export interface ReceiptLine {
  id: string;
  lineNo: number;
  productId: string;
  name: string;
  sku: string;
  kind: string;
  isSerial: boolean;
  unitId: string;
  unitName: string;
  factor: Decimalish;
  qty: Decimalish;
  price: Decimalish;
  promoDiscount: Decimalish;
  lineDiscount: Decimalish;
  receiptDiscount: Decimalish;
  bonusPaid: Decimalish;
  amount: Decimalish;
  place: string | null;
  priceSource: string | null;
  originalPrice: string | null;
  originalCurrency: string | null;
  discountPercent: string | null;
  discountAmount: string | null;
  customPrice: boolean | null;
  free: { name: string } | null;
  neighbor: { neighborId: string; name?: string; partNumber?: string } | null;
  unitCost?: Decimalish;
  // для возврата (returns/lookup)
  returnableQty?: string;
  returnableAmount?: string;
  returnPeriodExpired?: boolean;
}

export interface ReceiptPayment {
  id: string;
  method: PaymentMethod;
  accountId: string | null;
  accountName: string | null;
  currency: string;
  amount: Decimalish;
  amountKgs: Decimalish;
  verifyStatus: string | null;
}

export interface Receipt {
  id: string;
  kind: 'sale' | 'return';
  number: string;
  status: 'open' | 'deferred' | 'completed' | 'cancelled';
  storeId: string;
  registerId: string;
  shiftId: string | null;
  customerId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerVehicleId: string | null;
  vehicleLabel: string | null;
  masterId: string | null;
  masterName?: string | null;
  sellerName?: string | null;
  registerName?: string | null;
  label: string | null;
  receiptDiscountPercent: string | null;
  receiptDiscountAmount: Decimalish | null;
  subtotal: Decimalish;
  discountTotal: Decimalish;
  total: Decimalish;
  totalUsd: string | null;
  paid: Decimalish;
  change: Decimalish;
  changeCurrency: string;
  debtAmount: Decimalish;
  rate: Decimalish | null;
  completedAt: string | null;
  createdAt: string;
  version: number;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  daysSinceSale?: number;
  duplicate?: boolean;
}

export interface ReceiptListItem {
  id: string;
  number: string;
  kind: 'sale' | 'return';
  status: Receipt['status'];
  label: string | null;
  total: Decimalish;
  paid: Decimalish;
  debtAmount: Decimalish;
  createdAt: string;
  completedAt: string | null;
  registerName: string;
  customerName: string | null;
  sellerName: string | null;
  linesCount: number;
  version: number;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'debt' | 'return_credit' | 'advance' | 'scrap';

export interface PaymentInput {
  method: PaymentMethod;
  amount: string;
  currency?: 'KGS' | 'USD';
  accountId?: string;
}

export interface LineInput {
  lineId?: string;
  productId?: string;
  unitId?: string;
  qty: string;
  price?: string | null;
  discountPercent?: string | null;
  discountAmount?: string | null;
  free?: { name: string };
  neighbor?: { neighborId: string; name?: string; partNumber?: string; productId?: string | null; purchasePrice: string };
}

export interface HeaderInput {
  customerId?: string | null;
  vehicleLabel?: string | null;
  masterId?: string | null;
  receiptDiscountPercent?: string | null;
  receiptDiscountAmount?: string | null;
  label?: string | null;
}

export interface MoneyAccount {
  id: string;
  type: 'cash' | 'safe' | 'wallet' | 'acquiring' | 'bank' | 'accountable';
  name: string;
  currency: string;
  storeId: string | null;
  registerId: string | null;
  details: Record<string, unknown>;
}

export interface Counterparty {
  id: string;
  name: string;
  kind: 'person' | 'company';
  phone: string | null;
  roles: string[];
  groupName: string | null;
  debtKgs: Decimalish | null;
  lastVisit: string | null;
}

export interface Printable {
  kind: string;
  title: string;
  store: { name: string; address: string | null; phone: string | null };
  number: string;
  date: string;
  register: string;
  seller: string;
  customer: string | null;
  vehicle: string | null;
  lines: { name: string; qty: string; unit: string; price: string; discount: string; amount: string; warranty: string | null; returnRule: string | null }[];
  subtotal: string;
  discount: string;
  total: string;
  totalUsd: string | null;
  rate: string | null;
  payments: { method: string; account: string | null; amount: string; currency: string }[];
  change: { amount: string; currency: string } | null;
  debt: string | null;
  qr: string | null;
  footer: string;
}

export const RETURN_REASONS: Record<string, string> = {
  not_fit: 'Не подошло',
  defect: 'Брак',
  changed_mind: 'Передумал',
  wrong_item: 'Не та деталь',
  warranty: 'Гарантия',
  other: 'Другое',
};

// ── Запросы ─────────────────────────────────────────────

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const posApi = {
  registers: (storeId?: string) => d(api.get<Register[]>('/registers', { params: storeId ? { storeId } : {} })),
  currentShift: (registerId: string) => d(api.get<CurrentShift>('/shifts/current', { params: { registerId } })),
  openShift: (registerId: string, cash: CashByCurrency) => d(api.post<Shift>('/shifts/open', { registerId, cash })),
  xReport: (shiftId: string) => d(api.get<ShiftReport>(`/shifts/${shiftId}/x-report`)),
  closeShift: (shiftId: string, version: number, counted: CashByCurrency) => d(api.post<Shift>(`/shifts/${shiftId}/close`, { version, counted })),
  shiftCash: (shiftId: string, b: { type: 'cash_in' | 'cash_out'; currency: 'KGS' | 'USD'; amount: string; purpose?: string; comment?: string }) =>
    d(api.post(`/shifts/${shiftId}/cash`, b)),
  shifts: (p: { page?: number; limit?: number; registerId?: string; storeId?: string }) => d(api.get<Page<ShiftListItem>>('/shifts', { params: p })),

  createReceipt: (b: { registerId: string; lines?: LineInput[] } & HeaderInput) => d(api.post<Receipt>('/pos/receipts', b)),
  updateReceipt: (id: string, b: { version: number; lines?: LineInput[]; pin?: string } & HeaderInput) => d(api.patch<Receipt>(`/pos/receipts/${id}`, b)),
  receipt: (id: string) => d(api.get<Receipt>(`/pos/receipts/${id}`)),
  receipts: (p: { status?: string; registerId?: string; storeId?: string; q?: string; page?: number; limit?: number; from?: string; to?: string }) =>
    d(api.get<Page<ReceiptListItem>>('/pos/receipts', { params: p })),
  pay: (id: string, b: { version: number; payments: PaymentInput[]; changeCurrency?: 'KGS' | 'USD'; pin?: string }) => d(api.post<Receipt>(`/pos/receipts/${id}/pay`, b)),
  defer: (id: string, version: number, label?: string) => d(api.post<Receipt>(`/pos/receipts/${id}/defer`, { version, ...(label ? { label } : {}) })),
  resume: (id: string, registerId: string) => d(api.post<Receipt>(`/pos/receipts/${id}/resume`, { registerId })),
  cancel: (id: string, version: number) => d(api.post<Receipt>(`/pos/receipts/${id}/cancel`, { version })),
  printable: (id: string) => d(api.get<Printable>(`/pos/receipts/${id}/printable`)),
  printAgent: (id: string, registerId?: string) => d(api.post<{ jobId: string; status: string }>(`/pos/receipts/${id}/print`, null, { params: registerId ? { registerId } : {} })),
  share: (id: string) => d(api.get<{ url: string; text: string; whatsappUrl: string }>(`/pos/receipts/${id}/share`)),

  byBarcode: (code: string) =>
    d(api.get<{ barcode: string; matches: { productId: string; unitId: string; unitName: string; factor: string; name: string; sku: string; status: string }[]; ambiguous: boolean }>(
      `/products/by-barcode/${encodeURIComponent(code)}`,
    )),
  accounts: (p: { type?: string; storeId?: string }) => d(api.get<MoneyAccount[]>('/money/accounts', { params: p })),
  counterparties: (p: { q?: string; role?: string; limit?: number }) => d(api.get<Page<Counterparty>>('/counterparties', { params: { limit: 20, ...p } })),
  rates: () => d(api.get<{ current: { currency: string; rate: string; setAt: string }[] }>('/rates')),

  lookupReturn: (code: string) => d(api.get<Receipt>('/pos/returns/lookup', { params: { code } })),
  createReturn: (b: {
    registerId: string;
    saleReceiptId?: string;
    lines: { saleLineId?: string; qty: string; reason: string; condition?: 'ok' | 'defect'; noInstallMarks?: boolean; triedVehicleTitle?: string; comment?: string }[];
    refundMode?: 'same' | 'credit';
    confirmExpired?: boolean;
    pin?: string;
    idempotencyKey?: string;
  }) => d(api.post<Receipt>('/pos/returns', b)),
};

// ── Хуки ────────────────────────────────────────────────

export const useRegisters = (storeId?: string | null) =>
  useQuery({ queryKey: ['registers', storeId], queryFn: () => posApi.registers(storeId ?? undefined), staleTime: 5 * 60_000 });

export const useCurrentShift = (registerId?: string | null) =>
  useQuery({ queryKey: ['shift-current', registerId], queryFn: () => posApi.currentShift(registerId!), enabled: !!registerId, refetchInterval: 60_000 });

export const useDeferred = (registerId?: string | null, storeId?: string | null) =>
  useQuery({
    queryKey: ['receipts', 'deferred', storeId],
    queryFn: () => posApi.receipts({ status: 'deferred', ...(storeId ? { storeId } : {}), limit: 50 }),
    enabled: !!registerId,
    refetchInterval: 30_000,
  });

export const useAccounts = (type: string, storeId?: string | null) =>
  useQuery({ queryKey: ['accounts', type, storeId], queryFn: () => posApi.accounts({ type, ...(storeId ? { storeId } : {}) }), staleTime: 5 * 60_000 });

export const useRates = () => useQuery({ queryKey: ['rates'], queryFn: posApi.rates, staleTime: 5 * 60_000 });

export const useReceipts = (p: Parameters<typeof posApi.receipts>[0]) =>
  useQuery({ queryKey: ['receipts', p], queryFn: () => posApi.receipts(p), placeholderData: keepPreviousData });

export const useReceipt = (id?: string | null) => useQuery({ queryKey: ['receipt', id], queryFn: () => posApi.receipt(id!), enabled: !!id });

export const useShifts = (p: Parameters<typeof posApi.shifts>[0]) =>
  useQuery({ queryKey: ['shifts', p], queryFn: () => posApi.shifts(p), placeholderData: keepPreviousData });

export const useCounterparties = (q: string, role?: string) =>
  useQuery({ queryKey: ['counterparties', q, role], queryFn: () => posApi.counterparties({ q: q || undefined, role }), placeholderData: keepPreviousData });
