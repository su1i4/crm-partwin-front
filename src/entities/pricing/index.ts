import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page } from '@/shared/api';

export interface PriceType {
  id: string;
  name: string;
  code: string;
  currency: 'KGS' | 'USD';
  isRetail: boolean;
  sort: number;
  version: number;
}

export interface PriceSettingListItem {
  id: string;
  number: string;
  status: 'draft' | 'posted';
  validFrom: string | null;
  comment: string | null;
  postedAt: string | null;
  linesCount: number;
  version: number;
}

export interface PriceSettingLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  priceTypeId: string;
  priceTypeName: string;
  storeId: string | null;
  unitId: string | null;
  oldPrice: string | null;
  newPrice: string;
  currency: string;
  method: string;
  changePercent: string | null;
  cost?: string | null;
}

export interface PriceSetting extends PriceSettingListItem {
  lines: PriceSettingLine[];
  relabel?: string[];
}

export interface PriceSettingInput {
  validFrom?: string;
  comment?: string;
  lines?: { productId: string; priceTypeId: string; storeId?: string | null; newPrice: string; currency?: string }[];
  generate?: { method: 'markup' | 'from_type'; priceTypeId: string; sourcePriceTypeId?: string; percent?: string; categoryId?: string; brandId?: string; productIds?: string[]; onlyMissing?: boolean };
}

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const pricingApi = {
  types: () => d(api.get<PriceType[]>('/price-types')),
  rates: () => d(api.get<{ current: { currency: string; rate: string; setAt: string }[]; history: { currency: string; rate: string; note: string | null; setAt: string; setByName: string | null }[] }>('/rates')),
  setRate: (rate: string, note?: string, currency = 'USD') => d(api.post('/rates/shop', { currency, rate, ...(note ? { note } : {}) })),
  settings: (q: { status?: string; page?: number; limit?: number }) => d(api.get<Page<PriceSettingListItem>>('/price-settings', { params: q })),
  setting: (id: string) => d(api.get<PriceSetting>(`/price-settings/${id}`)),
  createSetting: (b: PriceSettingInput) => d(api.post<PriceSetting>('/price-settings', b)),
  updateSetting: (id: string, b: PriceSettingInput & { version: number }) => d(api.patch<PriceSetting>(`/price-settings/${id}`, b)),
  postSetting: (id: string, version: number) => d(api.post<PriceSetting>(`/price-settings/${id}/post`, { version })),
  deleteSetting: (id: string, version: number) => api.delete(`/price-settings/${id}`, { params: { version } }),
};

export const usePriceTypes = () => useQuery({ queryKey: ['price-types'], queryFn: pricingApi.types, staleTime: 10 * 60_000 });
export const useShopRates = () => useQuery({ queryKey: ['rates'], queryFn: pricingApi.rates });
export const usePriceSettings = (q: { status?: string; page?: number }) =>
  useQuery({ queryKey: ['price-settings', q], queryFn: () => pricingApi.settings(q), placeholderData: keepPreviousData });
export const usePriceSetting = (id?: string) => useQuery({ queryKey: ['price-setting', id], queryFn: () => pricingApi.setting(id!), enabled: !!id });
