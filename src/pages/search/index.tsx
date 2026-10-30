import { Camera, Car, HelpCircle, PackagePlus, Search, Store, Truck, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductThumb, QUALITY, QualityBadge, useSearch } from '@/entities/product';
import type { SearchItem } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { Button, EmptyState, ErrorState, Input, PageTitle, Pill, Skeleton, Tray } from '@/shared/ui';

const EXAMPLES = ['0 986-452.041', 'колодки камри 40', 'граната фит', '6PK1200', '35 52 7', 'rjkjlrb'];

function ItemRow({ i }: { i: SearchItem }) {
  return (
    <Link to={`/products/${i.id}`} className="flex items-center gap-3 rounded-[22px] bg-card p-2.5 pr-4 ring-1 ring-line transition hover:ring-line-strong">
      <ProductThumb fileId={i.photoFileId} size={46} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{i.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-mono text-ink-2">{i.mainNumber ?? i.sku}</span>
          <span>{i.brandName ?? 'без бренда'}</span>
          {i.analog?.throughAnalog && <Pill tone="warn" className="h-5">через аналог</Pill>}
          {i.applicabilityUnverified && <Pill tone="warn" className="h-5">применимость не уточнена</Pill>}
        </div>
      </div>
      <QualityBadge value={i.qualityClass} className="hidden sm:inline-flex" />
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-semibold text-ink tabular-nums">{money(i.price, i.currency ?? 'KGS')}</div>
        <div className={cn('text-xs whitespace-nowrap tabular-nums', Number(i.stockHere) > 0 ? 'text-ok' : 'text-muted')}>
          тут {num(i.stockHere, 3)} · всего {num(i.stockTotal, 3)}
        </div>
      </div>
    </Link>
  );
}

function Group({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: SearchItem[]; tone?: 'accent' | 'dark' | 'soft' }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-[15px] font-medium text-ink">
        {icon} {title} <Pill tone={tone ?? 'soft'}>{items.length}</Pill>
      </div>
      <div className="space-y-1.5">{items.map((i) => <ItemRow key={i.id} i={i} />)}</div>
    </section>
  );
}

/** Единый поиск (ТЗ 5.1): номер в любом формате, сленг, раскладка, размеры, машина; «лестница» классов */
export default function SearchPage() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounce(q, 250);
  const { data, isLoading, isFetching, error, refetch } = useSearch(dq, 'catalog');

  useEffect(() => {
    setSp(dq ? { q: dq } : {}, { replace: true });
  }, [dq, setSp]);

  return (
    <div className="space-y-6">
      <PageTitle title="Поиск и подбор" sub="Номер детали, название, сленг, VIN или код кузова — в одной строке" />
      <div className="flex gap-2">
        <Input
          autoFocus
          className="h-14 flex-1 px-5 text-base"
          icon={<Search />}
          placeholder="колодки камри 40, 04465-33450, граната фит…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          right={
            isFetching ? (
              <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />
            ) : q ? (
              <button onClick={() => setQ('')} aria-label="Очистить" className="text-muted hover:text-ink">
                <X className="size-4" />
              </button>
            ) : null
          }
        />
        <Button size="lg" className="h-14 w-14 justify-center p-0" title="Распознать номер камерой — на этапе 2" disabled>
          <Camera className="!size-5" />
        </Button>
      </div>

      {!dq && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => setQ(e)} className="rounded-full bg-card px-3.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line hover:ring-ink">
              {e}
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-[22px]" />)}</div>}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && dq && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {data.selection?.title && (
              <div className="flex items-center gap-3 rounded-[22px] bg-pill px-4 py-3 text-pill-ink">
                <Car className="size-4 text-accent" />
                <span className="text-sm">Подбор под машину: <b>{data.selection.title}</b></span>
              </div>
            )}
            {data.clarify.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-[22px] bg-warn-soft px-4 py-3">
                <HelpCircle className="size-4 text-warn" />
                <span className="mr-2 text-sm text-ink">{c.question}</span>
                {c.options.map((o) => (
                  <Pill key={o.value} tone="outline" className="cursor-pointer">
                    {o.label}
                  </Pill>
                ))}
              </div>
            ))}
            <Group title="В наличии в этой точке" icon={<Store className="size-4 text-ok" />} items={data.groups.here} tone="dark" />
            <Group title="В других точках" icon={<Truck className="size-4 text-muted" />} items={data.groups.elsewhere} />
            <Group title="Аналоги" icon={<Search className="size-4 text-accent" />} items={data.groups.analogs} tone="accent" />
            <Group title="Нет в наличии" icon={<X className="size-4 text-muted" />} items={data.groups.noStock} />
            {data.total === 0 && (
              <div className="rounded-[28px] bg-card">
                <EmptyState
                  title={`«${dq}» — не нашли`}
                  hint="Запрос записан в отчёт «Что спрашивают, но нет»."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="dark" onClick={() => (location.href = '/products?new=1')}>
                        <PackagePlus /> Создать товар
                      </Button>
                      <Button size="sm">Взял у соседа</Button>
                      <Button size="sm">
                        <UserPlus /> Заявка клиента
                      </Button>
                    </div>
                  }
                />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {data.ladder.length > 0 && (
              <Tray className="p-3">
                <div className="px-1 pb-2 text-[15px] font-medium">Лестница качества</div>
                <div className="space-y-1.5">
                  {data.ladder.map((l) => (
                    <div key={l.qualityClass} className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-3.5">
                      <span className={cn('size-2 rounded-full', QUALITY[l.qualityClass]?.dot)} />
                      <span className="flex-1 text-[13.5px] text-ink">{l.label}</span>
                      <span className="text-xs text-muted tabular-nums">от {money(l.minPrice)}</span>
                      <Pill tone="dark">{num(l.stockTotal)}</Pill>
                    </div>
                  ))}
                </div>
              </Tray>
            )}
            {data.groups.suppliers.length > 0 && (
              <Tray className="p-3">
                <div className="px-1 pb-2 text-[15px] font-medium">У поставщиков</div>
                <div className="space-y-1.5">
                  {data.groups.suppliers.map((s, i) => (
                    <div key={i} className="rounded-[18px] bg-card p-3">
                      <div className="flex justify-between gap-2 text-[13.5px]">
                        <span className="font-medium text-ink">{s.supplierName}</span>
                        <span className="font-semibold tabular-nums">{money(s.price, s.currency)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {s.brand} {s.number} {s.deliveryDays !== null && `· ${s.deliveryDays} дн.`}
                      </div>
                    </div>
                  ))}
                </div>
              </Tray>
            )}
            <div className="px-1 text-xs text-faint">
              {data.total} найдено за {data.tookMs} мс
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
