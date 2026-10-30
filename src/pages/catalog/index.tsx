import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Filter, FolderTree, Plus, Search, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buildTree, useCategories, type CategoryNode } from '@/entities/category';
import { ProductThumb, QUALITY, QualityBadge, useProducts } from '@/entities/product';
import { useCan } from '@/entities/session';
import { QuickProductDialog } from '@/features/quick-product';
import type { QualityClass } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, money, num } from '@/shared/lib/format';
import { Button, EmptyState, ErrorState, Input, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, PageTitle, Pill, Segmented, Skeleton, Tray } from '@/shared/ui';

const MISSING = [
  { value: 'price', label: 'Без цены' },
  { value: 'photo', label: 'Без фото' },
  { value: 'number', label: 'Без номера' },
  { value: 'category', label: 'Без категории' },
  { value: 'applicability', label: 'Без применимости' },
];
const SORTS = [
  { value: 'name', label: 'По названию' },
  { value: '-updatedAt', label: 'Сначала изменённые' },
  { value: 'sku', label: 'По артикулу' },
];
const LIMIT = 50;

function CategoryTree({ nodes, value, onPick, depth = 0 }: { nodes: CategoryNode[]; value?: string; onPick: (id?: string) => void; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className={cn(depth > 0 && 'ml-3 border-l border-line pl-2')}>
      {nodes.map((n) => {
        const on = value === n.id;
        const isOpen = open[n.id] ?? false;
        return (
          <div key={n.id}>
            <div className={cn('group flex items-center gap-1 rounded-xl pr-1.5', on && 'bg-card shadow-card')}>
              {n.children.length ? (
                <button onClick={() => setOpen({ ...open, [n.id]: !isOpen })} className="grid size-6 shrink-0 place-items-center text-muted" aria-label="Раскрыть">
                  <ChevronRight className={cn('size-3.5 transition', isOpen && 'rotate-90')} />
                </button>
              ) : (
                <span className="size-6 shrink-0" />
              )}
              <button onClick={() => onPick(on ? undefined : n.id)} className={cn('min-w-0 flex-1 truncate py-1.5 text-left text-[13.5px]', on ? 'font-medium text-accent' : 'text-ink-2 hover:text-ink')}>
                {n.name}
              </button>
              <span className="text-[11px] text-faint tabular-nums">{n.total}</span>
            </div>
            {isOpen && n.children.length > 0 && <CategoryTree nodes={n.children} value={value} onPick={onPick} depth={depth + 1} />}
          </div>
        );
      })}
    </div>
  );
}

