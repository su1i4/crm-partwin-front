import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-3xl bg-card shadow-card', className)} {...p} />
);

/** Серая «полка» — группа карточек, как блоки на референсе */
export const Tray = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-[28px] bg-card-muted p-2', className)} {...p} />
);

export const CardHeader = ({ title, hint, actions, className }: { title: React.ReactNode; hint?: React.ReactNode; actions?: React.ReactNode; className?: string }) => (
  <div className={cn('flex items-start justify-between gap-3 px-5 pt-4', className)}>
    <div className="min-w-0">
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
  </div>
);
