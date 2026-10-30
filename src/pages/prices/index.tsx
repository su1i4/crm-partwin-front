import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleDollarSign, Plus, Printer, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories } from '@/entities/category';
import { pricingApi, usePriceSetting, usePriceSettings, usePriceTypes, useShopRates, type PriceSetting, type PriceSettingInput } from '@/entities/pricing';
import { useCan } from '@/entities/session';
import { openPdf, stockApi } from '@/entities/stock';
import { ProductAddField } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago, date, money, num } from '@/shared/lib/format';
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';

// ── Курс магазина ───────────────────────────────────────

/** Курс магазина (ТЗ 5.3): свой курс $ для цен в долларах, история с автором */
export function ShopRatePage() {
  const { data, isLoading, error, refetch } = useShopRates();
  const can = useCan();
  const qc = useQueryClient();
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => pricingApi.setRate(rate.replace(',', '.'), note || undefined),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['rates'] }), setRate(''), setNote(''), toast.success('Курс обновлён — цены в $ пересчитаются сразу')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cur = data?.current.find((c) => c.currency === 'USD');
  return (
    <div className="space-y-6">
      <PageTitle title="Курс магазина" sub="Свой курс доллара: по нему товары с ценой в $ продаются в сомах" />
      {error && <ErrorState error={error} onRetry={refetch} />}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="hatch rounded-[28px] bg-pill p-6 text-pill-ink">
            <div className="flex items-center gap-2 text-sm opacity-70">
              <CircleDollarSign className="size-4" /> 1 USD
            </div>
            <div className="mt-2 text-[44px] leading-none font-semibold tabular-nums">{isLoading ? '…' : cur ? num(cur.rate, 2) : '—'}</div>
            <div className="mt-2 text-xs opacity-60">{cur ? `сом · с ${date(cur.setAt, 'D MMM, HH:mm')}` : 'курс не задан'}</div>
          </div>
          {can('prices.write') && (
            <Card className="space-y-3 p-5">
              <Field label="Новый курс">
                <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="89.50" className="text-lg font-semibold tabular-nums" />
              </Field>
              <Field label="Комментарий">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Курс на Дордое" />
              </Field>
              {cur && rate && Number(rate.replace(',', '.')) > 0 && (
                <div className="text-xs text-muted">
                  Изменение: <b className={cn(Number(rate.replace(',', '.')) > Number(cur.rate) ? 'text-accent' : 'text-ok')}>{num(((Number(rate.replace(',', '.')) / Number(cur.rate)) - 1) * 100, 2)}%</b> к текущему
                </div>
              )}
              <Button variant="dark" className="w-full" disabled={!(Number(rate.replace(',', '.')) > 0)} loading={save.isPending} onClick={() => save.mutate()}>
                Установить курс
              </Button>
            </Card>
          )}
        </div>
        <Tray className="p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">История</div>
          <div className="space-y-1">
            {data?.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-2.5">
                <span className="w-24 text-[15px] font-semibold tabular-nums">{num(h.rate, 2)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{h.note ?? ''}</span>
                <span className="text-xs text-muted">{h.setByName ?? ''}</span>
                <span className="w-32 text-right text-xs text-muted">{date(h.setAt, 'D MMM YY, HH:mm')}</span>
              </div>
            ))}
            {data && !data.history.length && <EmptyState title="Курс ещё не устанавливали" />}
          </div>
        </Tray>
      </div>
    </div>
  );
}

// ── Установка цен: журнал ───────────────────────────────

