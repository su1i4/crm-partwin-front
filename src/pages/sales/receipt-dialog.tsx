import { ArrowDownUp, MessageCircle, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReceipt } from '@/entities/pos';
import { printReceipt, shareWhatsApp } from '@/features/receipt-print';
import { date, money, num } from '@/shared/lib/format';
import { Button, Dialog, Pill, Skeleton } from '@/shared/ui';

const METHOD: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', debt: 'В долг', return_credit: 'Зачёт возврата', advance: 'Аванс', scrap: 'Лом' };
export const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'dark' | 'muted' | 'accent' }> = {
  completed: { label: 'Оплачен', tone: 'ok' },
  open: { label: 'Открыт', tone: 'warn' },
  deferred: { label: 'Отложен', tone: 'dark' },
  cancelled: { label: 'Отменён', tone: 'muted' },
};

export function ReceiptDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: r, isLoading } = useReceipt(id);
  const nav = useNavigate();
  const st = r ? (STATUS[r.status] ?? { label: r.status, tone: 'muted' as const }) : null;
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()} className="max-w-2xl" title={r ? `${r.kind === 'return' ? 'Возврат' : 'Чек'} ${r.number}` : 'Чек'} description={r ? `${date(r.completedAt ?? r.createdAt, 'D MMMM YYYY, HH:mm')} · ${r.registerName ?? ''} · ${r.sellerName ?? ''}` : undefined}>
      {isLoading && <Skeleton className="mt-4 h-60 rounded-[22px]" />}
      {r && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {st && <Pill tone={st.tone}>{st.label}</Pill>}
            {r.customerName && <Pill tone="soft">{r.customerName}</Pill>}
            {r.vehicleLabel && <Pill tone="outline">{r.vehicleLabel}</Pill>}
            {Number(r.debtAmount) > 0 && <Pill tone="accent-outline">в долг {money(r.debtAmount)}</Pill>}
          </div>
          <div className="scroll-thin max-h-[40vh] space-y-1.5 overflow-y-auto">
            {r.lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-[18px] bg-card-muted px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{l.free?.name ?? l.name}</span>
                  <span className="text-xs text-muted">
                    {num(l.qty, 3)} {l.unitName} × {money(l.price)}
                    {Number(l.lineDiscount) + Number(l.receiptDiscount) + Number(l.promoDiscount) > 0 && ` · скидка ${money(Number(l.lineDiscount) + Number(l.receiptDiscount) + Number(l.promoDiscount))}`}
                  </span>
                </span>
                <span className="text-[14px] font-semibold tabular-nums">{money(l.amount)}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 rounded-[20px] p-3.5 ring-1 ring-line">
              {r.payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate text-muted">
                    {METHOD[p.method] ?? p.method}
                    {p.accountName && p.method === 'transfer' ? ` · ${p.accountName}` : ''}
                    {p.verifyStatus === 'unverified' && <span className="text-warn"> · не сверено</span>}
                  </span>
                  <span className="tabular-nums">{money(p.amount, p.currency)}</span>
                </div>
              ))}
              {!r.payments.length && <span className="text-sm text-muted">Оплат нет</span>}
              {Number(r.change) > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">Сдача</span>
                  <span className="tabular-nums">{money(r.change, r.changeCurrency)}</span>
                </div>
              )}
            </div>
            <div className="rounded-[20px] bg-pill p-3.5 text-pill-ink">
              <div className="flex justify-between text-sm opacity-70">
                <span>Подытог</span>
                <span className="tabular-nums">{money(r.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm opacity-70">
                <span>Скидка</span>
                <span className="tabular-nums">{money(r.discountTotal)}</span>
              </div>
              <div className="mt-2 flex justify-between text-xl font-semibold">
                <span>Итого</span>
                <span className="tabular-nums">{money(r.total)}</span>
              </div>
            </div>
          </div>
          {r.status === 'completed' && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => printReceipt(r.id, r.registerId)}>
                <Printer /> Печать
              </Button>
              <Button onClick={() => shareWhatsApp(r.id)}>
                <MessageCircle /> WhatsApp
              </Button>
              {r.kind === 'sale' && (
                <Button variant="dark" onClick={() => nav(`/sales/returns?code=${encodeURIComponent(r.number)}`)}>
                  <ArrowDownUp /> Возврат
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
