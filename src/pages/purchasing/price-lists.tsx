import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, CloudDownload, FileSpreadsheet, History, Link2, PackagePlus, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { purchasingApi, useOffers, usePriceList, usePriceLists, usePriceRows, useSuppliers, type PriceListPreview, type PriceListStatus, type PriceRow } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { errorMessage, uploadFile } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const CURRENCIES = ['KGS', 'USD', 'CNY', 'AED', 'RUB', 'KZT', 'EUR'];
const SCHEDULE: Record<string, string> = { '': 'Вручную', hourly: 'Каждый час', every_6h: 'Каждые 6 часов', daily: 'Раз в сутки' };
export const PL_STATUS: Record<PriceListStatus, { label: string; tone: 'soft' | 'ok' | 'warn' | 'accent-outline' }> = {
  empty: { label: 'не загружен', tone: 'soft' },
  loading: { label: 'загружается…', tone: 'warn' },
  ready: { label: 'готов', tone: 'ok' },
  failed: { label: 'ошибка', tone: 'accent-outline' },
};

/** Поиск номера по всем прайсам: у кого есть, почём, за сколько привезут (с аналогами) */
export function OffersSearch({ initial = '', compact }: { initial?: string; compact?: boolean }) {
  const [q, setQ] = useState(initial);
  const dq = useDebounce(q, 350);
  const { data, isFetching } = useOffers(dq);
  return (
    <div className="space-y-2">
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер детали — найти во всех прайсах (с аналогами)" />
      {isFetching && <Skeleton className="h-16 rounded-[18px]" />}
      {data && dq.trim().length >= 3 && (
        <div className={cn('overflow-x-auto rounded-[20px] bg-card ring-1 ring-line', compact && 'max-h-80 overflow-y-auto')}>
          {!data.length && <div className="px-4 py-3 text-sm text-muted">Ни в одном прайсе не нашлось</div>}
          {data.length > 0 && (
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-normal">Поставщик</th>
                  <th className="px-2 font-normal">Номер · бренд</th>
                  <th className="px-2 text-right font-normal">Цена</th>
                  <th className="px-2 text-right font-normal">Наличие</th>
                  <th className="px-4 text-right font-normal">Срок</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{o.supplierName}</div>
                      <div className="text-xs text-muted">{o.priceListName}</div>
                    </td>
                    <td className="px-2">
                      <span className="font-mono">{o.number}</span> <span className="text-muted">{o.brand}</span>
                      {o.analog && <Pill tone="accent-outline" className="ml-1 h-5">аналог {o.analog.via}</Pill>}
                      {o.name && <div className="max-w-xs truncate text-xs text-muted">{o.name}</div>}
                    </td>
                    <td className="px-2 text-right tabular-nums">
                      {o.price != null ? (
                        <>
                          <div className="font-semibold">{money(o.price, o.currency)}</div>
                          {o.currency !== 'KGS' && o.priceKgs && <div className="text-xs text-muted">≈ {money(o.priceKgs)}</div>}
                        </>
                      ) : (
                        <span className="text-faint">скрыто</span>
                      )}
                    </td>
                    <td className="px-2 text-right">{o.stockText ?? '—'}</td>
                    <td className="px-4 text-right whitespace-nowrap">{o.leadDays != null ? `${o.leadDays} дн` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function NewPriceListDialog({ open, onOpenChange, supplierId }: { open: boolean; onOpenChange: (v: boolean) => void; supplierId?: string }) {
  const sup = useSuppliers('');
  const nb = useSuppliers('', 'neighbor');
  const nav = useNavigate();
  const [f, setF] = useState({ supplierId: supplierId ?? '', name: '', currency: 'KGS', leadDays: '' });
  useEffect(() => {
    if (open) setF((x) => ({ ...x, supplierId: supplierId ?? x.supplierId }));
  }, [open, supplierId]);
  const all = [...(sup.data?.items ?? []), ...(nb.data?.items ?? [])];
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.createPriceList({
        supplierId: f.supplierId,
        name: f.name.trim() || `Прайс ${all.find((s) => s.id === f.supplierId)?.name ?? ''}`.trim(),
        currency: f.currency,
        ...(f.leadDays ? { defaultLeadDays: Number(f.leadDays) } : {}),
      }),
    onSuccess: (l) => (onOpenChange(false), nav(`/purchasing/price-lists/${l.id}?upload=1`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Новый прайс" description="Потом загрузите Excel / CSV или дайте ссылку — колонки сопоставятся сами">
      <div className="mt-4 space-y-4">
        <Field label="Поставщик или сосед">
          <select className={sel} value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
            <option value="">— выберите —</option>
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Название">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Прайс опт (ежедневный)" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Валюта по умолчанию">
            <select className={sel} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Срок поставки, дн">
            <Input inputMode="numeric" value={f.leadDays} onChange={(e) => setF({ ...f, leadDays: e.target.value.replace(/\D/g, '') })} placeholder="3" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.supplierId} loading={create.isPending} onClick={() => create.mutate()}>
            Создать и загрузить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Прайсы поставщиков (ТЗ 10.2): список, поиск по всем прайсам */
export function PriceListsPage() {
  const [sp] = useSearchParams();
  const supplierId = sp.get('supplier') ?? undefined;
  const { data, isLoading, error, refetch } = usePriceLists(supplierId);
  const can = useCan();
  const [open, setOpen] = useState(false);
  const rows = data?.reduce((a, l) => a + l.rowsCount, 0) ?? 0;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Прайсы поставщиков"
        sub={data ? `${data.length} прайсов · ${num(rows)} строк — продавец видит их в поиске как «можно заказать»` : ' '}
        actions={
          can('purchasing.pricelists') && (
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Plus /> Прайс
            </Button>
          )
        }
      />
      <Tray className="p-4">
        <OffersSearch />
      </Tray>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.map((l) => (
          <Link key={l.id} to={`/purchasing/price-lists/${l.id}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line transition hover:ring-line-strong', !l.isActive && 'opacity-60')}>
            <FileSpreadsheet className="size-5 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium">{l.name}</span>
              <span className="block truncate text-xs text-muted">
                {l.supplierName} · {l.currency}
                {l.defaultLeadDays != null && ` · ${l.defaultLeadDays} дн`}
              </span>
            </span>
            {l.url && (
              <Pill tone="outline">
                <Link2 className="size-3" /> {SCHEDULE[l.schedule ?? '']}
              </Pill>
            )}
            <span className="w-24 text-right text-[13px] tabular-nums">{num(l.rowsCount)}</span>
            <span className="hidden w-28 text-right text-xs text-muted sm:block">{l.loadedAt ? ago(l.loadedAt) : '—'}</span>
            <Pill tone={PL_STATUS[l.status].tone}>{PL_STATUS[l.status].label}</Pill>
          </Link>
        ))}
        {data && !data.length && (
          <Card>
            <EmptyState icon={<FileSpreadsheet />} title="Прайсов нет" hint="Загрузите Excel поставщика — колонки «номер, бренд, цена, наличие» найдутся сами" />
          </Card>
        )}
      </div>
      <NewPriceListDialog open={open} onOpenChange={setOpen} supplierId={supplierId} />
    </div>
  );
}

/** Мастер загрузки: файл → колонки и образец → сопоставление → загрузка в фоне */
function UploadWizard({ id, open, onOpenChange, headerRow: hr0 }: { id: string; open: boolean; onOpenChange: (v: boolean) => void; headerRow: number }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [prev, setPrev] = useState<PriceListPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [headerRow, setHeaderRow] = useState(hr0);
  useEffect(() => {
    if (!open) (setFileId(null), setPrev(null), setMapping({}), setFileName(''));
  }, [open]);
  const upload = useMutation({
    mutationFn: async (f: File) => {
      const up = await uploadFile(f, 'import', f.name, { type: 'price_list', id });
      setFileId(up.id);
      setFileName(f.name);
      return purchasingApi.previewPriceList(id, up.id, headerRow);
    },
    onSuccess: (p) => (setPrev(p), setMapping(p.mapping)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const repreview = useMutation({
    mutationFn: (h: number) => purchasingApi.previewPriceList(id, fileId!, h),
    onSuccess: (p) => (setPrev(p), setMapping(p.mapping)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const load = useMutation({
    mutationFn: () => purchasingApi.loadPriceList(id, { fileId: fileId!, mapping, headerRow }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-list', id] });
      qc.invalidateQueries({ queryKey: ['price-lists'] });
      toast.success('Загрузка запущена — придёт уведомление, когда закончится');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const missing = prev?.fields.filter((f) => f.required && mapping[f.key] === undefined) ?? [];
  const colOf = (i: number) => prev?.fields.find((f) => mapping[f.key] === i);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Загрузка прайса" description={prev ? `${fileName} · ${num(prev.totalRows)} строк · сопоставление ${prev.mappingSource === 'saved' ? 'запомненное' : 'угадано по заголовкам'}` : 'Excel (.xlsx) или CSV'} className="max-w-5xl">
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
      {!prev && (
        <button onClick={() => input.current?.click()} className="mt-4 flex h-44 w-full flex-col items-center justify-center gap-2 rounded-[24px] text-muted ring-2 ring-line ring-dashed hover:text-ink hover:ring-line-strong">
          {upload.isPending ? <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-r-transparent" /> : <Upload className="size-7" />}
          <span className="text-sm">{upload.isPending ? 'Читаем файл…' : 'Выберите файл прайса'}</span>
        </button>
      )}
      {prev && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Строка заголовка" className="w-40">
              <Input
                inputMode="numeric"
                value={headerRow}
                onChange={(e) => setHeaderRow(Math.max(1, Math.min(50, Number(e.target.value.replace(/\D/g, '')) || 1)))}
                onBlur={() => repreview.mutate(headerRow)}
              />
            </Field>
            <div className="flex flex-1 flex-wrap gap-2">
              {prev.fields.map((f) => (
                <label key={f.key} className="flex items-center gap-1.5 rounded-full bg-card-muted py-1 pr-1 pl-3 text-[12.5px]">
                  {f.label}
                  {f.required && <span className="text-accent">*</span>}
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => {
                        const n = { ...m };
                        if (e.target.value === '') delete n[f.key];
                        else n[f.key] = Number(e.target.value);
                        return n;
                      })
                    }
                    className={cn('h-7 max-w-36 rounded-full bg-card px-2 text-[12.5px] outline-none', mapping[f.key] === undefined && f.required && 'text-accent ring-1 ring-accent-line')}
                  >
                    <option value="">—</option>
                    {prev.columns.map((c, i) => (
                      <option key={i} value={i}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="scroll-thin max-h-80 overflow-auto rounded-[20px] ring-1 ring-line">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-card-muted text-left">
                <tr>
                  {prev.columns.map((c, i) => {
                    const f = colOf(i);
                    return (
                      <th key={i} className={cn('px-3 py-2 font-medium whitespace-nowrap', f && 'bg-accent-soft text-accent')}>
                        {f ? f.label : <span className="font-normal text-muted">{c}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {prev.sample.map((r, k) => (
                  <tr key={k} className="border-t border-line">
                    {prev.columns.map((_, i) => (
                      <td key={i} className={cn('max-w-56 truncate px-3 py-1.5', colOf(i) ? 'text-ink' : 'text-faint')}>
                        {r[i] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-accent">
              <AlertTriangle className="size-4" /> Укажите колонки: {missing.map((m) => m.label).join(', ')}
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => input.current?.click()}>
              Другой файл
            </Button>
            <Button variant="dark" disabled={missing.length > 0} loading={load.isPending} onClick={() => load.mutate()}>
              <CloudDownload /> Загрузить {num(prev.totalRows)} строк
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function RowHistory({ row, onClose }: { row: PriceRow | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['row-history', row?.id], queryFn: () => purchasingApi.rowHistory(row!.id), enabled: !!row });
  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()} title="История цены" description={row ? `${row.number} ${row.brand ?? ''}` : ''}>
      <div className="mt-4 space-y-1">
        {isLoading && <Skeleton className="h-24" />}
        {data?.map((h, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[14px] bg-card-muted px-3 py-2 text-[13px]">
            <span className="flex-1 text-muted">{date(h.at, 'D MMM YYYY')}</span>
            <span className="text-muted tabular-nums line-through">{h.oldPrice ? money(h.oldPrice, h.currency) : '—'}</span>
            <span className={cn('font-semibold tabular-nums', Number(h.newPrice) > Number(h.oldPrice) ? 'text-accent' : 'text-ok')}>{h.newPrice ? money(h.newPrice, h.currency) : 'убран'}</span>
          </div>
        ))}
        {data && !data.length && <div className="text-sm text-muted">Цена не менялась</div>}
      </div>
    </Dialog>
  );
}

function CreateProductDialog({ row, onClose }: { row: PriceRow | null; onClose: () => void }) {
  const cats = useCategories();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', categoryId: '', retailPrice: '' });
  useEffect(() => {
    if (row) setF({ name: row.name ?? '', categoryId: '', retailPrice: '' });
  }, [row]);
  const create = useMutation({
    mutationFn: () => purchasingApi.rowCreateProduct(row!.id, { ...(f.name ? { name: f.name } : {}), ...(f.categoryId ? { categoryId: f.categoryId } : {}), ...(f.retailPrice ? { retailPrice: f.retailPrice } : {}) }),
    onSuccess: (p) => (toast.success('Товар создан'), onClose(), nav(`/products/${p.id}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()} title="Создать товар из прайса" description="Номер, бренд, OEM-номера (как кроссы) и применимость перенесутся">
      {row && (
        <div className="mt-4 space-y-4">
          <div className="rounded-[16px] bg-card-muted px-4 py-2.5 font-mono text-sm">
            {row.number} · {row.brand ?? 'без бренда'}
          </div>
          <Field label="Название">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Группа">
              <select className={sel} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                <option value="">—</option>
                {cats.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.level)}
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Розничная цена">
              <Input inputMode="decimal" value={f.retailPrice} onChange={(e) => setF({ ...f, retailPrice: e.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button variant="dark" loading={create.isPending} onClick={() => create.mutate()}>
              <PackagePlus /> Создать
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

const LIMIT = 50;

/** Прайс: настройки, загрузки, строки */
export function PriceListPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data: l, isLoading, error, refetch } = usePriceList(id);
  const can = useCan();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const rows = usePriceRows(id, { q: dq || undefined, page, limit: LIMIT });
  const [wizard, setWizard] = useState(sp.get('upload') === '1');
  const [hist, setHist] = useState<PriceRow | null>(null);
  const [mk, setMk] = useState<PriceRow | null>(null);
  const [cfg, setCfg] = useState<{ url: string; schedule: string; currency: string; leadDays: string; isActive: boolean } | null>(null);
  useEffect(() => {
    if (l) setCfg({ url: l.url ?? '', schedule: l.schedule ?? '', currency: l.currency, leadDays: l.defaultLeadDays?.toString() ?? '', isActive: l.isActive });
  }, [l]);
  useEffect(() => setPage(1), [dq]);
  const save = useMutation({
    mutationFn: () =>
      purchasingApi.updatePriceList(id!, {
        version: l!.version,
        url: cfg!.url.trim() || null,
        schedule: cfg!.url.trim() ? cfg!.schedule || null : null,
        currency: cfg!.currency,
        defaultLeadDays: cfg!.leadDays ? Number(cfg!.leadDays) : null,
        isActive: cfg!.isActive,
      }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['price-list', id] }), qc.invalidateQueries({ queryKey: ['price-lists'] }), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const byUrl = useMutation({
    mutationFn: () => purchasingApi.loadPriceList(id!, {}),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['price-list', id] }), toast.success('Скачиваем прайс по ссылке')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => purchasingApi.removePriceList(id!, l!.version),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['price-lists'] }), nav('/purchasing/price-lists')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  useEffect(() => {
    if (l?.status === 'ready') qc.invalidateQueries({ queryKey: ['price-rows', id] });
  }, [l?.status, l?.loadedAt, id, qc]);
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !l || !cfg) return <Skeleton className="h-96 rounded-[28px]" />;
  const edit = can('purchasing.pricelists');
  const dirty = cfg.url !== (l.url ?? '') || cfg.schedule !== (l.schedule ?? '') || cfg.currency !== l.currency || cfg.leadDays !== (l.defaultLeadDays?.toString() ?? '') || cfg.isActive !== l.isActive;
  const pages = rows.data ? Math.max(1, Math.ceil(rows.data.total / LIMIT)) : 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/purchasing/price-lists" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] leading-tight font-medium">{l.name}</h1>
          <div className="text-sm text-muted">
            <Link to={`/purchasing/suppliers/${l.supplierId}`} className="hover:text-ink">
              {l.supplierName}
            </Link>
            {' · '}
            {num(l.rowsCount)} строк{l.loadedAt && ` · обновлён ${ago(l.loadedAt)}`}
          </div>
        </div>
        <Pill tone={PL_STATUS[l.status].tone} className="h-8 px-3">
          {l.status === 'loading' && <RefreshCw className="size-3 animate-spin" />} {PL_STATUS[l.status].label}
        </Pill>
        {edit && (
          <>
            <Button variant="ghost" className="text-accent" onClick={() => confirm('Удалить прайс со всеми строками?') && remove.mutate()}>
              <Trash2 />
            </Button>
            {l.url && (
              <Button loading={byUrl.isPending} disabled={l.status === 'loading'} onClick={() => byUrl.mutate()}>
                <Link2 /> По ссылке
              </Button>
            )}
            <Button variant="dark" disabled={l.status === 'loading'} onClick={() => setWizard(true)}>
              <Upload /> Загрузить файл
            </Button>
          </>
        )}
      </div>
      {l.lastError && (
        <div className="flex items-center gap-3 rounded-[20px] bg-accent-soft px-4 py-3 text-sm text-accent ring-1 ring-accent-line">
          <AlertTriangle className="size-4 shrink-0" /> {l.lastError}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер или название в этом прайсе" />
          <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-normal">Номер · бренд</th>
                  <th className="px-2 font-normal">Название</th>
                  <th className="px-2 text-right font-normal">Цена</th>
                  <th className="px-2 text-right font-normal">Наличие</th>
                  <th className="px-2 text-right font-normal">Срок</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.data?.items.map((r) => (
                  <tr key={r.id} className="group border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-mono">{r.number}</span> <span className="text-muted">{r.brand}</span>
                      {r.oem && <div className="max-w-56 truncate text-xs text-faint">OEM {r.oem}</div>}
                    </td>
                    <td className="max-w-64 truncate px-2 text-ink-2">{r.name}</td>
                    <td className="px-2 text-right font-semibold tabular-nums">{r.price != null ? money(r.price, r.currency) : '—'}</td>
                    <td className="px-2 text-right">{r.stockText ?? '—'}</td>
                    <td className="px-2 text-right whitespace-nowrap">{r.leadDays != null ? `${r.leadDays} дн` : '—'}</td>
                    <td className="pr-3 text-right whitespace-nowrap">
                      <button onClick={() => setHist(r)} className="inline-grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted hover:text-ink" title="История цены">
                        <History className="size-3.5" />
                      </button>
                      {r.productId ? (
                        <Link to={`/products/${r.productId}`} className="inline-grid size-7 place-items-center rounded-full text-ok hover:bg-card-muted" title="Есть в каталоге">
                          <PackagePlus className="size-3.5" />
                        </Link>
                      ) : (
                        <button onClick={() => setMk(r)} className="inline-grid size-7 place-items-center rounded-full text-muted hover:bg-card-muted hover:text-accent" title="Создать товар">
                          <Plus className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.isLoading && <Skeleton className="m-3 h-40" />}
            {rows.data && !rows.data.items.length && <EmptyState title={dq ? 'Не найдено' : 'Строк нет'} hint={dq ? undefined : 'Загрузите файл прайса'} />}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Назад">
                <ChevronLeft />
              </Button>
              <span className="text-sm text-muted tabular-nums">
                {page} / {pages}
              </span>
              <Button size="icon-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Вперёд">
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="text-[14px] font-medium">Настройки</div>
            <Field label="Ссылка на прайс" hint="Будет скачиваться сама по расписанию">
              <Input value={cfg.url} disabled={!edit} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="https://supplier.kg/price.xlsx" />
            </Field>
            {cfg.url && (
              <Field label="Обновлять">
                <select className={sel} disabled={!edit} value={cfg.schedule} onChange={(e) => setCfg({ ...cfg, schedule: e.target.value })}>
                  {Object.entries(SCHEDULE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Валюта">
                <select className={sel} disabled={!edit} value={cfg.currency} onChange={(e) => setCfg({ ...cfg, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Срок, дн">
                <Input inputMode="numeric" disabled={!edit} value={cfg.leadDays} onChange={(e) => setCfg({ ...cfg, leadDays: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Switch checked={cfg.isActive} onChange={(v) => edit && setCfg({ ...cfg, isActive: v })} label="Участвует в поиске" />
            {edit && dirty && (
              <Button variant="dark" className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить
              </Button>
            )}
          </Card>
          <Tray className="p-3">
            <div className="px-1 pb-2 text-[14px] font-medium">Загрузки</div>
            <div className="space-y-1">
              {l.loads.map((x) => (
                <div key={x.id} className="rounded-[16px] bg-card px-3 py-2 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">
                      {date(x.createdAt, 'D MMM, HH:mm')} · {x.source === 'url' ? 'по ссылке' : 'файл'}
                    </span>
                    <Pill tone={x.status === 'done' ? 'ok' : x.status === 'failed' ? 'accent-outline' : 'warn'} className="h-5">
                      {x.status === 'done' ? 'готово' : x.status === 'failed' ? 'ошибка' : 'идёт'}
                    </Pill>
                  </div>
                  {x.status === 'done' && (
                    <div className="mt-1 text-muted">
                      {num(x.rows)} строк · +{num(x.added)} · изм. цен {num(x.priceChanges)} · убрано {num(x.removed)}
                      {x.crossesAdded > 0 && ` · кроссов ${num(x.crossesAdded)}`}
                    </div>
                  )}
                  {x.error && <div className="mt-1 text-accent">{x.error}</div>}
                </div>
              ))}
              {!l.loads.length && <div className="rounded-[16px] bg-card px-3 py-2 text-sm text-muted">Ещё не загружали</div>}
            </div>
          </Tray>
        </div>
      </div>
      <UploadWizard
        id={l.id}
        headerRow={l.headerRow}
        open={wizard}
        onOpenChange={(v) => {
          setWizard(v);
          if (!v && sp.get('upload')) setSp({}, { replace: true });
        }}
      />
      <RowHistory row={hist} onClose={() => setHist(null)} />
      <CreateProductDialog row={mk} onClose={() => setMk(null)} />
    </div>
  );
}
