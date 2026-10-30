import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
}) => (
  <D.Root open={open} onOpenChange={onOpenChange}>
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          'fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 rounded-[28px] bg-card p-6 shadow-2xl outline-none',
          className,
        )}
        aria-describedby={description ? undefined : undefined}
      >
        {title ? <D.Title className="pr-8 text-lg font-semibold text-ink">{title}</D.Title> : <D.Title className="sr-only">Окно</D.Title>}
        {description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}
        {!hideClose && (
          <D.Close className="absolute top-5 right-5 grid size-8 place-items-center rounded-full text-muted hover:bg-card-muted" aria-label="Закрыть">
            <X className="size-4" />
          </D.Close>
        )}
        {children}
      </D.Content>
    </D.Portal>
  </D.Root>
);
