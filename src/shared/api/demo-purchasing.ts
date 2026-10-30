/* Демо-данные закупок: поставщики, прайсы, заказы, автозаказ, контейнеры, доноры. Только для VITE_DEMO=true. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Res = { status: number; data: unknown } | { error: { status: number; code: string; message: string; details?: unknown } } | null;
type Handler = (url: string, method: string, params: Record<string, any>, body: any) => Promise<Res>;

interface P {
  id: string;
  name: string;
  sku: string;
  mainNumber: string | null;
  brandName: string | null;
  baseUnit: string;
  retailPrice: string | number | null;
  stock: number;
  categoryId: string | null;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const dayStr = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9А-Я]/g, '');
const RATES: Record<string, number> = { KGS: 1, USD: 87.4, CNY: 12.1, AED: 23.8 };

export function createDemoPurchasing(products: P[], storeId: string, stock: Handler) {
  const W2 = '00000000-0000-4000-8000-000000000842';
  const cost = (p: P) => r2(Number(p.retailPrice ?? 0) * 0.62);

  // ── поставщики и соседи
  const sup = (id: string, name: string, roles: string[], extra: any = {}) => ({
    id, name, kind: 'company', phone: extra.phone ?? null, phones: [], inn: extra.inn ?? null, address: extra.address ?? null, roles, tags: [], version: 1,
    messengers: extra.messengers ?? {}, supplierTerms: extra.terms ?? {}, note: extra.note ?? null, contacts: extra.contacts ?? [], debts: extra.debts ?? [],
  });
  const suppliers: any[] = [
    sup('00000000-0000-4000-8000-000000000951', 'ОсОО «Азия Партс»', ['supplier'], {
      phone: '0555 400 500', address: 'Бишкек, ул. Ахунбаева 98', messengers: { whatsapp: '996555400500', telegram: '@aziaparts' }, terms: { currency: 'KGS', paymentDelayDays: 14, leadTimeDays: 2 },
      debts: [{ direction: 'payable', currency: 'KGS', amount: '48600', overdue: '12000' }], contacts: [{ id: uid(), name: 'Марат', position: 'менеджер', phone: '0700 400 501', note: null }], note: 'Скидка 3% при оплате наличными',
    }),
    sup('00000000-0000-4000-8000-000000000952', 'Автомир Опт', ['supplier'], { phone: '0777 123 321', messengers: { whatsapp: '996777123321' }, terms: { currency: 'KGS', leadTimeDays: 1 } }),
    sup('00000000-0000-4000-8000-000000000953', 'Guangzhou Hongda Auto Parts', ['supplier'], { messengers: { whatsapp: '8613800138000' }, terms: { currency: 'USD', leadTimeDays: 35 }, address: 'Гуанчжоу, Китай' }),
    sup('00000000-0000-4000-8000-000000000954', 'Контейнер 118 — Улан', ['neighbor'], { phone: '0505 118 118', address: 'Дордой, ряд 4, конт. 118', note: 'Японские б/у агрегаты, отдаёт под реализацию' }),
    sup('00000000-0000-4000-8000-000000000955', 'Нурбек — масла и химия', ['neighbor'], { phone: '0559 300 300', address: 'Дордой, ряд 12' }),
  ];
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? 'Поставщик';

  // ── прайсы
  const fields = [
    { key: 'brand', label: 'Бренд' }, { key: 'number', label: 'Номер', required: true }, { key: 'name', label: 'Название' }, { key: 'price', label: 'Цена', required: true },
    { key: 'currency', label: 'Валюта' }, { key: 'stock', label: 'Остаток' }, { key: 'leadDays', label: 'Срок, дней' }, { key: 'multiplicity', label: 'Кратность' },
    { key: 'oem', label: 'OEM / кроссы' }, { key: 'applicability', label: 'Применимость' },
  ];
  const lists: any[] = [];
  const rows: Record<string, any[]> = {};
  const mkList = (supplierId: string, name: string, currency: string, lead: number, factor: number, extra: any = {}) => {
    const l = {
      id: uid(), name, supplierId, supplierName: supName(supplierId), currency, url: extra.url ?? null, schedule: extra.schedule ?? null, status: 'ready', rowsCount: 0,
      loadedAt: daysAgo(extra.age ?? 0.2), lastError: null, isActive: true, defaultLeadDays: lead, version: 1, headerRow: 1,
      mapping: { brand: 0, number: 1, name: 2, price: 3, stock: 4 }, loads: [] as any[],
    };
    const rs = products.filter((_, i) => (i + name.length) % 3 !== 0).map((p, i) => ({
      id: uid(), number: p.mainNumber ?? p.sku, normalized: norm(p.mainNumber ?? p.sku), brand: p.brandName, name: p.name,
      price: String(currency === 'USD' ? r2((cost(p) * factor) / RATES.USD) : Math.round(cost(p) * factor)), currency,
      stockText: i % 5 === 0 ? 'нет' : i % 3 === 0 ? '>10' : String(2 + (i % 7)), stockQty: i % 5 === 0 ? '0' : String(2 + (i % 7)),
      leadDays: lead, multiplicity: i % 4 === 0 ? '2' : null, oem: null, applicability: null, productId: p.id, updatedAt: l.loadedAt,
    }));
    for (let k = 0; k < 40; k++)
      rs.push({ id: uid(), number: `${['TB', 'GS', 'MK', 'HD'][k % 4]}-${4100 + k * 7}`, normalized: norm(`${['TB', 'GS', 'MK', 'HD'][k % 4]}${4100 + k * 7}`), brand: ['Masuma', 'GMB', 'CTR', 'Kayaba'][k % 4], name: ['Ступица задняя', 'Помпа', 'Наконечник рулевой', 'Пыльник ШРУСа', 'Опора двигателя'][k % 5], price: String(currency === 'USD' ? 8 + k : 900 + k * 37), currency, stockText: String(1 + (k % 9)), stockQty: String(1 + (k % 9)), leadDays: lead, multiplicity: null, oem: k % 3 === 0 ? '43560-26010' : null, applicability: k % 2 ? 'Toyota Camry 40' : null, productId: null, updatedAt: l.loadedAt } as any);
    rows[l.id] = rs;
    l.rowsCount = rs.length;
    l.loads = [{ id: uid(), source: extra.url ? 'url' : 'file', status: 'done', rows: rs.length, added: 3, updated: rs.length - 3, removed: 1, priceChanges: 12, skipped: 0, crossesAdded: 4, error: null, createdAt: l.loadedAt, finishedAt: l.loadedAt }];
    lists.push(l);
    return l;
  };
  mkList(suppliers[0].id, 'Прайс Азия Партс (опт)', 'KGS', 2, 1.0, { url: 'https://aziaparts.kg/price.xlsx', schedule: 'daily', age: 0.3 });
  mkList(suppliers[1].id, 'Автомир — ежедневный', 'KGS', 1, 1.07, { age: 1.5 });
  mkList(suppliers[2].id, 'Hongda FOB Guangzhou', 'USD', 35, 0.55, { age: 9 });
  mkList(suppliers[3].id, 'Улан — что есть в контейнере', 'KGS', 0, 1.25, { age: 3 });
  const listView = (l: any) => l;
  const listItem = ({ loads, mapping, headerRow, ...l }: any) => (void loads, void mapping, void headerRow, l);
  const priceHist = (row: any) => [
    { oldPrice: String(r2(Number(row.price) * 0.95)), newPrice: row.price, currency: row.currency, at: daysAgo(3) },
    { oldPrice: String(r2(Number(row.price) * 0.9)), newPrice: String(r2(Number(row.price) * 0.95)), currency: row.currency, at: daysAgo(24) },
  ];
  const files: Record<string, string> = {};

  // ── поставщики товара, правила
  const supProducts: Record<string, any[]> = {};
  const rules: Record<string, any[]> = {};
  products.forEach((p, i) => {
    supProducts[p.id] = [{ id: uid(), supplierId: suppliers[i % 2].id, supplierName: suppliers[i % 2].name, supplierCode: i % 3 === 0 ? `AP-${p.sku}` : null, multiplicity: i % 4 === 0 ? '2' : '1', minQty: '0', leadDays: null, preferred: true, lastPrice: String(cost(p)), lastCurrency: 'KGS', lastPurchaseAt: daysAgo(6 + i) }];
    if (i % 2 === 0) rules[p.id] = [{ id: uid(), storeId: null, minQty: String(Math.max(2, Math.round(p.stock / 2))), maxQty: String(Math.max(6, p.stock * 2)), summerMin: null, summerMax: null, winterMin: i === 14 ? '20' : null, winterMax: i === 14 ? '60' : null, supplierId: null }];
  });

  // ── заказы
  const orders: any[] = [];
  let oseq = 57;
  const oLine = (p: P, qty: number, price: number | null, n: number, supplierId: string, extra: any = {}) => ({
    id: uid(), lineNo: n, productId: p.id, productName: p.name, sku: p.sku, brand: p.brandName, number: p.mainNumber,
    supplierCode: supProducts[p.id]?.find((s) => s.supplierId === supplierId)?.supplierCode ?? null, unitId: uid(), unitName: p.baseUnit, factor: '1',
    qty: String(qty), price: price == null ? null : String(price), amount: price == null ? null : String(r2(qty * price)), receivedQty: String(extra.received ?? 0),
    leftQty: String(Math.max(0, qty - (extra.received ?? 0))), requestItemId: null, note: null, extra: extra.extra ?? {},
  });
  const totalOf = (o: any) => String(r2(o.lines.reduce((a: number, l: any) => a + Number(l.amount ?? 0), 0)));
  const hist = (status: string, days = 0, note?: string) => ({ at: daysAgo(days), status, by: 'Бакыт', ...(note ? { note } : {}) });
  const mkOrder = (supplierId: string, status: string, days: number, lines: any[], extra: any = {}) => {
    const o: any = {
      id: uid(), number: `ЗП-${String(++oseq).padStart(6, '0')}`, status, source: extra.source ?? 'manual', supplierId, storeId, warehouseId: extra.warehouseId ?? null,
      currency: extra.currency ?? 'KGS', totalAmount: '0', expectedAt: extra.expectedAt ?? null, sentAt: null, confirmedAt: null, closedAt: null, comment: extra.comment ?? null,
      version: 1, createdAt: daysAgo(days), history: extra.history ?? [hist('draft', days)], lines, receivings: [],
    };
    o.totalAmount = totalOf(o);
    orders.unshift(o);
    return o;
  };
  mkOrder(suppliers[0].id, 'received', 12, [oLine(products[0], 10, 2900, 1, suppliers[0].id, { received: 10 }), oLine(products[3], 30, 380, 2, suppliers[0].id, { received: 30 })], { history: [hist('draft', 12), hist('sent', 12), hist('confirmed', 11), hist('received', 6)] });
  mkOrder(suppliers[1].id, 'partially_received', 5, [oLine(products[6], 40, 560, 1, suppliers[1].id, { received: 24 }), oLine(products[7], 50, 240, 2, suppliers[1].id, { received: 50 }), oLine(products[12], 10, 540, 3, suppliers[1].id)], {
    expectedAt: dayStr(-1), history: [hist('draft', 5), hist('sent', 5), hist('confirmed', 4), hist('partially_received', 2)],
  });
  mkOrder(suppliers[0].id, 'sent', 1, [oLine(products[8], 4, 4100, 1, suppliers[0].id), oLine(products[10], 6, 880, 2, suppliers[0].id), oLine(products[13], 3, 6200, 3, suppliers[0].id)], { expectedAt: dayStr(2), history: [hist('draft', 1), hist('sent', 1)], comment: 'Срочно к пятнице' });
  mkOrder(suppliers[2].id, 'confirmed', 9, [oLine(products[11], 20, 42, 1, suppliers[2].id), oLine(products[16], 100, 3.2, 2, suppliers[2].id)], { currency: 'USD', expectedAt: dayStr(25), history: [hist('draft', 9), hist('sent', 9), hist('confirmed', 7, 'Отгрузка 3 ноября')] });
  mkOrder(suppliers[1].id, 'draft', 0, [oLine(products[4], 20, 260, 1, suppliers[1].id, { extra: { autoOrder: { stock: '6' } } }), oLine(products[15], 30, 230, 2, suppliers[1].id, { extra: { autoOrder: { stock: '2' } } })], { source: 'auto', comment: 'Автозаказ' });
  const orderView = (o: any) => {
    const s = suppliers.find((x) => x.id === o.supplierId);
    const labels: Record<string, string> = { draft: 'Черновик', sent: 'Отправлен', confirmed: 'Подтверждён', partially_received: 'Частично принят', received: 'Принят', closed: 'Закрыт', cancelled: 'Отменён' };
    return { ...o, statusLabel: labels[o.status], supplier: s ? { id: s.id, name: s.name, phone: s.phone, messengers: s.messengers } : null };
  };
  const orderItem = (o: any) => ({
    id: o.id, number: o.number, status: o.status, source: o.source, supplierId: o.supplierId, supplierName: supName(o.supplierId), storeId: o.storeId, currency: o.currency, totalAmount: o.totalAmount,
    expectedAt: o.expectedAt, createdAt: o.createdAt, version: o.version, linesCount: o.lines.length, overdue: !!o.expectedAt && o.expectedAt < dayStr(0) && ['sent', 'confirmed', 'partially_received'].includes(o.status),
  });
  const setOrderLines = (o: any, lines: any[]) => {
    o.lines = lines.map((l: any, i: number) => {
      const p = products.find((x) => x.id === l.productId);
      const prev = o.lines.find((x: any) => x.productId === l.productId);
      return p ? { ...oLine(p, Number(l.qty), l.price != null ? Number(l.price) : null, i + 1, o.supplierId, { received: Number(prev?.receivedQty ?? 0), extra: prev?.extra }), note: l.note ?? null } : null;
    }).filter(Boolean);
    o.totalAmount = totalOf(o);
  };

  // ── контейнеры
  const containers: any[] = [];
  const mkContainer = (status: string, days: number, extra: any = {}) => {
    const lines = products.slice(0, 9).map((p, i) => ({
      id: uid(), line_no: i + 1, invoice_code: `HD${8000 + i * 13}`, invoice_name: p.name.replace('передние', '').trim() + ' / ' + (p.mainNumber ?? ''), product_id: i === 4 || i === 7 ? null : p.id,
      productName: i === 4 || i === 7 ? null : p.name, qty: String(10 * (1 + (i % 4))), price: String(r2(cost(p) / RATES.USD * 0.8)), volume: String(0.01 * (1 + i)), weight: String(1.5 * (1 + i)),
      manual_cost: null, received_qty: status === 'received' ? String(10 * (1 + (i % 4))) : '0', damaged_qty: '0',
    }));
    const c: any = {
      id: uid(), number: `КН-${String(containers.length + 7)}`, supplierId: suppliers[2].id, storeId, warehouseId: W2, currency: 'USD', rate: extra.rate ?? '87.2', status,
      prepayments: status === 'draft' ? [] : [{ at: daysAgo(days), amount: '3000', comment: 'Предоплата 50%' }],
      costs: extra.costs ?? [{ name: 'Карго Урумчи — Бишкек', amount: '145000', currency: 'KGS' }, { name: 'Таможня', amount: '62000', currency: 'KGS' }],
      distribution: 'volume', expectedOn: extra.expectedOn ?? dayStr(12), receivingDocumentIds: [], history: [{ at: daysAgo(days), status: 'draft', by: 'Бакыт' }], comment: extra.comment ?? 'Урумчи → Дордой, 40 футов', version: 1, lines, createdAt: daysAgo(days),
    };
    containers.unshift(c);
    return c;
  };
  mkContainer('in_transit', 18, { comment: 'Hongda, партия сентябрь' });
  mkContainer('draft', 2, { comment: 'Hongda, ноябрь', costs: [], rate: null, expectedOn: dayStr(40) });
  const cView = (c: any) => {
    const total = c.lines.reduce((a: number, l: any) => a + Number(l.qty) * Number(l.price), 0);
    return { ...c, total: total.toFixed(2), prepaid: c.prepayments.reduce((a: number, p: any) => a + Number(p.amount), 0).toFixed(2), unmatched: c.lines.filter((l: any) => !l.product_id).length };
  };
  const pName = (id: string | null) => products.find((p) => p.id === id)?.name ?? null;

  // ── доноры
  const donors: any[] = [];
  const mkDonor = (title: string, d: any) => {
    const x: any = { id: uid(), number: `ДН-${donors.length + 3}`, title, warehouseId: W2, year: d.year ?? null, vin: d.vin ?? null, bodyCode: null, engine: d.engine ?? null, transmission: d.transmission ?? null, purchasePrice: d.purchase, deliveryCost: d.delivery ?? '0', customsCost: d.customs ?? '0', otherCost: '0', expectedTotal: d.expected, distributed: d.distributed ?? '0', documentIds: [], status: d.status ?? 'open', createdAt: daysAgo(d.days ?? 10), version: 1, sold: d.sold ?? '0', inStockCost: d.inStock ?? '0' };
    donors.unshift(x);
    return x;
  };
  const dView = (x: any) => {
    const total = ['purchasePrice', 'deliveryCost', 'customsCost', 'otherCost'].reduce((a, k) => a + Number(x[k]), 0);
    return { ...x, totalCost: total.toFixed(2), undistributed: (total - Number(x.distributed)).toFixed(2), payback: total ? ((Number(x.sold) / total) * 100).toFixed(1) : null };
  };
  mkDonor('Toyota Camry 40 2008, 2AZ, АКПП', { year: 2008, vin: 'JTNBE46K803123456', engine: '2AZ-FE', transmission: 'U241E', purchase: '280000', delivery: '45000', customs: '38000', expected: '720000', distributed: '214000', sold: '236500', inStock: '96000', days: 34 });
  mkDonor('Honda Fit GD1 2004, L13A, вариатор', { year: 2004, engine: 'L13A', transmission: 'CVT', purchase: '95000', delivery: '20000', expected: '260000', distributed: '115000', sold: '131000', inStock: '0', status: 'closed', days: 120 });

  const err = (status: number, code: string, message: string, details?: unknown) => ({ error: { status, code, message, details } });
  const ok = (data: unknown, status = 200) => ({ status, data });
  const mkDoc = async (b: any) => {
    const r: any = await stock('documents', 'post', {}, b);
    return r && 'data' in r ? r.data : null;
  };

  return async (url: string, method: string, params: Record<string, any>, body: any): Promise<Res> => {
    // файлы (демо: только имя)
    if (url === 'files' && method === 'post') {
      const f = body instanceof FormData ? (body.get('file') as File | null) : null;
      const id = uid();
      files[id] = f?.name ?? 'file.xlsx';
      return ok({ id, originalName: files[id], mime: f?.type ?? '', size: f?.size ?? 0 }, 201);
    }

    // ── поставщики
    if (url === 'counterparties' && method === 'get' && (params.role === 'supplier' || params.role === 'neighbor')) {
      const q = String(params.q ?? '').toLowerCase();
      const list = suppliers.filter((s) => s.roles.includes(params.role) && (!q || (s.name + (s.phone ?? '')).toLowerCase().includes(q)));
      return ok({ items: list.map(({ messengers, supplierTerms, debts, contacts, ...s }) => (void messengers, void supplierTerms, void debts, void contacts, s)), total: list.length });
    }
    if (url === 'counterparties' && method === 'post' && (body.roles ?? []).some((r: string) => r === 'supplier' || r === 'neighbor')) {
      if (body.phone && suppliers.some((s) => s.phone === body.phone) && !body.confirmDuplicatePhone) return err(409, 'DUPLICATE_PHONE', 'С этим телефоном уже есть контрагент');
      const s = sup(uid(), body.name, body.roles, { phone: body.phone, inn: body.inn, address: body.address, messengers: body.messengers, terms: body.supplierTerms, note: body.note });
      suppliers.push(s);
      return ok(s, 201);
    }
    let m = url.match(/^counterparties\/([\w-]+)(\/card)?$/);
    if (m) {
      const s = suppliers.find((x) => x.id === m![1]);
      if (s) {
        if (method === 'patch') {
          Object.assign(s, { name: body.name ?? s.name, kind: body.kind ?? s.kind, phone: body.phone ?? null, inn: body.inn ?? null, address: body.address ?? null, roles: body.roles ?? s.roles, messengers: body.messengers ?? s.messengers, supplierTerms: body.supplierTerms ?? s.supplierTerms, note: body.note ?? null, version: s.version + 1 });
          for (const l of lists) if (l.supplierId === s.id) l.supplierName = s.name;
        }
        return ok(s);
      }
    }

    // ── прайсы
    if (url === 'price-lists/fields') return ok(fields);
    if (url === 'price-lists/search') {
      const q = norm(String(params.q ?? ''));
      if (q.length < 3) return ok([]);
      const out: any[] = [];
      for (const l of lists.filter((x) => x.isActive))
        for (const r of rows[l.id])
          if (r.normalized.startsWith(q) || (q === norm('04465-33450') && ['AN690WK', 'SP1376'].includes(r.normalized)))
            out.push({ ...r, priceListId: l.id, priceListName: l.name, supplierId: l.supplierId, supplierName: l.supplierName, priceKgs: String(r2(Number(r.price) * (RATES[r.currency] ?? 1))), analog: r.normalized.startsWith(q) ? null : { via: '04465-33450' } });
      return ok(out.sort((a, b) => Number(a.priceKgs) - Number(b.priceKgs)).slice(0, 50));
    }
    if (url === 'price-lists' && method === 'get') return ok(lists.filter((l) => !params.supplierId || l.supplierId === params.supplierId).map(listItem));
    if (url === 'price-lists' && method === 'post') {
      const l: any = { id: uid(), name: body.name, supplierId: body.supplierId, supplierName: supName(body.supplierId), currency: body.currency ?? 'KGS', url: body.url ?? null, schedule: body.schedule ?? null, status: 'empty', rowsCount: 0, loadedAt: null, lastError: null, isActive: true, defaultLeadDays: body.defaultLeadDays ?? null, version: 1, headerRow: 1, mapping: {}, loads: [] };
      lists.push(l);
      rows[l.id] = [];
      return ok(l, 201);
    }
    m = url.match(/^price-lists\/([\w-]+)(?:\/(preview|load|rows))?$/);
    if (m) {
      const l = lists.find((x) => x.id === m![1]);
      if (!l) return err(404, 'NOT_FOUND', 'Прайс не найден');
      const act = m[2];
      if (!act && method === 'get') return ok(listView(l));
      if (!act && method === 'patch') {
        Object.assign(l, { url: body.url !== undefined ? body.url : l.url, schedule: body.schedule !== undefined ? body.schedule : l.schedule, currency: body.currency ?? l.currency, defaultLeadDays: body.defaultLeadDays !== undefined ? body.defaultLeadDays : l.defaultLeadDays, isActive: body.isActive ?? l.isActive, name: body.name ?? l.name, version: l.version + 1 });
        return ok(listView(l));
      }
      if (!act && method === 'delete') {
        lists.splice(lists.indexOf(l), 1);
        return ok(null, 204);
      }
      if (act === 'preview') {
        const columns = ['Производитель', 'Артикул', 'Наименование', 'Цена, сом', 'Наличие', 'Срок', 'Примечание'];
        const sample = products.slice(0, 8).map((p, i) => [p.brandName ?? '', p.mainNumber ?? p.sku, p.name, String(Math.round(cost(p) * 1.05)), i % 3 ? String(3 + i) : '>10', '2', i === 2 ? 'новинка' : '']);
        const saved = Object.keys(l.mapping).length > 0;
        return ok({ columns, sample, totalRows: 4812, mapping: saved ? l.mapping : { brand: 0, number: 1, name: 2, price: 3, stock: 4, leadDays: 5 }, mappingSource: saved ? 'saved' : 'guessed', fields });
      }
      if (act === 'load') {
        if (!body.fileId && !l.url) return err(400, 'FILE_REQUIRED', 'Загрузите файл или укажите ссылку');
        l.status = 'loading';
        if (body.mapping) l.mapping = body.mapping;
        const load = { id: uid(), source: body.fileId ? 'file' : 'url', status: 'running', rows: 0, added: 0, updated: 0, removed: 0, priceChanges: 0, skipped: 0, crossesAdded: 0, error: null, createdAt: now(), finishedAt: null };
        l.loads.unshift(load);
        setTimeout(() => {
          if (!rows[l.id].length) {
            const src = lists.find((x) => x.id !== l.id && rows[x.id].length);
            rows[l.id] = (src ? rows[src.id] : []).map((r) => ({ ...r, id: uid(), currency: l.currency, leadDays: l.defaultLeadDays, updatedAt: now() }));
          }
          Object.assign(load, { status: 'done', rows: rows[l.id].length, added: 18, updated: rows[l.id].length - 18, priceChanges: 27, removed: 2, crossesAdded: 5, finishedAt: now() });
          Object.assign(l, { status: 'ready', rowsCount: rows[l.id].length, loadedAt: now(), version: l.version + 1 });
        }, 4000);
        return ok(load, 201);
      }
      if (act === 'rows') {
        const page = Number(params.page ?? 1);
        const limit = Number(params.limit ?? 50);
        const q = String(params.q ?? '');
        const list = rows[l.id].filter((r) => !q || r.normalized.startsWith(norm(q)) || (r.name ?? '').toLowerCase().includes(q.toLowerCase()));
        return ok({ items: list.slice((page - 1) * limit, page * limit), total: list.length });
      }
    }
    m = url.match(/^price-list-rows\/([\w-]+)\/(history|create-product)$/);
    if (m) {
      const row = Object.values(rows).flat().find((r) => r.id === m![1]);
      if (!row) return err(404, 'NOT_FOUND', 'Строка не найдена');
      if (m[2] === 'history') return ok(priceHist(row));
      const p = products[0];
      row.productId = p.id;
      return ok({ id: p.id }, 201);
    }

    // ── заказы
    if (url === 'purchase-orders' && method === 'get') {
      const st = params.status ? String(params.status).split(',') : null;
      const list = orders.filter((o) => (!st || st.includes(o.status)) && (!params.supplierId || o.supplierId === params.supplierId));
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit).map(orderItem), total: list.length });
    }
    if (url === 'purchase-orders' && method === 'post') {
      if (!body.supplierId) return err(400, 'SUPPLIER_REQUIRED', 'Укажите поставщика');
      const o = mkOrder(body.supplierId, 'draft', 0, [], { currency: body.currency, expectedAt: body.expectedAt, comment: body.comment, warehouseId: body.warehouseId });
      setOrderLines(o, body.lines ?? []);
      return ok(orderView(o), 201);
    }
    m = url.match(/^purchase-orders\/([\w-]+)(?:\/(status|receiving|message|pdf|xlsx))?$/);
    if (m && m[1] !== 'expected') {
      const o = orders.find((x) => x.id === m![1]);
      if (!o) return err(404, 'NOT_FOUND', 'Заказ не найден');
      const act = m[2];
      if (!act && method === 'get') return ok(orderView(o));
      if (!act && method === 'patch') {
        if (!['draft', 'sent', 'confirmed'].includes(o.status)) return err(409, 'ORDER_LOCKED', 'Заказ уже принят — менять нельзя');
        Object.assign(o, { warehouseId: body.warehouseId ?? null, expectedAt: body.expectedAt ?? null, comment: body.comment ?? null, ...(o.status === 'draft' && body.currency ? { currency: body.currency } : {}), ...(o.status === 'draft' && body.supplierId ? { supplierId: body.supplierId } : {}) });
        if (body.lines) setOrderLines(o, body.lines);
        o.version++;
        return ok(orderView(o));
      }
      if (act === 'status') {
        const allowed: Record<string, string[]> = { sent: ['draft'], confirmed: ['draft', 'sent'], closed: ['partially_received', 'sent', 'confirmed'], cancelled: ['draft', 'sent', 'confirmed'] };
        if (!allowed[body.status]?.includes(o.status)) return err(409, 'BAD_STATUS', 'Так статус не меняется');
        if (body.status === 'sent' && !o.lines.length) return err(400, 'NO_LINES', 'В заказе нет строк');
        o.status = body.status;
        o.history.push(hist(body.status, 0, body.note));
        if (body.status === 'sent') o.sentAt = now();
        o.version++;
        return ok(orderView(o));
      }
      if (act === 'receiving') {
        const lines = o.lines.filter((l: any) => Number(l.leftQty) > 0).map((l: any) => ({ productId: l.productId, qty: l.leftQty, price: l.price }));
        const d = await mkDoc({ type: 'receiving', warehouseId: body.warehouseId, counterpartyId: o.supplierId, counterpartyName: supName(o.supplierId), currency: o.currency, comment: `По заказу ${o.number}`, extra: { purchaseOrderId: o.id }, lines });
        if (!d) return err(500, 'DEMO', 'Не удалось создать приёмку');
        o.receivings.push({ id: d.id, number: d.number, status: 'draft', docDate: now(), totalAmount: d.totalAmount, priceDiffs: null });
        return ok(d, 201);
      }
      if (act === 'message') {
        const s = suppliers.find((x) => x.id === o.supplierId);
        const text = [`Заказ ${o.number}`, ...o.lines.map((l: any, i: number) => `${i + 1}. ${[l.supplierCode ?? l.number, l.brand, l.productName].filter(Boolean).join(' ')} — ${Number(l.qty)} ${l.unitName}`), o.comment ? `\n${o.comment}` : ''].filter(Boolean).join('\n');
        const phone = (s?.messengers?.whatsapp ?? s?.phone ?? '').replace(/\D/g, '');
        return ok({ text, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, telegramUrl: `https://t.me/share/url?url=%20&text=${encodeURIComponent(text)}` });
      }
      if (act === 'pdf') return stock('products/labels.pdf', 'post', {}, {});
      if (act === 'xlsx') return ok(new Blob(['demo'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    }

    // ── автозаказ
    if (url === 'auto-order/preview') {
      const lines = products
        .map((p, i) => {
          const rule = rules[p.id]?.[0];
          const min = rule ? Number(rule.minQty) : null;
          const daily = r2((3 + (i % 5)) / 10);
          const st = p.stock;
          const lead = i % 2 ? 1 : 2;
          if (!(rule && st <= Number(rule.minQty) + 2) && !(body.includeWithoutRules && daily * (lead + 3) > st)) return null;
          const sp = supProducts[p.id]?.[0];
          if (body.supplierId && sp?.supplierId !== body.supplierId) return null;
          const target = Math.max(rule ? Number(rule.maxQty) : 0, Math.ceil(daily * (lead + (body.coverDays ?? 14))));
          const mult = Number(sp?.multiplicity ?? 1);
          const qty = Math.max(mult, Math.ceil((target - st) / mult) * mult);
          const noSup = i === 17;
          return {
            productId: p.id, name: p.name, number: p.mainNumber, sku: p.sku, unitId: uid(), supplierId: noSup ? null : sp?.supplierId ?? null, supplierName: noSup ? null : sp?.supplierName ?? null,
            qty: String(qty), price: noSup ? null : String(cost(p)), currency: 'KGS',
            explain: { stock: String(st), expected: '0', salesLastDays: String(Math.round(daily * (body.days ?? 30))), salesLastYear: String(Math.round(daily * (body.days ?? 30) * 0.8)), dailyDemand: String(daily), min: rule?.minQty ?? null, max: rule?.maxQty ?? null, season: rule?.winterMin ? 'winter' : null, leadDays: lead, reorderPoint: String(Math.max(min ?? 0, daily * lead)), target: String(target), multiplicity: String(mult), minQty: '0' },
          };
        })
        .filter(Boolean) as any[];
      const groups = new Map<string, any>();
      for (const l of lines) {
        const k = l.supplierId ?? 'none';
        const g = groups.get(k) ?? { supplierId: l.supplierId, supplierName: l.supplierName ?? 'Без поставщика', lines: [], total: 0 };
        g.lines.push(l);
        g.total += Number(l.price ?? 0) * Number(l.qty);
        groups.set(k, g);
      }
      return ok({ storeId, season: 'winter', days: body.days ?? 30, coverDays: body.coverDays ?? 14, lines, groups: [...groups.values()].map((g) => ({ ...g, total: g.total.toFixed(2) })) });
    }
    if (url === 'auto-order/create') {
      const by = new Map<string, any[]>();
      for (const l of body.lines) by.set(l.supplierId, [...(by.get(l.supplierId) ?? []), l]);
      const created = [...by].map(([s, ls]) => {
        const o = mkOrder(s, 'draft', 0, [], { source: 'auto', comment: 'Автозаказ' });
        setOrderLines(o, ls);
        o.lines.forEach((x: any, i: number) => (x.extra = { autoOrder: ls[i].explain ?? {} }));
        return orderView(o);
      });
      return ok(created, 201);
    }

    // ── поставщики товара, запас, история
    m = url.match(/^products\/([\w-]+)\/(suppliers|stock-rules|purchase-history)$/);
    if (m) {
      const pid = m[1];
      if (m[2] === 'suppliers') {
        if (method === 'put')
          supProducts[pid] = body.items.map((it: any) => ({ id: uid(), ...it, supplierName: supName(it.supplierId), multiplicity: it.multiplicity ?? '1', minQty: it.minQty ?? '0', leadDays: it.leadDays ?? null, preferred: !!it.preferred, lastPrice: supProducts[pid]?.find((x) => x.supplierId === it.supplierId)?.lastPrice ?? null, lastCurrency: 'KGS', lastPurchaseAt: null }));
        return ok(supProducts[pid] ?? []);
      }
      if (m[2] === 'stock-rules') {
        if (method === 'put') rules[pid] = body.rules.map((r: any) => ({ id: uid(), ...r }));
        return ok(rules[pid] ?? []);
      }
      const p = products.find((x) => x.id === pid);
      if (!p) return ok([]);
      return ok([
        { documentId: uid(), number: 'ПР-000122', date: daysAgo(6), supplier: suppliers[0].name, price: String(cost(p)), currency: 'KGS', unitCostKgs: String(cost(p)), orderPrice: String(r2(cost(p) * 0.97)), qty: '10' },
        { documentId: uid(), number: 'ПР-000098', date: daysAgo(41), supplier: suppliers[1].name, price: String(r2(cost(p) * 0.94)), currency: 'KGS', unitCostKgs: String(r2(cost(p) * 0.94)), orderPrice: null, qty: '6' },
      ]);
    }

    // ── контейнеры
    if (url === 'containers-expected') return ok({});
    if (url === 'containers' && method === 'get')
      return ok(containers.filter((c) => !params.status || c.status === params.status).map((c) => ({ id: c.id, number: c.number, status: c.status, currency: c.currency, expectedOn: c.expectedOn, supplier: supName(c.supplierId), total: cView(c).total })));
    if (url === 'containers' && method === 'post') {
      const c = mkContainer('draft', 0, { comment: body.comment ?? null, costs: [], rate: body.rate ?? null, expectedOn: body.expectedOn ?? null });
      Object.assign(c, { supplierId: body.supplierId, warehouseId: body.warehouseId, currency: body.currency ?? 'USD', distribution: body.distribution ?? 'amount', lines: [] });
      return ok(cView(c), 201);
    }
    m = url.match(/^containers\/([\w-]+)(?:\/(invoice|create-products|status|receive|prepay))?$/);
    if (m) {
      const c = containers.find((x) => x.id === m![1]);
      if (!c) return err(404, 'NOT_FOUND', 'Контейнер не найден');
      const act = m[2];
      if (!act && method === 'get') return ok(cView(c));
      if (!act && method === 'patch') {
        if (body.rate) c.rate = body.rate;
        if (body.costs) c.costs = body.costs;
        if (body.expectedOn) c.expectedOn = body.expectedOn;
        if (body.distribution) c.distribution = body.distribution;
        c.version++;
        return ok(cView(c));
      }
      if (act === 'invoice') {
        const add = products.slice(9, 15).map((p, i) => ({ id: uid(), line_no: c.lines.length + i + 1, invoice_code: `HX${700 + i}`, invoice_name: p.name, product_id: i === 2 ? null : p.id, productName: i === 2 ? null : p.name, qty: String(5 + i), price: String(r2(cost(p) / RATES.USD * 0.8)), volume: '0.02', weight: '2', manual_cost: null, received_qty: '0', damaged_qty: '0' }));
        c.lines.push(...add);
        return ok({ lines: add.length, matchedByMemory: 3, matchedByNumber: 2, unmatched: 1 });
      }
      if (act === 'create-products') {
        let n = 0;
        for (const l of c.lines) if (!l.product_id) (l.product_id = products[(l.line_no * 3) % products.length].id), (l.productName = pName(l.product_id)), n++;
        return ok({ created: n });
      }
      if (act === 'status') {
        const flow = ['draft', 'paid', 'in_transit', 'customs', 'received'];
        if (flow.indexOf(body.status) < flow.indexOf(c.status)) return err(400, 'BAD_STATUS', 'Статус назад не меняется');
        c.status = body.status;
        c.history.push({ at: now(), status: body.status, by: 'Бакыт' });
        return ok(cView(c));
      }
      if (act === 'prepay') {
        c.prepayments.push({ at: now(), amount: body.amount, accountId: body.accountId, comment: body.comment ?? null });
        if (c.status === 'draft') (c.status = 'paid'), c.history.push({ at: now(), status: 'paid', by: 'Бакыт' });
        return ok(cView(c));
      }
      if (act === 'receive') {
        if (!c.rate) return err(400, 'RATE_REQUIRED', 'Укажите курс контейнера');
        if (c.lines.some((l: any) => !l.product_id)) return err(400, 'UNMATCHED', 'Есть несопоставленные строки — сопоставьте или создайте товары');
        const pick = body.lines?.length ? body.lines : c.lines.map((l: any) => ({ lineId: l.id, qty: String(Number(l.qty) - Number(l.received_qty) - Number(l.damaged_qty)) }));
        const docLines: any[] = [];
        for (const x of pick) {
          const l = c.lines.find((y: any) => y.id === x.lineId);
          if (!l) continue;
          l.received_qty = String(Number(l.received_qty) + Number(x.qty));
          l.damaged_qty = String(Number(l.damaged_qty) + Number(x.damaged ?? 0));
          if (Number(x.qty) > 0) docLines.push({ productId: l.product_id, qty: x.qty, price: String(r2(Number(l.price) * Number(c.rate) * 1.18)) });
        }
        const d = await mkDoc({ type: 'receiving', warehouseId: c.warehouseId, counterpartyId: c.supplierId, counterpartyName: supName(c.supplierId), comment: `Контейнер ${c.number}`, lines: docLines, post: body.post !== false });
        if (d) c.receivingDocumentIds.push(d.id);
        if (c.lines.every((l: any) => Number(l.received_qty) + Number(l.damaged_qty) >= Number(l.qty))) (c.status = 'received'), c.history.push({ at: now(), status: 'received', by: 'Бакыт' });
        return ok({ container: cView(c), documentId: d?.id, damaged: pick.filter((x: any) => Number(x.damaged) > 0).map((x: any) => ({ lineNo: 1, productId: '', qty: x.damaged })) });
      }
      m = null;
    }
    m = url.match(/^containers\/([\w-]+)\/lines\/([\w-]+)\/match$/);
    if (m) {
      const c = containers.find((x) => x.id === m![1]);
      const l = c?.lines.find((x: any) => x.id === m![2]);
      if (!l) return err(404, 'NOT_FOUND', 'Строка не найдена');
      l.product_id = body.productId;
      l.productName = pName(body.productId);
      return ok(l);
    }

    // ── доноры
    if (url === 'donors' && method === 'get') return ok(donors.map(dView));
    if (url === 'donors' && method === 'post') {
      const d = mkDonor(body.title, { year: body.year, vin: body.vin, engine: body.engine, transmission: body.transmission, purchase: body.purchasePrice ?? '0', delivery: body.deliveryCost, customs: body.customsCost, expected: body.expectedTotal ?? '0', days: 0 });
      d.warehouseId = body.warehouseId;
      d.otherCost = body.otherCost ?? '0';
      return ok(dView(d), 201);
    }
    m = url.match(/^donors\/([\w-]+)(\/parts)?$/);
    if (m) {
      const d = donors.find((x) => x.id === m![1]);
      if (!d) return err(404, 'NOT_FOUND', 'Донор не найден');
      if (!m[2]) return ok(dView(d));
      const v = dView(d);
      const factor = Number(d.expectedTotal) > 0 ? Number(v.totalCost) / Number(d.expectedTotal) : 0;
      let lines = body.lines.map((l: any) => ({ productId: l.productId, qty: l.qty, price: (l.cost ? Number(l.cost) : Number(l.expectedPrice ?? 0) * factor).toFixed(2) }));
      let add = lines.reduce((a: number, l: any) => a + Number(l.price) * Number(l.qty), 0);
      const left = Number(v.undistributed);
      if (body.close && add > 0) (lines = lines.map((l: any) => ({ ...l, price: ((Number(l.price) * left) / add).toFixed(2) }))), (add = left);
      if (add > left + 1) return err(400, 'OVER_DISTRIBUTED', `Распределено больше стоимости донора: осталось ${left.toFixed(2)}`);
      const doc = await mkDoc({ type: 'donor', warehouseId: d.warehouseId, comment: `${d.number}: ${d.title}`, lines, post: true });
      d.distributed = (Number(d.distributed) + add).toFixed(2);
      d.inStockCost = (Number(d.inStockCost) + add).toFixed(2);
      if (doc) d.documentIds.push(doc.id);
      if (body.close) d.status = 'closed';
      return ok({ donor: dView(d), documentId: doc?.id }, 201);
    }
    return null;
  };
}
