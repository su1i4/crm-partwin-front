import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ── Заказы покупателей и доставка (ТЗ 14.6–14.8) ─────────

export type OrderStatus = 'new' | 'reserved' | 'partially_shipped' | 'shipped' | 'cancelled';
export type DeliveryStatus = 'assembled' | 'on_way' | 'delivered' | 'paid' | 'returned';
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'soft' | 'warn' | 'ok' | 'muted' | 'dark' }> = {
  new: { label: 'новый', tone: 'soft' },
  reserved: { label: 'в резерве', tone: 'dark' },
  partially_shipped: { label: 'частично', tone: 'warn' },
  shipped: { label: 'отгружен', tone: 'ok' },
  cancelled: { label: 'отменён', tone: 'muted' },
};
export const DELIVERY_STATUS: Record<DeliveryStatus, string> = { assembled: 'Собран', on_way: 'В пути', delivered: 'Доставлен', paid: 'Оплачен', returned: 'Возврат' };
export const DELIVERY_FLOW: DeliveryStatus[] = ['assembled', 'on_way', 'delivered', 'paid'];

export interface OrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  total: string;
  dueOn: string | null;
  address: string | null;
  deliveryStatus: DeliveryStatus | null;
  driverId: string | null;
  customer: string;
  phone: string | null;
}
export interface OrderLine {
  id: string;
  line_no: number;
  product_id: string;
  warehouse_id: string | null;
  qty: string;
  price: string;
  shipped_qty: string;
  name: string;
}
export interface Order {
  id: string;
  number: string;
  storeId: string;
  counterpartyId: string;
  status: OrderStatus;
  total: string;
  dueOn: string | null;
  address: string | null;
  driverId: string | null;
  deliveryCost: string | null;
  deliveryStatus: DeliveryStatus | null;
  history: { at: string; status: string; by: string | null; note?: string }[];
  comment: string | null;
  createdAt: string;
  version: number;
  receiptIds: string[];
  lines: OrderLine[];
  prepaidRemaining: string;
}
export interface OrderInput {
  counterpartyId: string;
  lines: { productId: string; qty: string; price?: string }[];
  reserve?: boolean;
  dueOn?: string;
  address?: string;
  driverId?: string;
  deliveryCost?: string;
  comment?: string;
}

// ── Реализация ──────────────────────────────────────────

export interface Consignee {
  id: string;
  name: string;
  warehouseId: string;
  qty: string;
  cost: string;
  debt: string;
}

// ── Гарантия (ТЗ 11.6) ──────────────────────────────────

export type WarrantyStatus = 'accepted' | 'checking' | 'sent_to_supplier' | 'decided';
export type WarrantyDecision = 'replace' | 'refund' | 'reject';
export const WARRANTY_STATUS: Record<WarrantyStatus, string> = { accepted: 'Принято', checking: 'Проверка', sent_to_supplier: 'У поставщика', decided: 'Решено' };
export const WARRANTY_DECISION: Record<WarrantyDecision, string> = { replace: 'замена', refund: 'возврат денег', reject: 'отказ' };
export interface WarrantyRow {
  id: string;
  number: string;
  status: WarrantyStatus;
  decision: WarrantyDecision | null;
  inWarranty: boolean;
  createdAt: string;
  productId: string;
  productName: string;
  brandName: string | null;
  customerName: string | null;
  supplierName: string | null;
  version: number;
}
export interface Warranty {
  id: string;
  number: string;
  status: WarrantyStatus;
  saleReceiptId: string | null;
  productId: string;
  customerId: string | null;
  supplierId: string | null;
  qty: string;
  complaint: string;
  photoFileIds: string[];
  inWarranty: boolean;
  decision: WarrantyDecision | null;
  decisionReason: string | null;
  decidedAt: string | null;
  history: { at: string; status: string; by: string | null; note?: string }[];
  createdAt: string;
  version: number;
}
export interface WarrantyReportRow {
  total: number;
  replaced: number;
  refunded: number;
  rejected: number;
  open: number;
}

// ── Задания склада (ТЗ 9.8) ─────────────────────────────

export type TaskKind = 'placement' | 'pick' | 'replenish' | 'count' | 'move';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export const TASK_KIND: Record<TaskKind, string> = { placement: 'Размещение', pick: 'Подбор', replenish: 'Пополнение', count: 'Пересчёт', move: 'Перемещение' };
export interface TaskLine {
  productId: string;
  qty: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  doneQty?: string;
  countedQty?: string;
  shortage?: boolean;
}
export interface WhTask {
  id: string;
  number: string;
  warehouse_id: string;
  kind: TaskKind;
  status: TaskStatus;
  lines: TaskLine[];
  assignee_id: string | null;
  assigneeName: string | null;
  source_type: string | null;
  created_at: string;
  done_at: string | null;
}
export interface Workload {
  name: string;
  open: number;
  doneWeek: number;
  avgMinutes: number | null;
}

