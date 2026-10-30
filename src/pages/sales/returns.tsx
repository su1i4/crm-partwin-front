import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, QrCode, Search, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { posApi, RETURN_REASONS, useRegisters, type Receipt } from '@/entities/pos';
import { useMyRegisterId } from '@/features/pos-cart';
import { printReceipt } from '@/features/receipt-print';
import { ApiError, errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { date, money, num } from '@/shared/lib/format';
import { uuid } from '@/shared/lib/uuid';
import { askPin, Button, Input, PageTitle, PinDialog, Pill, Segmented } from '@/shared/ui';

interface Pick {
  qty: string;
  reason: string;
  condition: 'ok' | 'defect';
  noInstallMarks: boolean;
  tried: string;
}

/** Возврат по чеку (ТЗ 15.2): QR / номер → позиции и количество → деньги теми же способами */
export default function ReturnsPage() {
  const [sp, setSp] = useSearchParams();
  const [code, setCode] = useState(sp.get('code') ?? '');
  const [sale, setSale] = useState<Receipt | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [refund, setRefund] = useState<'same' | 'credit'>('same');
  const [done, setDone] = useState<Receipt | null>(null);
  const myReg = useMyRegisterId();
  const regs = useRegisters();
  const registerId = myReg ?? regs.data?.[0]?.id ?? null;
  const idem = useMemo(() => uuid(), [sale?.id]);

  const lookup = useMutation({
    mutationFn: (c: string) => posApi.lookupReturn(c.trim()),
    onSuccess: (r) => {
      setSale(r);
      setPicks({});
      setDone(null);
      setSp({ code: r.number }, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  useEffect(() => {
    const c = sp.get('code');
    if (c) lookup.mutate(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = Object.entries(picks).filter(([, p]) => Number(p.qty) > 0);
  const expired = sale?.lines.some((l) => picks[l.id] && l.returnPeriodExpired);
  const amount = sale?.lines.reduce((a, l) => {
    const p = picks[l.id];
    if (!p || !Number(l.returnableQty)) return a;
    return a + (Number(l.returnableAmount) / Number(l.returnableQty)) * Number(p.qty);
  }, 0) ?? 0;
  const notFitInvalid = lines.some(([, p]) => p.reason === 'not_fit' && (!p.noInstallMarks || !p.tried.trim()));

  const create = useMutation({
    mutationFn: async (pin?: string): Promise<Receipt> => {
      const body = {
        registerId: registerId!,
        saleReceiptId: sale!.id,
        refundMode: refund,
        idempotencyKey: idem,
        confirmExpired: expired || undefined,
        lines: lines.map(([saleLineId, p]) => ({
          saleLineId,
          qty: p.qty,
          reason: p.reason,
          condition: p.condition,
          ...(p.reason === 'not_fit' ? { noInstallMarks: p.noInstallMarks, triedVehicleTitle: p.tried.trim() } : {}),
        })),
        ...(pin ? { pin } : {}),
      };
      try {
        return await posApi.createReturn(body);
      } catch (e) {
        if (e instanceof ApiError && (e.details as { requiresPin?: boolean } | undefined)?.requiresPin) {
          const p = await askPin(e.message);
          if (p) return posApi.createReturn({ ...body, pin: p });
        }
        throw e;
      }
    },
    onSuccess: (r) => {
      setDone(r);
      toast.success('Возврат проведён');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const setPick = (id: string, p: Partial<Pick>) =>
    setPicks((s) => ({ ...s, [id]: { ...{ qty: '1', reason: 'changed_mind', condition: 'ok' as const, noInstallMarks: false, tried: '' }, ...s[id], ...p } }));

  return (
    <div className="space-y-6">
      <PageTitle title="Возврат по чеку" sub="Отсканируйте QR с чека или введите номер" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) lookup.mutate(code);
        }}
        className="flex max-w-xl gap-2"
      >
        <Input autoFocus className="h-12 flex-1" icon={<QrCode />} placeholder="К1А-000457 или ссылка из QR" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" variant="dark" size="lg" loading={lookup.isPending}>
          <Search /> Найти
        </Button>
      </form>

      {done && (
        <div className="flex flex-wrap items-center gap-4 rounded-[28px] bg-card p-6">
          <CheckCircle2 className="size-10 text-ok" />
          <div className="flex-1">
            <div className="font-semibold">Возврат {done.number} проведён</div>
            <div className="text-sm text-muted">Вернуть клиенту: {money(done.total)}</div>
          </div>
          <Button onClick={() => printReceipt(done.id, registerId ?? undefined)}>Печать</Button>
          <Button variant="dark" onClick={() => (setSale(null), setDone(null), setCode(''), setSp({}))}>
            Новый возврат
          </Button>
        </div>
      )}

      {sale && !done && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="text-[15px] font-medium">Чек {sale.number}</span>
              <span className="text-sm text-muted">{date(sale.completedAt, 'D MMM YYYY, HH:mm')} · {sale.daysSinceSale} дн. назад</span>
              {sale.customerName && <Pill tone="soft">{sale.customerName}</Pill>}
            </div>
            {sale.lines.map((l) => {
              const can = Number(l.returnableQty) > 0;
              const p = picks[l.id];
              return (
                <div key={l.id} className={cn('rounded-[22px] bg-card p-3 ring-1', p ? 'ring-ink' : 'ring-line', !can && 'opacity-50')}>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      disabled={!can}
                      checked={!!p}
                      onChange={(e) =>
                        e.target.checked
                          ? setPick(l.id, { qty: String(Number(l.returnableQty)) })
                          : setPicks((s) => {
                              const n = { ...s };
                              delete n[l.id];
                              return n;
                            })
                      }
                      className="size-5 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.free?.name ?? l.name}</span>
                      <span className="text-xs text-muted">
                        куплено {num(l.qty, 3)} · можно вернуть {num(l.returnableQty, 3)} {l.unitName} · {money(l.amount)}
                      </span>
                    </span>
                    {l.returnPeriodExpired && <Pill tone="warn">срок возврата прошёл</Pill>}
                  </label>
                  {p && (
                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input className="h-10 w-24" inputMode="decimal" value={p.qty} onChange={(e) => setPick(l.id, { qty: String(Math.min(Number(e.target.value.replace(/[^\d.]/g, '')) || 0, Number(l.returnableQty))) })} />
                        <Segmented size="sm" value={p.condition} onChange={(v) => setPick(l.id, { condition: v })} options={[{ value: 'ok', label: 'На склад' }, { value: 'defect', label: 'В брак' }]} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(RETURN_REASONS).map(([k, v]) => (
                          <button key={k} onClick={() => setPick(l.id, { reason: k, condition: k === 'defect' ? 'defect' : p.condition })} className={cn('h-8 rounded-full px-3 text-xs ring-1', p.reason === k ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line')}>
                            {v}
                          </button>
                        ))}
                      </div>
                      {p.reason === 'not_fit' && (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn-soft p-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={p.noInstallMarks} onChange={(e) => setPick(l.id, { noInstallMarks: e.target.checked })} className="size-4" />
                            Без следов установки
                          </label>
                          <Input className="h-9 min-w-48 flex-1" placeholder="На какую машину пробовали" value={p.tried} onChange={(e) => setPick(l.id, { tried: e.target.value })} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <aside className="h-fit space-y-3 rounded-[28px] bg-card-muted p-2 lg:sticky lg:top-0">
            <div className="rounded-[22px] bg-card p-4">
              <div className="mb-2 text-sm font-medium">Деньги клиенту</div>
              <Segmented value={refund} onChange={setRefund} options={[{ value: 'same', label: 'Теми же способами' }, { value: 'credit', label: 'В аванс' }]} />
              <div className="mt-2 text-xs text-muted">Оплачено в долг — уменьшится долг. Бонусы вернутся на карту.</div>
            </div>
            {expired && (
              <div className="flex gap-2 rounded-[22px] bg-warn-soft p-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warn" /> Срок возврата прошёл — нужно право или PIN старшего
              </div>
            )}
            <div className="rounded-[22px] bg-pill p-4 text-pill-ink">
              <div className="text-sm opacity-70">К возврату ≈</div>
              <div className="text-3xl font-semibold tabular-nums">{money(amount)}</div>
              <button
                disabled={!lines.length || notFitInvalid || !registerId || create.isPending}
                onClick={() => create.mutate(undefined)}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-accent font-semibold text-accent-ink disabled:opacity-40"
              >
                <Undo2 className="size-5" /> Провести возврат
              </button>
              {notFitInvalid && <div className="mt-2 text-xs text-accent">«Не подошло»: отметьте «без следов установки» и укажите машину</div>}
            </div>
          </aside>
        </div>
      )}
      <PinDialog />
    </div>
  );
}
