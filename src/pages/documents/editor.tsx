import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  FileText,
  MoreHorizontal,
  Paperclip,
  PencilLine,
  Plus,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { QuickProductDialog } from '@/features/quick-product';
import { DOC_KIND, docApi, STATUS_LABEL, useDoc, useDocMeta, type DocType, type DocView, type LineError } from '@/entities/document';
import { productApi } from '@/entities/product';
import { useSession } from '@/entities/session';
import { openPdf } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { CounterpartyPicker } from '@/features/customer-picker';
import { ProductAddField, ProductSelect, type PickedProduct, type ProductAddHandle } from '@/features/product-add';
import { ApiError, errorMessage, uploadFile } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, dayjs, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Pill, Skeleton } from '@/shared/ui';

interface EditLine {
  key: string;
  productId: string;
  name: string;
  number: string | null;
  sku: string;
  baseUnit: string;
  unitId?: string | null;
  unitName?: string | null;
  qty: string;
  price: string;
  place: string;
  reason: string;
  productTo: { id: string; name: string } | null;
  expectedQty?: string;
}

interface Head {
  docDate: string;
  warehouseId: string;
  warehouseToId: string;
  counterparty: { id: string; name: string } | null;
  currency: string;
  rate: string;
  comment: string;
  invoiceNumber: string;
  invoiceDate: string;
  reason: string;
  extraCosts: { name: string; amount: string }[];
}

let k = 0;
const key = () => `n${Date.now().toString(36)}${k++}`;
const CURRENCIES = ['KGS', 'USD', 'CNY', 'AED', 'RUB', 'KZT'];

const emptyHead = (warehouseId = ''): Head => ({
  docDate: dayjs().format('YYYY-MM-DDTHH:mm'),
  warehouseId,
  warehouseToId: '',
  counterparty: null,
  currency: 'KGS',
  rate: '1',
  comment: '',
  invoiceNumber: '',
  invoiceDate: '',
  reason: 'defect',
  extraCosts: [],
});

function fromView(d: DocView): { head: Head; lines: EditLine[] } {
  return {
    head: {
      docDate: dayjs(d.docDate).format('YYYY-MM-DDTHH:mm'),
      warehouseId: d.warehouseId ?? '',
      warehouseToId: d.warehouseToId ?? '',
      counterparty: d.counterparty,
      currency: d.currency,
      rate: String(Number(d.rate)),
      comment: d.comment ?? '',
      invoiceNumber: d.extra.supplierInvoiceNumber ?? '',
      invoiceDate: d.extra.supplierInvoiceDate ?? '',
      reason: d.extra.reason ?? 'defect',
      extraCosts: d.extra.extraCosts ?? [],
    },
    lines: d.lines.map((l) => ({
      key: l.id,
      productId: l.productId,
      name: l.productName,
      number: l.mainNumber,
      sku: l.sku,
      baseUnit: l.baseUnit,
      unitId: l.unitId,
      unitName: l.unitName,
      qty: String(Number(l.qty)),
      price: l.price === null || l.price === undefined ? '' : String(Number(l.price)),
      place: l.place ?? '',
      reason: l.extra.reason ?? '',
      productTo: l.productToId ? { id: l.productToId, name: l.productToName ?? '' } : null,
      expectedQty: l.extra.expectedQty,
    })),
  };
}

const cell = 'h-9 w-full rounded-xl bg-card-muted px-2.5 text-[13.5px] tabular-nums outline-none focus:bg-card focus:ring-2 focus:ring-ink disabled:bg-transparent disabled:px-0';

/**
 * Документ (ТЗ 23.4): шапка, строки как в Excel (Tab/Enter/стрелки), поле добавления всегда в фокусе,
 * итоги, проведение с ошибками по строкам, «на основании», этикетки, вложения, связанные документы.
 */
