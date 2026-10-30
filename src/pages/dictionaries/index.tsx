import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FolderPlus, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { buildTree, useCategories, type CategoryNode } from '@/entities/category';
import { useCan } from '@/entities/session';
import { api, errorMessage, type Brand, type Category } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { Button, Card, Dialog, EmptyState, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

// ── Категории ───────────────────────────────────────────

type CatForm = { id?: string; version?: number; name: string; parentId: string | null; warrantyDays: string; returnDays: string; returnConditions: string; pairHint: boolean; noStockControl: boolean; universal: boolean; negativeStock: '' | 'forbid' | 'warn' };

function CatNode({ n, depth, onEdit, onAdd, canEdit }: { n: CategoryNode; depth: number; onEdit: (c: Category) => void; onAdd: (parent: Category) => void; canEdit: boolean }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div className={cn(depth > 0 && 'ml-4 border-l border-line pl-2')}>
      <div className="group flex items-center gap-1 rounded-xl py-1 pr-1 hover:bg-card">
        <button onClick={() => setOpen(!open)} className={cn('grid size-7 place-items-center text-muted', !n.children.length && 'invisible')} aria-label="Раскрыть">
          <ChevronRight className={cn('size-3.5 transition', open && 'rotate-90')} />
        </button>
        <span className="min-w-0 flex-1 truncate text-[14px]">{n.name}</span>
        {n.settings?.universal && <Pill tone="soft" className="h-5">универсальное</Pill>}
        {n.settings?.warrantyDays ? <Pill tone="outline" className="h-5">гар. {n.settings.warrantyDays} дн</Pill> : null}
        <span className="w-12 text-right text-xs text-faint tabular-nums">{n.total}</span>
        {canEdit && (
          <span className="flex opacity-0 transition group-hover:opacity-100">
            <button onClick={() => onAdd(n)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted" title="Подгруппа">
              <Plus className="size-3.5" />
            </button>
            <button onClick={() => onEdit(n)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted" title="Изменить">
              <Pencil className="size-3.5" />
            </button>
          </span>
        )}
      </div>
      {open && n.children.map((c) => <CatNode key={c.id} n={c} depth={depth + 1} onEdit={onEdit} onAdd={onAdd} canEdit={canEdit} />)}
    </div>
  );
}

/** Категории (ТЗ 4.6): дерево, правила гарантии / возврата / минуса наследуются вниз */
export function CategoriesPage() {
  const cats = useCategories();
  const can = useCan();
  const qc = useQueryClient();
  const tree = useMemo(() => buildTree(cats.data ?? []), [cats.data]);
  const [form, setForm] = useState<CatForm | null>(null);
  const toForm = (c?: Category, parentId: string | null = null): CatForm => ({
    id: c?.id,
    version: c?.version,
    name: c?.name ?? '',
    parentId: c ? c.parentId : parentId,
    warrantyDays: c?.settings?.warrantyDays?.toString() ?? '',
    returnDays: c?.settings?.returnDays?.toString() ?? '',
    returnConditions: c?.settings?.returnConditions ?? '',
    pairHint: !!c?.settings?.pairHint,
    noStockControl: !!c?.settings?.noStockControl,
    universal: !!c?.settings?.universal,
    negativeStock: c?.settings?.negativeStock ?? '',
  });
  const save = useMutation({
    mutationFn: async (f: CatForm) => {
      const settings = {
        warrantyDays: f.warrantyDays ? Number(f.warrantyDays) : null,
        returnDays: f.returnDays ? Number(f.returnDays) : null,
        returnConditions: f.returnConditions || null,
        pairHint: f.pairHint,
        noStockControl: f.noStockControl,
        universal: f.universal,
        ...(f.negativeStock ? { negativeStock: f.negativeStock } : {}),
      };
      if (f.id) return api.patch(`/categories/${f.id}`, { version: f.version, name: f.name, parentId: f.parentId, settings });
      return api.post('/categories', { name: f.name, ...(f.parentId ? { parentId: f.parentId } : {}), settings });
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['categories'] }), setForm(null), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (f: CatForm) => api.delete(`/categories/${f.id}`, { params: { version: f.version } }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['categories'] }), setForm(null), toast('Категория удалена')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const canEdit = can('catalog.manage');
  return (
    <div className="space-y-6">
      <PageTitle
        title="Категории"
        sub="Правила группы (гарантия, возврат, «обычно берут парой», минус) действуют на все подгруппы"
        actions={
          canEdit && (
            <Button variant="dark" onClick={() => setForm(toForm())}>
              <FolderPlus /> Группа
            </Button>
          )
        }
      />
      <Tray className="p-3">
        {cats.isLoading ? <Skeleton className="h-64" /> : tree.map((n) => <CatNode key={n.id} n={n} depth={0} canEdit={canEdit} onEdit={(c) => setForm(toForm(c))} onAdd={(p) => setForm(toForm(undefined, p.id))} />)}
      </Tray>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)} title={form?.id ? 'Группа' : 'Новая группа'} className="max-w-xl">
        {form && (
          <div className="mt-4 space-y-4">
            <Field label="Название">
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Родитель">
              <select value={form.parentId ?? ''} onChange={(e) => setForm({ ...form, parentId: e.target.value || null })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                <option value="">— корень —</option>
                {(cats.data ?? []).filter((c) => c.id !== form.id).map((c) => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.level)}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Гарантия, дней" hint="Пусто — как у родителя">
                <Input inputMode="numeric" value={form.warrantyDays} onChange={(e) => setForm({ ...form, warrantyDays: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Возврат, дней">
                <Input inputMode="numeric" value={form.returnDays} onChange={(e) => setForm({ ...form, returnDays: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Field label="Условия возврата">
              <Input value={form.returnConditions} onChange={(e) => setForm({ ...form, returnConditions: e.target.value })} placeholder="Только без следов установки" />
            </Field>
            <Field label="Продажа в минус">
              <select value={form.negativeStock} onChange={(e) => setForm({ ...form, negativeStock: e.target.value as CatForm['negativeStock'] })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                <option value="">Как в настройках магазина</option>
                <option value="forbid">Запретить</option>
                <option value="warn">Разрешить с предупреждением</option>
              </select>
            </Field>
            <div className="flex flex-col gap-2.5">
              <Switch checked={form.pairHint} onChange={(v) => setForm({ ...form, pairHint: v })} label="«Обычно берут парой» — подсказка на кассе" />
              <Switch checked={form.noStockControl} onChange={(v) => setForm({ ...form, noStockControl: v })} label="Без контроля остатка" />
              <Switch checked={form.universal} onChange={(v) => setForm({ ...form, universal: v })} label="Универсальное (масла, химия — без привязки к авто)" />
            </div>
            <div className="flex justify-between gap-2">
              {form.id ? (
                <Button variant="ghost" className="text-accent" loading={remove.isPending} onClick={() => confirm('Удалить группу?') && remove.mutate(form)}>
                  <Trash2 /> Удалить
                </Button>
              ) : (
                <span />
              )}
              <Button variant="dark" disabled={!form.name.trim()} loading={save.isPending} onClick={() => save.mutate(form)}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Бренды ──────────────────────────────────────────────

/** Бренды (ТЗ 4.2): свои + общий справочник с синонимами; «Подключить» общий бренд */
export function BrandsPage() {
  const can = useCan();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const { data, isLoading } = useQuery({ queryKey: ['brands', dq], queryFn: () => api.get<Brand[]>('/brands', { params: { q: dq || undefined } }).then((r) => r.data) });
  const [form, setForm] = useState<{ id?: string | null; version?: number; name: string; aliases: string; country: string } | null>(null);
  const save = useMutation({
    mutationFn: async (f: NonNullable<typeof form>) => {
      const aliases = f.aliases.split(',').map((s) => s.trim()).filter(Boolean);
      if (f.id) return api.patch(`/brands/${f.id}`, { version: f.version, name: f.name, aliases, country: f.country });
      return api.post('/brands', { name: f.name, aliases, ...(f.country ? { country: f.country } : {}) });
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['brands'] }), setForm(null), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const adopt = useMutation({
    mutationFn: (b: Brand) => api.post('/brands', { name: b.name, globalBrandId: b.globalBrandId }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['brands'] }), toast.success('Бренд подключён')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const own = data?.filter((b) => b.source === 'tenant') ?? [];
  const global = data?.filter((b) => b.source === 'global') ?? [];
  return (
    <div className="space-y-6">
      <PageTitle
        title="Бренды"
        sub="Синонимы склеивают прайсы разных поставщиков: MB = Mercedes-Benz, TRW Automotive = TRW"
        actions={
          can('catalog.manage') && (
            <Button variant="dark" onClick={() => setForm({ name: '', aliases: '', country: '' })}>
              <Plus /> Бренд
            </Button>
          )
        }
      />
      <Input icon={<Search />} placeholder="Поиск бренда или синонима" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tray className="p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">Бренды магазина · {own.length}</div>
          <div className="space-y-1">
            {own.map((b) => (
              <button
                key={b.id}
                onClick={() => can('catalog.manage') && setForm({ id: b.id, version: b.version, name: b.name, aliases: (b.aliases ?? []).join(', '), country: b.country ?? '' })}
                className="flex w-full items-center gap-3 rounded-[16px] bg-card px-3 py-2 text-left"
              >
                <Tag className="size-4 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{b.name}</span>
                  {b.aliases?.length ? <span className="block truncate text-xs text-muted">{b.aliases.join(', ')}</span> : null}
                </span>
                {b.isCarMaker && <Pill tone="soft">автопроизводитель</Pill>}
                {b.isNoBrand && <Pill tone="muted">без бренда</Pill>}
                {b.country && <span className="text-xs text-muted">{b.country}</span>}
              </button>
            ))}
            {!own.length && !isLoading && <EmptyState title="Своих брендов нет" hint="Бренд создаётся сам при вводе товара или подключается из общего справочника" />}
          </div>
        </Tray>
        <Tray className="p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">Общий справочник</div>
          <div className="space-y-1">
            {global.map((b) => (
              <div key={b.globalBrandId} className="flex items-center gap-3 rounded-[16px] bg-card px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px]">{b.name}</span>
                  {b.aliases?.length ? <span className="block truncate text-xs text-muted">{b.aliases.join(', ')}</span> : null}
                </span>
                {can('catalog.manage') && (
                  <Button size="sm" onClick={() => adopt.mutate(b)}>
                    Подключить
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Tray>
      </div>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)} title={form?.id ? 'Бренд' : 'Новый бренд'}>
        {form && (
          <div className="mt-4 space-y-4">
            <Field label="Название">
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Синонимы" hint="Через запятую: как бренд пишут в прайсах">
              <Input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="Масума, Masuma Japan" />
            </Field>
            <Field label="Страна">
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!form.name.trim()} loading={save.isPending} onClick={() => save.mutate(form)}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Типы деталей ────────────────────────────────────────

interface Attr {
  id: string;
  name: string;
  code: string;
  valueType: 'string' | 'number' | 'boolean' | 'list' | 'size';
  unit: string | null;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  options: string[] | null;
  version: number;
}
interface PartType {
  id: string;
  name: string;
  code: string;
  version: number;
  attributes: Attr[];
}
const VT: Record<Attr['valueType'], string> = { string: 'строка', number: 'число', boolean: 'да / нет', list: 'список', size: 'размер' };

/** Типы деталей и атрибуты (ТЗ 4.5): шаблон полей для фильтров и поиска */
export function PartTypesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['part-types'], queryFn: () => api.get<{ commonAttributes: Attr[]; types: PartType[] }>('/part-types').then((r) => r.data) });
  const [sel, setSel] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const [attr, setAttr] = useState<{ typeId: string | null; name: string; valueType: Attr['valueType']; unit: string; options: string; filterable: boolean; searchable: boolean; required: boolean } | null>(null);
  const type = data?.types.find((t) => t.id === sel) ?? null;
  const createType = useMutation({
    mutationFn: (name: string) => api.post('/part-types', { name }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['part-types'] }), setNewType(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const createAttr = useMutation({
    mutationFn: (a: NonNullable<typeof attr>) =>
      api.post(a.typeId ? `/part-types/${a.typeId}/attributes` : '/attributes', {
        name: a.name,
        valueType: a.valueType,
        ...(a.unit ? { unit: a.unit } : {}),
        ...(a.valueType === 'list' ? { options: a.options.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
        filterable: a.filterable,
        searchable: a.searchable,
        required: a.required,
      }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['part-types'] }), setAttr(null), toast.success('Атрибут добавлен')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeAttr = useMutation({
    mutationFn: (a: Attr) => api.delete(`/attributes/${a.id}`, { params: { version: a.version } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['part-types'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const list = (attrs: Attr[], typeId: string | null) => (
    <div className="space-y-1">
      {attrs.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-[14px] bg-card px-3 py-2 text-[13.5px]">
          <span className="min-w-0 flex-1">
            {a.name} {a.unit && <span className="text-muted">({a.unit})</span>}
            {a.options?.length ? <span className="block truncate text-xs text-muted">{a.options.join(', ')}</span> : null}
          </span>
          <Pill tone="soft" className="h-5">{VT[a.valueType]}</Pill>
          {a.filterable && <Pill tone="outline" className="h-5">фильтр</Pill>}
          {a.searchable && <Pill tone="outline" className="h-5">поиск</Pill>}
          {can('catalog.manage') && (
            <button onClick={() => confirm(`Удалить атрибут «${a.name}»?`) && removeAttr.mutate(a)} className="text-muted hover:text-accent" aria-label="Удалить">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {can('catalog.manage') && (
        <button onClick={() => setAttr({ typeId, name: '', valueType: 'string', unit: '', options: '', filterable: true, searchable: false, required: false })} className="flex h-9 w-full items-center justify-center gap-1 rounded-[14px] text-[13px] text-muted ring-1 ring-line ring-dashed hover:text-ink">
          <Plus className="size-3.5" /> Атрибут
        </button>
      )}
    </div>
  );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Типы деталей"
        sub="Атрибуты типа — поля карточки, фильтры каталога и размеры в поиске («35 52 7», «6PK1200»)"
        actions={
          can('catalog.manage') && (
            <Button variant="dark" onClick={() => setNewType('')}>
              <Plus /> Тип
            </Button>
          )
        }
      />
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Tray className="h-fit space-y-1 p-2">
            <button onClick={() => setSel(null)} className={cn('w-full rounded-[14px] px-3 py-2 text-left text-[14px]', !sel ? 'bg-card font-medium shadow-card' : 'hover:bg-card')}>
              Все детали (общие атрибуты)
            </button>
            {data.types.map((t) => (
              <button key={t.id} onClick={() => setSel(t.id)} className={cn('flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[14px]', sel === t.id ? 'bg-card font-medium shadow-card' : 'hover:bg-card')}>
                {t.name} <span className="text-xs text-faint">{t.attributes.length}</span>
              </button>
            ))}
          </Tray>
          <Card className="p-4">
            <div className="mb-3 text-[15px] font-medium">{type?.name ?? 'Общие атрибуты — у всех деталей'}</div>
            {list(type ? type.attributes : data.commonAttributes, type?.id ?? null)}
          </Card>
        </div>
      )}
      <Dialog open={newType !== null} onOpenChange={(v) => !v && setNewType(null)} title="Новый тип детали">
        <Input className="mt-4" autoFocus value={newType ?? ''} onChange={(e) => setNewType(e.target.value)} placeholder="Ремень ГРМ" />
        <div className="mt-4 flex justify-end">
          <Button variant="dark" disabled={!newType?.trim()} loading={createType.isPending} onClick={() => createType.mutate(newType!.trim())}>
            Создать
          </Button>
        </div>
      </Dialog>
      <Dialog open={!!attr} onOpenChange={(v) => !v && setAttr(null)} title="Новый атрибут">
        {attr && (
          <div className="mt-4 space-y-4">
            <Field label="Название">
              <Input autoFocus value={attr.name} onChange={(e) => setAttr({ ...attr, name: e.target.value })} placeholder="Количество зубьев" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Тип значения">
                <select value={attr.valueType} onChange={(e) => setAttr({ ...attr, valueType: e.target.value as Attr['valueType'] })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                  {Object.entries(VT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Единица">
                <Input value={attr.unit} onChange={(e) => setAttr({ ...attr, unit: e.target.value })} placeholder="мм, Ач, л" />
              </Field>
            </div>
            {attr.valueType === 'list' && (
              <Field label="Варианты" hint="Через запятую">
                <Input value={attr.options} onChange={(e) => setAttr({ ...attr, options: e.target.value })} placeholder="Летние, Зимние, Всесезонные" />
              </Field>
            )}
            <div className="flex flex-col gap-2.5">
              <Switch checked={attr.filterable} onChange={(v) => setAttr({ ...attr, filterable: v })} label="Участвует в фильтре каталога" />
              <Switch checked={attr.searchable} onChange={(v) => setAttr({ ...attr, searchable: v })} label="Участвует в поиске" />
              <Switch checked={attr.required} onChange={(v) => setAttr({ ...attr, required: v })} label="Обязательный" />
            </div>
            <div className="flex justify-end">
              <Button variant="dark" disabled={!attr.name.trim()} loading={createAttr.isPending} onClick={() => createAttr.mutate(attr)}>
                Добавить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
