import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from './button';
import { errorMessage } from '../api/client';

export const EmptyState = ({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
    <div className="mb-1 grid size-12 place-items-center rounded-full bg-card-muted text-muted [&_svg]:size-5">{icon ?? <Inbox />}</div>
    <div className="font-medium text-ink">{title}</div>
    {hint && <div className="max-w-sm text-sm text-muted">{hint}</div>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
    <div className="mb-1 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
      <AlertCircle className="size-5" />
    </div>
    <div className="font-medium text-ink">Не удалось загрузить</div>
    <div className="max-w-sm text-sm text-muted">{errorMessage(error)}</div>
    {onRetry && (
      <Button size="sm" className="mt-2" onClick={onRetry}>
        Повторить
      </Button>
    )}
  </div>
);
