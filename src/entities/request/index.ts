import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Decimalish, type Page } from '@/shared/api';
import type { PriceOffer } from '@/entities/purchasing';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type RequestStatus = 'new' | 'selecting' | 'offered' | 'ordered' | 'arrived' | 'issued' | 'refused';
export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: 'accent' | 'soft' | 'dark' | 'warn' | 'ok' | 'muted' | 'accent-outline' }> = {
  new: { label: 'Новая', tone: 'accent' },
  selecting: { label: 'Подбирается', tone: 'soft' },
  offered: { label: 'Предложено', tone: 'accent-outline' },
  ordered: { label: 'Заказано', tone: 'dark' },
  arrived: { label: 'Привезли', tone: 'ok' },
  issued: { label: 'Выдано', tone: 'muted' },
  refused: { label: 'Отказ', tone: 'muted' },
};
export const REQUEST_FLOW: RequestStatus[] = ['new', 'selecting', 'offered', 'ordered', 'arrived', 'issued', 'refused'];

export interface RequestListItem {
  id: string;
  number: string;
  kind: 'select' | 'order';
  status: RequestStatus;
  createdAt: string;
  dueAt: string | null;
  prepaid: Decimalish;
  version: number;
  customerName: string | null;
  customerPhone: string | null;
  vehicle: string | null;
  overdue: boolean;
  what: string | null;
}
export interface RequestOffer {
  id: string;
  productId?: string | null;
  name: string;
  brand?: string | null;
  qualityClass?: string | null;
  price: string;
  supplierId?: string | null;
  purchasePrice?: string | null;
  leadDays?: number | null;
  inStock?: boolean;
  chosen?: boolean;
}
export interface RequestItem {
  id: string;
  lineNo: number;
  number: string | null;
  name: string;
  qty: string;
  photoFileIds: string[];
  productId: string | null;
  productName: string | null;
  salePrice: string | null;
  sourceId: string | null;
  sourceKind: 'supplier' | 'neighbor' | null;
  sourceName: string | null;
  purchasePrice?: string | null;
  purchaseOrderLineId: string | null;
  purchaseOrderNumber: string | null;
  arrivedAt: string | null;
  offers: RequestOffer[];
}
export interface RequestView {
  id: string;
  number: string;
  storeId: string;
  kind: 'select' | 'order';
  status: RequestStatus;
  statusLabel: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerVehicleId: string | null;
  vehicleText: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  prepaid: string;
  receiptId: string | null;
  refuseReason: string | null;
  comment: string | null;
  createdAt: string;
  closedAt: string | null;
  version: number;
  overdue: boolean;
  history: { at: string; status: string; by: string | null; note?: string }[];
  customer: { id: string; name: string; phone: string | null } | null;
  items: RequestItem[];
  nextStatuses: RequestStatus[];
}
export interface RequestInput {
  kind?: 'select' | 'order';
  storeId?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerVehicleId?: string | null;
  vehicleText?: string | null;
  dueAt?: string | null;
  comment?: string | null;
  items?: { id?: string; number?: string | null; name?: string; qty?: string; productId?: string | null; salePrice?: string | null; photoFileIds?: string[] }[];
}
export interface Suggestion {
  itemId: string;
  name: string;
  number: string | null;
  catalog: { productId: string; name: string; qualityClass: string; brand: string | null; stock: string }[];
  suppliers: PriceOffer[];
}
export interface WaitlistEntry {
  id: string;
  status: 'waiting' | 'notified' | 'done' | 'cancelled';
  productId: string | null;
  productName: string | null;
  query: string | null;
  qty: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  notifiedAt: string | null;
  note: string | null;
  version: number;
}

export const requestApi = {
  list: (q: { status?: string; storeId?: string; customerId?: string; q?: string; page?: number; limit?: number }) => d(api.get<Page<RequestListItem>>('/requests', { params: { view: 'list', ...q } })),
  kanban: (q: { storeId?: string; q?: string }) => d(api.get<{ columns: { status: RequestStatus; label: string; items: RequestListItem[] }[]; total: number }>('/requests', { params: { view: 'kanban', ...q } })),
  get: (id: string) => d(api.get<RequestView>(`/requests/${id}`)),
  create: (b: RequestInput) => d(api.post<RequestView>('/requests', b)),
  update: (id: string, b: RequestInput & { version: number }) => d(api.patch<RequestView>(`/requests/${id}`, b)),
  suggest: (id: string) => d(api.get<Suggestion[]>(`/requests/${id}/suggest`)),
  offer: (id: string, version: number, itemId: string, offers: Omit<RequestOffer, 'id' | 'chosen'>[]) => d(api.post<RequestView>(`/requests/${id}/offer`, { version, itemId, offers })),
  choose: (id: string, b: { version: number; itemId: string; offerId?: string; productId?: string; salePrice?: string }) => d(api.post<RequestView>(`/requests/${id}/choose`, b)),
  order: (id: string, b: { version: number; itemIds?: string[]; sourceKind: 'supplier' | 'neighbor'; sourceId: string; purchasePrice?: string; dueAt?: string }) => d(api.post<RequestView>(`/requests/${id}/order`, b)),
  status: (id: string, version: number, status: RequestStatus, note?: string) => d(api.post<RequestView>(`/requests/${id}/status`, { version, status, ...(note ? { note } : {}) })),
  prepay: (id: string, b: { version: number; amount: string; method: 'cash' | 'card' | 'transfer'; registerId?: string; accountId?: string }) => d(api.post<RequestView>(`/requests/${id}/prepay`, b)),
  issue: (id: string, b: { version: number; registerId: string; payments?: { method: string; amount: string; currency?: string; accountId?: string }[] }) =>
    d(api.post<{ request: RequestView; receipt: { id: string; number: string } }>(`/requests/${id}/issue`, b)),
  refuse: (id: string, b: { version: number; reason: string; refund?: 'money' | 'advance'; registerId?: string }) => d(api.post<RequestView>(`/requests/${id}/refuse`, b)),
  message: (id: string) => d(api.get<{ text: string; whatsappUrl: string }>(`/requests/${id}/message`)),

  waitlist: (q: { status?: string; storeId?: string; productId?: string }) => d(api.get<WaitlistEntry[]>('/waitlist', { params: q })),
  addWaitlist: (b: { productId?: string; query?: string; customerId?: string; customerName?: string; customerPhone?: string; qty?: string; note?: string; storeId?: string }) => d(api.post<WaitlistEntry>('/waitlist', b)),
  waitlistStatus: (id: string, version: number, status: 'waiting' | 'done' | 'cancelled') => d(api.post<WaitlistEntry>(`/waitlist/${id}/status`, { version, status })),
};

export const useRequests = (q: Parameters<typeof requestApi.list>[0]) => useQuery({ queryKey: ['requests', 'list', q], queryFn: () => requestApi.list(q), placeholderData: keepPreviousData });
export const useKanban = (q: Parameters<typeof requestApi.kanban>[0]) => useQuery({ queryKey: ['requests', 'kanban', q], queryFn: () => requestApi.kanban(q), placeholderData: keepPreviousData, refetchInterval: 60_000 });
export const useRequest = (id?: string | null) => useQuery({ queryKey: ['request', id], queryFn: () => requestApi.get(id!), enabled: !!id });
export const useSuggest = (id?: string | null, on = true) => useQuery({ queryKey: ['request-suggest', id], queryFn: () => requestApi.suggest(id!), enabled: !!id && on });
export const useWaitlist = (status?: string) => useQuery({ queryKey: ['waitlist', status ?? null], queryFn: () => requestApi.waitlist({ status }) });
