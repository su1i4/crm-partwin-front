import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DOC_KIND, STATUS_LABEL, useDocs, type DocType } from '@/entities/document';
import { useCan, useSession } from '@/entities/session';
import { useWarehouses } from '@/entities/warehouse';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { Button, EmptyState, ErrorState, Input, PageTitle, Pill, Segmented, Skeleton } from '@/shared/ui';

const LIMIT = 50;
const TITLES: Partial<Record<DocType, string>> = {
  receiving: 'Приёмки',
  transfer: 'Перемещения',
  writeoff: 'Списания',
  surplus: 'Оприходования',
  resort: 'Пересортица',
  initial_stock: 'Ввод остатков',
  supplier_return: 'Возвраты поставщикам',
};

/** Журнал документов (ТЗ 9.2) — общий и по видам; фильтры в адресе */
export default function DocumentsPage() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const can = useCan();
  const storeId = useSession((s) => s.storeId);
  const type = (sp.get('type') ?? undefined) as DocType | undefined;
  const status = sp.get('status') ?? 'all';
  const page = Number(sp.get('page') ?? 1);
  const warehouseId = sp.get('warehouse') ?? undefined;
  const inTransit = sp.get('inTransit') === 'true';
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounce(q, 300);
  const whs = useWarehouses();
  const { data, isLoading, error, refetch, isFetching } = useDocs({
    type,
    status: status === 'all' ? undefined : status,
    page,
    limit: LIMIT,
    q: dq || undefined,
    warehouseId,
    ...(storeId ? { storeId } : {}),
    ...(inTransit ? { inTransit: true } : {}),
  });
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const canCreate = type && DOC_KIND[type] && can('documents.write');

  return (
    <div className="space-y-6">
      <PageTitle
        title={type ? (TITLES[type] ?? 'Документы') : 'Журнал документов'}
        sub={data ? `${num(data.total)} документов` : ' '}
        actions={
          <>
            <Segmented
              value={status}
              onChange={(v) => set('status', v === 'all' ? undefined : v)}
              options={[
                { value: 'all', label: 'Все' },
                { value: 'draft', label: 'Черновики' },
                { value: 'posted', label: 'Проведённые' },
                ...(type === 'writeoff' ? [{ value: 'awaiting_approval', label: 'На согласовании' }] : []),
              ]}
            />
            {canCreate && (
              <Button variant="dark" onClick={() => nav(`/documents/new?type=${type}`)}>
                <Plus /> {DOC_KIND[type!]!.title}
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-sm flex-1" icon={<Search />} placeholder="Номер документа, комментарий" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={warehouseId ?? ''} onChange={(e) => set('warehouse', e.target.value || undefined)} className="h-11 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
          <option value="">Все склады</option>
          {whs.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {type === 'transfer' && (
          <button onClick={() => set('inTransit', inTransit ? undefined : 'true')} className={cn('flex h-11 items-center gap-2 rounded-full px-4 text-sm ring-1', inTransit ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line')}>
            <Truck className="size-4" /> В пути
          </button>
        )}
      </div>

      {isLoading && <div className="space-y-1.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-full" />)}</div>}
      {error && !data && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.items.length === 0 && (
        <div className="rounded-[28px] bg-card">
          <EmptyState
            title="Документов нет"
            hint={type === 'initial_stock' ? 'Ввод начальных остатков — по частям: по полкам или из Excel' : 'Остаток меняется только проведением документа'}
            action={
              canCreate && (
                <Button size="sm" variant="dark" onClick={() => nav(`/documents/new?type=${type}`)}>
                  <Plus /> Создать
                </Button>
              )
            }
          />
        </div>
      )}
      <div className={cn('space-y-1.5', isFetching && !isLoading && 'opacity-60')}>
        {data?.items.map((d) => {
          const st = STATUS_LABEL[d.status];
          return (
            <Link
              key={d.id}
              to={`/documents/${d.id}`}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[20px] bg-card py-2.5 pr-4 pl-3 ring-1 ring-line transition hover:ring-line-strong md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_90px_120px_auto]',
                d.deletionMark && 'opacity-50',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card-muted text-[11px] font-semibold text-ink-2">{date(d.docDate, 'DD.MM')}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{d.number}</span>
                  <span className="block truncate text-xs text-muted">{type ? date(d.docDate, 'HH:mm') : d.typeLabel}</span>
                </span>
              </span>
              <span className="hidden min-w-0 truncate text-[13px] text-ink-2 md:block">
                {d.warehouseName}
                {d.warehouseToName && ` → ${d.warehouseToName}`}
                {d.counterpartyName && <span className="text-muted"> · {d.counterpartyName}</span>}
              </span>
              <span className="hidden text-right text-[13px] text-muted tabular-nums md:block">{num(d.totalQty, 3)} шт</span>
              <span className="hidden text-right text-[14px] font-semibold tabular-nums md:block">{d.totalAmount !== null && Number(d.totalAmount) ? money(d.totalAmount, d.currency === 'USD' ? 'USD' : 'KGS') : '—'}</span>
              <span className="flex items-center justify-end gap-1.5">
                {d.hasNegative && <AlertTriangle className="size-4 text-accent" />}
                {d.transferState === 'in_transit' && <Pill tone="warn">в пути</Pill>}
                <Pill tone={st.tone}>{st.label}</Pill>
              </span>
            </Link>
          );
        })}
      </div>
      {data && data.total > LIMIT && (
        <div className="flex justify-end gap-1.5">
          <Button size="icon-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))} aria-label="Назад">
            <ChevronLeft />
          </Button>
          <Pill tone="dark" className="h-8 px-3">
            {page} / {pages}
          </Pill>
          <Button size="icon-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))} aria-label="Вперёд">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
