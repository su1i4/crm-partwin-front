import { cn } from '../lib/cn';
import { avatarColor, initials } from '../lib/initials';

export const Avatar = ({ name, size = 28, className, ring }: { name?: string | null; size?: number; className?: string; ring?: boolean }) => (
  <span
    className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#3b2a2f]', ring && 'ring-2 ring-card', className)}
    style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: avatarColor(name) }}
    aria-hidden
  >
    {initials(name)}
  </span>
);
