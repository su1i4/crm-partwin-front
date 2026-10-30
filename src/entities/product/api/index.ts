import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Page, type ProductCard, type ProductListItem, type SearchResult } from '@/shared/api';

export interface ProductListParams {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  categoryId?: string;
  brandId?: string;
  qualityClass?: string;
  status?: string;
  missing?: string;
  quickCreated?: boolean;
}

export const productApi = {
  list: (p: ProductListParams) => api.get<Page<ProductListItem>>('/products', { params: p }).then((r) => r.data),
  card: (id: string) => api.get<ProductCard>(`/products/${id}`).then((r) => r.data),
  quick: (b: { name: string; number?: string; brand?: string; price?: string; vehicles?: string[]; categoryId?: string; barcode?: string; noStockControl?: boolean }) =>
    api.post<ProductCard>('/products/quick', b).then((r) => r.data),
  search: (q: string, context = 'global', limit = 20) =>
    api.get<SearchResult>('/search', { params: { q, context, limit, log: false } }).then((r) => r.data),
};

export const useProducts = (p: ProductListParams) =>
  useQuery({ queryKey: ['products', p], queryFn: () => productApi.list(p), placeholderData: keepPreviousData });

export const useProduct = (id?: string) => useQuery({ queryKey: ['product', id], queryFn: () => productApi.card(id!), enabled: !!id });

export const useSearch = (q: string, context = 'global') =>
  useQuery({ queryKey: ['search', q, context], queryFn: () => productApi.search(q, context), enabled: q.trim().length >= 2, placeholderData: keepPreviousData });
