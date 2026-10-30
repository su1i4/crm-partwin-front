/* Демо-данные склада, документов, справочников и цен — в памяти браузера. Только для VITE_DEMO=true. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Category } from './types';

type Res = { status: number; data: unknown } | { error: { status: number; code: string; message: string; details?: unknown } } | null;

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
const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
const r2 = (n: number) => Math.round(n * 100) / 100;

const TYPE_LABEL: Record<string, string> = {
  initial_stock: 'Ввод остатков', receiving: 'Приёмка', surplus: 'Оприходование', writeoff: 'Списание', resort: 'Пересортица',
  transfer: 'Перемещение', inventory: 'Инвентаризация', supplier_return: 'Возврат поставщику', sale: 'Продажа', donor: 'Приход с донора',
};
const PREFIX: Record<string, string> = { initial_stock: 'ВО', receiving: 'ПР', surplus: 'ОП', writeoff: 'СП', resort: 'ПС', transfer: 'ПМ', inventory: 'ИН', supplier_return: 'ВП', donor: 'ДН' };

/** Маленький валидный PDF «Этикетки» — чтобы кнопки печати открывали файл */
const pdfBlob = (title: string) =>
  new Blob(
    [`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 164 113]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 44>>stream\nBT /F1 10 Tf 10 60 Td (${title.replace(/[^\x20-\x7e]/g, '')}) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`],
    { type: 'application/pdf' },
  );

