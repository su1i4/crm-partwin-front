import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';

export type WarehouseType = 'sales_floor' | 'storage' | 'defect' | 'scrap' | 'customer' | 'transit';
export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  sales_floor: 'Торговый зал',
  storage: 'Склад',
  defect: 'Брак',
  scrap: 'Лом',
  customer: 'У клиента',
  transit: 'Транзит',
};

export interface Warehouse {
  id: string;
  storeId: string | null;
  name: string;
  code: string;
  type: WarehouseType;
  storageLevel: number;
  isActive: boolean;
  version: number;
}

export const useWarehouses = (storeId?: string | null) =>
  useQuery({
    queryKey: ['warehouses', storeId ?? null],
    queryFn: () => api.get<Warehouse[]>('/warehouses', { params: storeId ? { storeId } : {} }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

/** Склады, куда реально кладут товар (без виртуальных «у клиента» и «транзит») */
export const physical = (w: Warehouse[] | undefined) => (w ?? []).filter((x) => x.isActive && x.type !== 'customer' && x.type !== 'transit');
