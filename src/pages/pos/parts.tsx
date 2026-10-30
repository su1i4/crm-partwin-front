import { useQuery } from '@tanstack/react-query';
import { Barcode, Camera, ChevronLeft, Handshake, MapPin, Minus, PackagePlus, Percent, Plus, Search, Trash2, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useCategories } from '@/entities/category';
import { posApi, type Counterparty } from '@/entities/pos';
import { offlineSearch, useOffline, type OfflineItem } from '@/entities/pos-offline';
import { ProductThumb, QualityBadge, productApi, useProducts, useSearch } from '@/entities/product';
import { CounterpartyPicker } from '@/features/customer-picker';
import { cart, useCart, type AddableProduct, type DraftLine } from '@/features/pos-cart';
import type { SearchItem } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { sound, vibrate } from '@/shared/lib/sound';
import { Button, Dialog, Field, Input, Kbd, Pill, Segmented, Skeleton } from '@/shared/ui';

const flat = (d?: { groups: { here: SearchItem[]; elsewhere: SearchItem[]; analogs: SearchItem[]; noStock: SearchItem[] } }) =>
  d ? [...d.groups.here, ...d.groups.elsewhere, ...d.groups.analogs, ...d.groups.noStock] : [];

const toAddable = (i: SearchItem): AddableProduct => ({ id: i.id, name: i.name, sku: i.sku, mainNumber: i.mainNumber, brandName: i.brandName, baseUnit: i.baseUnit, price: i.price });

const offToAddable = (i: OfflineItem): AddableProduct => ({ id: i.id, name: i.name, sku: i.sku, mainNumber: i.mainNumber, brandName: i.brandName, baseUnit: i.baseUnit, price: i.price });
type Row = { id: string; name: string; sku: string; mainNumber: string | null; brandName: string | null; baseUnit: string; price: string | number | null; stockHere: string; qualityClass: string; photoFileId: string | null; analog?: unknown; add: AddableProduct };

/** Поиск без сети — по кэшу кассы в IndexedDB */
function useOfflineSearch(q: string, enabled: boolean) {
  const [items, setItems] = useState<OfflineItem[]>([]);
  useEffect(() => {
    const { db, meta } = useOffline.getState();
    if (!enabled || !db || !meta || q.trim().length < 2) return setItems([]);
    let alive = true;
    void offlineSearch(db, meta, q, 8).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [q, enabled]);
  return items;
}

const looksLikeBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());

export interface SearchBoxHandle {
  focus: () => void;
  handleCode: (code: string) => Promise<void>;
}

