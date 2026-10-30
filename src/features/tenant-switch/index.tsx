import { useMutation } from '@tanstack/react-query';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, useMe, useSession } from '@/entities/session';
import { errorMessage } from '@/shared/api';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/shared/ui';
import { useAfterAuth } from '../auth';

/** Переключатель магазина (аккаунта) — «Codename.com ▾» на референсе. Смена магазина = новый токен */
export function TenantSwitch() {
  const tenants = useSession((s) => s.tenants);
  const current = useSession((s) => s.currentTenantId);
  const { data: me } = useMe();
  const after = useAfterAuth();
  const m = useMutation({ mutationFn: authApi.selectTenant, onSuccess: (r) => after(r), onError: (e) => toast.error(errorMessage(e)) });
  const name = me?.tenant?.name ?? tenants.find((t) => t.tenantId === current)?.tenantName ?? 'Магазин';

  return (
    <Menu>
      <MenuTrigger className="flex max-w-full items-center gap-1 rounded-full py-1 text-left text-[15px] font-semibold text-ink outline-none">
        <span className="truncate">{name}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Мои магазины</MenuLabel>
        {tenants.map((t) => (
          <MenuItem key={t.tenantId} onSelect={() => t.tenantId !== current && m.mutate(t.tenantId)} active={t.tenantId === current}>
            <span className="flex-1 truncate">{t.tenantName}</span>
            {t.tenantId === current && <Check />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => toast('Новый магазин создаётся через регистрацию владельца')}>
          <Plus /> Ещё магазин
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
