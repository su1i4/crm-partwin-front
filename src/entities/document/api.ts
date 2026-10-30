import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Decimalish, type Page } from '@/shared/api';

/** Виды складских документов, которые создаются руками на этом этапе (остальные — из кассы, закупок, СТО) */
export type DocType =
  | 'initial_stock'
  | 'receiving'
  | 'surplus'
  | 'writeoff'
  | 'resort'
  | 'transfer'
  | 'inventory'
  | 'cost_adjustment'
  | 'sale'
  | 'sale_return'
  | 'supplier_return'
  | 'extra_costs'
  | 'selection_issue'
  | 'selection_return'
  | 'customer_purchase'
  | 'consignment'
  | 'consignment_return'
  | 'donor';

export type DocStatus = 'draft' | 'awaiting_approval' | 'posted';

export interface DocListItem {
  id: string;
  type: DocType;
  typeLabel: string;
  number: string;
  docDate: string;
  status: DocStatus;
  deletionMark: boolean;
  storeId: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  warehouseToId: string | null;
  warehouseToName: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  currency: string;
  totalQty: Decimalish;
  totalAmount: Decimalish | null;
  hasNegative: boolean;
  comment: string | null;
  transferState: 'in_transit' | 'accepted' | null;
  version: number;
  createdAt: string;
}

export interface DocLine {
  id: string;
  lineNo: number;
  productId: string;
  productName: string;
  sku: string;
  baseUnit: string;
  isSerial: boolean;
  mainNumber: string | null;
  unitId: string | null;
  unitName: string | null;
  factor: Decimalish;
  qty: Decimalish;
  baseQty: Decimalish;
  price: Decimalish | null;
  amount: Decimalish | null;
  unitCost?: Decimalish | null;
  costAmount?: Decimalish | null;
  productToId: string | null;
  productToName: string | null;
  place: string | null;
  extra: { reason?: string; comment?: string; expectedQty?: string; orderPrice?: string; defect?: boolean; acceptedQty?: string; [k: string]: unknown };
}

export interface DocView extends Omit<DocListItem, 'warehouseName' | 'warehouseToName' | 'counterpartyName' | 'typeLabel'> {
  typeLabel: string;
  rate: Decimalish;
  extra: { supplierInvoiceNumber?: string; supplierInvoiceDate?: string; extraCosts?: { name: string; amount: string }[]; reason?: string; transferState?: string; [k: string]: unknown };
  warehouse: { id: string; name: string } | null;
  warehouseTo: { id: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
  lines: DocLine[];
  links: { kind: string; direction: 'to' | 'from'; id: string; number: string; type: DocType; status: DocStatus; docDate: string }[];
  attachments: { id: string; name: string; mime: string; size: number; createdAt: string }[];
  baseDocumentId: string | null;
}

export interface LineInput {
  productId: string;
  unitId?: string;
  qty: string;
  price?: string | null;
  productToId?: string;
  place?: string;
  reason?: string;
  comment?: string;
}

export interface DocInput {
  docDate?: string;
  warehouseId?: string;
  warehouseToId?: string;
  counterpartyId?: string | null;
  currency?: string;
  rate?: string;
  comment?: string | null;
  extra?: Record<string, unknown>;
  lines?: LineInput[];
}

export interface DocListQuery {
  type?: string;
  status?: string;
  storeId?: string;
  warehouseId?: string;
  q?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  inTransit?: boolean;
  deletionMark?: boolean;
}

/** Ошибки проведения: details = [{ line, message }] */
export interface LineError {
  line?: number;
  message: string;
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const docApi = {
  meta: () => d(api.get<{ types: { code: DocType; prefix: string; label: string }[]; writeoffReasons: { code: string; label: string }[] }>('/documents/meta')),
  list: (q: DocListQuery) => d(api.get<Page<DocListItem>>('/documents', { params: q })),
  get: (id: string) => d(api.get<DocView>(`/documents/${id}`)),
  create: (b: DocInput & { type: DocType; post?: boolean; baseDocumentId?: string; confirmDuplicateInvoice?: boolean }) => d(api.post<DocView>('/documents', b)),
  update: (id: string, b: DocInput & { version: number; confirmDuplicateInvoice?: boolean }) => d(api.patch<DocView>(`/documents/${id}`, b)),
  post: (id: string, version: number, confirmDuplicateInvoice?: boolean) => d(api.post<DocView>(`/documents/${id}/post`, { version, ...(confirmDuplicateInvoice ? { confirmDuplicateInvoice } : {}) })),
  unpost: (id: string, version: number) => d(api.post<DocView>(`/documents/${id}/unpost`, { version })),
  approve: (id: string, version: number) => d(api.post<DocView>(`/documents/${id}/approve`, { version })),
  accept: (id: string, version: number, lines?: { lineId: string; qty: string }[]) => d(api.post<DocView>(`/documents/${id}/accept`, { version, ...(lines ? { lines } : {}) })),
  mark: (id: string, version: number, mark: boolean) => d(api.post<DocView>(`/documents/${id}/deletion-mark`, null, { params: { version, mark } })),
  remove: (id: string, version: number) => api.delete(`/documents/${id}`, { params: { version } }),
  basedOn: (id: string, type: 'transfer' | 'writeoff' | 'receiving' | 'surplus') => d(api.post<DocView>(`/documents/${id}/based-on`, { type })),
  attach: (id: string, fileId: string) => d(api.post(`/documents/${id}/attachments`, { fileId })),
  labelsPdf: (id: string, mode: 'all' | 'without_barcode' | 'unpack' = 'all') =>
    api.get<Blob>(`/documents/${id}/labels.pdf`, { params: { mode }, responseType: 'blob' }).then((r) => r.data),
  stale: () => d(api.get<DocListItem[]>('/documents/transfers/stale')),
};

export const useDocMeta = () => useQuery({ queryKey: ['doc-meta'], queryFn: docApi.meta, staleTime: Infinity });
export const useDocs = (q: DocListQuery) => useQuery({ queryKey: ['documents', q], queryFn: () => docApi.list(q), placeholderData: keepPreviousData });
export const useDoc = (id?: string | null) => useQuery({ queryKey: ['document', id], queryFn: () => docApi.get(id!), enabled: !!id });

/** Что умеет вид документа в редакторе */
export const DOC_KIND: Partial<Record<DocType, { title: string; price: boolean; counterparty?: 'supplier' | 'customer'; warehouseTo?: boolean; reason?: boolean; productTo?: boolean; currency?: boolean; invoice?: boolean; place?: boolean; priceLabel?: string }>> = {
  receiving: { title: 'Приёмка', price: true, counterparty: 'supplier', currency: true, invoice: true, place: true, priceLabel: 'Закупка' },
  initial_stock: { title: 'Ввод остатков', price: true, place: true, priceLabel: 'Себестоимость' },
  surplus: { title: 'Оприходование', price: true, place: true, priceLabel: 'Себестоимость' },
  writeoff: { title: 'Списание', price: false, reason: true },
  transfer: { title: 'Перемещение', price: false, warehouseTo: true },
  resort: { title: 'Пересортица', price: false, productTo: true },
  supplier_return: { title: 'Возврат поставщику', price: true, counterparty: 'supplier', priceLabel: 'Цена возврата' },
};

export const STATUS_LABEL: Record<DocStatus, { label: string; tone: 'ok' | 'warn' | 'soft' }> = {
  draft: { label: 'Черновик', tone: 'soft' },
  awaiting_approval: { label: 'Ждёт согласования', tone: 'warn' },
  posted: { label: 'Проведён', tone: 'ok' },
};