export const salesApi = {
  orders: (q: { status?: string; counterpartyId?: string; mine?: boolean } = {}) => d(api.get<OrderRow[]>('/sales-orders', { params: { ...q, mine: q.mine ? 'true' : undefined } })),
  order: (id: string) => d(api.get<Order>(`/sales-orders/${id}`)),
  createOrder: (b: OrderInput) => d(api.post<Order>('/sales-orders', b)),
  setLinePrice: (id: string, lineId: string, price: string) => d(api.patch<Order>(`/sales-orders/${id}/lines/${lineId}`, { price })),
  prepay: (id: string, b: { accountId: string; amount: string; comment?: string }) => d(api.post<Order>(`/sales-orders/${id}/prepay`, b)),
  ship: (id: string, b: { registerId: string; lines?: { lineId: string; qty: string }[]; payments?: { method: string; amount: string; accountId?: string }[] }) => d(api.post<unknown>(`/sales-orders/${id}/ship`, b)),
  cancel: (id: string, b: { prepayment: 'advance' | 'refund'; accountId?: string; reason?: string }) => d(api.post<Order>(`/sales-orders/${id}/cancel`, b)),
  delivery: (id: string, b: { status: DeliveryStatus; payment?: { method: 'cash' | 'transfer'; amount: string; accountId?: string }; note?: string }) => d(api.post<Order>(`/sales-orders/${id}/delivery`, b)),
  handover: (b: { driverId?: string; toAccountId: string; amount?: string }) => d(api.post<{ amount: string }>('/deliveries/handover', b)),

  consignees: () => d(api.get<Consignee[]>('/consignments')),
  consign: (b: { counterpartyId: string; warehouseId: string; lines: { productId: string; qty: string }[] }) => d(api.post<unknown>('/consignments', b)),
  consignReport: (b: { counterpartyId: string; registerId: string; sold: { productId: string; qty: string; price?: string }[] }) => d(api.post<unknown>('/consignments/report', b)),
  consignReturn: (b: { counterpartyId: string; warehouseId: string; lines: { productId: string; qty: string }[] }) => d(api.post<unknown>('/consignments/return', b)),

  warranties: (q: { status?: string; page?: number; limit?: number }) => d(api.get<Page<WarrantyRow>>('/warranty', { params: q })),
  warranty: (id: string) => d(api.get<Warranty>(`/warranty/${id}`)),
  createWarranty: (b: { saleReceiptId?: string; productId?: string; customerId?: string; qty?: string; complaint: string; photoFileIds?: string[] }) => d(api.post<Warranty>('/warranty', b)),
  warrantyStatus: (id: string, b: { version: number; status: WarrantyStatus; supplierId?: string; note?: string }) => d(api.post<Warranty>(`/warranty/${id}/status`, b)),
  decide: (id: string, b: { version: number; decision: WarrantyDecision; reason?: string; registerId?: string }) => d(api.post<Warranty>(`/warranty/${id}/decide`, b)),
  warrantyReport: (q: { from?: string; to?: string } = {}) => d(api.get<{ byBrand: (WarrantyReportRow & { brand: string })[]; bySupplier: (WarrantyReportRow & { supplier: string; supplierId: string | null })[] }>('/warranty/report', { params: q })),

  tasks: (q: { warehouseId?: string; status?: string; mine?: boolean }) => d(api.get<WhTask[]>('/storage/tasks', { params: { ...q, mine: q.mine ? 'true' : undefined } })),
  pickTask: (b: { warehouseId: string; lines: { productId: string; qty: string }[]; assigneeId?: string }) => d(api.post<WhTask>('/storage/tasks/pick', b)),
  taskLine: (id: string, b: { index: number; locationId?: string; productId: string; qty: string; shortage?: boolean }) =>
    d(api.post<{ task: WhTask; alternative?: { locationId: string; qty: string } | null; diff?: string }>(`/storage/tasks/${id}/line`, b)),
  replenish: (warehouseId: string) => d(api.post<{ created: number } | WhTask | null>(`/storage/warehouses/${warehouseId}/replenish`)),
  workload: (warehouseId: string) => d(api.get<Workload[]>(`/storage/warehouses/${warehouseId}/workload`)),
  locations: (warehouseId: string) => d(api.get<{ id: string; code: string; name: string | null }[]>(`/storage/warehouses/${warehouseId}/locations`)),
};

export const useOrders = (q: Parameters<typeof salesApi.orders>[0]) => useQuery({ queryKey: ['sales-orders', q], queryFn: () => salesApi.orders(q), placeholderData: keepPreviousData });
export const useOrder = (id?: string | null) => useQuery({ queryKey: ['sales-order', id], queryFn: () => salesApi.order(id!), enabled: !!id });
export const useConsignees = () => useQuery({ queryKey: ['consignees'], queryFn: salesApi.consignees });
export const useWarranties = (q: Parameters<typeof salesApi.warranties>[0]) => useQuery({ queryKey: ['warranty', q], queryFn: () => salesApi.warranties(q), placeholderData: keepPreviousData });
export const useWarranty = (id?: string | null) => useQuery({ queryKey: ['warranty-one', id], queryFn: () => salesApi.warranty(id!), enabled: !!id });
export const useWarrantyReport = () => useQuery({ queryKey: ['warranty-report'], queryFn: () => salesApi.warrantyReport() });
export const useWhTasks = (q: Parameters<typeof salesApi.tasks>[0]) => useQuery({ queryKey: ['wh-tasks', q], queryFn: () => salesApi.tasks(q), enabled: !!q.warehouseId, refetchInterval: 30_000 });
export const useWorkload = (wh?: string) => useQuery({ queryKey: ['workload', wh], queryFn: () => salesApi.workload(wh!), enabled: !!wh });
export const useLocations = (wh?: string) => useQuery({ queryKey: ['locations-min', wh], queryFn: () => salesApi.locations(wh!), enabled: !!wh, staleTime: 5 * 60_000 });
