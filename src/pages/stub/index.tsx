import { Hammer } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { NAV, STAGES } from '@/shared/config/navigation';
import { PageTitle, Pill } from '@/shared/ui';

/** Раздел ещё не сделан — показываем, на каком этапе он появится */
export default function StubPage() {
  const { pathname } = useLocation();
  const item = NAV.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => ({ ...i, section: s.label })))).find((i) => i.to.split('?')[0] === pathname);
  const stage = item?.stage;
  return (
    <div className="space-y-6">
      <PageTitle title={item?.label ?? 'Раздел'} sub={item?.section} />
      <div className="relative overflow-hidden rounded-[32px] bg-card p-8 sm:p-12">
        <div className="hatch absolute inset-y-0 right-0 hidden w-1/3 sm:block" />
        <div className="relative max-w-lg">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink">
            <Hammer className="size-5" />
          </span>
          <div className="mt-5 flex items-center gap-2">
            {stage && <Pill tone="dark">Этап {stage}</Pill>}
            <span className="text-sm text-muted">в разработке</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{stage ? STAGES[stage] : 'Скоро'}</h2>
          <p className="mt-2 text-sm text-muted">Backend для этого раздела уже готов — экран подключим на указанном этапе.</p>
          <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-pill px-5 text-sm font-medium text-pill-ink">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
