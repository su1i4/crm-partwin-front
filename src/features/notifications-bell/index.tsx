import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarkRead, useNotifications } from '@/entities/notification';
import { cn } from '@/shared/lib/cn';
import { ago } from '@/shared/lib/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui';

export function NotificationsBell() {
  const { data } = useNotifications();
  const read = useMarkRead();
  const nav = useNavigate();
  const unread = data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger className="relative grid size-10 place-items-center rounded-full bg-card text-ink ring-1 ring-line outline-none hover:ring-line-strong" aria-label="Уведомления">
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink ring-2 ring-shell">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-32px))] p-2">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="font-medium text-ink">Уведомления</div>
          {unread > 0 && (
            <button className="text-xs text-muted hover:text-ink" onClick={() => read.mutate('all')}>
              Прочитать все
            </button>
          )}
        </div>
        <div className="scroll-thin max-h-96 overflow-y-auto">
          {(data?.items ?? []).length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">Пока ничего</div>}
          {data?.items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.readAt) read.mutate([n.id]);
                if (n.link) nav(n.link);
              }}
              className="flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-card-muted"
            >
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                <span className="mt-0.5 block text-[11px] text-faint">{ago(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