/** Поиск в кассе: сканер (Enter), номер, название, «колодки камри 40». Выпадающий список, стрелки + Enter */
export const PosSearch = forwardRef<SearchBoxHandle, { onNotFound: (q: string) => void; onAmbiguous: (items: AddableProduct[]) => void; onCamera: () => void }>(function PosSearch(
  { onNotFound, onAmbiguous, onCamera },
  ref,
) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isOffline = useCart((s) => s.mode === 'offline');
  const dq = useDebounce(q, isOffline ? 80 : 180);
  const { data, isFetching: fetching } = useSearch(looksLikeBarcode(dq) || isOffline ? '' : dq, 'cash');
  const offItems = useOfflineSearch(looksLikeBarcode(dq) ? '' : dq, isOffline);
  const isFetching = !isOffline && fetching;
  const items: Row[] = useMemo(
    () =>
      isOffline
        ? offItems.map((i) => ({ ...i, photoFileId: null, add: offToAddable(i) }))
        : flat(data)
            .slice(0, 8)
            .map((i) => ({ ...i, add: toAddable(i) })),
    [data, offItems, isOffline],
  );

  const add = (p: AddableProduct) => {
    cart.add(p);
    sound.ok();
    vibrate();
    setQ('');
    setOpen(false);
    input.current?.focus();
  };

  const handleCode = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    if (useCart.getState().mode === 'offline') {
      const { db, meta } = useOffline.getState();
      const list = db && meta ? await offlineSearch(db, meta, c, 8) : [];
      const exact = list.filter((x) => x.matchKind !== 'text');
      if (exact.length === 1 || list.length === 1) add(offToAddable(exact[0] ?? list[0]));
      else if (exact.length > 1 && exact.every((x) => x.matchKind === 'barcode')) onAmbiguous(exact.map(offToAddable));
      else if (list.length) (setQ(c), setOpen(true));
      else (sound.error(), onNotFound(c), setQ(''));
      return;
    }
    if (looksLikeBarcode(c) || /^[\dA-Z-]{6,}$/.test(c)) {
      try {
        const r = await posApi.byBarcode(c);
        const active = r.matches.filter((m) => m.status === 'active');
        if (active.length === 1) {
          const card = await productApi.search(c, 'cash', 3).catch(() => null);
          const hit = flat(card ?? undefined).find((x) => x.id === active[0].productId);
          add(hit ? toAddable(hit) : { id: active[0].productId, name: active[0].name, sku: active[0].sku, baseUnit: active[0].unitName });
          return;
        }
        if (active.length > 1) {
          onAmbiguous(active.map((m) => ({ id: m.productId, name: m.name, sku: m.sku, baseUnit: m.unitName })));
          setQ('');
          return;
        }
      } catch {
        /* не штрихкод — ищем как номер/название */
      }
    }
    const res = await productApi.search(c, 'cash', 5).catch(() => null);
    const list = flat(res ?? undefined);
    if (list.length === 1 || (list[0] && ['barcode', 'sku', 'number'].includes(list[0].matchKind))) add(toAddable(list[0]));
    else if (list.length) {
      setQ(c);
      setOpen(true);
    } else {
      sound.error();
      onNotFound(c);
      setQ('');
    }
  };

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus(), handleCode }));
  useEffect(() => setIdx(0), [data]);

  return (
    <div className="relative">
      <label className="flex h-14 items-center gap-3 rounded-[22px] bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
        <Search className="size-5 text-muted" />
        <input
          ref={input}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(items.length - 1, i + 1)));
            else if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
            else if (e.key === 'Escape') (setQ(''), setOpen(false));
            else if (e.key === 'Enter') {
              e.preventDefault();
              if (open && items[idx] && q === dq && !looksLikeBarcode(q)) add(items[idx].add);
              else void handleCode(q);
            }
          }}
          placeholder="Скан / номер / название / «колодки камри 40»…"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        {isFetching && <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />}
        <Kbd className="hidden sm:inline">F2</Kbd>
        <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-card-muted" title="Камера: штрихкод или номер детали" onClick={onCamera}>
          <Camera className="size-[18px]" />
        </button>
      </label>
      {open && q.trim().length >= 2 && !looksLikeBarcode(q) && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[24px] bg-card p-1.5 shadow-2xl ring-1 ring-line">
          {items.length === 0 && !isFetching && (
            <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm text-muted">
              Ничего не нашли
              <Button size="sm" variant="dark" onMouseDown={(e) => e.preventDefault()} onClick={() => onNotFound(q)}>
                Варианты
              </Button>
            </div>
          )}
          {items.map((i, k) => (
            <button
              key={i.id}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIdx(k)}
              onClick={() => add(i.add)}
              className={cn('flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2 text-left', k === idx && 'bg-card-muted')}
            >
              <ProductThumb fileId={i.photoFileId} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                <span className="block truncate text-xs text-muted">
                  <span className="font-mono text-ink-2">{i.mainNumber ?? i.sku}</span> · {i.brandName ?? 'без бренда'}
                  {i.analog ? ' · аналог' : ''}
                </span>
              </span>
              <QualityBadge value={i.qualityClass as SearchItem['qualityClass']} className="hidden md:inline-flex" />
              <span className="w-24 text-right">
                <span className="block text-sm font-semibold text-ink tabular-nums">{i.price !== null ? money(i.price) : 'договорная'}</span>
                <span className={cn('block text-xs tabular-nums', Number(i.stockHere) > 0 ? 'text-ok' : 'text-muted')}>
                  {num(i.stockHere, 3)} {i.baseUnit}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function QtyStepper({ line }: { line: DraftLine }) {
  const [edit, setEdit] = useState<string | null>(null);
  const q = Number(line.qty);
  return (
    <div className="flex items-center rounded-full bg-card-muted p-0.5">
      <button onClick={() => cart.setQty(line.key, q - 1)} className="grid size-9 place-items-center rounded-full text-ink hover:bg-card" aria-label="Меньше">
        <Minus className="size-4" />
      </button>
      <input
        value={edit ?? num(q, 3)}
        onFocus={(e) => (setEdit(String(q)), e.target.select())}
        onChange={(e) => setEdit(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => {
          if (edit !== null) cart.setQty(line.key, Number(edit.replace(',', '.')) || 0);
          setEdit(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-10 bg-transparent text-center text-[15px] font-semibold text-ink tabular-nums outline-none"
        inputMode="decimal"
        aria-label="Количество"
      />
      <button onClick={() => cart.setQty(line.key, q + 1)} className="grid size-9 place-items-center rounded-full text-ink hover:bg-card" aria-label="Больше">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function LineRow({ line, onDiscount }: { line: DraftLine; onDiscount: (l: DraftLine) => void }) {
  const last = useCart((s) => s.lastAddedKey === line.key);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (last) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [last, line.qty]);
  const actions = (
    <>
      <button onClick={() => onDiscount(line)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-card-muted hover:text-ink" title="Скидка или цена" aria-label="Скидка">
        <Percent className="size-4" />
      </button>
      <button onClick={() => cart.remove(line.key)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent" aria-label="Удалить строку">
        <Trash2 className="size-4" />
      </button>
    </>
  );
  return (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[22px] bg-card p-3 ring-1 transition sm:grid-cols-[minmax(0,1fr)_auto_96px_100px_auto] sm:pr-2',
        last ? 'ring-2 ring-accent/60' : 'ring-line',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14.5px] font-medium text-ink">{line.name}</span>
          {line.pending && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-warn" title="Сохраняется" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {(line.number || line.sku) && <span className="font-mono text-ink-2">{line.number ?? line.sku}</span>}
          {line.brand && <span>{line.brand}</span>}
          {line.free && <Pill tone="warn" className="h-5">свободная позиция</Pill>}
          {line.neighbor && <Pill tone="soft" className="h-5">взял у соседа</Pill>}
          {line.place && (
            <span className="flex items-center gap-0.5 text-ink-2">
              <MapPin className="size-3 text-accent" />
              {line.place}
            </span>
          )}
        </div>
      </div>
      <div className="text-right sm:order-4">
        <div className="text-[15px] font-semibold text-ink tabular-nums">{line.amount !== null ? money(line.amount) : '—'}</div>
        {Number(line.discount) > 0 && <div className="text-xs text-accent tabular-nums">−{money(line.discount)}</div>}
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:order-2 sm:col-span-1">
        <QtyStepper line={line} />
        <span className="text-xs text-muted">{line.unitName}</span>
        <span className="ml-auto flex sm:hidden">{actions}</span>
      </div>
      <div className="hidden text-right text-[13px] text-muted tabular-nums sm:order-3 sm:block">× {line.price !== null ? money(line.price) : '—'}</div>
      <div className="hidden justify-end gap-1 sm:order-5 sm:flex">{actions}</div>
    </div>
  );
}

/** Плитки (сенсорный экран, товары без штрихкода): группы → товары */
export function TilesPanel() {
  const cats = useCategories();
  const [cat, setCat] = useState<{ id: string; name: string } | null>(null);
  const roots = (cats.data ?? []).filter((c) => !c.parentId);
  const products = useProducts({ categoryId: cat?.id, limit: 24, sort: 'name' });
  if (!cat)
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {cats.isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 rounded-[22px]" />)}
        {roots.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setCat({ id: c.id, name: c.name })}
            className={cn('flex min-h-20 flex-col justify-between rounded-[22px] p-3.5 text-left ring-1 transition hover:ring-ink', i % 5 === 0 ? 'hatch bg-card ring-line' : 'bg-card ring-line')}
          >
            <span className="text-[14px] font-medium text-ink">{c.name}</span>
            <span className="text-xs text-muted">{c.productsCount} товаров</span>
          </button>
        ))}
      </div>
    );
  return (
    <div className="space-y-2">
      <Button size="sm" onClick={() => setCat(null)}>
        <ChevronLeft /> {cat.name}
      </Button>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {products.isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}
        {products.data?.items.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              cart.add({ id: p.id, name: p.name, sku: p.sku, mainNumber: p.mainNumber, brandName: p.brandName, baseUnit: p.baseUnit, price: p.retailPrice });
              sound.ok();
            }}
            className="flex min-h-24 flex-col justify-between gap-2 rounded-[22px] bg-card p-3 text-left ring-1 ring-line transition hover:ring-ink active:scale-[0.98]"
          >
            <span className="line-clamp-2 text-[13.5px] font-medium text-ink">{p.name}</span>
            <span className="flex items-end justify-between gap-2">
              <span className="truncate text-[11px] text-muted">{p.brandName}</span>
              <span className="text-[13.5px] font-semibold text-ink tabular-nums">{p.retailPrice !== null ? money(p.retailPrice) : '—'}</span>
            </span>
          </button>
        ))}
        {products.data?.items.length === 0 && <div className="col-span-full py-6 text-center text-sm text-muted">В группе пока нет товаров</div>}
      </div>
    </div>
  );
}

/** «Товар не найден»: создать / свободная позиция / взял у соседа (ТЗ 4.9, 13.2) */
export function NotFoundDialog({ query, onClose, onCreate, allowCreate = true }: { query: string | null; onClose: () => void; onCreate: (q: string) => void; allowCreate?: boolean }) {
  const [mode, setMode] = useState<'menu' | 'free' | 'neighbor'>('menu');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [price, setPrice] = useState('');
  const [buy, setBuy] = useState('');
  const [neighbor, setNeighbor] = useState<Counterparty | null>(null);
  const [pick, setPick] = useState(false);
  useEffect(() => {
    if (query !== null) {
      setMode('menu');
      const isNum = /\d/.test(query) && !/\s{2,}/.test(query) && query.length < 25;
      setName(isNum ? '' : query);
      setNumber(isNum ? query : '');
      setPrice('');
      setBuy('');
      setNeighbor(null);
    }
  }, [query]);
  const done = () => {
    sound.ok();
    onClose();
  };
  return (
    <>
      <Dialog open={query !== null} onOpenChange={(v) => !v && onClose()} title={mode === 'free' ? 'Свободная позиция' : mode === 'neighbor' ? 'Взял у соседа' : 'Товар не найден'} description={mode === 'menu' ? `«${query}»` : undefined}>
        {mode === 'menu' && (
          <div className="mt-5 grid gap-2">
            {[
              ...(allowCreate ? [{ icon: PackagePlus, title: 'Создать товар', hint: 'За 15 секунд: номер, бренд, цена', on: () => (onClose(), onCreate(query ?? '')) }] : []),
              { icon: Barcode, title: 'Свободная позиция', hint: 'Название и цена — попадёт в отчёт для дозаполнения', on: () => setMode('free') },
              { icon: Handshake, title: 'Взял у соседа', hint: 'Приход от соседа, продажа и долг соседу одной операцией', on: () => setMode('neighbor') },
            ].map((o) => (
              <button key={o.title} onClick={o.on} className="flex items-center gap-3 rounded-[22px] p-3 text-left ring-1 ring-line hover:ring-ink">
                <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                  <o.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium text-ink">{o.title}</span>
                  <span className="block text-xs text-muted">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {mode === 'free' && (
          <div className="mt-5 space-y-4">
            <Field label="Название">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Хомут 40 мм" />
            </Field>
            <Field label="Цена, сом">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode('menu')}>Назад</Button>
              <Button variant="dark" disabled={!name.trim() || !Number(price)} onClick={() => (cart.addFree(name.trim(), price), done())}>
                В чек
              </Button>
            </div>
          </div>
        )}
        {mode === 'neighbor' && (
          <div className="mt-5 space-y-4">
            <Field label="У кого взял">
              <button onClick={() => setPick(true)} className="flex h-11 w-full items-center justify-between rounded-full bg-card px-4 text-left text-sm ring-1 ring-line">
                {neighbor?.name ?? <span className="text-faint">Выбрать соседа</span>}
                <Search className="size-4 text-muted" />
              </button>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Название">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Колодки передние" />
              </Field>
              <Field label="Номер">
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </Field>
              <Field label="Цена закупки у соседа">
                <Input inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value.replace(/[^\d.]/g, ''))} />
              </Field>
              <Field label="Цена продажи клиенту" hint={Number(buy) && Number(price) ? `Прибыль ${money(Number(price) - Number(buy))}` : undefined}>
                <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode('menu')}>Назад</Button>
              <Button
                variant="dark"
                disabled={!neighbor || !name.trim() || !Number(buy) || !Number(price)}
                onClick={() => {
                  cart.addNeighbor({ neighborId: neighbor!.id, neighborName: neighbor!.name, name: name.trim(), partNumber: number || undefined, purchasePrice: buy, salePrice: price });
                  done();
                }}
              >
                В чек
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <CounterpartyPicker open={pick} onOpenChange={setPick} role="neighbor" title="Сосед" onPick={setNeighbor} />
    </>
  );
}

/** Скидка на строку (% / сумма) или своя цена для «договорной» */
export function LineDiscountDialog({ line, onClose }: { line: DraftLine | null; onClose: () => void }) {
  const [mode, setMode] = useState<'percent' | 'amount' | 'price'>('percent');
  const [v, setV] = useState('');
  useEffect(() => {
    if (line) {
      setMode(line.customPrice ? 'price' : line.discountAmount ? 'amount' : 'percent');
      setV(line.customPrice ?? line.discountAmount ?? line.discountPercent ?? '');
    }
  }, [line]);
  const apply = () => {
    if (!line) return;
    cart.setLine(line.key, {
      discountPercent: mode === 'percent' && Number(v) ? v : null,
      discountAmount: mode === 'amount' && Number(v) ? v : null,
      customPrice: mode === 'price' && Number(v) ? v : null,
    });
    onClose();
  };
  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()} title="Скидка на строку" description={line?.name}>
      <div className="mt-4 space-y-4">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'percent', label: '%' }, { value: 'amount', label: 'Сумма' }, { value: 'price', label: 'Своя цена' }]} />
        <Input autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && apply()} className="h-12 [&_input]:text-lg [&_input]:font-semibold" right={<span className="text-faint">{mode === 'percent' ? '%' : 'с'}</span>} />
        <div className="text-xs text-muted">Сверх лимита роли или ниже минимальной цены — сервер попросит PIN старшего при оплате.</div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => (line && cart.setLine(line.key, { discountPercent: null, discountAmount: null, customPrice: null }), onClose())}>
            <X /> Убрать
          </Button>
          <Button variant="dark" onClick={apply}>Применить</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ReceiptDiscountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const receipt = useCart((s) => s.receipt);
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [v, setV] = useState('');
  useEffect(() => {
    if (open) {
      setMode(receipt?.receiptDiscountAmount ? 'amount' : 'percent');
      setV(String(receipt?.receiptDiscountAmount ?? receipt?.receiptDiscountPercent ?? ''));
    }
  }, [open, receipt]);
  const apply = (val: string) => {
    cart.setReceiptDiscount(mode === 'percent' ? { percent: Number(val) ? val : null } : { amount: Number(val) ? val : null });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Скидка на чек" description="Распределится по строкам пропорционально сумме">
      <div className="mt-4 space-y-4">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'percent', label: '%' }, { value: 'amount', label: 'Сумма' }]} />
        <Input autoFocus inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && apply(v)} className="h-12 [&_input]:text-lg [&_input]:font-semibold" />
        {mode === 'percent' && (
          <div className="flex gap-1.5">
            {['3', '5', '10'].map((p) => (
              <button key={p} onClick={() => apply(p)} className="h-9 rounded-full bg-card-muted px-4 text-sm font-medium hover:bg-line">
                {p}%
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => apply('')}>Без скидки</Button>
          <Button variant="dark" onClick={() => apply(v)}>Применить</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Один штрихкод у нескольких товаров — выбор (ТЗ 4.4) */
export function AmbiguousDialog({ items, onClose }: { items: AddableProduct[] | null; onClose: () => void }) {
  return (
    <Dialog open={!!items} onOpenChange={(v) => !v && onClose()} title="Штрихкод у нескольких товаров" description="Выберите, что продаёте">
      <div className="mt-4 space-y-1.5">
        {items?.map((p) => (
          <button key={p.id} onClick={() => (cart.add(p), sound.ok(), onClose())} className="flex w-full items-center gap-3 rounded-[20px] p-2.5 text-left ring-1 ring-line hover:ring-ink">
            <ProductThumb fileId={null} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="text-xs text-muted">арт. {p.sku}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Курс доллара магазина для шапки кассы */
export function useUsdRate() {
  return useQuery({
    queryKey: ['rates'],
    queryFn: posApi.rates,
    staleTime: 5 * 60_000,
    select: (d) => d.current.find((r) => r.currency === 'USD')?.rate ?? null,
  });
}
