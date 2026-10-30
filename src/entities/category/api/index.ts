import { useQuery } from '@tanstack/react-query';
import { api, type Category } from '@/shared/api';

export interface CategoryNode extends Category {
  children: CategoryNode[];
  total: number;
}

export function buildTree(list: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  list.forEach((c) => map.set(c.id, { ...c, children: [], total: c.productsCount }));
  const roots: CategoryNode[] = [];
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const sum = (n: CategoryNode): number => (n.total = n.productsCount + n.children.reduce((a, c) => a + sum(c), 0));
  roots.forEach(sum);
  return roots;
}

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories').then((r) => r.data), staleTime: 5 * 60_000 });