/** Стабильный id места по складу и коду — чтобы задания склада в демо ссылались на те же ячейки */
export const locId = (w: string, code: string) => {
  let h = 0;
  for (const ch of w + code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `00000000-0000-4000-9000-${h.toString(16).padStart(12, '0')}`;
};

export function createDemoStock(products: P[], storeId: string, cats: Category[]) {
  const W1 = '00000000-0000-4000-8000-000000000841';
  const W2 = '00000000-0000-4000-8000-000000000842';
  const warehouses = [
    { id: W1, storeId, name: 'Торговый зал', code: 'ТЗ', type: 'sales_floor', storageLevel: 1, isActive: true, version: 1 },
    { id: W2, storeId, name: 'Склад Дордой, конт. 214', code: 'СК', type: 'storage', storageLevel: 2, isActive: true, version: 1 },
    { id: '00000000-0000-4000-8000-000000000843', storeId, name: 'Брак', code: 'БР', type: 'defect', storageLevel: 1, isActive: true, version: 1 },
    { id: '00000000-0000-4000-8000-000000000844', storeId: null, name: 'В пути', code: 'ТР', type: 'transit', storageLevel: 1, isActive: true, version: 1 },
  ];
  const whName = (id: string | null) => warehouses.find((w) => w.id === id)?.name ?? null;
  const prod = (id: string) => products.find((p) => p.id === id);
  const cost = (p: P) => r2(Number(p.retailPrice ?? 0) * 0.62);

  // остатки и места
  const bal: Record<string, Record<string, number>> = { [W1]: {}, [W2]: {} };
  const places: Record<string, Record<string, string>> = { [W1]: {}, [W2]: {} };
  products.forEach((p, i) => {
    bal[W1][p.id] = p.stock;
    if (i % 3 === 0) bal[W2][p.id] = 2 + (i % 5);
    if (i % 4 !== 1) places[W1][p.id] = `Стеллаж ${1 + (i % 4)}, полка ${1 + (i % 3)}`;
    if (i % 3 === 0 && i % 2 === 0) places[W2][p.id] = `А-${String(1 + ((i / 6) % 6)).padStart(2, '0')}`;
  });
  bal[W1][products[16].id] = -1; // один товар в минусе — подсветка
  const total = (pid: string) => Object.values(bal).reduce((a, b) => a + (b[pid] ?? 0), 0);

  const moves: any[] = [];
  const supplier = { id: '00000000-0000-4000-8000-000000000951', name: 'ОсОО «Азия Партс»' };

  // документы
  const docs: any[] = [];
  let seq = 120;
  const mkLine = (p: P, qty: number, price: number | null, n: number, extra: any = {}) => ({
    id: uid(), lineNo: n, productId: p.id, productName: p.name, sku: p.sku, baseUnit: p.baseUnit, isSerial: false, mainNumber: p.mainNumber,
    unitId: null, unitName: null, factor: '1', qty: String(qty), baseQty: String(qty), price: price == null ? null : String(price),
    amount: price == null ? null : String(r2(price * qty)), unitCost: String(cost(p)), costAmount: String(r2(cost(p) * qty)),
    productToId: extra.productToId ?? null, productToName: extra.productToId ? prod(extra.productToId)?.name ?? null : null, place: extra.place ?? null, extra: { ...(extra.reason ? { reason: extra.reason } : {}) },
  });
  const totals = (d: any) => {
    d.totalQty = String(d.lines.reduce((a: number, l: any) => a + Number(l.qty), 0));
    const withPrice = d.lines.filter((l: any) => l.price != null);
    d.totalAmount = withPrice.length ? String(r2(withPrice.reduce((a: number, l: any) => a + Number(l.amount ?? 0), 0))) : null;
  };
  const mkDoc = (type: string, status: string, days: number, lines: any[], extra: any = {}) => {
    const d: any = {
      id: uid(), type, typeLabel: TYPE_LABEL[type], number: `${PREFIX[type] ?? 'ДК'}-${String(++seq).padStart(6, '0')}`, docDate: daysAgo(days), status,
      deletionMark: false, storeId, warehouseId: extra.warehouseId ?? W1, warehouseToId: extra.warehouseToId ?? null,
      counterpartyId: extra.counterparty?.id ?? null, currency: extra.currency ?? 'KGS', rate: extra.currency === 'USD' ? '87.4' : '1',
      hasNegative: false, comment: extra.comment ?? null, transferState: extra.transferState ?? null, version: 1, createdAt: daysAgo(days),
      extra: extra.extra ?? {}, counterparty: extra.counterparty ?? null, lines, links: [], attachments: [], baseDocumentId: null,
    };
    totals(d);
    docs.unshift(d);
    return d;
  };
  mkDoc('initial_stock', 'posted', 40, products.slice(0, 12).map((p, i) => mkLine(p, p.stock + 3, cost(p), i + 1)), { comment: 'Ввод остатков при запуске' });
  mkDoc('receiving', 'posted', 6, [mkLine(products[0], 10, 2900, 1), mkLine(products[3], 30, 380, 2), mkLine(products[6], 40, 560, 3)], {
    counterparty: supplier, extra: { supplierInvoiceNumber: 'АП-5521', supplierInvoiceDate: daysAgo(6).slice(0, 10) }, comment: 'Контейнер из Урумчи',
  });
  mkDoc('writeoff', 'posted', 4, [mkLine(products[15], 2, null, 1, { reason: 'defect' })], { comment: 'Перегорели при проверке' });
  mkDoc('transfer', 'posted', 2, [mkLine(products[4], 10, null, 1), mkLine(products[12], 4, null, 2)], { warehouseId: W2, warehouseToId: W1, transferState: 'in_transit' });
  mkDoc('receiving', 'draft', 0, [mkLine(products[8], 2, 4100, 1), mkLine(products[13], 3, 6200, 2)], { counterparty: supplier, comment: 'Черновик — ждём машину' });
  mkDoc('writeoff', 'awaiting_approval', 1, [mkLine(products[17], 1, null, 1, { reason: 'damage' })], { comment: 'Разбит при выгрузке' });
  mkDoc('resort', 'draft', 1, [mkLine(products[1], 1, null, 1, { productToId: products[2].id })]);
  for (const d of docs.filter((x) => x.status === 'posted').reverse())
    for (const l of d.lines) {
      const sign = ['writeoff', 'supplier_return'].includes(d.type) ? -1 : 1;
      moves.push({ id: uid(), movedAt: d.docDate, kind: sign > 0 ? 'in' : 'out', qty: String(sign * Number(l.qty)), costAmount: l.costAmount, warehouseId: d.warehouseId, warehouseName: whName(d.warehouseId), documentId: d.id, number: d.number, type: d.type, productId: l.productId });
    }

  const listItem = (d: any) => {
    const { lines, links, attachments, extra, counterparty, rate, baseDocumentId, ...rest } = d;
    void lines; void links; void attachments; void extra; void rate; void baseDocumentId;
    return { ...rest, warehouseName: whName(d.warehouseId), warehouseToName: whName(d.warehouseToId), counterpartyName: counterparty?.name ?? null };
  };
  const view = (d: any) => ({ ...d, warehouse: d.warehouseId ? { id: d.warehouseId, name: whName(d.warehouseId) } : null, warehouseTo: d.warehouseToId ? { id: d.warehouseToId, name: whName(d.warehouseToId) } : null });

  const applyLines = (d: any, input: any[]) => {
    d.lines = input.map((l, i) => {
      const p = prod(l.productId);
      if (!p) return null;
      const line = mkLine(p, Number(l.qty), l.price != null && l.price !== '' ? Number(l.price) : null, i + 1, { productToId: l.productToId, place: l.place, reason: l.reason });
      return line;
    }).filter(Boolean);
    totals(d);
  };
  const post = (d: any) => {
    const errs: any[] = [];
    const sign = ['writeoff', 'supplier_return', 'resort', 'transfer'].includes(d.type) ? -1 : 1;
    if (sign < 0)
      d.lines.forEach((l: any) => {
        const have = bal[d.warehouseId]?.[l.productId] ?? 0;
        if (have < Number(l.qty)) errs.push({ line: l.lineNo, message: `«${l.productName}»: на складе ${have}, нужно ${Number(l.qty)}` });
      });
    if (errs.length) return { error: { status: 422, code: 'STOCK_NOT_ENOUGH', message: 'Не хватает остатка', details: errs } };
    if (d.type === 'writeoff' && d.status === 'draft' && d.lines.some((l: any) => Number(l.costAmount) > 5000)) {
      d.status = 'awaiting_approval';
      return null;
    }
    for (const l of d.lines) {
      bal[d.warehouseId] ??= {};
      bal[d.warehouseId][l.productId] = (bal[d.warehouseId][l.productId] ?? 0) + sign * Number(l.qty);
      moves.unshift({ id: uid(), movedAt: now(), kind: sign > 0 ? 'in' : 'out', qty: String(sign * Number(l.qty)), costAmount: l.costAmount, warehouseId: d.warehouseId, warehouseName: whName(d.warehouseId), documentId: d.id, number: d.number, type: d.type, productId: l.productId });
      if (d.type === 'resort' && l.productToId) bal[d.warehouseId][l.productToId] = (bal[d.warehouseId][l.productToId] ?? 0) + Number(l.qty);
      if (d.type === 'transfer' && d.warehouseToId) d.transferState = 'in_transit';
    }
    d.status = 'posted';
    return null;
  };

  // инвентаризации
  const inventories: Record<string, any> = {};
  const mkInventory = (warehouseId: string, ids: string[], comment: string | null) => {
    const d = mkDoc('inventory', 'draft', 0, [], { warehouseId, comment });
    const inv = {
      id: d.id, number: d.number, status: 'draft', docDate: d.docDate, warehouseId, comment, version: 1, extra: {},
      sheets: [{ id: uid(), name: 'Лист 1', assignedTo: null, status: 'open' }],
      counts: {} as Record<string, number>, ids,
    };
    inventories[d.id] = inv;
    return inv;
  };
  const invView = (inv: any) => {
    const rows = inv.ids.map((pid: string) => {
      const p = prod(pid)!;
      const book = bal[inv.warehouseId]?.[pid] ?? 0;
      const counted = inv.counts[pid];
      return { productId: pid, name: p.name, sku: p.sku, baseUnit: p.baseUnit, isSerial: false, place: places[inv.warehouseId]?.[pid] ?? null, counted: counted == null ? '0' : String(counted), countedAt: counted == null ? null : now(), book: String(book), diff: counted == null ? '0' : String(counted - book) };
    });
    const counted = rows.filter((r: any) => r.countedAt);
    return {
      id: inv.id, number: inv.number, status: inv.status, docDate: inv.docDate, warehouseId: inv.warehouseId, comment: inv.comment, version: inv.version, extra: {}, sheets: inv.sheets, rows,
      lateMovements: counted.length ? [{ id: uid(), productId: rows[0].productId, name: rows[0].name, qty: '-1', movedAt: now(), receivedAt: now(), number: 'К1А-000452' }] : [],
      summary: { products: rows.length, counted: counted.length, surplus: counted.filter((r: any) => Number(r.diff) > 0).length, shortage: counted.filter((r: any) => Number(r.diff) < 0).length },
    };
  };
  {
    const inv = mkInventory(W1, products.slice(0, 10).map((p) => p.id), 'Стеллаж 1–2');
    inv.counts[products[0].id] = products[0].stock;
    inv.counts[products[1].id] = products[1].stock - 1;
    inv.counts[products[3].id] = products[3].stock + 2;
  }

  // справочники
  for (const c of cats) {
    c.version ??= 1;
    c.settings ??= c.name === 'Колодки' ? { warrantyDays: 30, returnDays: 14, returnConditions: 'Без следов установки', pairHint: true } : c.name === 'Масла и автохимия' ? { universal: true } : c.name === 'Агрегаты б/у' ? { warrantyDays: 14, returnDays: 0 } : {};
  }
  const ALIASES: Record<string, string[]> = { Toyota: ['TOYOTA', 'Тойота', 'Toyota Genuine'], Bosch: ['BOSCH', 'Бош'], Akebono: ['AKB'], '555': ['Japan 555', 'Три пятёрки'], Mobil: ['Mobil 1', 'ExxonMobil'] };
  const brands: any[] = [...new Set(products.map((p) => p.brandName))].map((n) => ({ id: uid(), name: n, aliases: ALIASES[n!] ?? [], country: n === 'Китай' ? null : n === 'Toyota' ? 'Япония' : null, isCarMaker: n === 'Toyota', isNoBrand: n === 'Китай', source: 'tenant', version: 1 }));
  const globalBrands = ['Masuma', 'Lemförder', 'TRW', 'Mann-Filter', 'Ruville', 'SKF', 'Hella', 'Valeo'].map((n, i) => ({ id: null, globalBrandId: uid(), name: n, aliases: i === 2 ? ['TRW Automotive', 'Lucas TRW'] : [], source: 'global' }));
  const at = (name: string, code: string, valueType: string, extra: any = {}) => ({ id: uid(), name, code, valueType, unit: null, required: false, filterable: true, searchable: false, options: null, version: 1, ...extra });
  const partTypes = {
    commonAttributes: [at('Сторона', 'side', 'list', { options: ['Левая', 'Правая', 'Пара'] }), at('Ось', 'axle', 'list', { options: ['Передняя', 'Задняя'] })],
    types: [
      { id: uid(), name: 'Ремень поликлиновой', code: 'belt_v', version: 1, attributes: [at('Количество рёбер', 'ribs', 'number'), at('Длина', 'length', 'number', { unit: 'мм', searchable: true })] },
      { id: uid(), name: 'Аккумулятор', code: 'battery', version: 1, attributes: [at('Ёмкость', 'capacity', 'number', { unit: 'Ач', searchable: true }), at('Полярность', 'polarity', 'list', { options: ['Прямая', 'Обратная'] }), at('Пусковой ток', 'cca', 'number', { unit: 'А' })] },
      { id: uid(), name: 'Сальник', code: 'seal', version: 1, attributes: [at('Размер', 'size', 'size', { unit: 'мм', searchable: true })] },
      { id: uid(), name: 'Шина', code: 'tire', version: 1, attributes: [at('Сезон', 'season', 'list', { options: ['Летние', 'Зимние', 'Всесезонные'] }), at('Размер', 'size', 'size', { searchable: true })] },
    ],
  };
  const crosses: any[] = [
    { id: uid(), aNumber: '04465-33450', aBrand: 'Toyota', bNumber: 'AN-690WK', bBrand: 'Akebono', crossType: 'full', source: 'manual', createdAt: daysAgo(20) },
    { id: uid(), aNumber: '04465-33450', aBrand: 'Toyota', bNumber: 'SP1376', bBrand: 'Sangsin', crossType: 'full', source: 'import', createdAt: daysAgo(30) },
    { id: uid(), aNumber: '90915-YZZE1', aBrand: 'Toyota', bNumber: '0 986 452 041', bBrand: 'Bosch', crossType: 'full', source: 'global', createdAt: daysAgo(60) },
  ];

  // цены
  const priceTypes = [
    { id: '00000000-0000-4000-8000-000000000a01', name: 'Розница', code: 'retail', currency: 'KGS', isRetail: true, sort: 0, version: 1 },
    { id: '00000000-0000-4000-8000-000000000a02', name: 'Мастера / СТО', code: 'sto', currency: 'KGS', isRetail: false, sort: 1, version: 1 },
    { id: '00000000-0000-4000-8000-000000000a03', name: 'Опт', code: 'wholesale', currency: 'KGS', isRetail: false, sort: 2, version: 1 },
  ];
  let rate = { currency: 'USD', rate: '87.40', setAt: daysAgo(1, 2) };
  const rateHistory = [
    { currency: 'USD', rate: '87.40', note: 'Курс на Дордое', setAt: daysAgo(1, 2), setByName: 'Бакыт' },
    { currency: 'USD', rate: '87.10', note: null, setAt: daysAgo(5), setByName: 'Бакыт' },
    { currency: 'USD', rate: '86.80', note: 'Нацбанк +0.5', setAt: daysAgo(12), setByName: 'Азамат' },
  ];
  const settings: any[] = [];
  let pseq = 14;
  const psLine = (p: P, typeId: string, newPrice: number) => {
    const old = typeId === priceTypes[0].id ? Number(p.retailPrice ?? 0) || null : null;
    return { id: uid(), productId: p.id, productName: p.name, sku: p.sku, priceTypeId: typeId, priceTypeName: priceTypes.find((t) => t.id === typeId)!.name, storeId: null, unitId: null, oldPrice: old == null ? null : String(old), newPrice: String(newPrice), currency: 'KGS', method: 'manual', changePercent: old ? String(r2((newPrice / old - 1) * 100)) : null, cost: String(cost(p)) };
  };
  const mkSetting = (status: string, days: number, comment: string, lines: any[]) => {
    const s = { id: uid(), number: `УЦ-${String(++pseq).padStart(6, '0')}`, status, validFrom: daysAgo(days), comment, postedAt: status === 'posted' ? daysAgo(days) : null, linesCount: lines.length, version: 1, lines };
    settings.unshift(s);
    return s;
  };
  mkSetting('posted', 9, 'Наценка 40% на тормоза', products.slice(0, 3).map((p) => psLine(p, priceTypes[0].id, Number(p.retailPrice))));
  mkSetting('draft', 0, 'Подорожание фильтров', products.filter((p) => /Фильтр/.test(p.name)).map((p) => psLine(p, priceTypes[0].id, Math.round(Number(p.retailPrice) * 1.08 / 10) * 10)));
  const generate = (g: any) => {
    let list = products;
    if (g.categoryId) {
      const ids = new Set([g.categoryId, ...cats.filter((c) => c.parentId === g.categoryId).map((c) => c.id)]);
      list = list.filter((p) => p.categoryId && ids.has(p.categoryId));
    }
    if (g.productIds) list = list.filter((p) => g.productIds.includes(p.id));
    const pct = Number(g.percent ?? 0) / 100;
    return list.map((p) => psLine(p, g.priceTypeId, Math.round((g.method === 'markup' ? cost(p) * (1 + pct) : Number(p.retailPrice) * (1 + pct)) / 10) * 10));
  };

  const err = (status: number, code: string, message: string, details?: unknown) => ({ error: { status, code, message, details } });
  const ok = (data: unknown, status = 200) => ({ status, data });

  return async (url: string, method: string, params: Record<string, any>, body: any): Promise<Res> => {
    // ── склады и остатки
    if (url === 'warehouses') return ok(warehouses);
    if (url === 'stock') {
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      const whs = params.warehouseId ? [params.warehouseId] : [W1, W2];
      let rows = products.map((p) => {
        const qty = whs.reduce((a: number, w: string) => a + (bal[w]?.[p.id] ?? 0), 0);
        return {
          productId: p.id, name: p.name, sku: p.sku, baseUnit: p.baseUnit, brandName: p.brandName, mainNumber: p.mainNumber, qty: String(qty),
          reserved: p.stock > 20 ? '2' : '0', available: String(qty - (p.stock > 20 ? 2 : 0)), inTransit: p.id === products[4].id ? '10' : '0', expected: p.id === products[8].id ? '2' : '0',
          amount: String(r2(cost(p) * qty)), unitCost: String(cost(p)),
          warehouses: whs.filter((w: string) => bal[w]?.[p.id] != null).map((w: string) => ({ warehouseId: w, qty: String(bal[w][p.id]), place: places[w]?.[p.id] ?? null })),
        };
      });
      if (params.q) {
        const t = String(params.q).toLowerCase();
        rows = rows.filter((r) => (r.name + r.sku + r.mainNumber + r.brandName).toLowerCase().includes(t));
      }
      if (params.categoryId) {
        const ids = new Set([params.categoryId, ...cats.filter((c) => c.parentId === params.categoryId).map((c) => c.id)]);
        rows = rows.filter((r) => ids.has(prod(r.productId)!.categoryId!));
      }
      if (params.onlyNegative === true || params.onlyNegative === 'true') rows = rows.filter((r) => Number(r.qty) < 0);
      else rows = rows.filter((r) => r.warehouses.length);
      return ok({ items: rows.slice((page - 1) * limit, page * limit), total: rows.length, costRecalcPending: false });
    }
    if (url === 'stock/places/suggest') {
      const all = Object.values(places[params.warehouseId] ?? {});
      const counts = all.reduce((a: Record<string, number>, p) => ((a[p] = (a[p] ?? 0) + 1), a), {});
      return ok(Object.entries(counts).filter(([p]) => !params.q || p.toLowerCase().includes(String(params.q).toLowerCase())).map(([place, n]) => ({ place, products: n })).slice(0, 10));
    }
    if (method === 'put' && url === 'stock/places') {
      places[body.warehouseId] ??= {};
      for (const id of body.productIds) if (body.place) places[body.warehouseId][id] = body.place; else delete places[body.warehouseId][id];
      return ok({ updated: body.productIds.length });
    }
    url = url.replace(/^storage\//, (x) => (/^storage\/(warehouses\/[\w-]+\/(without-place|locations|from-text-places|labels))$/.test(url) ? '' : x));
    let m = url.match(/^warehouses\/([\w-]+)\/without-place$/);
    if (m) {
      const w = m[1];
      return ok(products.filter((p) => (bal[w]?.[p.id] ?? 0) > 0 && !places[w]?.[p.id]).map((p) => ({ id: p.id, name: p.name, sku: p.sku, qty: String(bal[w][p.id]) })));
    }
    m = url.match(/^warehouses\/([\w-]+)\/locations$/);
    if (m) {
      const w = m[1];
      const codes = [...new Set(Object.values(places[w] ?? {}))];
      if (w === W1) return ok([]);
      return ok(codes.map((code) => ({ id: locId(w, code), code, name: null, kind: 'shelf', cell_type: 'storage', blocked: false, qty: String(Object.entries(places[w]).filter(([, c]) => c === code).reduce((a, [pid]) => a + (bal[w][pid] ?? 0), 0)), products: Object.values(places[w]).filter((c) => c === code).length })));
    }
    m = url.match(/^warehouses\/([\w-]+)\/from-text-places$/);
    if (m && method === 'post') return ok({ places: new Set(Object.values(places[m[1]] ?? {})).size, created: 0 });
    if (method === 'post' && (url === 'products/labels.pdf' || /^warehouses\/[\w-]+\/labels$/.test(url))) return ok(pdfBlob('Labels demo'));
    m = url.match(/^products\/([\w-]+)\/movements$/);
    if (m) {
      const pid = m[1];
      const list = moves.filter((x) => x.productId === pid).sort((a, b) => a.movedAt.localeCompare(b.movedAt));
      let b = 0;
      const out = list.map((x) => ((b += Number(x.qty)), { ...x, balance: String(b) }));
      return ok(out.reverse());
    }
    m = url.match(/^products\/([\w-]+)\/crosses$/);
    if (m) {
      const p = prod(m[1]);
      return ok(p ? crosses.filter((c) => c.aNumber === p.mainNumber || c.bNumber === p.mainNumber) : []);
    }
    if (method === 'post' && url === 'crosses') {
      const c = { id: uid(), aNumber: body.aNumber, aBrand: body.aBrand ?? null, bNumber: body.bNumber, bBrand: body.bBrand ?? null, crossType: body.crossType, source: 'manual', createdAt: now() };
      crosses.unshift(c);
      return ok(c, 201);
    }
    m = url.match(/^crosses\/([\w-]+)$/);
    if (m && method === 'delete') {
      const i = crosses.findIndex((c) => c.id === m![1]);
      if (i >= 0) crosses.splice(i, 1);
      return ok(null, 204);
    }

    // ── документы
    if (url === 'documents/meta')
      return ok({
        types: Object.entries(TYPE_LABEL).map(([code, label]) => ({ code, label, prefix: PREFIX[code] ?? '' })),
        writeoffReasons: [
          { code: 'defect', label: 'Брак' }, { code: 'damage', label: 'Бой / порча' }, { code: 'shortage', label: 'Недостача' }, { code: 'own_needs', label: 'Свои нужды' }, { code: 'other', label: 'Другое' },
        ],
      });
    if (url === 'documents/transfers/stale') return ok([]);
    if (url === 'documents' && method === 'get') {
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      let list = docs.slice();
      if (params.type) list = list.filter((d) => d.type === params.type);
      else list = list.filter((d) => d.type !== 'inventory' || true);
      if (params.status) list = list.filter((d) => d.status === params.status);
      if (params.warehouseId) list = list.filter((d) => d.warehouseId === params.warehouseId || d.warehouseToId === params.warehouseId);
      if (params.inTransit === true || params.inTransit === 'true') list = list.filter((d) => d.transferState === 'in_transit');
      if (params.q) list = list.filter((d) => (d.number + (d.comment ?? '') + (d.counterparty?.name ?? '')).toLowerCase().includes(String(params.q).toLowerCase()));
      return ok({ items: list.slice((page - 1) * limit, page * limit).map(listItem), total: list.length });
    }
    if (url === 'documents' && method === 'post') {
      if (body.type === 'receiving' && body.extra?.supplierInvoiceNumber === 'АП-5521' && !body.confirmDuplicateInvoice)
        return err(409, 'DUPLICATE_INVOICE', 'Накладная АП-5521 этого поставщика уже проведена', { documentId: docs.find((d) => d.extra?.supplierInvoiceNumber === 'АП-5521')?.id });
      const d = mkDoc(body.type, 'draft', 0, [], {
        warehouseId: body.warehouseId ?? W1, warehouseToId: body.warehouseToId, currency: body.currency, comment: body.comment, extra: body.extra,
        counterparty: body.counterpartyId ? (body.counterpartyId === supplier.id ? supplier : { id: body.counterpartyId, name: body.counterpartyName ?? 'Поставщик' }) : null,
      });
      if (body.docDate) d.docDate = body.docDate;
      applyLines(d, body.lines ?? []);
      if (body.post) {
        const e = post(d);
        if (e) return e;
      }
      return ok(view(d), 201);
    }
    m = url.match(/^documents\/([\w-]+)(?:\/([\w-]+))?$/);
    if (m) {
      const d = docs.find((x) => x.id === m![1]);
      if (!d) return err(404, 'NOT_FOUND', 'Документ не найден');
      const act = m[2];
      if (!act && method === 'get') return ok(view(d));
      if (!act && method === 'patch') {
        if (d.status === 'posted') return err(409, 'ALREADY_POSTED', 'Документ проведён');
        if (body.warehouseId) d.warehouseId = body.warehouseId;
        if (body.warehouseToId !== undefined) d.warehouseToId = body.warehouseToId;
        if (body.comment !== undefined) d.comment = body.comment;
        if (body.docDate) d.docDate = body.docDate;
        if (body.extra) d.extra = { ...d.extra, ...body.extra };
        if (body.counterpartyId !== undefined) d.counterparty = body.counterpartyId ? (body.counterpartyId === supplier.id ? supplier : { id: body.counterpartyId, name: 'Поставщик' }) : null;
        d.counterpartyId = d.counterparty?.id ?? null;
        if (body.lines) applyLines(d, body.lines);
        d.version++;
        return ok(view(d));
      }
      if (act === 'post') {
        const e = post(d);
        if (e) return e;
        d.version++;
        return ok(view(d));
      }
      if (act === 'unpost' || act === 'approve') {
        if (act === 'approve') {
          d.status = 'draft';
          const e = post(d);
          if (e) return e;
        } else d.status = 'draft';
        d.version++;
        return ok(view(d));
      }
      if (act === 'accept') {
        d.transferState = 'accepted';
        d.version++;
        return ok(view(d));
      }
      if (act === 'deletion-mark') {
        d.deletionMark = params.mark === true || params.mark === 'true';
        d.version++;
        return ok(view(d));
      }
      if (act === 'based-on') {
        const n = mkDoc(body.type, 'draft', 0, d.lines.map((l: any, i: number) => ({ ...l, id: uid(), lineNo: i + 1, price: body.type === 'writeoff' || body.type === 'transfer' ? null : l.price })), { warehouseId: d.warehouseId });
        n.baseDocumentId = d.id;
        n.links = [{ kind: 'based_on', direction: 'from', id: d.id, number: d.number, type: d.type, status: d.status, docDate: d.docDate }];
        return ok(view(n), 201);
      }
      if (act === 'attachments') return ok({ id: uid() }, 201);
      if (act === 'labels.pdf') return ok(pdfBlob(d.number));
      if (!act && method === 'delete') {
        docs.splice(docs.indexOf(d), 1);
        return ok(null, 204);
      }
    }

    // ── инвентаризации
    if (url === 'inventories' && method === 'post') {
      let ids = products.filter((p) => bal[body.warehouseId]?.[p.id] != null).map((p) => p.id);
      if (body.categoryId) {
        const cs = new Set([body.categoryId, ...cats.filter((c) => c.parentId === body.categoryId).map((c) => c.id)]);
        ids = ids.filter((id) => cs.has(prod(id)!.categoryId!));
      }
      if (body.place) ids = ids.filter((id) => (places[body.warehouseId]?.[id] ?? '').toLowerCase().includes(String(body.place).toLowerCase()));
      return ok(invView(mkInventory(body.warehouseId, ids, body.comment ?? null)), 201);
    }
    m = url.match(/^inventories\/([\w-]+)(?:\/([\w-]+))?$/);
    if (m) {
      const inv = inventories[m[1]];
      if (!inv) return err(404, 'NOT_FOUND', 'Инвентаризация не найдена');
      const act = m[2];
      if (!act) return ok(invView(inv));
      if (act === 'sheets') {
        inv.sheets.push({ id: uid(), name: body.name, assignedTo: null, status: 'open' });
        return ok(invView(inv), 201);
      }
      if (act === 'counts') {
        const pid = body.productId;
        if (!pid) return err(404, 'NOT_FOUND', 'Товар не найден');
        if (!inv.ids.includes(pid)) inv.ids.push(pid);
        inv.counts[pid] = body.mode === 'set' ? Number(body.qty) : (inv.counts[pid] ?? 0) + Number(body.qty);
        return ok({ productId: pid, name: prod(pid)?.name, counted: String(inv.counts[pid]) });
      }
      if (act === 'finish') {
        for (const pid of inv.ids) {
          const c = inv.counts[pid] ?? (body.uncountedAsZero ? 0 : undefined);
          if (c != null) bal[inv.warehouseId][pid] = c;
        }
        inv.status = 'posted';
        inv.version++;
        const d = docs.find((x) => x.id === inv.id);
        if (d) d.status = 'posted';
        return ok(invView(inv));
      }
    }

    // ── справочники каталога
    if (url === 'categories' && method === 'get') return ok(cats);
    if (url === 'categories' && method === 'post') {
      const parent = cats.find((c) => c.id === body.parentId);
      const c: Category = { id: uid(), parentId: body.parentId ?? null, name: body.name, path: '', level: parent ? parent.level + 1 : 0, sort: 99, productsCount: 0, version: 1, settings: body.settings ?? {} };
      cats.push(c);
      return ok(c, 201);
    }
    m = url.match(/^categories\/([\w-]+)$/);
    if (m) {
      const i = cats.findIndex((c) => c.id === m![1]);
      if (i < 0) return err(404, 'NOT_FOUND', 'Категория не найдена');
      if (method === 'delete') {
        if (cats.some((c) => c.parentId === cats[i].id) || cats[i].productsCount > 0) return err(409, 'CATEGORY_NOT_EMPTY', 'В группе есть подгруппы или товары — сначала перенесите их');
        cats.splice(i, 1);
        return ok(null, 204);
      }
      const c = cats[i];
      Object.assign(c, { name: body.name ?? c.name, parentId: body.parentId === undefined ? c.parentId : body.parentId, settings: body.settings ?? c.settings, version: (c.version ?? 1) + 1 });
      c.level = c.parentId ? (cats.find((x) => x.id === c.parentId)?.level ?? 0) + 1 : 0;
      return ok(c);
    }
    if (url === 'brands' && method === 'get') {
      const q = String(params.q ?? '').toLowerCase();
      const f = (b: any) => !q || (b.name + ' ' + b.aliases.join(' ')).toLowerCase().includes(q);
      return ok([...brands.filter(f), ...globalBrands.filter((g) => f(g) && !brands.some((b) => b.name === g.name))]);
    }
    if (url === 'brands' && method === 'post') {
      if (brands.some((b) => b.name.toLowerCase() === String(body.name).toLowerCase())) return err(409, 'BRAND_EXISTS', 'Такой бренд уже есть');
      const g = globalBrands.find((x) => x.globalBrandId === body.globalBrandId);
      const b = { id: uid(), name: body.name, aliases: body.aliases ?? g?.aliases ?? [], country: body.country ?? null, isCarMaker: false, isNoBrand: false, source: 'tenant', version: 1 };
      brands.push(b);
      return ok(b, 201);
    }
    m = url.match(/^brands\/([\w-]+)$/);
    if (m && method === 'patch') {
      const b = brands.find((x) => x.id === m![1]);
      if (!b) return err(404, 'NOT_FOUND', 'Бренд не найден');
      Object.assign(b, { name: body.name ?? b.name, aliases: body.aliases ?? b.aliases, country: body.country ?? b.country, version: b.version + 1 });
      return ok(b);
    }
    if (url === 'part-types' && method === 'get') return ok(partTypes);
    if (url === 'part-types' && method === 'post') {
      const t = { id: uid(), name: body.name, code: body.name.toLowerCase(), version: 1, attributes: [] };
      partTypes.types.push(t);
      return ok(t, 201);
    }
    m = url.match(/^part-types\/([\w-]+)\/attributes$/);
    if ((m || url === 'attributes') && method === 'post') {
      const a = at(body.name, body.name.toLowerCase().replace(/\s+/g, '_'), body.valueType, { unit: body.unit ?? null, options: body.options ?? null, filterable: !!body.filterable, searchable: !!body.searchable, required: !!body.required });
      (m ? partTypes.types.find((t) => t.id === m![1])!.attributes : partTypes.commonAttributes).push(a as any);
      return ok(a, 201);
    }
    m = url.match(/^attributes\/([\w-]+)$/);
    if (m && method === 'delete') {
      for (const list of [partTypes.commonAttributes, ...partTypes.types.map((t) => t.attributes)]) {
        const i = list.findIndex((a: any) => a.id === m![1]);
        if (i >= 0) list.splice(i, 1);
      }
      return ok(null, 204);
    }

    // ── цены
    if (url === 'price-types') return ok(priceTypes);
    if (url === 'rates') return ok({ current: [rate], history: rateHistory });
    if (url === 'rates/shop' && method === 'post') {
      rate = { currency: 'USD', rate: Number(body.rate).toFixed(2), setAt: now() };
      rateHistory.unshift({ currency: 'USD', rate: rate.rate, note: body.note ?? null, setAt: rate.setAt, setByName: 'Бакыт' });
      return ok(rate, 201);
    }
    if (url === 'price-settings' && method === 'get') {
      const list = settings.filter((s) => !params.status || s.status === params.status);
      return ok({ items: list.map(({ lines, ...s }) => (void lines, s)), total: list.length });
    }
    if (url === 'price-settings' && method === 'post') {
      const lines = [...(body.lines ?? []).map((l: any) => psLine(prod(l.productId)!, l.priceTypeId, Number(l.newPrice))), ...(body.generate ? generate(body.generate) : [])];
      const s = mkSetting('draft', 0, body.comment ?? '', lines);
      if (body.validFrom) s.validFrom = body.validFrom;
      else s.validFrom = now();
      return ok(s, 201);
    }
    m = url.match(/^price-settings\/([\w-]+)(?:\/(post))?$/);
    if (m) {
      const s = settings.find((x) => x.id === m![1]);
      if (!s) return err(404, 'NOT_FOUND', 'Установка цен не найдена');
      if (method === 'get') return ok(s);
      if (method === 'delete') {
        settings.splice(settings.indexOf(s), 1);
        return ok(null, 204);
      }
      if (m[2] === 'post') {
        if (s.lines.some((l: any) => !(Number(l.newPrice) > 0))) return err(422, 'LINES_INVALID', 'Есть строки без цены', s.lines.map((l: any, i: number) => (Number(l.newPrice) > 0 ? null : { line: i + 1, message: `«${l.productName}»: цена 0` })).filter(Boolean));
        s.status = 'posted';
        s.postedAt = now();
        s.version++;
        for (const l of s.lines) if (l.priceTypeId === priceTypes[0].id) { const p = prod(l.productId); if (p) p.retailPrice = Number(l.newPrice); }
        return ok({ ...s, relabel: s.lines.filter((l: any) => l.oldPrice !== l.newPrice).map((l: any) => l.productId) });
      }
      if (method === 'patch') {
        if (s.status !== 'draft') return err(409, 'ALREADY_POSTED', 'Установка цен уже проведена — создайте новую');
        if (body.comment !== undefined) s.comment = body.comment;
        if (body.lines || body.generate) s.lines = [...(body.lines ?? []).map((l: any) => psLine(prod(l.productId)!, l.priceTypeId, Number(l.newPrice))), ...(body.generate ? generate(body.generate) : [])];
        s.linesCount = s.lines.length;
        s.version++;
        return ok(s);
      }
    }
    void total;
    return null;
  };
}
