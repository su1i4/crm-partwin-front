import * as Tabs from '@radix-ui/react-tabs';
import { Archive, ArrowLeft, Barcode, Car, Copy, Info, PackagePlus, Printer, ShieldCheck, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductThumb, QualityBadge, useProduct } from '@/entities/product';
import { useMe } from '@/entities/session';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { CrossesBlock, MovesTab, SuppliersTab } from './tabs';
import { Button, Card, EmptyState, ErrorState, Pill, Skeleton, Tray } from '@/shared/ui';

const NUM_TYPE: Record<string, string> = { manufacturer: 'Производитель', oem: 'OEM', supplier: 'Код поставщика' };
const PRECISION: Record<string, string> = { make: 'Марка', model: 'Модель', generation: 'Поколение', modification: 'Модификация' };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
    <span className="text-[13px] text-muted">{label}</span>
    <span className="text-right text-[13.5px] text-ink">{children}</span>
  </div>
);

const TABS = [
  { value: 'main', label: 'Основное' },
  { value: 'numbers', label: 'Номера и аналоги' },
  { value: 'fit', label: 'Применимость' },
  { value: 'prices', label: 'Цены' },
  { value: 'stock', label: 'Остатки' },
  { value: 'moves', label: 'Движения' },
  { value: 'suppliers', label: 'Поставщики' },
  { value: 'history', label: 'История', stage: 7 },
];

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: p, isLoading, error, refetch } = useProduct(id);
  const { data: me } = useMe();
  const storeName = (sid: string | null) => (sid ? (me?.stores.find((s) => s.id === sid)?.name ?? 'Точка') : 'Все точки');

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-80 rounded-[28px]" />
      </div>
    );
  if (error || !p) return <ErrorState error={error} onRetry={() => refetch()} />;

  const retail = p.prices.find((x) => !x.storeId && !x.unitId && /розн/i.test(x.priceTypeName ?? '')) ?? p.prices[0];
  const stockTotal = p.stock.reduce((a, s) => a + Number(s.qty), 0);
  const soon = () => toast('Появится на следующих этапах');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => (history.length > 1 ? nav(-1) : nav('/products'))}>
          <ArrowLeft /> Каталог
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={soon}>
            <Printer /> Этикетка
          </Button>
          <Button size="sm" onClick={soon}>
            <PackagePlus /> Приёмка
          </Button>
          <Button size="sm" onClick={soon}>
            <Copy /> Копировать
          </Button>
          <Button size="sm" variant="ghost" onClick={soon}>
            <Archive /> В архив
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <ProductThumb fileId={p.photos[0]?.fileId ?? null} size={88} className="rounded-[26px]" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Арт. {p.sku}</span>
              {p.category && <span>· {p.category.name}</span>}
              {p.status !== 'active' && <Pill tone="dark">{p.status === 'archived' ? 'Архив' : p.status}</Pill>}
            </div>
            <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[30px]">{p.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {p.mainNumber && <Pill tone="outline" className="font-mono text-[13px]">{p.mainNumber}</Pill>}
              {p.brand && <Pill tone="soft">{p.brand.name}</Pill>}
              <QualityBadge value={p.qualityClass} />
              {p.isSerial && <Pill tone="warn">Серийный учёт</Pill>}
              {p.noStockControl && <Pill tone="muted">Без контроля остатка</Pill>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex">
          <div className="flex min-w-[170px] flex-col justify-between rounded-[22px] bg-pill p-4 text-pill-ink">
            <div className="text-xs opacity-60">{retail?.priceTypeName ?? 'Цена'}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {p.priceNegotiable && !retail ? 'Договорная' : money(retail?.price, retail?.currency)}
            </div>
            {p.minPrice && <div className="mt-1 text-xs opacity-60">мин. {money(p.minPrice)}</div>}
          </div>
          <div className="flex min-w-[130px] flex-col items-center justify-between gap-2 rounded-[22px] bg-card p-4 text-center ring-2 ring-accent">
            <div className="text-[13px] text-ink-2">Остаток</div>
            <Pill tone="accent" className="h-7 px-3 text-[13px]">
              {p.noStockControl ? '∞' : `${num(stockTotal, 3)} ${p.baseUnit}`}
            </Pill>
            <div className="text-xs text-muted">{p.stock.length} склад(а)</div>
          </div>
        </div>
      </div>

      {p.fitWarning && (
        <div className="flex items-center gap-3 rounded-[22px] bg-accent-soft px-4 py-3 text-sm text-accent ring-1 ring-accent-line">
          <Undo2 className="size-4 shrink-0" /> {p.fitWarning}
        </div>
      )}

      <Tabs.Root defaultValue="main">
        <Tabs.List className="scroll-thin flex gap-1 overflow-x-auto rounded-full bg-card p-1 ring-1 ring-line">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-ink-2 transition hover:bg-card-muted data-[state=active]:bg-pill data-[state=active]:text-pill-ink"
            >
              {t.label}
              {t.stage && <span className="text-[10px] opacity-50">эт.{t.stage}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="main" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-2 text-[15px] font-medium">Карточка</div>
            <Row label="Тип детали">{p.partType?.name ?? '—'}</Row>
            <Row label="Единица">{p.baseUnit}</Row>
            <Row label="Упаковки">{p.units.filter((u) => !u.isBase).map((u) => `${u.name} = ${num(u.factor, 3)} ${p.baseUnit}`).join(', ') || '—'}</Row>
            <Row label="Штрихкоды">
              <span className="flex flex-wrap justify-end gap-1">
                {p.units.flatMap((u) => u.barcodes).map((b) => (
                  <Pill key={b.id} tone="soft" className="font-mono">
                    <Barcode className="size-3" /> {b.barcode}
                  </Pill>
                ))}
                {!p.units.some((u) => u.barcodes.length) && '—'}
              </span>
            </Row>
            <Row label="Теги">{p.tags.length ? p.tags.join(', ') : '—'}</Row>
            <Row label="Изменён">{date(p.updatedAt, 'D MMM YYYY, HH:mm')}</Row>
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-2 text-[15px] font-medium">Атрибуты</div>
              {Object.keys(p.attributes ?? {}).length === 0 && <div className="py-3 text-sm text-muted">Не заполнены</div>}
              {Object.entries(p.attributes ?? {}).map(([k, v]) => (
                <Row key={k} label={p.attributeDefs.find((d) => d.code === k)?.name ?? k}>
                  {String(v)}
                </Row>
              ))}
            </Card>
            <Tray className="p-4">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                <ShieldCheck className="size-4 text-accent" /> Гарантия и возврат
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[18px] bg-card p-3">
                  <div className="text-xs text-muted">Гарантия</div>
                  <div className="font-semibold">{p.effective.warrantyDays ? `${p.effective.warrantyDays} дн.` : 'нет'}</div>
                </div>
                <div className="rounded-[18px] bg-card p-3">
                  <div className="text-xs text-muted">Возврат</div>
                  <div className="font-semibold">{p.effective.returnDays ? `${p.effective.returnDays} дн.` : 'нет'}</div>
                </div>
              </div>
              {p.effective.returnConditions && <div className="mt-2 text-xs text-muted">{p.effective.returnConditions}</div>}
            </Tray>
            {p.sellerNote && (
              <div className="flex gap-3 rounded-[22px] bg-warn-soft p-4 text-sm text-ink-2">
                <Info className="mt-0.5 size-4 shrink-0 text-warn" />
                <span>
                  <span className="font-medium text-ink">Заметка для продавца.</span> {p.sellerNote}
                </span>
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="numbers" className="mt-4">
          <div className="space-y-1.5">
            {p.numbers.map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-4 ring-1 ring-line">
                <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-ink">{n.number}</span>
                <span className="hidden text-[13px] text-muted sm:block">{n.brandName ?? '—'}</span>
                <Pill tone={n.type === 'manufacturer' ? 'dark' : n.type === 'oem' ? 'accent-outline' : 'soft'}>{NUM_TYPE[n.type] ?? n.type}</Pill>
              </div>
            ))}
            {!p.numbers.length && <EmptyState title="Номеров нет" hint="Добавьте номер производителя и OEM — по ним работает поиск и аналоги" />}
          </div>
          <CrossesBlock productId={p.id} mainNumber={p.mainNumber} brand={p.brand?.name ?? null} />
        </Tabs.Content>

        <Tabs.Content value="fit" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {p.applicability.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-[20px] bg-card p-3 ring-1 ring-line">
                <span className="grid size-9 place-items-center rounded-full bg-card-muted">
                  <Car className="size-4 text-accent" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{a.title ?? [a.makeName, a.modelName, a.generationName].filter(Boolean).join(' ')}</span>
                {a.precision && <Pill tone={a.precision === 'make' || a.precision === 'model' ? 'warn' : 'soft'}>{PRECISION[a.precision] ?? a.precision}</Pill>}
              </div>
            ))}
          </div>
          {!p.applicability.length && <EmptyState title="Применимость не указана" hint="Деталь видна в ветке «Без привязки к авто» и в отчёте «Дозаполнить»" />}
        </Tabs.Content>

        <Tabs.Content value="prices" className="mt-4 space-y-1.5">
          {p.prices.map((x, i) => (
            <div key={i} className="flex items-center gap-3 rounded-full bg-card py-2 pr-4 pl-4 ring-1 ring-line">
              <span className="flex-1 text-[13.5px] font-medium text-ink">{x.priceTypeName ?? 'Тип цены'}</span>
              <span className="hidden text-xs text-muted sm:block">{storeName(x.storeId)}</span>
              <span className="w-28 text-right text-[14px] font-semibold tabular-nums">{money(x.price, x.currency)}</span>
            </div>
          ))}
          {!p.prices.length && <EmptyState title="Цен нет" hint={p.priceNegotiable ? 'Договорная цена — продавец вводит при продаже' : 'Без цены товар нельзя продать'} />}
        </Tabs.Content>

        <Tabs.Content value="stock" className="mt-4 space-y-1.5">
          {p.stock.map((s) => (
            <div key={s.warehouseId} className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-4 ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.warehouseName ?? 'Склад'}</span>
              <span className="hidden text-xs text-muted sm:block">{storeName(s.storeId)}</span>
              <Pill tone={Number(s.qty) > 0 ? 'dark' : 'muted'} className="h-7 px-3">
                {num(s.qty, 3)} {p.baseUnit}
              </Pill>
            </div>
          ))}
          {!p.stock.length && <EmptyState title="Остатков нет" hint="Остаток появляется только после проведения документа — приёмки или ввода остатков" />}
        </Tabs.Content>

        <Tabs.Content value="suppliers" className="mt-4">
          <SuppliersTab productId={p.id} unit={p.baseUnit} />
        </Tabs.Content>

        <Tabs.Content value="moves" className="mt-4">
          <MovesTab productId={p.id} unit={p.baseUnit} />
        </Tabs.Content>

        {TABS.filter((t) => t.stage).map((t) => (
          <Tabs.Content key={t.value} value={t.value} className="mt-4">
            <div className={cn('rounded-[28px] bg-card')}>
              <EmptyState title={`«${t.label}» — этап ${t.stage}`} hint="Вкладка подключится вместе с документами склада и закупками." />
            </div>
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <div className="text-center text-xs text-faint">
        <Link to="/products" className="hover:text-ink">
          ← ко всем товарам
        </Link>
      </div>
    </div>
  );
}
