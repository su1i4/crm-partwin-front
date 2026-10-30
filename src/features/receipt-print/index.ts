import { toast } from 'sonner';
import { posApi, type Printable } from '@/entities/pos';
import type { LocalReceipt } from '@/entities/pos-offline';
import { errorMessage } from '@/shared/api';

const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const n = (v: string) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

/** HTML нефискального чека 58/80 мм — запасной вариант, когда агент печати недоступен (ТЗ 12.1) */
export function receiptHtml(p: Printable, width: 58 | 80 = 80) {
  const lines = p.lines
    .map(
      (l) => `<div class="l"><div>${esc(l.name)}</div><div class="r"><span>${esc(l.qty)} ${esc(l.unit)} × ${n(l.price)}</span><b>${n(l.amount)}</b></div>
      ${Number(l.discount) ? `<div class="r s"><span>скидка</span><span>−${n(l.discount)}</span></div>` : ''}
      ${l.warranty || l.returnRule ? `<div class="s">${esc([l.warranty, l.returnRule].filter(Boolean).join(' · '))}</div>` : ''}</div>`,
    )
    .join('');
  const pays = p.payments.map((x) => `<div class="r"><span>${esc(x.method)}${x.account ? ` (${esc(x.account)})` : ''}</span><span>${n(x.amount)} ${x.currency === 'USD' ? '$' : ''}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.number)}</title><style>
    @page{size:${width}mm auto;margin:3mm}*{box-sizing:border-box}body{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;width:${width - 6}mm;margin:0;color:#000}
    h1{font-size:14px;text-align:center;margin:0 0 2px}.c{text-align:center}.s{font-size:10px;color:#333}.r{display:flex;justify-content:space-between;gap:6px}
    .l{border-bottom:1px dashed #999;padding:4px 0}.t{font-size:16px;font-weight:700;margin-top:6px}hr{border:0;border-top:1px dashed #000;margin:6px 0}
  </style></head><body>
  <h1>${esc(p.store.name)}</h1><div class="c s">${esc(p.store.address)} ${esc(p.store.phone)}</div><hr>
  <div class="r"><b>${esc(p.title)} ${esc(p.number)}</b><span>${esc(p.date)}</span></div>
  <div class="s">${esc(p.register)} · продавец ${esc(p.seller)}${p.customer ? ` · ${esc(p.customer)}` : ''}${p.vehicle ? ` · ${esc(p.vehicle)}` : ''}</div><hr>
  ${lines}
  <div class="r"><span>Подытог</span><span>${n(p.subtotal)}</span></div>
  ${Number(p.discount) ? `<div class="r"><span>Скидка</span><span>−${n(p.discount)}</span></div>` : ''}
  <div class="r t"><span>ИТОГО</span><span>${n(p.total)} сом</span></div>
  ${p.totalUsd ? `<div class="r s"><span>≈ по курсу ${esc(p.rate)}</span><span>$${n(p.totalUsd)}</span></div>` : ''}<hr>
  ${pays}
  ${p.change ? `<div class="r"><b>Сдача</b><b>${n(p.change.amount)} ${p.change.currency === 'USD' ? '$' : 'сом'}</b></div>` : ''}
  ${p.debt ? `<div class="r"><b>В долг</b><b>${n(p.debt)}</b></div>` : ''}
  <hr><div class="c">${esc(p.footer)}</div>${p.qr ? `<div class="c s">${esc(p.qr)}</div>` : ''}
  <div class="c s">Нефискальный чек</div></body></html>`;
}

export function printHtml(html: string) {
  const f = document.createElement('iframe');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(f);
  f.contentDocument!.open();
  f.contentDocument!.write(html);
  f.contentDocument!.close();
  setTimeout(() => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 1500);
  }, 250);
}

/** Печать чека: сначала агент кассы, если не вышло — через окно печати браузера */
export async function printReceipt(id: string, registerId?: string, opts: { browserOnly?: boolean } = {}) {
  if (!opts.browserOnly) {
    try {
      const r = await posApi.printAgent(id, registerId);
      toast.success(r.status === 'done' ? 'Напечатано' : 'Отправлено на принтер кассы');
      return;
    } catch {
      toast('Агент печати не подключён — печатаем через браузер');
    }
  }
  try {
    printHtml(receiptHtml(await posApi.printable(id)));
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export async function shareWhatsApp(id: string) {
  try {
    const s = await posApi.share(id);
    window.open(s.whatsappUrl, '_blank', 'noopener');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

/** Печать чека, проданного без сети: данные — с устройства */
export function printLocalReceipt(l: LocalReceipt, store: { name: string; address: string | null; phone: string | null; register: string }) {
  const p: Printable = {
    kind: 'sale',
    title: 'Товарный чек',
    store: { name: store.name, address: store.address, phone: store.phone },
    number: l.number,
    date: new Date(l.createdAt).toLocaleString('ru-RU'),
    register: store.register,
    seller: l.sellerName.split(' ')[0],
    customer: l.customerName,
    vehicle: l.vehicleLabel,
    lines: l.lines.map((x) => ({ ...x, warranty: null, returnRule: null })),
    subtotal: l.subtotal,
    discount: l.discount,
    total: l.total,
    totalUsd: l.rate ? (Number(l.total) / Number(l.rate)).toFixed(2) : null,
    rate: l.rate,
    payments: l.payments,
    change: Number(l.change) > 0 ? { amount: l.change, currency: l.changeCurrency } : null,
    debt: Number(l.debt) > 0 ? l.debt : null,
    qr: null,
    footer: 'Спасибо за покупку! Чек пробит без интернета.',
  };
  printHtml(receiptHtml(p));
}
