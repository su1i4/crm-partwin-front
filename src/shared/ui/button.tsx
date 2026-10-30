import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type Variant = 'dark' | 'accent' | 'outline' | 'ghost' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  dark: 'bg-pill text-pill-ink hover:opacity-90',
  accent: 'bg-accent text-accent-ink hover:brightness-95 shadow-[0_6px_16px_-6px_var(--accent)]',
  outline: 'bg-card text-ink border border-line hover:border-line-strong',
  ghost: 'text-ink-2 hover:bg-card-muted',
  soft: 'bg-card-muted text-ink hover:bg-line',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'size-10 justify-center',
  'icon-sm': 'size-8 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'outline', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap transition select-none',
        'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
