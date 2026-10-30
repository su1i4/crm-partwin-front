import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Banknote, Boxes, Car, FileDown, FileSpreadsheet, Info, Search, Star, Trash2, TrendingUp, Truck, UserCog, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { reportApi, useReport, useReportCatalog, useReportViews, type ColType, type ReportMeta } from '@/entities/report';
import { useCan, useMe } from '@/entities/session';
import { openPdf } from '@/entities/stock';
import { saveBlob } from '@/entities/purchasing';
import { physical, useWarehouses } from '@/entities/warehouse';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Skeleton, Switch, Tray } from '@/shared/ui';

const GROUP_ICON: Record<string, typeof BarChart3> = { sales: BarChart3, profit: TrendingUp, stock: Boxes, parts: Car, purchases: Truck, customers: Users, staff: UserCog, money: Banknote };
const sel = 'h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthStart = () => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const today = () => ymd(new Date());

/** Каталог отчётов (ТЗ 20): по разделам, поиск, избранные сверху */
export function ReportsPage() {
  const { data, isLoading, error, refetch } = useReportCatalog();
  const views = useReportViews();
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  return (
    <div className="space-y-6">
      <PageTitle title="Отчёты" sub="Любой отчёт — с фильтрами, группировкой и выгрузкой в Excel / PDF. Настроенный вид сохраняется в «Избранные»" />
      <Input icon={<Search />} placeholder="Найти отчёт" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      {views.data && views.data.length > 0 && !t && (
        <div className="flex flex-wrap gap-2">
          {views.data.slice(0, 8).map((v) => (
            <Link key={v.id} to={`/reports/${v.report}?${new URLSearchParams(v.params)}`}>
              <Pill tone="dark" className="h-8 px-3">
                <Star className="size-3 text-accent" /> {v.name}
              </Pill>
            </Link>
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-96 rounded-[24px]" />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((g) => {
          const list = g.reports.filter((r) => !t || r.title.toLowerCase().includes(t));
          if (!list.length) return null;
          const I = GROUP_ICON[g.group] ?? BarChart3;
          return (
            <Tray key={g.group} className="p-3">
              <div className="flex items-center gap-2 px-1 pb-2 text-[14px] font-medium">
                <I className="size-4 text-accent" /> {g.title}
              </div>
              <div className="space-y-1">
                {list.map((r) => (
                  <Link key={r.code} to={r.path ?? `/reports/${r.code}`} className="flex items-center gap-2 rounded-[14px] bg-card px-3 py-2.5 text-[13.5px] transition hover:ring-1 hover:ring-line-strong">
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.path && <Pill tone="soft" className="h-5">страница</Pill>}
                  </Link>
                ))}
              </div>
            </Tray>
          );
        })}
      </div>
    </div>
  );
}

const fmt = (v: unknown, t?: ColType) => {
  if (v == null || v === '') return '—';
  switch (t) {
    case 'money':
      return money(v as string);
    case 'qty':
      return num(v as string, 3);
    case 'int':
      return num(v as string);
    case 'percent':
      return `${num(v as string, 1)}%`;
    case 'date':
      return date(v as string, 'DD.MM.YYYY');
    case 'datetime':
      return date(v as string, 'DD.MM.YY HH:mm');
    default:
      return String(v);
  }
};

/** Отчёт: фильтры в адресе, таблица с итогами и полосками, Excel / PDF, сохранить вид */
export function ReportPage() {
  const { code } = useParams();
  const [sp, setSp] = useSearchParams();
  const catalog = useReportCatalog();
  const meta: ReportMeta | undefined = useMemo(() => catalog.data?.flatMap((g) => g.reports).find((r) => r.code === code), [catalog.data, code]);
  const filters = meta?.filters ?? ['from', 'to'];
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    sp.forEach((v, k) => v && (p[k] = v));
    if (filters.includes('from') && !p.from) p.from = monthStart();
    if (filters.includes('to') && !p.to) p.to = today();
    return p;
  }, [sp, filters]);
  const { data, isLoading, isFetching, error, refetch } = useReport(code, params);
  const cats = useCategories();
  const whs = useWarehouses();
  const me = useMe();
  const can = useCan();
  const qc = useQueryClient();
  const [save, setSave] = useState<{ name: string; shared: boolean } | null>(null);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const xlsx = useMutation({ mutationFn: () => reportApi.xlsx(code!, params), onSuccess: (b) => saveBlob(b, `${code}.xlsx`), onError: (e) => toast.error(errorMessage(e)) });
  const pdf = useMutation({ mutationFn: () => reportApi.pdf(code!, params), onSuccess: openPdf, onError: (e) => toast.error(errorMessage(e)) });
  const saveView = useMutation({
    mutationFn: () => reportApi.saveView({ report: code!, name: save!.name.trim(), params, ...(save!.shared ? { shared: true } : {}) }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['report-views'] }), setSave(null), toast.success('Добавлено в избранные')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const barKey = data?.columns.find((c) => c.type === 'money')?.key;
  const rows = useMemo(() => {
    const r = [...(data?.rows ?? [])];
    if (sort) r.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const nx = Number(x);
      const ny = Number(y);
      const c = !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''));
      return sort.desc ? -c : c;
    });
    return r;
  }, [data, sort]);
  const max = barKey ? Math.max(1, ...rows.map((r) => Math.abs(Number(r[barKey]) || 0))) : 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/reports" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[26px] leading-tight font-medium">{data?.report.title ?? meta?.title ?? 'Отчёт'}</h1>
        <Button onClick={() => setSave({ name: data?.report.title ?? '', shared: false })} disabled={!data}>
          <Star /> В избранные
        </Button>
        {can('reports.export') && (
          <>
            <Button loading={xlsx.isPending} disabled={!data} onClick={() => xlsx.mutate()}>
              <FileSpreadsheet /> Excel
            </Button>
            <Button loading={pdf.isPending} disabled={!data} onClick={() => pdf.mutate()}>
              <FileDown /> PDF
            </Button>
          </>
        )}
      </div>

      <Card className="flex flex-wrap items-end gap-2 p-3">
        {filters.includes('from') && (
          <Field label="С">
            <Input type="date" value={params.from ?? ''} onChange={(e) => set('from', e.target.value)} className="h-10" />
          </Field>
        )}
        {filters.includes('to') && (
          <Field label="По">
            <Input type="date" value={params.to ?? ''} onChange={(e) => set('to', e.target.value)} className="h-10" />
          </Field>
        )}
        {filters.includes('date') && (
          <Field label="На дату">
            <Input type="date" value={params.date ?? today()} onChange={(e) => set('date', e.target.value)} className="h-10" />
          </Field>
        )}
        {filters.includes('days') && (
          <Field label="Дней">
            <Input inputMode="numeric" value={params.days ?? ''} placeholder="90" onChange={(e) => set('days', e.target.value.replace(/\D/g, ''))} className="h-10 w-24" />
          </Field>
        )}
        {filters.includes('warehouseId') && (
          <Field label="Склад">
            <select className={sel} value={params.warehouseId ?? ''} onChange={(e) => set('warehouseId', e.target.value || undefined)}>
              <option value="">Все</option>
              {physical(whs.data).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {filters.includes('storeId') && (me.data?.stores.length ?? 0) > 1 && (
          <Field label="Точка">
            <select className={sel} value={params.storeId ?? ''} onChange={(e) => set('storeId', e.target.value || undefined)}>
              <option value="">Все</option>
              {me.data?.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {filters.includes('categoryId') && (
          <Field label="Группа">
            <select className={cn(sel, 'max-w-56')} value={params.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || undefined)}>
              <option value="">Все</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {'— '.repeat(c.level)}
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {filters.includes('qualityClass') && (
          <Field label="Класс">
            <select className={sel} value={params.qualityClass ?? ''} onChange={(e) => set('qualityClass', e.target.value || undefined)}>
              <option value="">Все</option>
              <option value="original">Оригинал</option>
              <option value="oem">OEM</option>
              <option value="aftermarket">Аналог</option>
              <option value="copy">Копия</option>
              <option value="used">Б/у</option>
            </select>
          </Field>
        )}
        {meta?.groupBy && meta.groupBy.length > 0 && (
          <Field label="Группировать">
            <select className={sel} value={params.groupBy ?? meta.groupBy[0].value} onChange={(e) => set('groupBy', e.target.value)}>
              {meta.groupBy.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {isFetching && <span className="mb-3 ml-2 size-4 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />}
      </Card>

      {data?.note && (
        <div className="flex items-start gap-2 rounded-[18px] bg-card-muted px-4 py-3 text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-muted" /> {data.note}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-96 rounded-[24px]" />}
      {data && (
        <div className="scroll-thin overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
          <table className="w-full text-[13.5px]">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted">
              <tr className="border-b border-line">
                {data.columns.map((c) => {
                  const right = c.type && c.type !== 'text' && c.type !== 'date' && c.type !== 'datetime';
                  return (
                    <th key={c.key} className={cn('px-3 py-2.5 font-normal whitespace-nowrap first:pl-4 last:pr-4', right && 'text-right')}>
                      <button onClick={() => setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : true }))} className="hover:text-ink">
                        {c.title}
                        {sort?.key === c.key && (sort.desc ? ' ↓' : ' ↑')}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0 hover:bg-card-muted/50">
                  {data.columns.map((c) => {
                    const right = c.type && c.type !== 'text' && c.type !== 'date' && c.type !== 'datetime';
                    const neg = right && Number(r[c.key]) < 0;
                    return (
                      <td key={c.key} className={cn('relative px-3 py-2 first:pl-4 last:pr-4', right && 'text-right whitespace-nowrap tabular-nums', neg && 'text-accent')}>
                        {c.key === barKey && <span className="absolute inset-y-1.5 right-0 rounded-l-md bg-accent/10" style={{ width: `${(Math.abs(Number(r[c.key]) || 0) / max) * 100}%` }} />}
                        <span className="relative">{fmt(r[c.key], c.type)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {data.totals && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line bg-card-muted font-semibold">
                  {data.columns.map((c, i) => {
                    const right = c.type && c.type !== 'text' && c.type !== 'date' && c.type !== 'datetime';
                    return (
                      <td key={c.key} className={cn('px-3 py-2.5 first:pl-4 last:pr-4', right && 'text-right whitespace-nowrap tabular-nums')}>
                        {i === 0 ? 'Итого' : data.totals![c.key] != null ? fmt(data.totals![c.key], c.type) : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
          {!rows.length && <EmptyState title="Данных за период нет" hint="Попробуйте другой период или фильтры" />}
        </div>
      )}
      <Dialog open={!!save} onOpenChange={(v) => !v && setSave(null)} title="Сохранить в избранные" description="Отчёт откроется с этими же фильтрами">
        {save && (
          <div className="mt-4 space-y-4">
            <Field label="Название">
              <Input autoFocus value={save.name} onChange={(e) => setSave({ ...save, name: e.target.value })} />
            </Field>
            {me.data?.membership?.isOwner && <Switch checked={save.shared} onChange={(v) => setSave({ ...save, shared: v })} label="Видят все сотрудники" />}
            <div className="flex justify-end">
              <Button variant="dark" disabled={!save.name.trim()} loading={saveView.isPending} onClick={() => saveView.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** Избранные отчёты: сохранённые виды (свои и общие) */
export function SavedReportsPage() {
  const { data, isLoading, error, refetch } = useReportViews();
  const catalog = useReportCatalog();
  const qc = useQueryClient();
  const remove = useMutation({ mutationFn: (id: string) => reportApi.removeView(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['report-views'] }), onError: (e) => toast.error(errorMessage(e)) });
  const title = (c: string) => catalog.data?.flatMap((g) => g.reports).find((r) => r.code === c)?.title ?? c;
  return (
    <div className="space-y-6">
      <PageTitle title="Избранные отчёты" sub="Сохранённые виды: отчёт + фильтры + группировка" />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((v) => (
          <div key={v.id} className="group flex items-start gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line">
            <Star className="mt-0.5 size-4 text-accent" />
            <Link to={`/reports/${v.report}?${new URLSearchParams(v.params)}`} className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium">{v.name}</span>
              <span className="block truncate text-xs text-muted">
                {title(v.report)}
                {v.params.groupBy && ` · по ${v.params.groupBy}`}
                {v.shared && ' · общий'}
              </span>
            </Link>
            {v.mine && (
              <button onClick={() => remove.mutate(v.id)} className="grid size-8 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 hover:text-accent" aria-label="Удалить">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {data && !data.length && (
        <Card>
          <EmptyState icon={<Star />} title="Избранных нет" hint="Откройте отчёт, настройте фильтры и нажмите «В избранные»" />
        </Card>
      )}
    </div>
  );
}
