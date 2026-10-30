import { useMutation } from '@tanstack/react-query';
import { Minus, Plus, Printer, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { openPdf, stockApi } from '@/entities/stock';
import { physical, useWarehouses } from '@/entities/warehouse';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { Button, Card, EmptyState, PageTitle, Segmented, Tray } from '@/shared/ui';

const SIZES = { '58x40': { w: 58, h: 40 }, '40x30': { w: 40, h: 30 }, '58x30': { w: 58, h: 30 } } as const;
type Size = keyof typeof SIZES;

/** Ценники и этикетки (ТЗ 9.6): набрать товары сканом, количество копий, размер, PDF на термопринтер */
export default function LabelsPage() {
  const [rows, setRows] = useState<(PickedProduct & { copies: number })[]>([]);
  const [size, setSize] = useState<Size>(() => {
    try {
      return (localStorage.getItem('labels.size') as Size) || '58x40';
    } catch {
      return '58x40';
    }
  });
  const whs = useWarehouses();
  const [wh, setWh] = useState('');

  const print = useMutation({
    mutationFn: () => stockApi.productLabels(rows.map((r) => ({ productId: r.id, copies: r.copies, ...(r.unitId ? { unitId: r.unitId } : {}), ...(wh ? { warehouseId: wh } : {}) })) as never, SIZES[size].w, SIZES[size].h),
    onSuccess: openPdf,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const add = (p: PickedProduct) =>
    setRows((x) => {
      const i = x.findIndex((r) => r.id === p.id);
      if (i >= 0) return x.map((r, k) => (k === i ? { ...r, copies: r.copies + 1 } : r));
      return [{ ...p, copies: 1 }, ...x];
    });
  const total = rows.reduce((a, r) => a + r.copies, 0);

  return (
    <div className="space-y-6">
      <PageTitle title="Ценники и этикетки" sub="Сканируйте товары — повторный скан добавляет копию. Этикетка: название, номер, штрихкод, место, цена" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <ProductAddField onPick={add} placeholder="Скан / номер — добавить на печать" />
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 rounded-[20px] bg-card py-2 pr-2 pl-4 ring-1 ring-line">
                <Tag className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.name}</span>
                  <span className="block truncate font-mono text-xs text-muted">
                    {r.mainNumber ?? r.sku} · {r.brandName ?? 'без бренда'}
                  </span>
                </span>
                <span className="hidden w-24 text-right text-[13px] tabular-nums sm:block">{r.price != null ? money(r.price) : '—'}</span>
                <span className="flex items-center gap-1 rounded-full bg-card-muted p-0.5">
                  <button onClick={() => setRows((x) => x.map((y, k) => (k === i ? { ...y, copies: Math.max(1, y.copies - 1) } : y)))} className="grid size-7 place-items-center rounded-full hover:bg-card" aria-label="Меньше">
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    value={r.copies}
                    inputMode="numeric"
                    onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, copies: Math.min(999, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) } : y)))}
                    className="w-9 bg-transparent text-center text-[14px] font-semibold tabular-nums outline-none"
                  />
                  <button onClick={() => setRows((x) => x.map((y, k) => (k === i ? { ...y, copies: y.copies + 1 } : y)))} className="grid size-7 place-items-center rounded-full hover:bg-card" aria-label="Больше">
                    <Plus className="size-3.5" />
                  </button>
                </span>
                <button onClick={() => setRows((x) => x.filter((_, k) => k !== i))} className="grid size-8 place-items-center rounded-full text-muted hover:text-accent" aria-label="Убрать">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {!rows.length && <Card><EmptyState title="Список пуст" hint="Отсканируйте товар или найдите по номеру. Из остатков и установки цен этикетки печатаются кнопкой там же" /></Card>}
          </div>
        </div>
        <Tray className="h-fit space-y-4 p-4 lg:sticky lg:top-24">
          <div>
            <div className="mb-2 text-xs text-muted">Размер этикетки, мм</div>
            <Segmented
              value={size}
              onChange={(v) => {
                setSize(v);
                try {
                  localStorage.setItem('labels.size', v);
                } catch {
                  /* ignore */
                }
              }}
              options={(Object.keys(SIZES) as Size[]).map((s) => ({ value: s, label: s.replace('x', '×') }))}
            />
          </div>
          <div>
            <div className="mb-2 text-xs text-muted">Место хранения со склада</div>
            <select value={wh} onChange={(e) => setWh(e.target.value)} className="h-10 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
              <option value="">Не печатать место</option>
              {physical(whs.data).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className={cn('flex items-baseline justify-between rounded-[18px] bg-card px-4 py-3')}>
            <span className="text-sm text-muted">Этикеток</span>
            <span className="text-2xl font-semibold tabular-nums">{num(total)}</span>
          </div>
          <Button variant="dark" size="lg" className="w-full" disabled={!rows.length} loading={print.isPending} onClick={() => print.mutate()}>
            <Printer /> Печать PDF
          </Button>
          {rows.length > 0 && (
            <button onClick={() => setRows([])} className="w-full text-center text-xs text-muted hover:text-ink">
              Очистить список
            </button>
          )}
        </Tray>
      </div>
    </div>
  );
}
