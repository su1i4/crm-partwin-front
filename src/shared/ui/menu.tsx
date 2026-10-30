import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export const MenuContent = ({ children, className, align = 'end' }: { children: ReactNode; className?: string; align?: 'start' | 'end' | 'center' }) => (
  <M.Portal>
    <M.Content
      align={align}
      sideOffset={8}
      className={cn('z-50 min-w-52 rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-line', className)}
    >
      {children}
    </M.Content>
  </M.Portal>
);

export const MenuItem = ({ children, onSelect, className, active }: { children: ReactNode; onSelect?: () => void; className?: string; active?: boolean }) => (
  <M.Item
    onSelect={onSelect}
    className={cn(
      'flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink outline-none select-none data-[highlighted]:bg-card-muted [&_svg]:size-4 [&_svg]:text-muted',
      active && 'font-medium',
      className,
    )}
  >
    {children}
  </M.Item>
);

export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{children}</M.Label>;
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
