import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useMe, useSession } from '@/entities/session';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/shared/ui';

/** Точка: меняет контекст остатков, цен и отчётов (X-Store-Id). «Все точки» — только разрешённые (ТЗ 23.1) */
export function StoreSwitch({ compact }: { compact?: boolean }) {
  const { data: me } = useMe();
  const storeId = useSession((s) => s.storeId);
  const setStore = useSession((s) => s.setStore);
  const qc = useQueryClient();
  const stores = me?.stores ?? [];
  const current = stores.find((s) => s.id === storeId);
  const pick = (id: string | null) => {
    setStore(id);
    qc.invalidateQueries();
  };
  return (
    <Menu>
      <MenuTrigger className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-medium text-ink ring-1 ring-line outline-none hover:ring-line-strong">
        <MapPin className="size-4 text-accent" />
        {!compact && <span className="max-w-40 truncate">{current?.name ?? 'Все точки'}</span>}
        <ChevronDown className="size-3.5 text-muted" />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>Точка</MenuLabel>
        <MenuItem onSelect={() => pick(null)} active={!storeId}>
          <span className="flex-1">Все точки</span>
          {!storeId && <Check />}
        </MenuItem>
        <MenuSeparator />
        {stores.map((s) => (
          <MenuItem key={s.id} onSelect={() => pick(s.id)} active={s.id === storeId}>
            <span className="grid size-6 place-items-center rounded-full bg-card-muted text-[10px] font-semibold text-ink-2">{s.code.slice(0, 3)}</span>
            <span className="flex-1 truncate">{s.name}</span>
            {s.id === storeId && <Check />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
