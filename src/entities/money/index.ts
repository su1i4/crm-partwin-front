import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type AccountType = 'cash' | 'safe' | 'bank' | 'wallet' | 'acquiring' | 'accountable';
export const ACCOUNT_TYPE: Record<AccountType, string> = { cash: 'Касса', safe: 'Сейф', bank: 'Банк', wallet: 'Кошелёк', acquiring: 'Эквайринг', accountable: 'Подотчёт' };

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  currency: string;
  storeId: string | null;
  registerId: string | null;
  holderMembershipId: string | null;
  details: { provider?: string; phone?: string; commissionPercent?: string; [k: string]: unknown };
  isActive: boolean;
  version: number;
  balance?: string;
  unverified?: string;
}
export interface Movement {
  id: string;
  accountId: string;
  accountName: string;
  currency: string;
  amount: string;
  amountKgs: string;
  kind: string;
  movedAt: string;
  documentId: string | null;
  documentNumber: string | null;
  shiftId: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  verifyStatus: 'unverified' | 'verified' | 'not_received' | null;
  comment: string | null;
}
export interface Transfer {
  id: string;
  accountId: string;
  accountName: string;
  amount: string;
  currency: string;
  movedAt: string;
  status: 'unverified' | 'verified' | 'not_received';
  documentId: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  customerName: string | null;
  sellerName: string | null;
  fileId: string | null;
}
export interface TransferSummary {
  byDay: { day: string; count: number; amount: string }[];
  bySeller: { membershipId: string | null; seller: string; count: number; amount: string }[];
  byWallet: { accountId: string; wallet: string; count: number; amount: string }[];
}
export interface Expense {
  id: string;
  date: string;
  articleId: string;
  articleName: string;
  articleKind: 'expense' | 'salary' | 'owner';
  accountId: string;
  accountName: string;
  currency: string;
  amount: string;
  amountKgs: string;
  storeId: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  membershipId: string | null;
  memberName: string | null;
  recurringId: string | null;
  comment: string | null;
  status: 'posted' | 'cancelled';
}
export interface Article {
  id: string;
  name: string;
  code: string | null;
  kind: 'expense' | 'salary' | 'owner';
  isSystem: boolean;
  isActive: boolean;
}
export interface Recurring {
  id: string;
  version: number;
  articleId: string;
  articleName: string;
  accountId: string;
  accountName: string;
  storeId: string | null;
  amount: string;
  currency: string;
  dayOfMonth: number;
  nextDate: string;
  comment: string | null;
  isActive: boolean;
  lastRunAt: string | null;
}

export const MOVE_KIND: Record<string, string> = {
  sale: 'Продажа',
  refund: 'Возврат',
  debt_in: 'Оплата долга',
  debt_out: 'Оплата поставщику',
  cash_in: 'Внесение',
  cash_out: 'Изъятие',
  transfer: 'Перемещение',
  exchange: 'Обмен',
  fee: 'Комиссия',
  shift_diff: 'Расхождение смены',
  not_received: 'Не поступило',
  expense: 'Расход',
  owner_withdrawal: 'Изъятие владельцем',
};
export const DEBT_KIND: Record<string, string> = {
  sale: 'Покупка в долг',
  neighbor: 'Взяли у соседа',
  advance: 'Аванс',
  prepayment: 'Предоплата',
  not_received: 'Перевод не пришёл',
  manual: 'Вручную',
  purchase: 'Закупка',
  purchase_return: 'Возврат поставщику',
  extra_costs: 'Доп. расходы',
  master_bonus: 'Бонус мастеру',
  consignment: 'Реализация',
};