export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();
  const can = useCan();
  const set = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (resetPage) next.delete('page');
    setSp(next, { replace: true });
  };
  const page = Number(sp.get('page') ?? 1);
  const categoryId = sp.get('category') ?? undefined;
  const quality = (sp.get('quality') ?? undefined) as QualityClass | undefined;
  const missing = sp.get('missing') ?? undefined;
  const quick = sp.get('quick') === '1';
  const sort = sp.get('sort') ?? 'name';
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounce(q, 300);
  const [view, setView] = useState<'groups' | 'makes'>('groups');

  useEffect(() => {
    if ((sp.get('q') ?? '') !== dq) set({ q: dq || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const { data, isLoading, error, refetch, isFetching } = useProducts({
    page,
    limit: LIMIT,
    sort,
    q: dq || undefined,
    categoryId,
    qualityClass: quality,
    missing,
    quickCreated: quick || undefined,
  });
  const cats = useCategories();
  const tree = useMemo(() => buildTree(cats.data ?? []), [cats.data]);
  const catName = cats.data?.find((c) => c.id === categoryId)?.name;
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const filters = [
    catName && { key: 'category', label: catName },
    quality && { key: 'quality', label: QUALITY[quality].label },
    missing && { key: 'missing', label: MISSING.find((m) => m.value === missing)?.label ?? missing },
    quick && { key: 'quick', label: 'Созданы на кассе' },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="space-y-6">
      <PageTitle
        title={missing ? 'Дозаполнить' : quick ? 'Созданы на кассе' : 'Каталог'}
        sub={data ? `${num(data.total)} товаров${missing || quick ? ' — начните с ходовых' : ''}` : ' '}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'groups', label: 'По группам' },
                { value: 'makes', label: 'По маркам' },
              ]}
            />
            {can('products.write') && (
              <Button variant="dark" onClick={() => set({ new: '1' }, false)}>
                <Plus /> Новый товар
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Tray className="hidden h-fit p-3 lg:block">
          <div className="flex items-center justify-between px-1 pb-2">
            <div className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <FolderTree className="size-4 text-accent" /> {view === 'groups' ? 'Группы деталей' : 'Марки авто'}
            </div>
            {categoryId && (
              <button onClick={() => set({ category: undefined })} className="text-xs text-muted hover:text-ink">
                Сбросить
              </button>
            )}
          </div>
          {view === 'makes' ? (
            <div className="rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted">Дерево по маркам — на этапе 3 (из применимости товаров)</div>
          ) : cats.isLoading ? (
            <div className="space-y-2 p-1">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : (
            <div className="scroll-thin max-h-[62vh] overflow-y-auto">
              <CategoryTree nodes={tree} value={categoryId} onPick={(id) => set({ category: id })} />
            </div>
          )}
        </Tray>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-[220px] flex-1"
              icon={<Search />}
              placeholder="Номер в любом формате, артикул, название…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              right={
                q ? (
                  <button onClick={() => setQ('')} className="text-muted hover:text-ink" aria-label="Очистить">
                    <X className="size-4" />
                  </button>
                ) : isFetching ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />
                ) : null
              }
            />
            <Menu>
              <MenuTrigger className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-[13.5px] text-ink ring-1 ring-line outline-none lg:hidden">
                <FolderTree className="size-4" /> {catName ?? 'Группа'} <ChevronDown className="size-3.5 text-muted" />
              </MenuTrigger>
              <MenuContent align="start" className="max-h-80 overflow-y-auto">
                <MenuItem onSelect={() => set({ category: undefined })}>Все группы</MenuItem>
                {tree.map((c) => (
                  <MenuItem key={c.id} onSelect={() => set({ category: c.id })} active={c.id === categoryId}>
                    {c.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-[13.5px] text-ink ring-1 ring-line outline-none hover:ring-line-strong">
                <Filter className="size-4" /> Фильтры
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Класс качества</MenuLabel>
                {(Object.keys(QUALITY) as QualityClass[]).map((k) => (
                  <MenuItem key={k} onSelect={() => set({ quality: quality === k ? undefined : k })} active={quality === k}>
                    <span className={cn('size-2 rounded-full', QUALITY[k].dot)} /> {QUALITY[k].label}
                  </MenuItem>
                ))}
                <MenuLabel>Чего не хватает</MenuLabel>
                {MISSING.map((m) => (
                  <MenuItem key={m.value} onSelect={() => set({ missing: missing === m.value ? undefined : m.value })} active={missing === m.value}>
                    {m.label}
                  </MenuItem>
                ))}
                <MenuLabel>Прочее</MenuLabel>
                <MenuItem onSelect={() => set({ quick: quick ? undefined : '1' })} active={quick}>
                  <Zap /> Созданы на кассе
                </MenuItem>
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger className="grid size-11 place-items-center rounded-full bg-card text-ink ring-1 ring-line outline-none hover:ring-line-strong" aria-label="Сортировка">
                <ArrowDownUp className="size-4" />
              </MenuTrigger>
              <MenuContent>
                {SORTS.map((s) => (
                  <MenuItem key={s.value} onSelect={() => set({ sort: s.value === 'name' ? undefined : s.value }, false)} active={sort === s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>

          {filters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <button key={f.key} onClick={() => set({ [f.key]: undefined })} className="flex h-8 items-center gap-1.5 rounded-full bg-pill pr-2 pl-3 text-xs font-medium text-pill-ink">
                  {f.label} <X className="size-3.5 opacity-70" />
                </button>
              ))}
            </div>
          )}

          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)_100px] gap-4 px-4 pt-1 text-xs text-muted md:grid">
            <span>Товар</span>
            <span>Бренд</span>
            <span className="w-[104px]">Класс</span>
            <span>Группа</span>
            <span className="text-right">Цена</span>
          </div>

          {isLoading && <div className="space-y-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 rounded-[22px]" />)}</div>}
          {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}
          {data && data.items.length === 0 && (
            <div className="rounded-[28px] bg-card">
              <EmptyState
                title={q ? `По запросу «${q}» ничего` : 'Товаров пока нет'}
                hint="Создайте товар за 15 секунд — остальное дозаполните потом. Или загрузите Excel / выгрузку 1С на этапе 7."
                action={
                  can('products.write') && (
                    <Button variant="dark" size="sm" onClick={() => set({ new: '1' }, false)}>
                      <Plus /> Создать товар
                    </Button>
                  )
                }
              />
            </div>
          )}

          <div className={cn('space-y-1.5 transition-opacity', isFetching && !isLoading && 'opacity-60')}>
            {data?.items.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[22px] bg-card p-2.5 pr-4 ring-1 ring-line transition hover:ring-line-strong md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)_100px]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb fileId={p.photoFileId} size={44} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-medium text-ink">{p.name}</span>
                      {p.quickCreated && <Zap className="size-3.5 shrink-0 text-warn" aria-label="Создан на кассе" />}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      <span className="font-mono text-ink-2">{p.mainNumber ?? '—'}</span> · арт. {p.sku}
                      <span className="md:hidden"> · {p.brandName ?? 'без бренда'}</span>
                    </span>
                  </span>
                </span>
                <span className="hidden truncate text-[13.5px] text-ink-2 md:block">{p.brandName ?? '—'}</span>
                <span className="hidden w-[104px] md:block">
                  <QualityBadge value={p.qualityClass} />
                </span>
                <span className="hidden truncate text-[13px] text-muted md:block">{p.categoryName ?? 'Без группы'}</span>
                <span className="text-right">
                  {p.retailPrice !== null ? (
                    <span className="text-[14px] font-semibold text-ink tabular-nums">{money(p.retailPrice, p.retailCurrency ?? 'KGS')}</span>
                  ) : p.priceNegotiable ? (
                    <Pill tone="warn">договорная</Pill>
                  ) : (
                    <Pill tone="muted">нет цены</Pill>
                  )}
                  <span className="hidden text-[11px] text-faint lg:block">{ago(p.updatedAt)}</span>
                </span>
              </Link>
            ))}
          </div>

          {data && data.total > LIMIT && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} из {num(data.total)}
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="icon-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label="Назад">
                  <ChevronLeft />
                </Button>
                <Pill tone="dark" className="h-8 px-3">
                  {page} / {pages}
                </Pill>
                <Button size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label="Вперёд">
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickProductDialog open={sp.get('new') === '1'} onOpenChange={(v) => !v && set({ new: undefined }, false)} />
    </div>
  );
}
