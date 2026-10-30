import type { QualityClass } from '@/shared/api';
import { cn } from '@/shared/lib/cn';

/** «Лестница» классов качества (ТЗ 5.1): оригинал → OEM → аналог → копия → б/у */
export const QUALITY: Record<QualityClass, { label: string; short: string; dot: string }> = {
  original: { label: 'Оригинал', short: 'ORIG', dot: 'bg-ink' },
  oem: { label: 'OEM', short: 'OEM', dot: 'bg-accent' },
  aftermarket: { label: 'Аналог', short: 'АНЛ', dot: 'bg-[#7a8cf0]' },
  copy: { label: 'Копия', short: 'КОП', dot: 'bg-warn' },
  used: { label: 'Б/у', short: 'Б/У', dot: 'bg-faint' },
};

export const QualityBadge = ({ value, className }: { value: QualityClass; className?: string }) => (
  <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full bg-card px-2 text-xs font-medium text-ink-2 ring-1 ring-line', className)}>
    <span className={cn('size-1.5 rounded-full', QUALITY[value]?.dot)} />
    {QUALITY[value]?.label ?? value}
  </span>
);