export const moneyApi = {
  accounts: (q: { storeId?: string; type?: string; includeInactive?: boolean } = {}) => d(api.get<Account[]>('/money/accounts', { params: q })),
  createAccount: (b: Partial<Account>) => d(api.post<Account>('/money/accounts', b)),
  updateAccount: (id: string, b: Partial<Account> & { version: number }) => d(api.patch<Account>(`/money/accounts/${id}`, b)),
  movements: (q: { accountId?: string; from?: string; to?: string; page?: number; limit?: number }) => d(api.get<Page<Movement>>('/money/movements', { params: q })),
  operation: (b: { type: 'cash_in' | 'cash_out' | 'transfer' | 'exchange'; fromAccountId?: string; toAccountId?: string; amount: string; toAmount?: string; rate?: string; purpose?: string; comment?: string }) =>
    d(api.post('/money/operations', b)),

  transfers: (q: { status?: string; accountId?: string; from?: string; to?: string; page?: number; limit?: number }) => d(api.get<Page<Transfer>>('/money/transfers', { params: q })),
  transferSummary: (q: { from?: string; to?: string } = {}) => d(api.get<TransferSummary>('/money/transfers/summary', { params: q })),
  verify: (ids: string[]) => d(api.post<{ verified: number }>('/money/transfers/verify', { ids })),
  notReceived: (id: string, action: 'debt' | 'cancel') => d(api.post(`/money/transfers/${id}/not-received`, { action })),
  matchStatement: (accountId: string, fileId: string) =>
    d(api.post<{ matches: { transferId: string; row: number; amount: string }[]; unmatchedStatementRows: { row: number; at: string; amount: string }[]; unmatchedTransfers: string[] }>('/money/transfers/match', { accountId, fileId })),

  expenses: (q: { from?: string; to?: string; articleId?: string; kind?: string; page?: number; limit?: number }) => d(api.get<Page<Expense> & { totalKgs: string }>('/money/expenses', { params: q })),
  createExpense: (b: { articleId: string; accountId: string; amount: string; date?: string; counterpartyId?: string; comment?: string }) => d(api.post<Expense>('/money/expenses', b)),
  cancelExpense: (id: string, reason?: string) => d(api.post(`/money/expenses/${id}/cancel`, reason ? { reason } : {})),
  articles: () => d(api.get<Article[]>('/money/expense-articles')),
  createArticle: (name: string, kind: 'expense' | 'salary' = 'expense') => d(api.post<Article>('/money/expense-articles', { name, kind })),
  recurring: () => d(api.get<Recurring[]>('/money/recurring-expenses')),
  createRecurring: (b: { articleId: string; accountId: string; amount: string; dayOfMonth: number; comment?: string }) => d(api.post<Recurring>('/money/recurring-expenses', b)),
  updateRecurring: (id: string, b: { version: number; isActive?: boolean; amount?: string; dayOfMonth?: number }) => d(api.patch<Recurring>(`/money/recurring-expenses/${id}`, b)),

  containerPrepay: (id: string, b: { accountId: string; amount: string; comment?: string }) => d(api.post(`/containers/${id}/prepay`, b)),
};

export const useMoneyAccounts = (q: { storeId?: string; type?: string; includeInactive?: boolean } = {}) => useQuery({ queryKey: ['money-accounts', q], queryFn: () => moneyApi.accounts(q) });
export const useMovements = (q: Parameters<typeof moneyApi.movements>[0]) => useQuery({ queryKey: ['money-movements', q], queryFn: () => moneyApi.movements(q), placeholderData: keepPreviousData });
export const useTransfers = (q: Parameters<typeof moneyApi.transfers>[0]) => useQuery({ queryKey: ['transfers', q], queryFn: () => moneyApi.transfers(q), placeholderData: keepPreviousData });
export const useTransferSummary = () => useQuery({ queryKey: ['transfers-summary'], queryFn: () => moneyApi.transferSummary() });
export const useExpenses = (q: Parameters<typeof moneyApi.expenses>[0]) => useQuery({ queryKey: ['expenses', q], queryFn: () => moneyApi.expenses(q), placeholderData: keepPreviousData });
export const useArticles = () => useQuery({ queryKey: ['expense-articles'], queryFn: moneyApi.articles, staleTime: 5 * 60_000 });
export const useRecurring = () => useQuery({ queryKey: ['recurring'], queryFn: moneyApi.recurring });
