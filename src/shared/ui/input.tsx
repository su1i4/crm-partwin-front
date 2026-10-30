import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  right?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, icon, right, invalid, ...p }, ref) => (
  <label
    className={cn(
      'flex h-11 items-center gap-2 rounded-full bg-card px-4 ring-1 ring-line transition focus-within:ring-2 focus-within:ring-ink/80',
      invalid && 'ring-2 ring-accent focus-within:ring-accent',
      className,
    )}
  >
    {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
    <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" {...p} />
    {right}
  </label>
));
Input.displayName = 'Input';

export const Field = ({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) => (
  <div className={cn('space-y-1.5', className)}>
    <div className="px-1 text-[13px] font-medium text-ink-2">{label}</div>
    {children}
    {error ? <div className="px-1 text-xs text-accent">{error}</div> : hint ? <div className="px-1 text-xs text-muted">{hint}</div> : null}
  </div>
);

export const Kbd = ({ children, className }: { children: ReactNode; className?: string }) => (
  <kbd className={cn('rounded-md border border-line bg-card-muted px-1.5 py-0.5 font-sans text-[11px] text-muted', className)}>{children}</kbd>
);
