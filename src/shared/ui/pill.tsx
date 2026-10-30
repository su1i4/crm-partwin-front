import type { HTMLAttributes } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { pct } from '../lib/format';

type Tone = 'dark' | 'accent' | 'accent-outline' | 'soft' | 'muted' | 'ok' | 'warn' | 'outline';
const tones: Record<Tone, string> = {
  dark: 'bg-pill text-pill-ink',
  accent: 'bg-accent text-accent-ink',
  'accent-outline': 'bg-accent-soft text-accent ring-1 ring-accent-line',
  soft: 'bg-card-muted text-ink-2',
  muted: 'bg-line text-muted',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  outline: 'bg-card text-ink-2 ring-1 ring-line',
};

export const Pill = ({ tone = 'soft', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) => (
  <span
    className={cn('inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums whitespace-nowrap', tones[tone], className)}
    {...p}
  />
);

/** Дельта в %: стрелка и цвет; inverse — когда рост плохо */
export const Delta = ({ value, className, inverse }: { value: number | null | undefined; className?: string; inverse?: boolean }) => {
  if (value === null || value === undefined) return <Pill tone="muted" className={className}>—</Pill>;
  const up = value >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Pill tone={good ? 'accent' : 'dark'} className={cn('pl-1.5', className)}>
      <Icon className="size-3" strokeWidth={2.6} />
      {pct(value)}
    </Pill>
  );
};
