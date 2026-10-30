import { Camera, Search } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { posApi } from '@/entities/pos';
import { ProductThumb, productApi, QualityBadge, useSearch } from '@/entities/product';
import type { SearchItem } from '@/shared/api';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useScanner } from '@/shared/hooks/use-scanner';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { sound } from '@/shared/lib/sound';
import { Kbd } from '@/shared/ui';
import { CameraScanDialog } from '../camera-scan';

export interface PickedProduct {
  id: string;
  name: string;
  sku: string;
  mainNumber: string | null;
  brandName: string | null;
  baseUnit: string;
  price: string | number | null;
  unitId?: string;
}

const flat = (d?: { groups: { here: SearchItem[]; elsewhere: SearchItem[]; analogs: SearchItem[]; noStock: SearchItem[] } }) =>
  d ? [...d.groups.here, ...d.groups.elsewhere, ...d.groups.noStock, ...d.groups.analogs] : [];
const toPicked = (i: SearchItem): PickedProduct => ({ id: i.id, name: i.name, sku: i.sku, mainNumber: i.mainNumber, brandName: i.brandName, baseUnit: i.baseUnit, price: i.price });
const isBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());

export interface ProductAddHandle {
  focus: () => void;
}

/**
 * Поле добавления товара в документ (ТЗ 23.4): всегда в фокусе, сканер-пистолет, камера, поиск по номеру.
 * Штрихкод упаковки подставляет её единицу (unitId).
 */
export const ProductAddField = forwardRef<ProductAddHandle, { onPick: (p: PickedProduct) => void; onNotFound?: (q: string) => void; placeholder?: string; autoFocus?: boolean }>(
  function ProductAddField({ onPick, onNotFound, placeholder, autoFocus = true }, ref) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [idx, setIdx] = useState(0);
    const [camera, setCamera] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const dq = useDebounce(q, 200);
    const { data, isFetching } = useSearch(isBarcode(dq) ? '' : dq, 'document');
    const items = useMemo(() => flat(data).slice(0, 8), [data]);
    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
    useEffect(() => setIdx(0), [data]);

    const pick = (p: PickedProduct) => {
      onPick(p);
      sound.ok();
      setQ('');
      setOpen(false);
      input.current?.focus();
    };

    const byCode = async (code: string) => {
      const c = code.trim();
      if (!c) return;
      try {
        const r = await posApi.byBarcode(c);
        const m = r.matches.filter((x) => x.status === 'active');
        if (m.length >= 1) {
          const s = await productApi.search(c, 'document', 3).catch(() => null);
          const hit = flat(s ?? undefined).find((x) => x.id === m[0].productId);
          return pick({ ...(hit ? toPicked(hit) : { id: m[0].productId, name: m[0].name, sku: m[0].sku, mainNumber: null, brandName: null, baseUnit: m[0].unitName, price: null }), unitId: m[0].unitId });
        }
      } catch {
        /* не штрихкод */
      }
      const s = await productApi.search(c, 'document', 5).catch(() => null);
      const list = flat(s ?? undefined);
      if (list[0] && (list.length === 1 || ['barcode', 'sku', 'number'].includes(list[0].matchKind))) pick(toPicked(list[0]));
      else if (list.length) (setQ(c), setOpen(true));
      else {
        sound.error();
        onNotFound?.(c);
      }
    };

    useScanner((code) => void byCode(code));

    return (
      <div className="relative">
        <label className="flex h-12 items-center gap-3 rounded-[20px] bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
          <Search className="size-[18px] text-muted" />
          <input
            ref={input}
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => (setQ(e.target.value), setOpen(true))}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(items.length - 1, i + 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
              else if (e.key === 'Escape') (setQ(''), setOpen(false));
              else if (e.key === 'Enter') {
                e.preventDefault();
                if (open && items[idx] && q === dq && !isBarcode(q)) pick(toPicked(items[idx]));
                else void byCode(q);
              }
            }}
            placeholder={placeholder ?? 'Скан / номер детали / название — добавить строку'}
            className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-faint"
          />
          {isFetching && <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-r-transparent" />}
          <Kbd className="hidden sm:inline">Enter</Kbd>
          <button type="button" onClick={() => setCamera(true)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-card-muted" title="Камера">
            <Camera className="size-[18px]" />
          </button>
        </label>
        {open && q.trim().length >= 2 && !isBarcode(q) && items.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[22px] bg-card p-1.5 shadow-2xl ring-1 ring-line">
            {items.map((i, k) => (
              <button
                key={i.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setIdx(k)}
                onClick={() => pick(toPicked(i))}
                className={cn('flex w-full items-center gap-3 rounded-[16px] px-2.5 py-2 text-left', k === idx && 'bg-card-muted')}
              >
                <ProductThumb fileId={i.photoFileId} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono text-ink-2">{i.mainNumber ?? i.sku}</span> · {i.brandName ?? 'без бренда'}
                  </span>
                </span>
                <QualityBadge value={i.qualityClass} className="hidden md:inline-flex" />
                <span className="w-24 text-right text-xs text-muted">
                  <span className="block text-sm font-semibold text-ink tabular-nums">{i.price !== null ? money(i.price) : '—'}</span>
                  {num(i.stockTotal, 3)} {i.baseUnit}
                </span>
              </button>
            ))}
          </div>
        )}
        <CameraScanDialog open={camera} onOpenChange={setCamera} allowOcr onCode={(c) => byCode(c)} onProduct={(p) => pick(toPicked(p))} />
      </div>
    );
  },
);

/** Компактный выбор одного товара (пересортица «во что») */
export function ProductSelect({ value, onChange, placeholder }: { value: { id: string; name: string } | null; onChange: (p: PickedProduct) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounce(q, 200);
  const { data } = useSearch(dq, 'document');
  const items = flat(data).slice(0, 6);
  return (
    <div className="relative">
      <input
        value={open ? q : (value?.name ?? '')}
        onFocus={() => (setOpen(true), setQ(''))}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? 'Во что…'}
        className="h-9 w-full rounded-xl bg-card-muted px-3 text-[13px] outline-none focus:ring-2 focus:ring-ink"
      />
      {open && items.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 min-w-64 rounded-2xl bg-card p-1 shadow-xl ring-1 ring-line">
          {items.map((i) => (
            <button key={i.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (onChange(toPicked(i)), setOpen(false))} className="block w-full truncate rounded-xl px-2.5 py-1.5 text-left text-[13px] hover:bg-card-muted">
              {i.name} <span className="text-muted">· {i.mainNumber ?? i.sku}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
