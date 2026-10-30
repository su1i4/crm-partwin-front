import type { ReactNode } from 'react';

/** Крупный серый заголовок, как «New report» на референсе */
export const PageTitle = ({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[28px] leading-tight font-medium tracking-tight text-faint sm:text-[34px]">{title}</h1>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