export default function DocumentEditorPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isNew = !id;
  const type = (sp.get('type') ?? 'receiving') as DocType;
  const { data: doc, isLoading, error, refetch } = useDoc(id);
  const docType = (doc?.type ?? type) as DocType;
  const kind = DOC_KIND[docType] ?? { title: doc?.typeLabel ?? 'Документ', price: false };
  const storeId = useSession((s) => s.storeId);
  const whs = useWarehouses();
  const meta = useDocMeta();
  const myWhs = physical(whs.data).filter((w) => !storeId || w.storeId === storeId || w.storeId === null);

  const [head, setHead] = useState<Head>(emptyHead());
  const [lines, setLines] = useState<EditLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editPosted, setEditPosted] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [cpOpen, setCpOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  /** Не нашли товар при приёмке / вводе остатков — создаём тут же, без ухода в каталог */
  const [quick, setQuick] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [dupInvoice, setDupInvoice] = useState<string | null>(null);
  const add = useRef<ProductAddHandle>(null);
  const loadedVersion = useRef<number | null>(null);

  // Загрузка документа / склад по умолчанию для нового
  useEffect(() => {
    if (doc && loadedVersion.current !== doc.version) {
      const v = fromView(doc);
      setHead(v.head);
      setLines(v.lines);
      setDirty(false);
      loadedVersion.current = doc.version;
    }
  }, [doc]);
  useEffect(() => {
    if (isNew && !head.warehouseId && myWhs[0]) setHead((h) => ({ ...h, warehouseId: myWhs.find((w) => w.type === (docType === 'writeoff' ? 'sales_floor' : 'storage'))?.id ?? myWhs[0].id }));
  }, [isNew, myWhs, head.warehouseId, docType]);

  const posted = doc?.status === 'posted';
  const readOnly = posted && !editPosted;
  const totalQty = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const totalAmount = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const noPrice = kind.price && lines.some((l) => l.price === '');

  const setH = (p: Partial<Head>) => (setHead((h) => ({ ...h, ...p })), setDirty(true));
  const setL = (key: string, p: Partial<EditLine>) => (setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l))), setDirty(true));

  const addProduct = (p: PickedProduct) => {
    if (readOnly) return;
    setLines((ls) => {
      // Повторный скан — +1 к строке (ТЗ 23.4)
      const ex = ls.find((l) => l.productId === p.id && (l.unitId ?? null) === (p.unitId ?? null) && !l.productTo);
      if (ex) return ls.map((l) => (l.key === ex.key ? { ...l, qty: String(Number(l.qty) + 1) } : l));
      return [
        ...ls,
        {
          key: key(),
          productId: p.id,
          name: p.name,
          number: p.mainNumber,
          sku: p.sku,
          baseUnit: p.baseUnit,
          unitId: p.unitId ?? null,
          qty: '1',
          price: '',
          place: '',
          reason: '',
          productTo: null,
        },
      ];
    });
    setDirty(true);
  };

  const payload = useCallback(
    () => ({
      docDate: new Date(head.docDate).toISOString(),
      ...(head.warehouseId ? { warehouseId: head.warehouseId } : {}),
      ...(kind.warehouseTo && head.warehouseToId ? { warehouseToId: head.warehouseToId } : {}),
      ...(kind.counterparty ? { counterpartyId: head.counterparty?.id ?? null } : {}),
      ...(kind.currency ? { currency: head.currency, rate: head.currency === 'KGS' ? '1' : head.rate || '1' } : {}),
      comment: head.comment || null,
      extra: {
        ...(kind.invoice ? { supplierInvoiceNumber: head.invoiceNumber || undefined, supplierInvoiceDate: head.invoiceDate || undefined, extraCosts: head.extraCosts.filter((c) => c.name && Number(c.amount)) } : {}),
        ...(kind.reason ? { reason: head.reason } : {}),
      },
      lines: lines.map((l) => ({
        productId: l.productId,
        ...(l.unitId ? { unitId: l.unitId } : {}),
        qty: String(Number(String(l.qty).replace(',', '.')) || 0),
        ...(kind.price ? { price: l.price === '' ? null : String(Number(String(l.price).replace(',', '.'))) } : {}),
        ...(kind.productTo && l.productTo ? { productToId: l.productTo.id } : {}),
        ...(kind.place && l.place ? { place: l.place } : {}),
        ...(kind.reason && l.reason ? { reason: l.reason } : {}),
      })),
    }),
    [head, lines, kind],
  );

  const showErrors = (e: unknown) => {
    if (e instanceof ApiError && Array.isArray(e.details)) {
      const map: Record<number, string> = {};
      for (const d of e.details as LineError[]) if (d.line) map[d.line] = d.message;
      setErrors(map);
      setGeneralError(e.message);
    } else if (e instanceof ApiError && e.code === 'DUPLICATE_INVOICE') setDupInvoice(e.message);
    else toast.error(errorMessage(e));
  };

  const save = useMutation({
    mutationFn: async (opts: { post?: boolean; silent?: boolean; confirmDup?: boolean } = {}) => {
      setErrors({});
      setGeneralError(null);
      if (isNew) return docApi.create({ type: docType, ...payload(), post: !!opts.post, ...(opts.confirmDup ? { confirmDuplicateInvoice: true } : {}) });
      let d = doc!;
      if (dirty || editPosted) d = await docApi.update(d.id, { version: d.version, ...payload(), ...(opts.confirmDup ? { confirmDuplicateInvoice: true } : {}) });
      if (opts.post && d.status !== 'posted') d = await docApi.post(d.id, d.version, opts.confirmDup);
      return d;
    },
    onSuccess: (d, opts = {}) => {
      setDirty(false);
      setEditPosted(false);
      loadedVersion.current = null;
      qc.setQueryData(['document', d.id], d);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      if (!opts.silent) toast.success(opts.post || d.status === 'posted' ? `${kind.title} ${d.number} проведена` : 'Сохранено');
      if (isNew) nav(`/documents/${d.id}`, { replace: true });
    },
    onError: (e, opts = {}) => {
      if (!opts.silent) showErrors(e);
    },
  });

  // Автосохранение черновика (ТЗ 23.4)
  useEffect(() => {
    if (!dirty || isNew || !doc || doc.status !== 'draft' || save.isPending) return;
    const t = setTimeout(() => save.mutate({ silent: true }), 2000);
    return () => clearTimeout(t);
  }, [dirty, isNew, doc, head, lines, save]);

  // Не уходить со страницы с несохранёнными изменениями
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => (e.preventDefault(), (e.returnValue = ''));
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Ctrl+S — сохранить, Ctrl+Enter — провести
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || readOnly) return;
      if (e.key.toLowerCase() === 's') (e.preventDefault(), save.mutate({}));
      if (e.key === 'Enter') (e.preventDefault(), save.mutate({ post: true }));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [readOnly, save]);

  const act = useMutation({
    mutationFn: async (a: 'unpost' | 'approve' | 'mark' | 'unmark' | 'delete' | 'transfer' | 'writeoff' | 'surplus' | 'labels') => {
      const d = doc!;
      if (a === 'unpost') return docApi.unpost(d.id, d.version);
      if (a === 'approve') return docApi.approve(d.id, d.version);
      if (a === 'mark' || a === 'unmark') return docApi.mark(d.id, d.version, a === 'mark');
      if (a === 'delete') {
        await docApi.remove(d.id, d.version);
        return null;
      }
      if (a === 'labels') {
        openPdf(await docApi.labelsPdf(d.id, 'without_barcode'));
        return d;
      }
      return docApi.basedOn(d.id, a);
    },
    onSuccess: (r, a) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      if (a === 'delete') return (toast('Черновик удалён'), nav(-1));
      if (['transfer', 'writeoff', 'surplus'].includes(a) && r) return nav(`/documents/${r.id}`);
      if (r && a !== 'labels') {
        loadedVersion.current = null;
        qc.setQueryData(['document', r.id], r);
        toast.success(a === 'unpost' ? 'Проведение отменено' : a === 'approve' ? 'Согласовано и проведено' : 'Готово');
      }
    },
    onError: showErrors,
  });

  const attach = useMutation({
    mutationFn: async (f: File) => {
      const up = await uploadFile(f, 'attachment', f.name, { type: 'document', id: doc!.id });
      await docApi.attach(doc!.id, up.id);
    },
    onSuccess: () => (refetch(), toast.success('Вложение добавлено')),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!isNew && isLoading) return <Skeleton className="h-96 rounded-[32px]" />;
  if (!isNew && (error || !doc)) return <ErrorState error={error} onRetry={() => refetch()} />;

  const st = doc ? STATUS_LABEL[doc.status] : null;
  const reasons = meta.data?.writeoffReasons ?? [];
  const inTransit = doc?.type === 'transfer' && doc.status === 'posted' && doc.extra.transferState === 'in_transit';

  return (
    <div className="space-y-5 pb-24">
      {/* Шапка */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => (dirty && !confirm('Есть несохранённые изменения. Уйти?') ? null : nav(-1))}>
          <ArrowLeft /> Назад
        </Button>
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2 pl-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {kind.title} {doc?.number && <span className="font-normal text-muted">{doc.number}</span>}
          </h1>
          {st && <Pill tone={st.tone}>{st.label}</Pill>}
          {doc?.deletionMark && <Pill tone="dark">помечен на удаление</Pill>}
          {inTransit && <Pill tone="warn">в пути</Pill>}
          {doc?.hasNegative && <Pill tone="accent-outline">ушло в минус</Pill>}
          {dirty && <span className="text-xs text-muted">{save.isPending ? 'сохраняем…' : 'не сохранено'}</span>}
        </div>
        {readOnly ? (
          <>
            {inTransit && (
              <Button variant="dark" onClick={() => setAcceptOpen(true)}>
                <Truck /> Принять
              </Button>
            )}
            <Button onClick={() => setEditPosted(true)}>
              <PencilLine /> Исправить
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => save.mutate({})} loading={save.isPending && !save.variables?.post} disabled={!lines.length && isNew}>
              <Save /> {editPosted ? 'Перепровести' : 'Сохранить'}
            </Button>
            {!editPosted && (
              <Button variant="dark" onClick={() => save.mutate({ post: true })} loading={save.isPending && !!save.variables?.post} disabled={!lines.length}>
                <CheckCircle2 /> Провести
              </Button>
            )}
          </>
        )}
        {doc && (
          <Menu>
            <MenuTrigger className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line outline-none" aria-label="Ещё">
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent className="w-64">
              {doc.status === 'awaiting_approval' && (
                <MenuItem onSelect={() => act.mutate('approve')}>
                  <ShieldCheck /> Согласовать списание
                </MenuItem>
              )}
              {posted && (
                <MenuItem onSelect={() => act.mutate('unpost')}>
                  <Undo2 /> Отменить проведение
                </MenuItem>
              )}
              {posted && (
                <>
                  <MenuSeparator />
                  {doc.type !== 'transfer' && <MenuItem onSelect={() => act.mutate('transfer')}><Copy /> Перемещение на основании</MenuItem>}
                  {doc.type === 'receiving' && <MenuItem onSelect={() => act.mutate('writeoff')}><Copy /> Списание на основании</MenuItem>}
                  <MenuItem onSelect={() => act.mutate('labels')}>
                    <Printer /> Этикетки на товары без штрихкода
                  </MenuItem>
                </>
              )}
              <MenuSeparator />
              {doc.status === 'draft' ? (
                <MenuItem onSelect={() => confirm('Удалить черновик?') && act.mutate('delete')} className="text-accent">
                  <Trash2 /> Удалить черновик
                </MenuItem>
              ) : (
                <MenuItem onSelect={() => act.mutate(doc.deletionMark ? 'unmark' : 'mark')}>
                  <Trash2 /> {doc.deletionMark ? 'Снять пометку удаления' : 'Пометить на удаление'}
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        )}
      </div>

      {editPosted && (
        <div className="flex items-center gap-2 rounded-[20px] bg-warn-soft px-4 py-3 text-sm">
          <PencilLine className="size-4 text-warn" /> Исправление проведённого: при сохранении старые движения заменятся новыми. Минус проверяется по итогу.
          <button onClick={() => (setEditPosted(false), (loadedVersion.current = null), refetch())} className="ml-auto text-xs text-muted hover:text-ink">
            Отменить исправление
          </button>
        </div>
      )}
      {generalError && (
        <div className="flex gap-2 rounded-[20px] bg-accent-soft px-4 py-3 text-sm text-accent ring-1 ring-accent-line">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <b>{generalError}</b>
            {Object.entries(errors).slice(0, 5).map(([ln, m]) => (
              <div key={ln}>{m}</div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Реквизиты */}
          <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Дата">
              <Input type="datetime-local" value={head.docDate} disabled={readOnly} onChange={(e) => setH({ docDate: e.target.value })} />
            </Field>
            <Field label={kind.warehouseTo ? 'Откуда' : 'Склад'}>
              <select disabled={readOnly} value={head.warehouseId} onChange={(e) => setH({ warehouseId: e.target.value })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none disabled:opacity-70">
                {myWhs.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            {kind.warehouseTo && (
              <Field label="Куда">
                <select disabled={readOnly} value={head.warehouseToId} onChange={(e) => setH({ warehouseToId: e.target.value })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                  <option value="">— выберите склад —</option>
                  {physical(whs.data)
                    .filter((w) => w.id !== head.warehouseId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {kind.counterparty && (
              <Field label="Поставщик">
                <button type="button" disabled={readOnly} onClick={() => setCpOpen(true)} className="flex h-11 w-full items-center justify-between rounded-full bg-card px-4 text-left text-sm ring-1 ring-line">
                  <span className={cn('truncate', !head.counterparty && 'text-faint')}>{head.counterparty?.name ?? 'Выбрать'}</span>
                  <Search className="size-4 text-muted" />
                </button>
              </Field>
            )}
            {kind.reason && (
              <Field label="Причина">
                <select disabled={readOnly} value={head.reason} onChange={(e) => setH({ reason: e.target.value })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
                  {reasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind.invoice && (
              <>
                <Field label="№ накладной поставщика">
                  <Input value={head.invoiceNumber} disabled={readOnly} onChange={(e) => setH({ invoiceNumber: e.target.value })} />
                </Field>
                <Field label="Дата накладной">
                  <Input type="date" value={head.invoiceDate} disabled={readOnly} onChange={(e) => setH({ invoiceDate: e.target.value })} />
                </Field>
              </>
            )}
            {kind.currency && (
              <Field label="Валюта и курс" hint={head.currency !== 'KGS' ? 'По умолчанию — курс НБКР на дату' : undefined}>
                <div className="flex gap-1.5">
                  <select disabled={readOnly} value={head.currency} onChange={(e) => setH({ currency: e.target.value })} className="h-11 rounded-full bg-card px-3 text-sm ring-1 ring-line outline-none">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  {head.currency !== 'KGS' && <Input value={head.rate} disabled={readOnly} onChange={(e) => setH({ rate: e.target.value.replace(/[^\d.]/g, '') })} className="flex-1" />}
                </div>
              </Field>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Комментарий">
                <Input value={head.comment} disabled={readOnly} onChange={(e) => setH({ comment: e.target.value })} placeholder="Необязательно" />
              </Field>
            </div>
          </Card>

          {/* Строки */}
          <div className="space-y-2">
            {!readOnly && (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <ProductAddField ref={add} onPick={addProduct} onNotFound={(q) => setQuick(q)} />
                </div>
                <Button className="h-12" onClick={() => setPasteOpen(true)} title="Вставить строки из Excel">
                  <ClipboardPaste /> <span className="hidden sm:inline">Из Excel</span>
                </Button>
              </div>
            )}
            <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="w-10 py-2.5 pl-4 font-normal">№</th>
                    <th className="py-2.5 font-normal">Товар</th>
                    {kind.productTo && <th className="w-56 py-2.5 font-normal">Во что</th>}
                    <th className="w-28 py-2.5 font-normal">Кол-во</th>
                    {kind.price && <th className="w-32 py-2.5 font-normal">{kind.priceLabel ?? 'Цена'}</th>}
                    {kind.price && <th className="w-28 py-2.5 text-right font-normal">Сумма</th>}
                    {kind.place && <th className="w-28 py-2.5 pl-3 font-normal">Место</th>}
                    {kind.reason && <th className="w-36 py-2.5 pl-3 font-normal">Причина строки</th>}
                    {!readOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const err = errors[i + 1];
                    const diff = l.expectedQty !== undefined && Number(l.expectedQty) !== Number(l.qty);
                    return (
                      <tr key={l.key} className={cn('border-b border-line last:border-0', err && 'bg-accent-soft')}>
                        <td className="py-2 pl-4 align-top text-xs text-faint tabular-nums">{i + 1}</td>
                        <td className="py-2 pr-3 align-top">
                          <Link to={`/products/${l.productId}`} className="block truncate font-medium text-ink hover:underline">
                            {l.name}
                          </Link>
                          <div className="text-xs text-muted">
                            <span className="font-mono">{l.number ?? l.sku}</span>
                            {l.unitName && l.unitName !== l.baseUnit && <span> · {l.unitName}</span>}
                            {l.expectedQty !== undefined && <span className={cn(diff && 'font-medium text-warn')}> · ожидалось {num(l.expectedQty, 3)}</span>}
                          </div>
                          {err && <div className="mt-0.5 text-xs font-medium text-accent">{err}</div>}
                        </td>
                        {kind.productTo && (
                          <td className="py-2 pr-2 align-top">
                            {readOnly ? <span className="text-[13px]">{l.productTo?.name ?? '—'}</span> : <ProductSelect value={l.productTo} onChange={(p) => setL(l.key, { productTo: { id: p.id, name: p.name } })} />}
                          </td>
                        )}
                        <td className="py-2 pr-2 align-top">
                          <div className="flex items-center gap-1">
                            <input
                              data-cell={`${i}:0`}
                              disabled={readOnly}
                              inputMode="decimal"
                              value={l.qty}
                              onChange={(e) => setL(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '') })}
                              onKeyDown={(e) => gridNav(e, i, 0)}
                              className={cell}
                            />
                            <span className="text-xs text-muted">{l.baseUnit}</span>
                          </div>
                        </td>
                        {kind.price && (
                          <td className="py-2 pr-2 align-top">
                            <input
                              data-cell={`${i}:1`}
                              disabled={readOnly}
                              inputMode="decimal"
                              value={l.price}
                              placeholder="ожидает цен"
                              onChange={(e) => setL(l.key, { price: e.target.value.replace(/[^\d.,]/g, '') })}
                              onKeyDown={(e) => gridNav(e, i, 1)}
                              className={cn(cell, 'placeholder:text-[11px] placeholder:text-warn')}
                            />
                          </td>
                        )}
                        {kind.price && <td className="py-2 pr-3 text-right align-top font-medium tabular-nums">{l.price !== '' ? money((Number(l.qty) || 0) * (Number(l.price) || 0), head.currency === 'USD' ? 'USD' : 'KGS') : '—'}</td>}
                        {kind.place && (
                          <td className="py-2 pr-2 pl-3 align-top">
                            <input data-cell={`${i}:2`} disabled={readOnly} value={l.place} onChange={(e) => setL(l.key, { place: e.target.value.slice(0, 50) })} onKeyDown={(e) => gridNav(e, i, 2)} placeholder={readOnly ? "" : "A-3"} className={cell} />
                          </td>
                        )}
                        {kind.reason && (
                          <td className="py-2 pr-2 pl-3 align-top">
                            <select disabled={readOnly} value={l.reason} onChange={(e) => setL(l.key, { reason: e.target.value })} className={cell}>
                              <option value="">как в шапке</option>
                              {reasons.map((r) => (
                                <option key={r.code} value={r.code}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        {!readOnly && (
                          <td className="py-2 pr-2 align-top">
                            <button onClick={() => (setLines((ls) => ls.filter((x) => x.key !== l.key)), setDirty(true))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent" aria-label="Удалить строку">
                              <X className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!lines.length && <EmptyState title="Строк пока нет" hint={readOnly ? undefined : 'Сканируйте товар или введите номер в поле выше'} />}
            </div>
          </div>

          {/* Доп. расходы приёмки */}
          {kind.invoice && (head.extraCosts.length > 0 || !readOnly) && (
            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-medium">Доп. расходы (доставка, карго, таможня)</div>
                {!readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => setH({ extraCosts: [...head.extraCosts, { name: 'Доставка', amount: '' }] })}>
                    <Plus /> Добавить
                  </Button>
                )}
              </div>
              {head.extraCosts.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="h-10 flex-1" disabled={readOnly} value={c.name} onChange={(e) => setH({ extraCosts: head.extraCosts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Input className="h-10 w-36" disabled={readOnly} inputMode="decimal" value={c.amount} onChange={(e) => setH({ extraCosts: head.extraCosts.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, '') } : x)) })} />
                  {!readOnly && (
                    <button onClick={() => setH({ extraCosts: head.extraCosts.filter((_, j) => j !== i) })} className="grid size-10 place-items-center rounded-full text-muted hover:text-accent" aria-label="Убрать">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="text-xs text-muted">Распределяются по строкам пропорционально сумме и входят в себестоимость.</div>
            </Card>
          )}
        </div>

        {/* Боковая панель */}
        <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-[24px] bg-pill p-4 text-pill-ink">
            <div className="flex justify-between text-sm opacity-70">
              <span>Строк · количество</span>
              <span className="tabular-nums">
                {lines.length} · {num(totalQty, 3)}
              </span>
            </div>
            {kind.price && (
              <div className="mt-2 flex items-end justify-between">
                <span className="text-sm opacity-70">Сумма</span>
                <span className="text-2xl font-semibold tabular-nums">{money(totalAmount, head.currency === 'USD' ? 'USD' : 'KGS')}</span>
              </div>
            )}
            {kind.price && head.currency !== 'KGS' && <div className="text-right text-xs opacity-60">≈ {money(totalAmount * (Number(head.rate) || 0))}</div>}
            {noPrice && <div className="mt-2 text-xs text-warn">Есть строки без цены — товар можно продавать, себестоимость досчитается после ввода цен</div>}
          </div>
          {doc && (
            <Card className="space-y-3 p-4">
              <div className="text-[14px] font-medium">Связанные документы</div>
              {!doc.links.length && <div className="text-sm text-muted">Нет</div>}
              {doc.links.map((l) => (
                <Link key={l.id} to={`/documents/${l.id}`} className="flex items-center gap-2 rounded-xl bg-card-muted px-3 py-2 text-[13px] hover:bg-line">
                  <FileText className="size-4 text-muted" />
                  <span className="flex-1 truncate">{l.number}</span>
                  <span className="text-xs text-muted">{date(l.docDate, 'D MMM')}</span>
                </Link>
              ))}
              <div className="border-t border-line pt-3 text-[14px] font-medium">Вложения</div>
              {doc.attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[13px]">
                  <Paperclip className="size-3.5 text-muted" />
                  <span className="truncate">{a.name}</span>
                </div>
              ))}
              <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] text-muted ring-1 ring-line ring-dashed hover:text-ink">
                <Paperclip className="size-4" /> {attach.isPending ? 'Загружаем…' : 'Фото накладной, скриншот'}
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && attach.mutate(e.target.files[0])} />
              </label>
            </Card>
          )}
        </aside>
      </div>

      <CounterpartyPicker open={cpOpen} onOpenChange={setCpOpen} role="supplier" title="Поставщик" onPick={(c) => setH({ counterparty: { id: c.id, name: c.name } })} />
      <QuickProductDialog
        open={quick !== null}
        onOpenChange={(v) => !v && setQuick(null)}
        initial={quick ?? undefined}
        onCreated={(p) => (addProduct({ id: p.id, name: p.name, sku: p.sku, mainNumber: p.mainNumber, brandName: p.brandName, baseUnit: p.baseUnit, price: p.retailPrice }), setDirty(true), setTimeout(() => add.current?.focus(), 50))}
      />
      <PasteDialog open={pasteOpen} onOpenChange={setPasteOpen} withPrice={kind.price} onLines={(ls) => (setLines((x) => [...x, ...ls]), setDirty(true))} />
      {doc && inTransit && <AcceptDialog open={acceptOpen} onOpenChange={setAcceptOpen} doc={doc} />}
      <Dialog open={!!dupInvoice} onOpenChange={(v) => !v && setDupInvoice(null)} title="Такая накладная уже была" description={dupInvoice ?? ''}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDupInvoice(null)}>
            Проверю
          </Button>
          <Button variant="dark" onClick={() => (setDupInvoice(null), save.mutate({ post: true, confirmDup: true }))}>
            Это другая поставка — провести
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Навигация по ячейкам как в Excel: Enter / стрелки вверх-вниз по строкам, Tab — по колонкам */
function gridNav(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
  const go = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${r}:${c}"]`);
    if (el) (e.preventDefault(), el.focus(), el.select());
  };
  if (e.key === 'Enter' || e.key === 'ArrowDown') go(row + 1, col);
  else if (e.key === 'ArrowUp') go(row - 1, col);
}

/** Вставка строк из Excel: номер (или штрихкод) · количество · цена */
function PasteDialog({ open, onOpenChange, withPrice, onLines }: { open: boolean; onOpenChange: (v: boolean) => void; withPrice: boolean; onLines: (l: EditLine[]) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const rows = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((r) => r.split('\t').map((c) => c.trim()))
        .filter((r) => r[0]),
    [text],
  );
  const run = async () => {
    setBusy(true);
    const out: EditLine[] = [];
    const miss: string[] = [];
    for (const r of rows) {
      const res = await productApi.search(r[0], 'document', 3).catch(() => null);
      const hit = res ? [...res.groups.here, ...res.groups.elsewhere, ...res.groups.noStock].find((x) => ['barcode', 'sku', 'number'].includes(x.matchKind)) : undefined;
      if (!hit) {
        miss.push(r[0]);
        continue;
      }
      out.push({
        key: key(),
        productId: hit.id,
        name: hit.name,
        number: hit.mainNumber,
        sku: hit.sku,
        baseUnit: hit.baseUnit,
        qty: String(Number((r[1] ?? '1').replace(',', '.')) || 1),
        price: withPrice && r[2] ? String(Number(r[2].replace(/\s/g, '').replace(',', '.')) || '') : '',
        place: '',
        reason: '',
        productTo: null,
      });
    }
    setBusy(false);
    setMissing(miss);
    onLines(out);
    toast.success(`Добавлено строк: ${out.length}${miss.length ? `, не найдено: ${miss.length}` : ''}`);
    if (!miss.length) (onOpenChange(false), setText(''));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl" title="Вставить из Excel" description={`Скопируйте колонки: номер или штрихкод · количество${withPrice ? ' · цена' : ''}`}>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={'04465-33450\t2\t3200\n90915-YZZE1\t10\t380'}
        className="mt-4 w-full rounded-[18px] bg-card-muted p-3 font-mono text-[13px] outline-none focus:ring-2 focus:ring-ink"
      />
      {missing.length > 0 && <div className="mt-2 rounded-2xl bg-warn-soft p-3 text-xs">Не нашли в каталоге: {missing.join(', ')}</div>}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted">Строк: {rows.length}</span>
        <Button variant="dark" disabled={!rows.length} loading={busy} onClick={run}>
          Найти и добавить
        </Button>
      </div>
    </Dialog>
  );
}

/** Приёмка перемещения на складе-получателе: меньше отправленного — акт расхождения */
function AcceptDialog({ open, onOpenChange, doc }: { open: boolean; onOpenChange: (v: boolean) => void; doc: DocView }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setQty(Object.fromEntries(doc.lines.map((l) => [l.id, String(Number(l.baseQty))])));
  }, [open, doc]);
  const m = useMutation({
    mutationFn: () => docApi.accept(doc.id, doc.version, doc.lines.map((l) => ({ lineId: l.id, qty: qty[l.id] || '0' }))),
    onSuccess: (d) => {
      qc.setQueryData(['document', d.id], d);
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Перемещение принято');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl" title="Принять перемещение" description={`${doc.warehouse?.name} → ${doc.warehouseTo?.name}`}>
      <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto">
        {doc.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-[16px] bg-card-muted px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[13.5px]">{l.productName}</span>
            <span className="text-xs text-muted">отправлено {num(l.baseQty, 3)}</span>
            <input value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value.replace(/[^\d.]/g, '') })} className="h-9 w-20 rounded-xl bg-card px-2 text-right text-sm tabular-nums ring-1 ring-line outline-none" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="dark" loading={m.isPending} onClick={() => m.mutate()}>
          Принять
        </Button>
      </div>
    </Dialog>
  );
}
