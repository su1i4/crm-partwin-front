import { cn } from '../lib/cn';

/** Переключатель-«таблетки», как «Revenue / Leads / W/L» на референсе */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('inline-flex items-center gap-0.5 rounded-full bg-card p-1 ring-1 ring-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full font-medium whitespace-nowrap transition',
            size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[13px]',
            value === o.value ? 'bg-pill text-pill-ink' : 'text-ink-2 hover:bg-card-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
