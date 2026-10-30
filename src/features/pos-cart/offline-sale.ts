import { offline, useOffline, verifyPinOffline, type LocalReceipt } from '@/entities/pos-offline';
import type { PaymentInput } from '@/entities/pos';
import { calcReceipt } from '@/shared/lib/pricing-engine';
import { uuid } from '@/shared/lib/uuid';
import { askPin } from '@/shared/ui';
import { useCart } from './model';

const METHOD: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', debt: 'В долг' };

export class OfflineSaleError extends Error {}

/**
 * Продажа без сети (ТЗ 16.2–16.4): чек считается на кассе тем же движком, получает UUID и номер устройства
 * (К1А-000457), уходит в очередь операций и будет принят сервером по порядку, когда появится связь.
 */
export async function payOffline(payments: PaymentInput[], changeCurrency: 'KGS' | 'USD'): Promise<LocalReceipt> {
  const cart = useCart.getState();
  const o = useOffline.getState();
  if (!o.db || !o.device || !o.meta) throw new OfflineSaleError('Касса не подготовлена к работе без интернета');
  if (!o.shift || o.shift.status !== 'open') throw new OfflineSaleError('Откройте смену');
  const seller = o.seller;
  if (!seller) throw new OfflineSaleError('Войдите по PIN — неизвестно, кто продаёт');
  const rules = o.meta.offlineRules;
  for (const p of payments) {
    if (p.method === 'debt' && !rules.debt) throw new OfflineSaleError('Без интернета в режиме «несколько касс» продажа в долг недоступна');
    if (!['cash', 'card', 'transfer', 'debt'].includes(p.method)) throw new OfflineSaleError('Этот способ оплаты недоступен без интернета');
  }
  if (payments.some((p) => p.method === 'debt') && !cart.customer) throw new OfflineSaleError('В долг — только клиенту из базы');
  if (cart.lines.some((l) => !l.free && !l.neighbor && (l.price === null || l.price === undefined) && !l.customPrice)) throw new OfflineSaleError('У товара нет цены — укажите «свою цену»');

  const calc = calcReceipt({
    lines: cart.lines.map((l) => ({ key: l.key, qty: l.qty, price: l.customPrice ?? l.price ?? '0', discountPercent: l.discountPercent ?? null, discountAmount: l.discountAmount ?? null })),
    receiptDiscountPercent: cart.offDiscount.percent,
    receiptDiscountAmount: cart.offDiscount.amount,
  });

  // Скидка сверх лимита роли — PIN старшего проверяется на кассе по хэшу (ТЗ 3.5)
  const approvals: { action: 'discount'; membershipId: string; at: string }[] = [];
  const me = (await o.db.staff.get(seller.membershipId)) ?? null;
  const limit = me?.isOwner ? 100 : (me?.maxDiscountPercent ?? 0);
  if (Number(calc.maxManualPercent) > limit + 0.001) {
    const pin = await askPin(`Скидка ${Number(calc.maxManualPercent).toFixed(1)}% выше лимита ${limit}% — PIN старшего`);
    if (!pin) throw new OfflineSaleError('Скидка не подтверждена');
    const approver = await verifyPinOffline(pin, await o.db.staff.toArray(), o.tenantId!, o.device.secret);
    if (!approver || !(approver.isOwner || approver.maxDiscountPercent >= Number(calc.maxManualPercent))) throw new OfflineSaleError('PIN неверный или у сотрудника тоже не хватает лимита');
    approvals.push({ action: 'discount', membershipId: approver.membershipId, at: new Date().toISOString() });
  }

  const rate = o.meta.rates.find((r) => r.currency === 'USD')?.rate ?? null;
  const paidKgs = payments.reduce((a, p) => a + Number(p.amount) * (p.currency === 'USD' ? Number(rate ?? 0) : 1), 0);
  const total = Number(calc.total);
  if (paidKgs + 0.005 < total) throw new OfflineSaleError('Оплачено меньше суммы чека');
  const changeKgs = Math.round((paidKgs - total) * 100) / 100;

  const id = uuid();
  const number = await offline.nextNumber();
  const createdAt = new Date().toISOString();
  const payload = {
    number,
    createdAt,
    shiftId: o.shift.id,
    customerId: cart.customer?.id ?? null,
    vehicleLabel: cart.vehicleLabel || null,
    receiptDiscountPercent: cart.offDiscount.percent,
    receiptDiscountAmount: cart.offDiscount.amount,
    lines: cart.lines.map((l) => ({
      ...(l.productId && !l.free && !l.neighbor ? { productId: l.productId } : {}),
      qty: l.qty,
      price: l.customPrice ?? l.price ?? '0',
      ...(l.discountPercent ? { discountPercent: l.discountPercent } : {}),
      ...(l.discountAmount ? { discountAmount: l.discountAmount } : {}),
      ...(l.free ? { free: l.free } : {}),
      ...(l.neighbor ? { neighbor: l.neighbor } : {}),
    })),
    payments,
    changeCurrency,
    total: calc.total,
    approvals,
    rate,
  };
  await offline.enqueue('sale', payload, seller.membershipId, `Чек ${number} · ${calc.total} с`, id);

  // Наличные в кассе для подсказки при закрытии смены без сети
  const delta = { ...(o.shift.cashDelta ?? {}) };
  for (const p of payments) if (p.method === 'cash') delta[p.currency ?? 'KGS'] = (delta[p.currency ?? 'KGS'] ?? 0) + Number(p.amount);
  delta[changeCurrency] = (delta[changeCurrency] ?? 0) - (changeCurrency === 'USD' && rate ? changeKgs / Number(rate) : changeKgs);
  await offline.setShift({ ...o.shift, cashDelta: delta });

  const local: LocalReceipt = {
    id,
    number,
    createdAt,
    total: calc.total,
    subtotal: calc.subtotal,
    discount: calc.discountTotal,
    change: changeCurrency === 'USD' && rate ? (changeKgs / Number(rate)).toFixed(2) : changeKgs.toFixed(2),
    changeCurrency,
    debt: payments.filter((p) => p.method === 'debt').reduce((a, p) => a + Number(p.amount), 0).toFixed(2),
    sellerName: seller.name,
    customerName: cart.customer?.name ?? null,
    vehicleLabel: cart.vehicleLabel || null,
    rate,
    lines: cart.lines.map((l, i) => ({
      name: l.name,
      qty: l.qty,
      unit: l.unitName,
      price: l.customPrice ?? l.price ?? '0',
      discount: String(Number(calc.lines[i].lineDiscount) + Number(calc.lines[i].receiptDiscount)),
      amount: calc.lines[i].total,
    })),
    payments: payments.map((p) => ({ method: METHOD[p.method] ?? p.method, account: null, currency: p.currency ?? 'KGS', amount: p.amount })),
  };
  await o.db.local.put(local);
  return local;
}
