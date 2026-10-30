import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export interface Selection {
  id: string;
  number: string;
  status: 'open' | 'closed';
  dueDate: string | null;
  overdue: boolean;
  lines: { productId: string; name?: string; qty: string; price?: string }[];
  counterpartyId: string;
  customer: string;
  phone: string | null;
  receiptId: string | null;
  createdAt: string;
  closedAt: string | null;
}
export interface BonusRule {
  id: string;
  masterId: string | null;
  categoryId: string | null;
  kind: 'percent_sales' | 'percent_margin' | 'fixed';
  value: string;
  isActive: boolean;
  version: number;
}
export interface BonusRow {
  masterId: string;
  name: string;
  receipts: number;
  accrued: string;
  paid: string;
  owed: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'done' | 'cancelled';
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  counterpartyId: string | null;
  customerName: string | null;
  version: number;
  createdAt: string;
}
/** Акция: строки из SQL p.* (snake_case) */
export interface Promotion {
  id: string;
  name: string;
  kind: 'percent' | 'receipt_amount' | 'second_item';
  percent: string;
  min_amount: string | null;
  starts_on: string | null;
  ends_on: string | null;
  stackable: boolean;
  by_code: boolean;
  is_active: boolean;
  version: number;
  category_ids: string[];
  brand_ids: string[];
  quality_classes: string[];
  codes: { id: string; code: string; maxUses: number | null; usedCount: number; isActive: boolean }[] | null;
}

export const stoApi = {
  selections: (q: { status?: string; counterpartyId?: string }) => d(api.get<Selection[]>('/selections', { params: q })),
  createSelection: (b: { counterpartyId: string; lines: { productId: string; qty: string }[]; days?: number; comment?: string }) => d(api.post<Selection>('/selections', b)),
  closeSelection: (id: string, b: { registerId: string; fitted: { productId: string; qty: string }[]; payments?: unknown[] }) => d(api.post(`/selections/${id}/close`, b)),
  rules: () => d(api.get<BonusRule[]>('/master-bonuses/rules')),
  saveRule: (id: string | null, b: Partial<BonusRule>) => d(id ? api.patch<BonusRule>(`/master-bonuses/rules/${id}`, b) : api.post<BonusRule>('/master-bonuses/rules', b)),
  bonuses: (q: { from?: string; to?: string; masterId?: string }) => d(api.get<BonusRow[]>('/master-bonuses', { params: q })),
  tasks: (q: { status?: string; mine?: boolean; counterpartyId?: string }) => d(api.get<Task[]>('/tasks', { params: q })),
  createTask: (b: { title: string; description?: string; dueAt?: string; counterpartyId?: string }) => d(api.post<Task>('/tasks', b)),
  updateTask: (id: string, b: { version: number; status?: Task['status']; title?: string }) => d(api.patch<Task>(`/tasks/${id}`, b)),
  promotions: () => d(api.get<Promotion[]>('/loyalty/promotions')),
  savePromotion: (id: string | null, b: Record<string, unknown>) => d(id ? api.patch(`/loyalty/promotions/${id}`, b) : api.post('/loyalty/promotions', b)),
  addCodes: (id: string, b: { codes?: string[]; generate?: number; maxUses?: number }) => d(api.post(`/loyalty/promotions/${id}/codes`, b)),
  liability: () => d(api.get<{ onCards: string; customers: number; thisMonth: { accrued: string; spent: string; expired: string } }>('/loyalty/liability')),
  botLink: () => d(api.get<{ link: string }>('/loyalty/bot-link')),
};

export const useSelections = (status?: string) => useQuery({ queryKey: ['selections', status ?? null], queryFn: () => stoApi.selections({ status }) });
export const useBonusRules = () => useQuery({ queryKey: ['bonus-rules'], queryFn: stoApi.rules });
export const useBonuses = (q: { from?: string; to?: string }) => useQuery({ queryKey: ['bonuses', q], queryFn: () => stoApi.bonuses(q) });
export const useTasks = (q: { status?: string; mine?: boolean; counterpartyId?: string }) => useQuery({ queryKey: ['tasks', q], queryFn: () => stoApi.tasks(q) });
export const usePromotions = () => useQuery({ queryKey: ['promotions'], queryFn: stoApi.promotions });
export const useLiability = () => useQuery({ queryKey: ['liability'], queryFn: stoApi.liability });