/** Журнал установок цен (ТЗ 5.2): цены меняются только документом — с историей и перепечаткой ценников */
export function PriceSettingsPage() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const { data, isLoading, error, refetch } = usePriceSettings({ status: status || undefined, page });
  const nav = useNavigate();
  const [create, setCreate] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Установка цен"
        sub="Наценка от закупки, ±% от другого типа или вручную. Проведённая установка сразу предлагает новые ценники"
        actions={
          <Button variant="dark" onClick={() => setCreate(true)}>
            <Plus /> Установка цен
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={status as '' | 'draft' | 'posted'}
          onChange={(v) => setSp(v ? { status: v } : {})}
          options={[
            { value: '', label: 'Все' },
            { value: 'draft', label: 'Черновики' },
            { value: 'posted', label: 'Проведены' },
          ]}
        />
        <Link to="/prices/rate" className="ml-auto text-sm text-muted hover:text-ink">
          Курс магазина →
        </Link>
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-48 rounded-[24px]" />}
      <div className="space-y-1.5">
        {data?.items.map((s) => (
          <button key={s.id} onClick={() => nav(`/prices/${s.id}`)} className="flex w-full items-center gap-4 rounded-[20px] bg-card px-4 py-3 text-left ring-1 ring-line transition hover:ring-line-strong">
            <span className="font-mono text-[13px] text-muted">№{s.number}</span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{s.comment || 'Установка цен'}</span>
            <span className="text-xs text-muted">{num(s.linesCount)} строк</span>
            <span className="hidden w-28 text-right text-xs text-muted sm:block">с {date(s.validFrom, 'D MMM YYYY')}</span>
            <Pill tone={s.status === 'posted' ? 'ok' : 'soft'}>{s.status === 'posted' ? 'проведена' : 'черновик'}</Pill>
          </button>
        ))}
        {data && !data.items.length && <EmptyState title="Установок цен нет" hint="Создайте первую — например, наценка 40% на всё без цены" />}
      </div>
      <CreateDialog open={create} onOpenChange={setCreate} onCreated={(s) => nav(`/prices/${s.id}`)} />
    </div>
  );
}

