import { cn } from '../lib/cn';

export const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
    <span className={cn('relative h-5 w-9 rounded-full transition', checked ? 'bg-pill' : 'bg-line-strong')}>
      <span className={cn('absolute top-0.5 size-4 rounded-full bg-card shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </span>
    {label}
  </button>
);
