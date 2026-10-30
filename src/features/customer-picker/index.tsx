import { Phone, Search, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCounterparties, type Counterparty } from '@/entities/pos';
import { useOffline } from '@/entities/pos-offline';
import { useOnline } from '@/shared/hooks/use-online';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { money } from '@/shared/lib/format';
import { Avatar, Dialog, Input, Pill, Skeleton } from '@/shared/ui';

const ROLE: Record<string, string> = { customer: 'Клиент', sto: 'СТО', master: 'Мастер', supplier: 'Поставщик', neighbor: 'Сосед', consignee: 'Реализатор' };

/** Без сети — клиенты из кэша кассы (для «одной кассы» — с долгом на момент синхронизации) */
function useLocalCounterparties(q: string, role: string | undefined, enabled: boolean) {
  const [res, setRes] = useState<{ items: Counterparty[]; total: number } | undefined>();
  useEffect(() => {
    const db = useOffline.getState().db;
    if (!enabled || !db) return;
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, '');
    void db.customers
      .filter((c) => (!role || c.roles.includes(role)) && (!t || c.name.toLowerCase().includes(t) || (!!digits && (c.phone ?? '').replace(/\D/g, '').includes(digits))))
      .limit(30)
      .toArray()
      .then((rows) =>
        setRes({
          items: rows.map((c) => ({ id: c.id, name: c.name, kind: 'person', phone: c.phone, roles: c.roles, groupName: null, debtKgs: c.debt ?? null, lastVisit: null })),
          total: rows.length,
        }),
      );
  }, [q, role, enabled]);
  return res;
}

/** Выбор контрагента по имени, телефону или госномеру */
export function CounterpartyPicker({
  open,
  onOpenChange,
  onPick,
  role,
  title = 'Клиент',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (c: Counterparty) => void;
  role?: string;
  title?: string;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const online = useOnline();
  const remote = useCounterparties(online ? dq : '__offline__', role);
  const local = useLocalCounterparties(dq, role, !online);
  const data = online ? remote.data : local;
  const isLoading = online && remote.isLoading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description="Имя, телефон или госномер машины">
      <Input
        className="mt-4"
        autoFocus
        icon={<Search />}
        placeholder="Азамат, 0555…, 01KG123"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        right={q ? <button onClick={() => setQ('')} className="text-muted" aria-label="Очистить"><X className="size-4" /></button> : null}
      />
      <div className="scroll-thin mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
        {data?.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted">
            <UserRound className="size-5" /> Никого не нашли. Новый клиент — в разделе «Клиенты» (этап 5).
          </div>
        )}
        {data?.items.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              onPick(c);
              onOpenChange(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-card-muted"
          >
            <Avatar name={c.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted">
                {c.phone && (
                  <>
                    <Phone className="size-3" /> {c.phone}
                  </>
                )}
                {c.groupName && <span>· {c.groupName}</span>}
              </span>
            </span>
            {Number(c.debtKgs) > 0 && <Pill tone="accent-outline">долг {money(c.debtKgs)}</Pill>}
            {c.roles.slice(0, 1).map((r) => (
              <Pill key={r} tone="soft">{ROLE[r] ?? r}</Pill>
            ))}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