type Gen = { method: 'markup' | 'from_type' | 'manual'; priceTypeId: string; sourcePriceTypeId: string; percent: string; categoryId: string; onlyMissing: boolean; comment: string; validFrom: string };

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (s: PriceSetting) => void }) {
  const types = usePriceTypes();
  const cats = useCategories();
  const retail = types.data?.find((t) => t.isRetail) ?? types.data?.[0];
  const [f, setF] = useState<Gen>({ method: 'markup', priceTypeId: '', sourcePriceTypeId: '', percent: '40', categoryId: '', onlyMissing: false, comment: '', validFrom: '' });
  useEffect(() => {
    if (retail && !f.priceTypeId) setF((x) => ({ ...x, priceTypeId: retail.id }));
  }, [retail, f.priceTypeId]);
  const create = useMutation({
    mutationFn: () => {
      const b: PriceSettingInput = { ...(f.comment ? { comment: f.comment } : {}), ...(f.validFrom ? { validFrom: new Date(f.validFrom).toISOString() } : {}) };
      if (f.method !== 'manual')
        b.generate = {
          method: f.method,
          priceTypeId: f.priceTypeId,
          percent: f.percent.replace(',', '.') || '0',
          ...(f.method === 'from_type' ? { sourcePriceTypeId: f.sourcePriceTypeId } : {}),
          ...(f.categoryId ? { categoryId: f.categoryId } : {}),
          ...(f.onlyMissing ? { onlyMissing: true } : {}),
        };
      return pricingApi.createSetting(b);
    },
    onSuccess: (s) => (onOpenChange(false), onCreated(s)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Новая установка цен" className="max-w-xl">
      <div className="mt-4 space-y-4">
        <Segmented
          value={f.method}
          onChange={(method) => setF({ ...f, method })}
          options={[
            { value: 'markup', label: 'Наценка от закупки' },
            { value: 'from_type', label: 'От другого типа' },
            { value: 'manual', label: 'Вручную' },
          ]}
        />
        {f.method !== 'manual' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Какую цену ставим">
                <select className={sel} value={f.priceTypeId} onChange={(e) => setF({ ...f, priceTypeId: e.target.value })}>
                  {types.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              {f.method === 'from_type' && (
                <Field label="От какой">
                  <select className={sel} value={f.sourcePriceTypeId} onChange={(e) => setF({ ...f, sourcePriceTypeId: e.target.value })}>
                    <option value="">—</option>
                    {types.data?.filter((t) => t.id !== f.priceTypeId).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={f.method === 'markup' ? 'Наценка, %' : '± %'} hint={f.method === 'from_type' ? 'Например −10 — оптовая на 10% ниже розницы' : undefined}>
                <Input inputMode="decimal" value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value.replace(/[^\d.,-]/g, '') })} />
              </Field>
              <Field label="Группа">
                <select className={sel} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                  <option value="">Все товары</option>
                  {cats.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'— '.repeat(c.level)}
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Switch checked={f.onlyMissing} onChange={(v) => setF({ ...f, onlyMissing: v })} label="Только товары без этой цены" />
          </>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Действует с" hint="Пусто — сразу после проведения">
            <Input type="datetime-local" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
          </Field>
          <Field label="Комментарий">
            <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Новый контейнер" />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="dark" loading={create.isPending} disabled={f.method === 'from_type' && !f.sourcePriceTypeId} onClick={() => create.mutate()}>
            {f.method === 'manual' ? 'Создать' : (
              <>
                <Wand2 /> Сформировать
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Установка цен: документ ─────────────────────────────

type Line = { productId: string; productName: string; sku: string; priceTypeId: string; storeId: string | null; oldPrice: string | null; newPrice: string; currency: string; cost?: string | null };

/** Документ установки цен: правка новых цен, проведение → перепечатка ценников */
export function PriceSettingPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = usePriceSetting(id);
  const types = usePriceTypes();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [dirty, setDirty] = useState(false);
  const [relabel, setRelabel] = useState<string[] | null>(null);
  const [q, setQ] = useState('');
  const retail = types.data?.find((t) => t.isRetail) ?? types.data?.[0];
  useEffect(() => {
    if (data) (setLines(data.lines.map((l) => ({ ...l }))), setDirty(false));
  }, [data]);
  const draft = data?.status === 'draft';
  const toInput = () => lines.map((l) => ({ productId: l.productId, priceTypeId: l.priceTypeId, ...(l.storeId ? { storeId: l.storeId } : {}), newPrice: l.newPrice || '0', currency: l.currency }));
  const save = useMutation({
    mutationFn: () => pricingApi.updateSetting(id!, { version: data!.version, lines: toInput() }),
    onSuccess: (s) => (qc.setQueryData(['price-setting', id], s), setDirty(false), toast.success('Сохранено')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const post = useMutation({
    mutationFn: async () => {
      let v = data!.version;
      if (dirty) v = (await pricingApi.updateSetting(id!, { version: v, lines: toInput() })).version;
      return pricingApi.postSetting(id!, v);
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['price-settings'] });
      qc.setQueryData(['price-setting', id], s);
      toast.success('Цены установлены');
      if (s.relabel?.length) setRelabel(s.relabel);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => pricingApi.deleteSetting(id!, data!.version),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['price-settings'] }), nav('/prices')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const print = useMutation({
    mutationFn: (ids: string[]) => stockApi.productLabels(ids.map((productId) => ({ productId, copies: 1 }))),
    onSuccess: (b) => (openPdf(b), setRelabel(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <Skeleton className="h-96 rounded-[28px]" />;
  const shown = q ? lines.filter((l) => (l.productName + l.sku).toLowerCase().includes(q.toLowerCase())) : lines;
  const up = lines.filter((l) => l.oldPrice && Number(l.newPrice) > Number(l.oldPrice)).length;
  const down = lines.filter((l) => l.oldPrice && Number(l.newPrice) < Number(l.oldPrice)).length;
  const typeName = (tid: string) => types.data?.find((t) => t.id === tid)?.name ?? '';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/prices" className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:bg-card-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-medium">Установка цен №{data.number}</h1>
          <div className="text-sm text-muted">
            {data.comment || 'без комментария'} · с {date(data.validFrom, 'D MMM YYYY, HH:mm')}
            {data.postedAt && ` · проведена ${ago(data.postedAt)}`}
          </div>
        </div>
        <Pill tone={draft ? 'soft' : 'ok'} className="h-8 px-3">{draft ? 'черновик' : 'проведена'}</Pill>
        {draft && (
          <>
            <Button variant="ghost" className="text-accent" onClick={() => confirm('Удалить черновик?') && remove.mutate()}>
              <Trash2 />
            </Button>
            <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              Сохранить
            </Button>
            <Button variant="accent" disabled={!lines.length} loading={post.isPending} onClick={() => post.mutate()}>
              <Sparkles /> Провести
            </Button>
          </>
        )}
        {!draft && (
          <Button onClick={() => print.mutate(lines.map((l) => l.productId))} loading={print.isPending}>
            <Printer /> Ценники
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Строк', num(lines.length)],
          ['Подорожает', num(up)],
          ['Подешевеет', num(down)],
          ['Новых цен', num(lines.filter((l) => !l.oldPrice).length)],
        ].map(([l, v], i) => (
          <div key={l} className={cn('rounded-[22px] p-4', i === 0 ? 'bg-pill text-pill-ink' : 'bg-card ring-1 ring-line')}>
            <div className="text-xs opacity-60">{l}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {draft && (
        <ProductAddField
          autoFocus={false}
          placeholder="Добавить товар в установку — скан или номер"
          onPick={(p) => {
            if (!retail || lines.some((l) => l.productId === p.id && l.priceTypeId === retail.id)) return;
            setLines((x) => [{ productId: p.id, productName: p.name, sku: p.sku, priceTypeId: retail.id, storeId: null, oldPrice: p.price != null ? String(p.price) : null, newPrice: p.price != null ? String(p.price) : '', currency: retail.currency }, ...x]);
            setDirty(true);
          }}
        />
      )}
      {lines.length > 15 && <Input placeholder="Фильтр по строкам" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />}

      <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-normal">Товар</th>
              <th className="px-2 font-normal">Тип цены</th>
              <th className="px-2 text-right font-normal">Себест.</th>
              <th className="px-2 text-right font-normal">Было</th>
              <th className="px-2 text-right font-normal">Станет</th>
              <th className="px-2 text-right font-normal">Δ</th>
              {draft && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 500).map((l) => {
              const idx = lines.indexOf(l);
              const ch = l.oldPrice && Number(l.oldPrice) > 0 ? (Number(l.newPrice) / Number(l.oldPrice) - 1) * 100 : null;
              const belowCost = l.cost && Number(l.newPrice) < Number(l.cost);
              return (
                <tr key={l.productId + l.priceTypeId + (l.storeId ?? '')} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <div className="truncate font-medium">{l.productName}</div>
                    <div className="font-mono text-xs text-muted">{l.sku}</div>
                  </td>
                  <td className="px-2 text-ink-2">{typeName(l.priceTypeId)}</td>
                  <td className="px-2 text-right text-muted tabular-nums">{l.cost ? money(l.cost) : '—'}</td>
                  <td className="px-2 text-right text-muted tabular-nums">{l.oldPrice ? money(l.oldPrice, l.currency) : '—'}</td>
                  <td className="px-2 text-right">
                    {draft ? (
                      <input
                        value={l.newPrice}
                        inputMode="decimal"
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '');
                          setLines((x) => x.map((y, k) => (k === idx ? { ...y, newPrice: v } : y)));
                          setDirty(true);
                        }}
                        className={cn('h-9 w-28 rounded-xl bg-card-muted px-3 text-right font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ink', belowCost && 'text-accent ring-1 ring-accent-line')}
                      />
                    ) : (
                      <span className="font-semibold tabular-nums">{money(l.newPrice, l.currency)}</span>
                    )}
                  </td>
                  <td className={cn('px-2 text-right text-xs tabular-nums', ch == null ? 'text-faint' : ch > 0 ? 'text-accent' : ch < 0 ? 'text-ok' : 'text-muted')}>{ch == null ? 'новая' : `${ch > 0 ? '+' : ''}${num(ch, 1)}%`}</td>
                  {draft && (
                    <td className="pr-3">
                      <button onClick={() => (setLines((x) => x.filter((_, k) => k !== idx)), setDirty(true))} className="grid size-7 place-items-center rounded-full text-muted hover:text-accent" aria-label="Убрать">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!lines.length && <EmptyState title="Строк нет" hint="Добавьте товары сканом или сформируйте наценкой" />}
      </div>

      <Dialog open={!!relabel} onOpenChange={(v) => !v && setRelabel(null)} title="Перепечатать ценники?" description={`Цена изменилась у ${relabel?.length ?? 0} товаров — старые ценники на полке врут.`}>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setRelabel(null)}>Позже</Button>
          <Button variant="dark" loading={print.isPending} onClick={() => relabel && print.mutate(relabel)}>
            <Printer /> Печать
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
