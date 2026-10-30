import * as P from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverContent = ({ children, className, align = 'end' }: { children: ReactNode; className?: string; align?: 'start' | 'end' | 'center' }) => (
  <P.Portal>
    <P.Content align={align} sideOffset={8} className={cn('z-50 rounded-3xl bg-card shadow-xl ring-1 ring-line outline-none', className)}>
      {children}
    </P.Content>
  </P.Portal>
);
