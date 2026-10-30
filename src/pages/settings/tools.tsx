import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, History, Plus, Printer, RotateCcw, Search, Sparkles, Star, Tag, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useAudit, useImports, useImportTemplates, useShopSettings, useStaff, useSynonyms, useTenant, useUnfound, type AuditRow, type ImportField, type ImportJob, type ImportPreview, type ImportType } from '@/entities/admin';
import { saveBlob } from '@/entities/purchasing';
import { useCan } from '@/entities/session';
import { errorMessage, uploadFile } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago, date, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';


// ── Печатные формы ──────────────────────────────────────

/** Печатные формы (ТЗ 22.4): чек, ценник, этикетка — что печатается и как выглядит */
export function PrintFormsPage() {
  const tenant = useTenant();
  const s = useShopSettings();
  const qc = useQueryClient();
  const can = useCan();
  const [cipher, setCipher] = useState<string | null>(null);
  const [cur, setCur] = useState<'KGS' | 'USD' | 'both' | null>(null);
  const v = s.data?.settings;
  const cipherVal = cipher ?? v?.minPriceCipher ?? '';
  const curVal = cur ?? v?.priceTagCurrency ?? 'KGS';
  const valid = !cipherVal || (cipherVal.length === 10 && new Set(cipherVal.toUpperCase()).size === 10);
  const save = useMutation({
    mutationFn: () => adminApi.updateSettings(s.data!.version, { minPriceCipher: cipherVal ? cipherVal.toUpperCase() : null, priceTagCurrency: curVal }),
    onSuccess: (r) => (qc.setQueryData(['shop-settings'], r), setCipher(null), setCur(null), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const enc = (n: number) => (cipherVal.length === 10 ? String(n).split('').map((d) => cipherVal.toUpperCase()[Number(d)]).join('') : '—');
  const t = tenant.data;
  const dirty = cipher !== null || cur !== null;
  return (
    <div className="space-y-6">
      <PageTitle title="Печатные формы" sub="Чек и документы берут реквизиты из «Настроек». Ценник — цена в сомах, долларах или обеих, минимальная цена шифром для продавца" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-[15px] font-medium">
            <Printer className="size-4 text-accent" /> Чек 58/80 мм
          </div>
          <div className="mx-auto w-56 rounded-md bg-white p-4 font-mono text-[11px] leading-snug text-black shadow-card ring-1 ring-line">
            <div className="text-center font-bold">{t?.name ?? 'Магазин'}</div>
            <div className="text-center">{t?.address ?? 'адрес'}</div>
            <div className="text-center">{t?.phone ?? ''}</div>
            <div className="my-1 border-t border-dashed border-black/40" />
            <div>Чек К1А-000458 · 25.10.26 14:32</div>
            <div className="my-1 border-t border-dashed border-black/40" />
            <div className="flex justify-between"><span>Колодки Toyota</span><span>4 850</span></div>
            <div className="flex justify-between"><span>Фильтр масл.</span><span>650</span></div>
            <div className="my-1 border-t border-dashed border-black/40" />
            <div className="flex justify-between font-bold"><span>ИТОГО</span><span>5 500</span></div>
            <div>Гарантия: колодки — 30 дн.</div>
            <div className="mt-1 text-center">Спасибо за покупку!</div>
          </div>
          <div className="mt-3 text-xs text-muted">Гарантия и условия возврата печатаются из правил группы товара</div>
        </Card>
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Tag className="size-4 text-accent" /> Ценник
          </div>
          <div className="mx-auto w-56 rounded-lg bg-white p-3 text-black shadow-card ring-1 ring-line">
            <div className="text-[11px] leading-tight font-semibold">Колодки тормозные передние</div>
            <div className="text-[10px]">Toyota · 04465-33450</div>
            <div className="mt-1 text-2xl font-bold">{curVal === 'USD' ? '$55,50' : '4 850 с'}</div>
            {curVal === 'both' && <div className="text-xs">$55,50</div>}
            <div className="mt-1 text-right font-mono text-[10px] text-black/60">{enc(4123)}</div>
          </div>
          <Field label="Валюта на ценнике">
            <Segmented size="sm" value={curVal} onChange={(x) => setCur(x)} options={[{ value: 'KGS', label: 'Сомы' }, { value: 'USD', label: 'Доллары' }, { value: 'both', label: 'Обе' }]} />
          </Field>
          <Field label="Шифр минимальной цены" hint="10 разных букв: 1-я буква = 0, 2-я = 1 … Например ПОЛУСТАНЕК" error={valid ? undefined : 'Нужно ровно 10 разных букв'}>
            <Input disabled={!can('settings.manage')} value={cipherVal} onChange={(e) => setCipher(e.target.value.toUpperCase().slice(0, 10))} placeholder="ПОЛУСТАНЕК" className="font-mono tracking-widest" />
          </Field>
          {dirty && (
            <Button variant="dark" className="w-full" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
              Сохранить
            </Button>
          )}
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <FileSpreadsheet className="size-4 text-accent" /> Документы и этикетки
          </div>
          {[
            ['Этикетка товара', '58×40, 40×30, 58×30 мм: название, номер, штрихкод, место', '/labels'],
            ['Ценники пачкой', 'После установки цен — печать изменившихся', '/prices'],
            ['Накладная, приёмка', 'PDF из карточки документа', '/documents'],
            ['Заказ поставщику', 'PDF и Excel, текст для WhatsApp', '/purchasing/orders'],
            ['Сверка долга', 'PDF и текст для WhatsApp из карточки клиента', '/customers/debts'],
            ['Этикетки мест хранения', 'Коды ячеек со штрихкодом', '/stock/places'],
          ].map(([l, h, to]) => (
            <Link key={l} to={to} className="flex items-center gap-2 rounded-[14px] bg-card-muted px-3 py-2.5 hover:bg-line">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{l}</span>
                <span className="block truncate text-xs text-muted">{h}</span>
              </span>
              <ArrowRight className="size-4 text-muted" />
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Синонимы ────────────────────────────────────────────

/** Словарь синонимов (ТЗ 6.4): «бочонок» = глушитель; «Что спрашивают, но нет» */
export function SynonymsPage() {
  const { data, isLoading } = useSynonyms();
  const unfound = useUnfound();
  const qc = useQueryClient();
  const [w, setW] = useState('');
  const [t, setT] = useState('');
  const [q, setQ] = useState('');
  const add = useMutation({ mutationFn: () => adminApi.addSynonym(w.trim().toLowerCase(), t.trim().toLowerCase()), onSuccess: () => (qc.invalidateQueries({ queryKey: ['synonyms'] }), setW(''), setT(''), toast.success('Синоним добавлен — поиск понимает его сразу')), onError: (e) => toast.error(errorMessage(e)) });
  const del = useMutation({ mutationFn: (id: string) => adminApi.removeSynonym(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['synonyms'] }), onError: (e) => toast.error(errorMessage(e)) });
  const f = (x: { word: string; target: string }) => !q || (x.word + x.target).includes(q.toLowerCase());
  return (
    <div className="space-y-6">
      <PageTitle title="Словарь синонимов" sub="Как называют детали покупатели и мастера. Общий словарь уже знает сотни слов; свои — дополняют его" />
      <Card className="flex flex-wrap items-end gap-2 p-4">
        <Field label="Слово клиента" className="min-w-48 flex-1">
          <Input value={w} onChange={(e) => setW(e.target.value)} placeholder="бочонок" />
        </Field>
        <ArrowRight className="mb-3 size-5 text-accent" />
        <Field label="Что это" className="min-w-48 flex-1">
          <Input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && w.trim() && t.trim() && add.mutate()} placeholder="глушитель" />
        </Field>
        <Button variant="dark" size="lg" disabled={!w.trim() || !t.trim()} loading={add.isPending} onClick={() => add.mutate()}>
          <Plus /> Добавить
        </Button>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти слово" className="max-w-sm" />
          {isLoading && <Skeleton className="h-40 rounded-[24px]" />}
          {data && (
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">Свои · {data.own.length}</div>
              <div className="flex flex-wrap gap-1.5">
                {data.own.filter(f).map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-card py-1 pr-1 pl-3 text-[13px]">
                    {s.word} <ArrowRight className="size-3 text-accent" /> <b>{s.target}</b>
                    <button onClick={() => del.mutate(s.id)} className="grid size-6 place-items-center rounded-full text-muted hover:text-accent" aria-label="Удалить">
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ))}
                {!data.own.length && <span className="text-sm text-muted">Пока нет</span>}
              </div>
              <div className="mt-4 px-1 pb-2 text-[14px] font-medium">Общий словарь · {data.global.length}</div>
              <div className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto">
                {data.global.filter(f).slice(0, 300).map((s) => (
                  <span key={s.word + s.target} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-[12.5px] text-ink-2">
                    {s.word} → {s.target}
                  </span>
                ))}
              </div>
            </Tray>
          )}
        </div>
        <Tray className="h-fit p-3">
          <div className="flex items-center gap-2 px-1 pb-2 text-[14px] font-medium">
            <AlertTriangle className="size-4 text-warn" /> Что спрашивают, но нет
          </div>
          <div className="space-y-1">
            {unfound.data?.slice(0, 20).map((u) => (
              <div key={u.normalized} className="rounded-[14px] bg-card px-3 py-2 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{u.example}</span>
                  <span className="text-muted tabular-nums">{u.times}×</span>
                </div>
                <div className="text-xs text-muted">
                  {u.notFound ? `не нашли ${u.notFound}` : ''}
                  {u.noStock ? `${u.notFound ? ' · ' : ''}нет в наличии ${u.noStock}` : ''}
                  {u.vehicles?.length ? ` · ${u.vehicles.slice(0, 2).join(', ')}` : ''}
                </div>
              </div>
            ))}
            {unfound.data && !unfound.data.length && <div className="rounded-[14px] bg-card px-3 py-2 text-sm text-muted">Всё находится 👍</div>}
          </div>
        </Tray>
      </div>
    </div>
  );
}

// ── Журнал действий ─────────────────────────────────────

const ACTIONS: [string, string][] = [
  ['', 'Все'],
  ['settings.', 'Настройки'],
  ['price', 'Цены'],
  ['document.', 'Документы'],
  ['receipt.', 'Чеки'],
  ['shift.', 'Смены'],
  ['member', 'Сотрудники'],
  ['role.', 'Роли'],
];

/** Журнал действий (ТЗ 3.6): кто, когда, что изменил — со «было / стало» */
export function AuditPage() {
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [important, setImportant] = useState(false);
  const [page, setPage] = useState(1);
  const staff = useStaff({ limit: 200 });
  const { data, isLoading, error, refetch } = useAudit({ action: action || undefined, userId: userId || undefined, important: important || undefined, page, limit: 50 });
  const [open, setOpen] = useState<AuditRow | null>(null);
  useEffect(() => setPage(1), [action, userId, important]);
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  return (
    <div className="space-y-6">
      <PageTitle title="Журнал действий" sub="Изменение цены, удаление строки чека, правка проведённого документа, вход сотрудника — с автором и временем" />
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Все сотрудники</option>
          {staff.data?.items.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
        <Switch checked={important} onChange={setImportant} label="Только важное" />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
          {data.items.map((a) => (
            <button key={a.id} onClick={() => setOpen(a)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-card-muted">
              <span className="w-28 text-[13px] text-muted">{date(a.createdAt, 'DD.MM HH:mm')}</span>
              <span className="w-32 truncate text-[13px] font-medium">{a.userName ?? 'система'}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                {a.important && <Star className="mr-1 inline size-3.5 text-accent" />}
                {a.summary ?? a.action}
              </span>
              <span className="font-mono text-[11px] text-faint">{a.action}</span>
            </button>
          ))}
          {!data.items.length && <EmptyState icon={<History />} title="Записей нет" />}
        </div>
      )}
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
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)} title={open?.summary ?? open?.action ?? ''} description={open ? `${open.userName ?? 'система'} · ${date(open.createdAt, 'D MMM YYYY, HH:mm:ss')}${open.ip ? ` · ${open.ip}` : ''}` : ''} className="max-w-2xl">
        {open && (
          <div className="mt-4 space-y-2">
            {open.diff && Object.keys(open.diff).length > 0 ? (
              <div className="overflow-hidden rounded-[16px] ring-1 ring-line">
                {Object.entries(open.diff).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr_1fr] gap-2 border-b border-line px-3 py-2 text-[13px] last:border-0">
                    <span className="text-muted">{k}</span>
                    <span className="truncate text-accent line-through">{JSON.stringify(v.from)}</span>
                    <span className="truncate text-ok">{JSON.stringify(v.to)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">Без подробностей</div>
            )}
            {open.supportSessionId && <Pill tone="warn">сделано поддержкой</Pill>}
            {open.userAgent && <div className="truncate text-xs text-faint">{open.userAgent}</div>}
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Импорт и экспорт ────────────────────────────────────

const TYPES: { value: ImportType; label: string; hint: string }[] = [
  { value: 'products', label: 'Товары', hint: 'Название, номер, бренд, группа, штрихкод, цена, применимость' },
  { value: 'crosses', label: 'Кроссы', hint: 'Номер = номер аналога' },
  { value: 'applicability', label: 'Применимость', hint: 'Товар → для каких машин' },
];
const JOB_STATUS: Record<ImportJob['status'], { label: string; tone: 'soft' | 'ok' | 'warn' | 'accent-outline' | 'muted' }> = {
  uploaded: { label: 'загружен', tone: 'soft' },
  previewed: { label: 'проверен', tone: 'soft' },
  queued: { label: 'в очереди', tone: 'warn' },
  running: { label: 'идёт', tone: 'warn' },
  done: { label: 'готово', tone: 'ok' },
  failed: { label: 'ошибка', tone: 'accent-outline' },
  rolled_back: { label: 'откачен', tone: 'muted' },
};

function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ImportType>('products');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [job, setJob] = useState<{ id: string; columns: string[]; sample: string[][]; fields: ImportField[]; total: number; name: string } | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [opts, setOpts] = useState({ updateExisting: true, createCategories: true });
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  useEffect(() => {
    if (open) (setStep(1), setJob(null), setPrev(null), setMapping({}));
  }, [open]);
  const upload = useMutation({
    mutationFn: async (f: File) => {
      const up = await uploadFile(f, 'import', f.name);
      return { r: await adminApi.createImport(type, up.id), name: f.name };
    },
    onSuccess: ({ r, name }) => (setJob({ id: r.job.id, columns: r.columns, sample: r.sample, fields: r.fields, total: r.job.totalRows, name }), setMapping(r.suggestedMapping), setStep(2)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const check = useMutation({ mutationFn: () => adminApi.previewImport(job!.id, mapping, opts), onSuccess: (p) => (setPrev(p), setStep(3)), onError: (e) => toast.error(errorMessage(e)) });
  const run = useMutation({ mutationFn: () => adminApi.runImport(job!.id), onSuccess: () => (qc.invalidateQueries({ queryKey: ['imports'] }), onClose(), toast.success('Загрузка пошла в фоне — можно работать дальше')), onError: (e) => toast.error(errorMessage(e)) });
  const missing = job?.fields.filter((f) => f.required && mapping[f.key] === undefined) ?? [];
  const colOf = (i: number) => job?.fields.find((f) => mapping[f.key] === i);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Импорт из Excel" description={['1. Файл', '2. Колонки', '3. Проверка'].map((s, i) => (i + 1 === step ? `● ${s}` : s)).join('   ')} className="max-w-5xl">
      <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
      {step === 1 && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button key={t.value} onClick={() => setType(t.value)} className={cn('rounded-[18px] p-4 text-left ring-1 transition', type === t.value ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line hover:ring-line-strong')}>
                <div className="text-[15px] font-medium">{t.label}</div>
                <div className={cn('mt-1 text-xs', type === t.value ? 'opacity-70' : 'text-muted')}>{t.hint}</div>
              </button>
            ))}
          </div>
          <button onClick={() => file.current?.click()} className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-[24px] text-muted ring-2 ring-line ring-dashed hover:text-ink">
            {upload.isPending ? <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-r-transparent" /> : <Upload className="size-7" />}
            <span className="text-sm">{upload.isPending ? 'Читаем файл…' : 'Выберите Excel или CSV — выгрузку из 1С, МойСклад или свою таблицу'}</span>
          </button>
        </div>
      )}
      {step === 2 && job && (
        <div className="mt-4 space-y-4">
          <div className="text-sm text-muted">
            {job.name} · {num(job.total)} строк. Колонки угаданы по заголовкам — проверьте
          </div>
          <div className="flex flex-wrap gap-2">
            {job.fields.map((f) => (
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
                  className={cn('h-7 max-w-40 rounded-full bg-card px-2 text-[12.5px] outline-none', mapping[f.key] === undefined && f.required && 'text-accent ring-1 ring-accent-line')}
                >
                  <option value="">—</option>
                  {job.columns.map((c, i) => (
                    <option key={i} value={i}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="scroll-thin max-h-72 overflow-auto rounded-[20px] ring-1 ring-line">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-card-muted text-left">
                <tr>
                  {job.columns.map((c, i) => (
                    <th key={i} className={cn('px-3 py-2 font-medium whitespace-nowrap', colOf(i) && 'bg-accent-soft text-accent')}>
                      {colOf(i)?.label ?? <span className="font-normal text-muted">{c}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.sample.map((r, k) => (
                  <tr key={k} className="border-t border-line">
                    {job.columns.map((_, i) => (
                      <td key={i} className={cn('max-w-56 truncate px-3 py-1.5', colOf(i) ? 'text-ink' : 'text-faint')}>
                        {r[i] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {type === 'products' && (
            <div className="flex flex-wrap gap-4">
              <Switch checked={opts.updateExisting} onChange={(v) => setOpts({ ...opts, updateExisting: v })} label="Обновлять найденные товары (по номеру + бренду или артикулу)" />
              <Switch checked={opts.createCategories} onChange={(v) => setOpts({ ...opts, createCategories: v })} label="Создавать недостающие группы" />
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button variant="dark" disabled={missing.length > 0} loading={check.isPending} onClick={() => check.mutate()}>
              Проверить строки
            </Button>
          </div>
        </div>
      )}
      {step === 3 && prev && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Проверено', `${num(prev.checkedRows)}${prev.partial ? ` из ${num(prev.totalRows)}` : ''}`],
              ['Без ошибок', num(prev.validRows)],
              ['Создастся', prev.wouldCreate != null ? num(prev.wouldCreate) : '—'],
              ['Обновится', prev.wouldUpdate != null ? num(prev.wouldUpdate) : '—'],
            ].map(([l, v], i) => (
              <div key={l} className={cn('rounded-[18px] p-3', i === 1 ? 'bg-ok-soft' : 'bg-card-muted')}>
                <div className="text-xs text-muted">{l}</div>
                <div className="text-xl font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          {prev.errors.length > 0 && (
            <div className="scroll-thin max-h-56 space-y-1 overflow-y-auto">
              <div className="text-sm font-medium text-accent">Строк с ошибками: {prev.errorRows} — они пропустятся</div>
              {prev.errors.slice(0, 100).map((e, i) => (
                <div key={i} className="rounded-[12px] bg-accent-soft px-3 py-1.5 text-[12.5px]">
                  Строка {e.row}
                  {e.field && ` · ${e.field}`}: {e.message}
                </div>
              ))}
            </div>
          )}
          {prev.partial && <div className="text-xs text-muted">Проверены первые {num(prev.checkedRows)} строк — остальные проверятся при загрузке</div>}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Назад к колонкам
            </Button>
            <Button variant="accent" disabled={!prev.validRows} loading={run.isPending} onClick={() => run.mutate()}>
              <Sparkles /> Загрузить {num(prev.totalRows - (prev.partial ? 0 : prev.errorRows))} строк
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Импорт и экспорт (ТЗ 24): переход с 1С / МойСклад, кроссы, применимость; откат; полная выгрузка */
export function ImportPage() {
  const jobs = useImports();
  const tpl = useImportTemplates();
  const qc = useQueryClient();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const rollback = useMutation({
    mutationFn: (id: string) => adminApi.rollbackImport(id),
    onSuccess: (r) => (qc.invalidateQueries({ queryKey: ['imports'] }), toast.success(`Откатили: товаров ${r.removedProducts}, кроссов ${r.removedCrosses}`), r.notReverted && toast.warning(r.notReverted)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const exp = useMutation({ mutationFn: adminApi.exportFull, onSuccess: (b) => saveBlob(b, `export-${new Date().toISOString().slice(0, 10)}.zip`), onError: (e) => toast.error(errorMessage(e)) });
  const shown = useMemo(() => tpl.data ?? [], [tpl.data]);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Импорт и экспорт"
        sub="Загрузите выгрузку из 1С, МойСклад или любой Excel — колонки найдутся сами. Остатки — через «Ввод остатков» (кнопка «Из Excel»)"
        actions={
          <>
            {can('settings.manage') && (
              <Button onClick={() => exp.mutate()} loading={exp.isPending}>
                <Download /> Выгрузить всё
              </Button>
            )}
            <Button variant="dark" onClick={() => setOpen(true)}>
              <Upload /> Импорт
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-1.5">
          {jobs.isLoading && <Skeleton className="h-40 rounded-[24px]" />}
          {jobs.data?.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] bg-card px-4 py-3 ring-1 ring-line">
              <FileSpreadsheet className="size-5 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{j.fileName}</span>
                <span className="block text-xs text-muted">
                  {TYPES.find((t) => t.value === j.type)?.label} · {ago(j.createdAt)}
                  {j.status === 'done' && ` · создано ${num(j.createdCount)}, обновлено ${num(j.updatedCount)}${j.errorCount ? `, ошибок ${num(j.errorCount)}` : ''}`}
                  {j.failReason && ` · ${j.failReason}`}
                </span>
              </span>
              {j.status === 'running' && (
                <span className="w-32">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full bg-accent transition-all" style={{ width: `${j.totalRows ? (j.processedRows / j.totalRows) * 100 : 0}%` }} />
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {num(j.processedRows)} / {num(j.totalRows)}
                  </span>
                </span>
              )}
              <Pill tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</Pill>
              {j.status === 'done' && j.type !== 'applicability' && (
                <Button size="sm" variant="ghost" loading={rollback.isPending && rollback.variables === j.id} onClick={() => confirm('Откатить загрузку? Созданные товары удалятся, если по ним нет документов') && rollback.mutate(j.id)}>
                  <RotateCcw /> Откатить
                </Button>
              )}
            </div>
          ))}
          {jobs.data && !jobs.data.length && (
            <Card>
              <EmptyState icon={<FileSpreadsheet />} title="Загрузок ещё не было" hint="Начните с товаров: выгрузка номенклатуры из 1С или «Товары → Экспорт» из МойСклад" />
            </Card>
          )}
        </div>
        <Tray className="h-fit space-y-2 p-3">
          <div className="px-1 text-[14px] font-medium">Как выгрузить из старой программы</div>
          {shown.map((t) => (
            <div key={t.code} className="rounded-[16px] bg-card px-3 py-2.5">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                <CheckCircle2 className="size-3.5 text-ok" /> {t.title}
              </div>
              <div className="mt-0.5 text-xs text-muted">{t.howTo}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.columns.map((c) => (
                  <Pill key={c} tone="outline" className="h-5 text-[10.5px]">
                    {c}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </Tray>
      </div>
      <ImportWizard open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
