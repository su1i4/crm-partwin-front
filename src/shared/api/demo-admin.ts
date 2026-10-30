/* Демо-данные настроек, сотрудников, журнала, импорта, мастера, заказов, реализации, гарантии и заданий склада. Только для VITE_DEMO=true. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { locId } from './demo-stock';

type Res = { status: number; data: unknown } | { error: { status: number; code: string; message: string; details?: unknown } } | null;
type Handler = (url: string, method: string, params: Record<string, any>, body: any) => Res | Promise<Res>;

interface P {
  id: string;
  name: string;
  sku: string;
  mainNumber: string | null;
  brandName: string | null;
  retailPrice: string | number | null;
  stock: number;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const ago = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const s2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const ok = (data: unknown, status = 200) => ({ status, data });
const err = (status: number, code: string, message: string) => ({ error: { status, code, message } });
const data = async (h: Handler, url: string, method = 'get', params: Record<string, any> = {}, body: any = {}) => {
  const r = await h(url, method, params, body);
  return r && 'data' in r ? (r.data as any) : null;
};

export function createDemoAdmin(
  products: P[],
  stores: { id: string; name: string; code: string; timezone: string; isActive: boolean }[],
  user: { id: string; name: string; phone: string | null },
  deps: { stock: Handler; crm: Handler; pos: Handler },
) {
  const storeId = stores[0].id;
  const W1 = '00000000-0000-4000-8000-000000000841';
  const W2 = '00000000-0000-4000-8000-000000000842';
  const REG = '00000000-0000-4000-8000-000000000401';
  const prod = (id: string) => products.find((p) => p.id === id);
  const pr = (i: number) => products[i % products.length];

  // ── магазин и настройки
  const tenant: any = {
    id: '00000000-0000-4000-8000-000000000021', name: 'Автозапчасти «Тетик»', legalForm: 'ИП', inn: '20101199000123', address: 'Дордой, контейнер 214', phone: '0555 123 456', city: 'Бишкек',
    requisites: { bank: 'Оптима Банк', account: '1091820123456789', bik: '109018' }, language: 'ru', shopType: 'city', status: 'active', subscriptionUntil: '2027-01-31', onboardingCompletedAt: ago(90), version: 3,
  };
  let settingsVersion = 7;
  const settings: any = {
    negativeStock: 'warn', editOldDocumentsDays: 3, reserveDays: 3, periodCloseReminder: true, writeoffApprovalAmount: 5000, transferStaleDays: 2, belowCostSale: 'confirm', allowFreeItems: true, allowQuickCreateAtPos: true, allowOcr: true,
    deleteLineRequiresPin: false, cashHandover: true, shiftAutoCloseTime: '23:30', returnInOtherStore: true, repeatScanIncrements: true, selectionIssueDays: 3, creditBlockOverdueDays: 30, transferMatchWindowMinutes: 30,
    quickBanknotes: [100, 200, 500, 1000, 2000, 5000], summerMonths: [5, 6, 7, 8, 9], autoOrderSalesDays: 30, autoOrderCoverDays: 14, priceRounding: 10, priceTagCurrency: 'KGS', minPriceCipher: 'ПОЛУСТАНЕК',
    catalogDefaultView: 'groups', ourMakes: ['toyota', 'lexus', 'honda'], makeTreeDepth: 'generation', defaultStorageLevel: 1, offlineProductLimit: 20000, eveningSummaryTime: '21:00',
    loyaltyEnabled: true, bonusAccrualPercent: 3, bonusMaxPayPercent: 30, bonusExpireDays: 180, loyaltyLevels: [{ name: 'Серебро', threshold: '50000', percent: '3' }, { name: 'Золото', threshold: '200000', percent: '5' }], selectionDays: 3,
  };
  const storeRows: any[] = stores.map((s, i) => ({ ...s, address: ['Дордой, контейнер 214', 'ул. Жибек Жолу 412', 'Ош, рынок Кара-Суу'][i] ?? null, phone: null, registerMode: i === 1 ? 'multi' : 'single', version: 1 }));

  // ── роли и сотрудники
  const CATALOG = [
    { group: 'Касса и продажи', permissions: [['pos.use', 'Работать на кассе'], ['sales.orders', 'Заказы покупателей'], ['sales.custom_price', 'Своя цена в заказе'], ['sales.warranty', 'Гарантия'], ['deliveries.own', 'Свои доставки'], ['deliveries.manage', 'Все доставки']] },
    { group: 'Товары и цены', permissions: [['products.read', 'Видеть товары'], ['products.write', 'Менять товары'], ['products.view_cost', 'Видеть себестоимость'], ['prices.write', 'Устанавливать цены'], ['catalog.manage', 'Справочники']] },
    { group: 'Склад', permissions: [['stock.read', 'Остатки'], ['stock.receive', 'Приёмка'], ['stock.transfer', 'Перемещения'], ['stock.inventory', 'Инвентаризация'], ['stock.locations', 'Места хранения'], ['stock.tasks', 'Задания склада'], ['documents.post', 'Проводить документы']] },
    { group: 'Клиенты и деньги', permissions: [['customers.read', 'Клиенты'], ['customers.debts', 'Долги'], ['money.read', 'Счета'], ['money.write', 'Платежи и расходы'], ['money.verify_transfers', 'Сверка переводов']] },
    { group: 'Отчёты и настройки', permissions: [['reports.sales', 'Продажи'], ['reports.profit', 'Прибыль'], ['reports.staff', 'По сотрудникам'], ['settings.manage', 'Настройки магазина'], ['staff.manage', 'Сотрудники и роли'], ['audit.read', 'Журнал действий']] },
  ].map((g) => ({ group: g.group, permissions: g.permissions.map(([code, label]) => ({ code, label })) }));
  const ALL = CATALOG.flatMap((g) => g.permissions.map((p) => p.code));
  const role = (name: string, code: string | null, perms: string[], max: number, sys = true) => ({ id: uid(), name, code, description: null, isSystem: sys, maxDiscountPercent: max, permissions: perms, membersCount: 0, version: 1 });
  const roles: any[] = [
    role('Владелец', 'owner', ALL, 100),
    role('Продавец', 'seller', ['pos.use', 'products.read', 'customers.read', 'stock.read', 'sales.orders', 'sales.warranty'], 5),
    role('Кладовщик', 'storekeeper', ['stock.read', 'stock.receive', 'stock.transfer', 'stock.inventory', 'stock.locations', 'stock.tasks', 'products.read'], 0),
    role('Водитель', 'driver', ['deliveries.own'], 0),
    role('Бухгалтер', 'accountant', ['money.read', 'money.write', 'money.verify_transfers', 'reports.sales', 'reports.profit', 'customers.debts'], 0),
  ];
  const r = (code: string) => roles.find((x) => x.code === code)!;
  const member = (name: string, phone: string, rc: string[], position: string | null, extra: any = {}) => ({
    id: uid(), userId: uid(), status: 'active', isOwner: false, allStores: false, position, joinedAt: ago(200), disabledAt: null, name, phone, email: null, lastLoginAt: ago(0, 3), totpEnabled: false,
    roles: rc.map((c) => ({ id: r(c).id, name: r(c).name, code: c })), storeIds: [storeId], warehouseIds: [], ...extra,
  });
  const staff: any[] = [
    member(user.name, user.phone ?? '', ['owner'], 'Владелец', { id: '00000000-0000-4000-8000-000000000011', userId: user.id, isOwner: true, allStores: true, storeIds: [], totpEnabled: true, lastLoginAt: now() }),
    member('Айгерим Садыкова', '0700 555 101', ['seller'], 'Продавец'),
    member('Тимур Жумабеков', '0555 707 202', ['seller'], 'Старший продавец', { allStores: true, storeIds: [] }),
    member('Нурбек Алиев', '0777 303 404', ['storekeeper'], 'Кладовщик', { warehouseIds: [W2] }),
    member('Сапар (водитель)', '0709 121 212', ['driver'], 'Водитель'),
    member('Жылдыз Осмонова', '0502 888 777', ['accountant'], 'Бухгалтер', { allStores: true, storeIds: [], lastLoginAt: ago(4) }),
    member('Марат (уволен)', '0555 000 111', ['seller'], 'Продавец', { status: 'disabled', disabledAt: ago(40), lastLoginAt: ago(41) }),
  ];
  const syncCounts = () => roles.forEach((x) => (x.membersCount = staff.filter((m) => m.status === 'active' && m.roles.some((y: any) => y.id === x.id)).length));
  syncCounts();
  const invitations: any[] = [{ id: uid(), login: '0555 909 808', name: 'Эмиль', position: 'Продавец', roleIds: [r('seller').id], allStores: false, storeIds: [storeId], expiresAt: day(5), createdAt: ago(2) }];
  const driver = staff.find((m) => m.roles.some((x: any) => x.code === 'driver'))!;
  const keeper = staff.find((m) => m.roles.some((x: any) => x.code === 'storekeeper'))!;

  // ── устройства
  const devices: any[] = [
    { id: uid(), kind: 'agent', registerId: REG, storeId, name: 'Агент печати · KASSA-PC', agentVersion: '1.4.2', info: { printers: ['XP-58 (чек)', 'Xprinter 365B (этикетки)'], drawer: true }, lastSeenAt: ago(0, 0.01), revokedAt: null, series: null, lastSyncAt: null, createdAt: ago(80), online: true },
  ];
  const posDevices: any[] = [
    { id: uid(), kind: 'pos', registerId: REG, storeId, name: 'Chrome · Windows 11', agentVersion: null, info: {}, lastSeenAt: ago(0, 0.1), revokedAt: null, series: 'К1А', lastSyncAt: ago(0, 0.2), createdAt: ago(60), online: true },
    { id: uid(), kind: 'pos', registerId: REG, storeId, name: 'Chrome Mobile · Android', agentVersion: null, info: {}, lastSeenAt: ago(3), revokedAt: null, series: 'К1Б', lastSyncAt: ago(3), createdAt: ago(30), online: false },
  ];

  // ── журнал действий
  const audit: any[] = [];
  const log = (action: string, summary: string, diff: any = null, important = false, who: any = staff[0], at = now()) =>
    audit.unshift({ id: uid(), createdAt: at, action, entityType: action.split('.')[0], entityId: null, summary, diff, important, storeId, ip: '212.112.100.4', userAgent: 'Chrome 130 · Windows 11', userId: who.userId, userName: who.name, supportSessionId: null });
  [
    ['auth.login', 'Вход в систему', null, false, staff[1], ago(0, 2)],
    ['price.change', 'Цена «Колодки Toyota 04465-33450»: 4 650 → 4 850', { retailPrice: { from: '4650.00', to: '4850.00' } }, true, staff[0], ago(0, 3)],
    ['receipt.line_deleted', 'Удалена строка чека К1А-000452: Фильтр масляный ×2', { qty: { from: '2', to: '0' } }, true, staff[1], ago(0, 5)],
    ['shift.close', 'Смена №44 закрыта, расхождение −200 с', { diff: { from: '0', to: '-200' } }, true, staff[2], ago(1, 1)],
    ['document.unpost', 'Отменено проведение ПР-000318', null, true, staff[0], ago(1, 4)],
    ['settings.update', 'Настройки: «Продажа в минус» — предупреждать', { negativeStock: { from: 'forbid', to: 'warn' } }, false, staff[0], ago(3)],
    ['member.invite', 'Приглашён Эмиль (Продавец)', null, false, staff[0], ago(2)],
    ['role.update', 'Роль «Продавец»: скидка до 5%', { maxDiscountPercent: { from: 3, to: 5 } }, false, staff[0], ago(6)],
    ['receipt.discount', 'Скидка 12% в чеке К1А-000431 (выше лимита) — по PIN владельца', null, true, staff[2], ago(7)],
    ['auth.login', 'Вход в систему', null, false, staff[5], ago(4)],
  ].forEach(([a, s, d, i, w, t]) => audit.push({ id: uid(), createdAt: t, action: a, entityType: String(a).split('.')[0], entityId: null, summary: s, diff: d, important: i, storeId, ip: '212.112.100.4', userAgent: 'Chrome 130 · Windows 11', userId: (w as any).userId, userName: (w as any).name, supportSessionId: null }));

  // ── синонимы
  const own: any[] = [
    ['бочонок', 'глушитель'], ['подушка', 'опора двигателя'], ['сайлент', 'сайлентблок'], ['граната', 'шрус'], ['тормозуха', 'тормозная жидкость'], ['шаровая', 'шаровая опора'], ['лампочка', 'лампа'],
  ].map(([word, target]) => ({ id: uid(), word, target, version: 1 }));
  const global = [
    ['амортизатор', 'амортизатор'], ['аморт', 'амортизатор'], ['стойка', 'амортизатор'], ['колодки', 'колодки тормозные'], ['диски', 'диск тормозной'], ['масляник', 'фильтр масляный'], ['воздушник', 'фильтр воздушный'],
    ['салонник', 'фильтр салона'], ['свечи', 'свеча зажигания'], ['ремень грм', 'ремень ГРМ'], ['ролик', 'ролик натяжной'], ['помпа', 'насос водяной'], ['радик', 'радиатор'], ['генка', 'генератор'], ['стартер', 'стартер'],
    ['акб', 'аккумулятор'], ['дворники', 'щётки стеклоочистителя'], ['наконечник', 'наконечник рулевой'], ['тяга', 'тяга рулевая'], ['пыльник', 'пыльник шруса'], ['ступица', 'ступица'], ['подшипник', 'подшипник ступицы'],
    ['рычаг', 'рычаг подвески'], ['стабилизатор', 'стойка стабилизатора'], ['косточка', 'стойка стабилизатора'], ['термостат', 'термостат'], ['датчик кислорода', 'лямбда-зонд'], ['лямбда', 'лямбда-зонд'], ['катушка', 'катушка зажигания'],
  ].map(([word, target]) => ({ word, target }));
  const unfound = [
    { normalized: 'стойка стабилизатора ipsum 2003', example: 'косточка ипсум 2003', times: 9, lastAt: ago(0, 1), notFound: 2, noStock: 7, vehicles: ['Toyota Ipsum 2003'] },
    { normalized: 'датчик abs camry 50', example: 'датчик абс камри 50', times: 6, lastAt: ago(1), notFound: 6, noStock: 0, vehicles: ['Toyota Camry 50'] },
    { normalized: 'фара fit ge6', example: 'фара фит ge6 левая', times: 5, lastAt: ago(2), notFound: 0, noStock: 5, vehicles: ['Honda Fit GE6'] },
    { normalized: 'бачок омывателя', example: 'бачок омывателя', times: 4, lastAt: ago(3), notFound: 4, noStock: 0, vehicles: [] },
    { normalized: '48655-33060', example: '48655-33060', times: 3, lastAt: ago(5), notFound: 3, noStock: 0, vehicles: [] },
  ];

  // ── импорт
  const FIELDS: Record<string, any[]> = {
    products: [{ key: 'name', label: 'Название', required: true }, { key: 'number', label: 'Номер' }, { key: 'brand', label: 'Бренд' }, { key: 'category', label: 'Группа' }, { key: 'barcode', label: 'Штрихкод' }, { key: 'price', label: 'Цена' }, { key: 'unit', label: 'Ед.' }, { key: 'vehicles', label: 'Применимость' }],
    crosses: [{ key: 'number', label: 'Номер', required: true }, { key: 'brand', label: 'Бренд' }, { key: 'analogNumber', label: 'Номер аналога', required: true }, { key: 'analogBrand', label: 'Бренд аналога' }],
    applicability: [{ key: 'number', label: 'Номер', required: true }, { key: 'brand', label: 'Бренд' }, { key: 'vehicle', label: 'Машина', required: true }],
  };
  const jobs: any[] = [
    { id: uid(), type: 'products', status: 'done', fileName: 'Номенклатура_1С.xlsx', columns: [], mapping: {}, totalRows: 3412, processedRows: 3412, createdCount: 3120, updatedCount: 214, errorCount: 78, failReason: null, startedAt: ago(85), finishedAt: ago(85), createdAt: ago(85) },
    { id: uid(), type: 'crosses', status: 'done', fileName: 'кроссы_toyota.csv', columns: [], mapping: {}, totalRows: 18240, processedRows: 18240, createdCount: 17996, updatedCount: 0, errorCount: 244, failReason: null, startedAt: ago(40), finishedAt: ago(40), createdAt: ago(40) },
  ];
  const templates = [
    { code: '1c', title: '1С: Управление торговлей', type: 'products', howTo: 'Номенклатура → Ещё → Вывести список → Сохранить как Excel', columns: ['Наименование', 'Артикул', 'Производитель', 'Группа', 'Штрихкод', 'Цена'] },
    { code: 'moysklad', title: 'МойСклад', type: 'products', howTo: 'Товары → Экспорт → Excel', columns: ['Наименование', 'Код', 'Артикул', 'Группы', 'Цена продажи'] },
    { code: 'own', title: 'Своя таблица', type: 'products', howTo: 'Любой Excel: первая строка — заголовки', columns: ['Название', 'Номер', 'Бренд', 'Цена'] },
  ];
  const tick = () =>
    jobs.forEach((j) => {
      if (j.status === 'queued') j.status = 'running';
      else if (j.status === 'running') {
        j.processedRows = Math.min(j.totalRows, j.processedRows + Math.ceil(j.totalRows / 4));
        if (j.processedRows >= j.totalRows) Object.assign(j, { status: 'done', finishedAt: now(), createdCount: j.totalRows - 12 - 31, updatedCount: 31, errorCount: 12 });
      }
    });

  // ── заказы покупателей
  const custNames: Record<string, { name: string; phone: string | null }> = {};
  const orderLines = (pairs: [number, number][]) => pairs.map(([i, q], k) => ({ id: uid(), line_no: k + 1, product_id: pr(i).id, warehouse_id: W1, qty: String(q), price: s2(Number(pr(i).retailPrice ?? 0) * 0.92), shipped_qty: '0', name: pr(i).name }));
  const order = (n: number, customer: string, phone: string, status: string, lines: any[], extra: any = {}) => {
    const cpId = uid();
    custNames[cpId] = { name: customer, phone };
    return {
      id: uid(), number: `ЗК-${String(n).padStart(6, '0')}`, storeId, counterpartyId: cpId, status, total: s2(lines.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0) + Number(extra.deliveryCost ?? 0)),
      dueOn: null, address: null, driverId: null, deliveryCost: null, deliveryStatus: null, history: [{ at: ago(2), status: 'new', by: null }], comment: null, createdAt: ago(2), version: 1, receiptIds: [], prepaid: 0, lines, ...extra,
    };
  };
  const orders: any[] = [
    order(141, 'Эрлан — СТО «Ак-Жол»', '0700 112 233', 'reserved', orderLines([[0, 4], [3, 10], [6, 8]]), { dueOn: day(1), prepaid: 10000, comment: 'Заберут после обеда', history: [{ at: ago(2), status: 'new', by: null }, { at: ago(2), status: 'reserved', by: null }] }),
    order(140, 'ОсОО «Бишкек Логистик»', '0312 66 77 88', 'reserved', orderLines([[4, 20], [7, 16]]), { address: 'ул. Алма-Атинская 52, бокс 3', driverId: driver.id, deliveryStatus: 'on_way', deliveryCost: '300' }),
    order(139, 'Улан — СТО «Мотор»', '0702 300 300', 'partially_shipped', orderLines([[1, 2], [9, 4]]).map((l, i) => (i === 0 ? { ...l, shipped_qty: '2' } : l)), { address: 'ул. Ахунбаева 98', driverId: driver.id, deliveryStatus: 'assembled' }),
    order(138, 'Нурлан (такси)', '0779 404 404', 'new', orderLines([[5, 1], [8, 4]]), { address: 'мкр Джал 23, д. 4', deliveryStatus: null }),
    order(137, 'Эрлан — СТО «Ак-Жол»', '0700 112 233', 'shipped', orderLines([[2, 6]]).map((l) => ({ ...l, shipped_qty: l.qty })), { address: 'ул. Жибек Жолу 412', driverId: driver.id, deliveryStatus: 'paid', createdAt: ago(6) }),
    order(136, 'Гульнара Асанова', '0557 818 181', 'cancelled', orderLines([[10, 1]]), { createdAt: ago(9) }),
  ];
  const driverCash: Record<string, number> = { [driver.id]: 15300 };
  const orderRow = (o: any) => ({ id: o.id, number: o.number, status: o.status, total: o.total, dueOn: o.dueOn, address: o.address, deliveryStatus: o.deliveryStatus, driverId: o.driverId, customer: custNames[o.counterpartyId]?.name ?? '—', phone: custNames[o.counterpartyId]?.phone ?? null });
  const orderView = (o: any) => ({ ...o, prepaidRemaining: s2(o.prepaid) });
  const hist = (o: any, status: string, note?: string) => (o.history = [...o.history, { at: now(), status, by: null, ...(note ? { note } : {}) }]);

  // ── реализация
  const consignees: any[] = [
    { id: uid(), name: 'Сосед — конт. 118 (Дордой)', warehouseId: uid(), stock: { [pr(3).id]: 6, [pr(6).id]: 10, [pr(11).id]: 2 }, debt: 8400 },
    { id: uid(), name: 'Точка в Токмоке (Жаныбек)', warehouseId: uid(), stock: { [pr(0).id]: 2, [pr(4).id]: 12 }, debt: 0 },
  ];
  const consigneeRow = (c: any) => ({
    id: c.id, name: c.name, warehouseId: c.warehouseId, qty: String(Object.values(c.stock as Record<string, number>).reduce((a, b) => a + b, 0)),
    cost: s2(Object.entries(c.stock as Record<string, number>).reduce((a, [pid, q]) => a + q * Number(prod(pid)?.retailPrice ?? 0) * 0.62, 0)), debt: s2(c.debt),
  });

  // ── гарантия
  const wr = (n: number, pi: number, status: string, extra: any = {}) => ({
    id: uid(), number: `Г-${String(n).padStart(5, '0')}`, status, storeId, saleReceiptId: null, saleLineId: null, productId: products[pi].id, serialItemId: null, customerId: null, supplierId: null, qty: '1',
    complaint: 'Стучит после 2 недель', photoFileIds: [], inWarranty: true, decision: null, decisionReason: null, returnReceiptId: null, replacementReceiptId: null, decidedAt: null, decidedBy: null,
    history: [{ at: ago(5), status: 'accepted', by: null }], createdAt: ago(5), version: 1, customerName: 'Айбек Токтогулов', supplierName: null, ...extra,
  });
  const claims: any[] = [
    wr(31, 9, 'accepted', { complaint: 'Амортизатор течёт, пробег 3 000 км', createdAt: ago(0, 4), history: [{ at: ago(0, 4), status: 'accepted', by: null }] }),
    wr(30, 13, 'sent_to_supplier', { complaint: 'Не крутит, щётки целые', customerName: 'Эрлан — СТО «Ак-Жол»', supplierName: 'ОсОО «Азия Партс»', history: [{ at: ago(5), status: 'accepted', by: null }, { at: ago(4), status: 'checking', by: null }, { at: ago(3), status: 'sent_to_supplier', by: null, note: 'отправили с машиной' }] }),
    wr(29, 1, 'checking', { complaint: 'Скрипят, стёрлись за месяц', inWarranty: false, customerName: 'Нурлан (такси)', createdAt: ago(2) }),
    wr(28, 2, 'decided', { decision: 'replace', decisionReason: 'Брак пластины', customerName: 'Улан — СТО «Мотор»', supplierName: 'ОсОО «Азия Партс»', createdAt: ago(14), decidedAt: ago(10) }),
    wr(27, 7, 'decided', { decision: 'reject', decisionReason: 'Следы неправильной установки', customerName: 'Азамат', createdAt: ago(20), decidedAt: ago(18) }),
  ];
  const claimRow = (w: any) => ({ id: w.id, number: w.number, status: w.status, decision: w.decision, inWarranty: w.inWarranty, createdAt: w.createdAt, productId: w.productId, productName: prod(w.productId)?.name ?? '—', brandName: prod(w.productId)?.brandName ?? null, customerName: w.customerName, supplierName: w.supplierName, version: w.version });

  // ── задания склада (W2 адресный: ячейки А-01..А-06)
  const cell = (k: number) => locId(W2, `А-${String(1 + (k % 4)).padStart(2, '0')}`);
  const task = (n: number, kind: string, status: string, lines: any[], extra: any = {}) => ({ id: uid(), number: `ЗС-${String(n).padStart(5, '0')}`, warehouse_id: W2, kind, status, lines, assignee_id: null, assigneeName: null, source_type: null, created_at: ago(0, 3), done_at: null, version: 1, ...extra });
  const tasks: any[] = [
    task(52, 'placement', 'open', [0, 6, 12].map((i, k) => ({ productId: pr(i).id, qty: String(4 + k), fromLocationId: null, toLocationId: cell(k) })), { source_type: 'document', created_at: ago(0, 1) }),
    task(51, 'pick', 'in_progress', [[1, 2, 1], [3, 5, 2], [8, 1, 4]].map(([i, q, c]) => ({ productId: pr(i).id, qty: String(q), fromLocationId: cell(c) })), { assignee_id: keeper.id, assigneeName: keeper.name, created_at: ago(0, 2) }),
    task(50, 'count', 'open', [{ productId: pr(18).id, qty: '3', fromLocationId: cell(3) }], { created_at: ago(1) }),
    task(49, 'replenish', 'done', [{ productId: pr(24).id, qty: '6', fromLocationId: cell(5), toLocationId: cell(0), doneQty: '6' }], { assignee_id: keeper.id, assigneeName: keeper.name, created_at: ago(2), done_at: ago(2) }),
  ];
  tasks[1].lines[0].doneQty = '2';

  let onboardingDone = true;

  return async (url: string, method: string, params: Record<string, any>, body: any): Promise<Res> => {
    // ── магазин
    if (url === 'tenant' && method === 'get') return ok(tenant);
    if (url === 'tenant' && method === 'patch') {
      Object.assign(tenant, body, { version: tenant.version + 1 });
      log('tenant.update', 'Реквизиты магазина изменены');
      return ok(tenant);
    }
    if (url === 'settings' && method === 'get') return ok({ version: settingsVersion, settings });
    if (url === 'settings' && method === 'patch') {
      if (body.version !== settingsVersion) return err(409, 'VERSION_CONFLICT', 'Настройки изменил другой сотрудник — обновите страницу');
      const { version: _v, ...patch } = body;
      void _v;
      const diff = Object.fromEntries(Object.keys(patch).map((k) => [k, { from: settings[k], to: patch[k] }]));
      Object.assign(settings, patch);
      settingsVersion++;
      log('settings.update', `Настройки: ${Object.keys(patch).join(', ')}`, diff);
      return ok({ version: settingsVersion, settings });
    }
    if (url === 'stores' && method === 'get') return ok(storeRows);
    if (url === 'stores' && method === 'post') {
      const s = { id: uid(), name: body.name, code: body.code ?? body.name.slice(0, 3).toUpperCase(), address: body.address ?? null, phone: body.phone ?? null, timezone: 'Asia/Bishkek', registerMode: 'single', isActive: true, version: 1 };
      storeRows.push(s);
      if (body.createDefaults !== false) {
        const whs = await data(deps.stock, 'warehouses');
        const w = { id: uid(), storeId: s.id, name: 'Торговый зал', code: 'ТЗ', type: 'sales_floor', storageLevel: 1, isActive: true, version: 1 };
        whs?.push(w);
        (await data(deps.pos, 'registers'))?.push({ id: uid(), storeId: s.id, code: 'К1', name: 'Касса 1', warehouseId: w.id, isActive: true, version: 1 });
      }
      log('store.create', `Новая точка «${s.name}»`);
      return ok(s, 201);
    }
    let m = url.match(/^stores\/([\w-]+)$/);
    if (m && method === 'patch') {
      const s = storeRows.find((x) => x.id === m![1]);
      if (!s) return err(404, 'NOT_FOUND', 'Точка не найдена');
      const { version: _v, ...rest } = body;
      void _v;
      Object.assign(s, rest, { version: s.version + 1 });
      return ok(s);
    }
    if (url === 'warehouses' && method === 'post') {
      const whs = await data(deps.stock, 'warehouses');
      const w = { id: uid(), storeId: body.storeId ?? null, name: body.name, code: body.code ?? body.name.slice(0, 2).toUpperCase(), type: body.type, storageLevel: body.storageLevel ?? 1, isActive: true, version: 1 };
      whs?.push(w);
      return ok(w, 201);
    }
    m = url.match(/^warehouses\/([\w-]+)$/);
    if (m && method === 'patch') {
      const w = (await data(deps.stock, 'warehouses'))?.find((x: any) => x.id === m![1]);
      if (!w) return err(404, 'NOT_FOUND', 'Склад не найден');
      const { version: _v, ...rest } = body;
      void _v;
      Object.assign(w, rest, { version: (w.version ?? 1) + 1 });
      return ok(w);
    }
    if (url === 'storage/locations/generate' && method === 'post') {
      const racks = Math.max(0, Number(body.racks?.[1] ?? 1) - Number(body.racks?.[0] ?? 1) + 1);
      const places = racks * Number(body.shelves ?? 1) * Number(body.cells ?? 1);
      return ok({ places, created: places });
    }
    if (url === 'registers' && method === 'post') {
      const regs = await data(deps.pos, 'registers');
      const x = { id: uid(), storeId: body.storeId, code: body.code ?? `К${(regs?.length ?? 0) + 1}`, name: body.name ?? `Касса ${(regs?.length ?? 0) + 1}`, warehouseId: body.warehouseId ?? W1, isActive: true, version: 1 };
      regs?.push(x);
      return ok(x, 201);
    }
    m = url.match(/^registers\/([\w-]+)$/);
    if (m && method === 'patch') {
      const x = (await data(deps.pos, 'registers'))?.find((y: any) => y.id === m![1]);
      if (!x) return err(404, 'NOT_FOUND', 'Касса не найдена');
      const { version: _v, ...rest } = body;
      void _v;
      Object.assign(x, rest, { version: (x.version ?? 1) + 1 });
      return ok(x);
    }
    if (url === 'devices' && method === 'get') return ok(devices.filter((d) => !d.revokedAt));
    if (url === 'pos-devices' && method === 'get') return ok(posDevices.filter((d) => !d.revokedAt));
    if (url === 'devices/pairing-code' && method === 'post') return ok({ code: String(100000 + Math.floor(Math.random() * 899999)), expiresInSec: 600, register: { id: body.registerId, name: 'Касса 1' } });
    m = url.match(/^(devices|pos-devices)\/([\w-]+)$/);
    if (m && method === 'delete') {
      const d = [...devices, ...posDevices].find((x) => x.id === m![2]);
      if (d) d.revokedAt = now();
      log('device.revoke', `Отключено устройство «${d?.name ?? ''}»`, null, true);
      return ok(null, 204);
    }
    if (url === 'print-jobs' && method === 'post') return ok({ id: uid(), status: 'queued' }, 201);

    // ── сотрудники
    if (url === 'staff' && method === 'get') {
      let list = staff.slice();
      if (params.status) list = list.filter((x) => x.status === params.status);
      if (params.roleId) list = list.filter((x) => x.roles.some((y: any) => y.id === params.roleId));
      return ok({ items: list, total: list.length });
    }
    if (url === 'staff/invitations' && method === 'get') return ok(invitations);
    if (url === 'staff/invitations' && method === 'post') {
      const code = String(100000 + Math.floor(Math.random() * 899999));
      const inv = { id: uid(), login: body.login ?? null, name: body.name ?? null, position: body.position ?? null, roleIds: body.roleIds, allStores: !!body.allStores, storeIds: body.storeIds ?? [], expiresAt: day(body.expiresInDays ?? 7), createdAt: now() };
      invitations.unshift(inv);
      log('member.invite', `Приглашён ${inv.name ?? inv.login ?? 'сотрудник'}`);
      return ok({ ...inv, code, link: `${location.origin}/register?invite=${code}` }, 201);
    }
    m = url.match(/^staff\/invitations\/([\w-]+)$/);
    if (m && method === 'delete') {
      const i = invitations.findIndex((x) => x.id === m![1]);
      if (i >= 0) invitations.splice(i, 1);
      return ok(null, 204);
    }
    m = url.match(/^staff\/([\w-]+)(?:\/(disable|enable|reset-password))?$/);
    if (m) {
      const x = staff.find((y) => y.id === m![1]);
      if (!x) return err(404, 'NOT_FOUND', 'Сотрудник не найден');
      if (m[2] === 'disable') {
        if (x.isOwner) return err(400, 'OWNER', 'Владельца отключить нельзя');
        Object.assign(x, { status: 'disabled', disabledAt: now() });
        log('member.disable', `Отключён ${x.name}`, null, true);
        syncCounts();
        return ok(x);
      }
      if (m[2] === 'enable') return (Object.assign(x, { status: 'active', disabledAt: null }), syncCounts(), ok(x));
      if (m[2] === 'reset-password') return (log('member.reset_password', `Сброшен пароль: ${x.name}`, null, true), ok({ temporaryPassword: Math.random().toString(36).slice(2, 10) }));
      if (method === 'patch') {
        if (body.roleIds) x.roles = body.roleIds.map((id: string) => roles.find((y) => y.id === id)).filter(Boolean).map((y: any) => ({ id: y.id, name: y.name, code: y.code }));
        if (body.allStores !== undefined) x.allStores = body.allStores;
        if (body.storeIds) x.storeIds = body.storeIds;
        if (body.warehouseIds) x.warehouseIds = body.warehouseIds;
        if (body.position !== undefined) x.position = body.position;
        syncCounts();
        log('member.update', `Изменён доступ: ${x.name}`);
        return ok(x);
      }
      return ok(x);
    }
    if (url === 'roles/permissions') return ok(CATALOG);
    if (url === 'roles' && method === 'get') return ok(roles);
    if (url === 'roles' && method === 'post') {
      const x = role(body.name, null, body.permissions ?? [], body.maxDiscountPercent ?? 0, false);
      x.description = body.description ?? null;
      roles.push(x);
      log('role.create', `Новая роль «${x.name}»`);
      return ok(x, 201);
    }
    m = url.match(/^roles\/([\w-]+)$/);
    if (m) {
      const x = roles.find((y) => y.id === m![1]);
      if (!x) return err(404, 'NOT_FOUND', 'Роль не найдена');
      if (method === 'delete') {
        if (x.isSystem) return err(400, 'SYSTEM_ROLE', 'Готовую роль удалить нельзя');
        if (x.membersCount) return err(409, 'ROLE_IN_USE', 'У роли есть сотрудники');
        roles.splice(roles.indexOf(x), 1);
        return ok(null, 204);
      }
      if (method === 'patch') {
        if (x.code === 'owner') return err(400, 'SYSTEM_ROLE', 'Роль владельца не меняется');
        const { version: _v, ...rest } = body;
        void _v;
        Object.assign(x, rest, { version: x.version + 1 });
        staff.forEach((s) => s.roles.forEach((y: any) => y.id === x.id && (y.name = x.name)));
        log('role.update', `Роль «${x.name}» изменена`);
        return ok(x);
      }
    }

    // ── журнал, синонимы
    if (url === 'audit') {
      let list = audit.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (params.action) list = list.filter((a) => a.action.startsWith(params.action) || a.action.includes(params.action));
      if (params.userId) list = list.filter((a) => a.userId === params.userId);
      if (params.important === true || params.important === 'true') list = list.filter((a) => a.important);
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit), total: list.length });
    }
    if (url === 'search/synonyms' && method === 'get') return ok({ own, global });
    if (url === 'search/synonyms' && method === 'post') {
      if (own.some((x) => x.word === body.word)) return err(409, 'DUPLICATE', 'Такое слово уже есть');
      const x = { id: uid(), word: body.word, target: body.target, version: 1 };
      own.unshift(x);
      return ok(x, 201);
    }
    m = url.match(/^search\/synonyms\/([\w-]+)$/);
    if (m && method === 'delete') {
      const i = own.findIndex((x) => x.id === m![1]);
      if (i >= 0) own.splice(i, 1);
      return ok(null, 204);
    }
    if (url === 'search/unfound') return ok(unfound);

    // ── импорт
    if (url === 'imports' && method === 'get') return (tick(), ok(jobs));
    if (url === 'imports/templates') return ok(templates);
    if (url === 'imports' && method === 'post') {
      const type = body.type ?? 'products';
      const columns = type === 'products' ? ['Наименование', 'Артикул', 'Производитель', 'Группа', 'Штрихкод', 'Цена', 'Остаток'] : type === 'crosses' ? ['Номер', 'Бренд', 'Аналог', 'Бренд аналога'] : ['Номер', 'Марка', 'Модель', 'Годы'];
      const sample =
        type === 'products'
          ? products.slice(0, 8).map((p, i) => [p.name, p.mainNumber ?? p.sku, p.brandName ?? '', 'Тормозная система', i % 3 ? '' : `46${String(100000000 + i * 7919).slice(0, 11)}`, String(p.retailPrice ?? ''), String(p.stock)])
          : products.slice(0, 8).map((p) => [p.mainNumber ?? p.sku, p.brandName ?? '', `X-${p.sku}`, 'Sakura']);
      const sug: Record<string, number> = type === 'products' ? { name: 0, number: 1, brand: 2, category: 3, barcode: 4, price: 5 } : type === 'crosses' ? { number: 0, brand: 1, analogNumber: 2, analogBrand: 3 } : { number: 0, vehicle: 1 };
      const job = { id: uid(), type, status: 'uploaded', fileName: 'Номенклатура.xlsx', columns, mapping: sug, totalRows: 1250, processedRows: 0, createdCount: 0, updatedCount: 0, errorCount: 0, failReason: null, startedAt: null, finishedAt: null, createdAt: now() };
      jobs.unshift(job);
      return ok({ job, columns, sample, suggestedMapping: sug, fields: FIELDS[type] }, 201);
    }
    m = url.match(/^imports\/([\w-]+)(?:\/(preview|run|rollback))?$/);
    if (m) {
      const j = jobs.find((x) => x.id === m![1]);
      if (!j) return err(404, 'NOT_FOUND', 'Загрузка не найдена');
      if (m[2] === 'preview') {
        j.status = 'previewed';
        j.mapping = body.mapping;
        return ok({ jobId: j.id, checkedRows: 1000, totalRows: j.totalRows, partial: true, validRows: 988, errorRows: 12, errors: [{ row: 14, field: 'Цена', message: 'не число: «договорная»' }, { row: 233, field: 'Название', message: 'пусто' }, { row: 512, message: 'дубль номера в файле' }], wouldUpdate: 31, wouldCreate: 957, sample: [] });
      }
      if (m[2] === 'run') return (Object.assign(j, { status: 'queued', startedAt: now() }), log('import.run', `Импорт «${j.fileName}»`), ok(j));
      if (m[2] === 'rollback') return (j.status = 'rolled_back', log('import.rollback', `Откат импорта «${j.fileName}»`, null, true), ok({ removedProducts: j.createdCount, removedCrosses: j.type === 'crosses' ? j.createdCount : 0, notReverted: j.updatedCount ? `Обновлённые товары (${j.updatedCount}) остались как есть` : null }));
      return ok(j);
    }
    if (url === 'export/full') return ok(new Blob(['PK demo'], { type: 'application/zip' }));

    // ── мастер
    if (url === 'onboarding') {
      return ok({
        completed: onboardingDone,
        tenant: { name: tenant.name, city: tenant.city, language: 'ru', shopType: tenant.shopType },
        shopTypes: [
          { type: 'container', name: 'Контейнер на рынке', description: 'Одна-две точки, продаёт сам владелец или 1–2 продавца, много соседских подборов', suggestedRoles: ['Продавец'] },
          { type: 'city', name: 'Магазин в городе', description: 'Несколько продавцов, кассы, склад, клиенты и СТО с долгами', suggestedRoles: ['Продавец', 'Кладовщик', 'Бухгалтер'] },
          { type: 'wholesale', name: 'Опт и контейнеры', description: 'Контейнеры из Эмиратов и Китая, заказы оптовиков, доставка, реализация', suggestedRoles: ['Менеджер', 'Кладовщик', 'Водитель', 'Бухгалтер'] },
        ],
        makes: [['toyota', 'Toyota', 1], ['lexus', 'Lexus', 1], ['honda', 'Honda', 1], ['nissan', 'Nissan', 1], ['mitsubishi', 'Mitsubishi', 1], ['subaru', 'Subaru', 1], ['mazda', 'Mazda', 1], ['hyundai', 'Hyundai', 1], ['kia', 'Kia', 1], ['mercedes', 'Mercedes-Benz', 1], ['bmw', 'BMW', 1], ['audi', 'Audi', 1], ['volkswagen', 'Volkswagen', 1], ['lada', 'ВАЗ / Lada', 1], ['daewoo', 'Daewoo', 0], ['chevrolet', 'Chevrolet', 0], ['opel', 'Opel', 0], ['ford', 'Ford', 0], ['suzuki', 'Suzuki', 0], ['isuzu', 'Isuzu', 0], ['chery', 'Chery', 0], ['geely', 'Geely', 0]].map(([code, name, popular]) => ({ code, name, country: null, popular: popular ? 1 : null })),
        checklist: [
          { key: 'shop', title: 'Данные магазина', done: true },
          { key: 'products', title: 'Загрузить товары (Excel или по одному)', done: onboardingDone },
          { key: 'stock', title: 'Ввести остатки', done: onboardingDone },
          { key: 'staff', title: 'Пригласить продавцов', done: staff.length > 1 },
          { key: 'agent', title: 'Подключить принтер чеков', done: devices.length > 0 },
          { key: 'sale', title: 'Пробить первую продажу', done: onboardingDone },
        ],
      });
    }
    if (url === 'onboarding/complete' && method === 'post') {
      if (body.shopName) tenant.name = body.shopName;
      if (body.city) tenant.city = body.city;
      tenant.shopType = body.shopType;
      if (body.ourMakes) settings.ourMakes = body.ourMakes;
      onboardingDone = true;
      tenant.onboardingCompletedAt = now();
      return ok({
        ok: true,
        checklist: [
          { key: 'shop', title: 'Данные магазина', done: true },
          { key: 'products', title: 'Загрузить товары (Excel или по одному)', done: false },
          { key: 'stock', title: 'Ввести остатки', done: false },
          { key: 'staff', title: 'Пригласить продавцов', done: false },
          { key: 'agent', title: 'Подключить принтер чеков', done: false },
          { key: 'sale', title: 'Пробить первую продажу', done: false },
        ],
      });
    }

    // ── заказы и доставка
    if (url === 'sales-orders' && method === 'get') {
      let list = orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (params.status) list = list.filter((o) => o.status === params.status);
      if (params.mine === 'true') list = list.filter((o) => o.driverId === staff[0].id || !o.driverId);
      return ok(list.map(orderRow));
    }
    if (url === 'sales-orders' && method === 'post') {
      const card = await data(deps.crm, `counterparties/${body.counterpartyId}`);
      const lines = body.lines.map((l: any, k: number) => {
        const p = prod(l.productId);
        return { id: uid(), line_no: k + 1, product_id: l.productId, warehouse_id: W1, qty: String(l.qty), price: s2(Number(l.price ?? p?.retailPrice ?? 0)), shipped_qty: '0', name: p?.name ?? 'Товар' };
      });
      const o = order(142 + orders.length, card?.name ?? 'Клиент', card?.phone ?? null, body.reserve === false ? 'new' : 'reserved', lines, {
        counterpartyId: body.counterpartyId, dueOn: body.dueOn ?? null, address: body.address ?? null, driverId: body.driverId ?? null, deliveryCost: body.deliveryCost ?? null, deliveryStatus: null, comment: body.comment ?? null, createdAt: now(),
        history: [{ at: now(), status: 'new', by: null }, ...(body.reserve === false ? [] : [{ at: now(), status: 'reserved', by: null }])],
      });
      custNames[body.counterpartyId] = { name: card?.name ?? 'Клиент', phone: card?.phone ?? null };
      orders.unshift(o);
      return ok(orderView(o), 201);
    }
    m = url.match(/^sales-orders\/([\w-]+)(?:\/(prepay|ship|cancel|delivery|lines\/([\w-]+)))?$/);
    if (m) {
      const o = orders.find((x) => x.id === m![1]);
      if (!o) return err(404, 'NOT_FOUND', 'Заказ не найден');
      const act = m[2];
      if (!act) return ok(orderView(o));
      if (act.startsWith('lines/')) {
        const l = o.lines.find((x: any) => x.id === m![3]);
        l.price = s2(Number(body.price));
        o.total = s2(o.lines.reduce((a: number, x: any) => a + Number(x.qty) * Number(x.price), 0) + Number(o.deliveryCost ?? 0));
        return ok(orderView(o));
      }
      if (act === 'prepay') return (o.prepaid += Number(body.amount), hist(o, o.status, `предоплата ${body.amount}`), ok(orderView(o)));
      if (act === 'cancel') return (o.status = 'cancelled', hist(o, 'cancelled', body.reason), body.prepayment === 'refund' && (o.prepaid = 0), ok(orderView(o)));
      if (act === 'ship') {
        const want = body.lines ?? o.lines.map((l: any) => ({ lineId: l.id, qty: String(Number(l.qty) - Number(l.shipped_qty)) }));
        let sum = 0;
        for (const w of want) {
          const l = o.lines.find((x: any) => x.id === w.lineId);
          if (!l) continue;
          if (Number(w.qty) > Number(l.qty) - Number(l.shipped_qty)) return err(400, 'TOO_MUCH', `«${l.name}»: больше, чем осталось`);
          l.shipped_qty = String(Number(l.shipped_qty) + Number(w.qty));
          sum += Number(w.qty) * Number(l.price);
        }
        o.prepaid = Math.max(0, o.prepaid - sum);
        o.status = o.lines.every((l: any) => Number(l.shipped_qty) >= Number(l.qty)) ? 'shipped' : 'partially_shipped';
        if (o.address && !o.deliveryStatus) o.deliveryStatus = 'assembled';
        hist(o, o.status);
        return ok({ receiptId: uid(), total: s2(sum) });
      }
      if (act === 'delivery') {
        o.deliveryStatus = body.status;
        if (body.status === 'paid' && body.payment?.method === 'cash' && o.driverId) driverCash[o.driverId] = (driverCash[o.driverId] ?? 0) + Number(body.payment.amount);
        hist(o, body.status, body.note);
        return ok(orderView(o));
      }
    }
    if (url === 'deliveries/handover' && method === 'post') {
      const id = body.driverId ?? driver.id;
      const amount = body.amount ? Number(body.amount) : (driverCash[id] ?? 0);
      if (amount <= 0) return err(400, 'NOTHING', 'У водителя нет денег в подотчёте');
      driverCash[id] = Math.max(0, (driverCash[id] ?? 0) - amount);
      return ok({ amount: s2(amount) });
    }

    // ── реализация
    if (url === 'consignments' && method === 'get') return ok(consignees.map(consigneeRow));
    const cgn = async (id: string) => {
      let c = consignees.find((x) => x.id === id);
      if (!c) {
        const card = await data(deps.crm, `counterparties/${id}`);
        c = { id, name: card?.name ?? 'Реализатор', warehouseId: uid(), stock: {}, debt: 0 };
        consignees.push(c);
      }
      return c;
    };
    if (url === 'consignments' && method === 'post') {
      const c = await cgn(body.counterpartyId);
      body.lines.forEach((l: any) => (c.stock[l.productId] = (c.stock[l.productId] ?? 0) + Number(l.qty)));
      return ok({ id: uid(), number: `РЛ-${String(Date.now()).slice(-5)}`, status: 'posted' }, 201);
    }
    if (url === 'consignments/report' && method === 'post') {
      const c = await cgn(body.counterpartyId);
      let total = 0;
      for (const s of body.sold) {
        c.stock[s.productId] = Math.max(0, (c.stock[s.productId] ?? 0) - Number(s.qty));
        total += Number(s.qty) * Number(s.price ?? prod(s.productId)?.retailPrice ?? 0);
      }
      c.debt += total;
      return ok({ receiptId: uid(), total: s2(total) });
    }
    if (url === 'consignments/return' && method === 'post') {
      const c = await cgn(body.counterpartyId);
      body.lines.forEach((l: any) => (c.stock[l.productId] = Math.max(0, (c.stock[l.productId] ?? 0) - Number(l.qty))));
      return ok({ id: uid(), status: 'posted' }, 201);
    }
    // остатки склада реализатора — для отчёта и возврата
    if (url === 'stock' && params.warehouseId && consignees.some((c) => c.warehouseId === params.warehouseId)) {
      const c = consignees.find((x) => x.warehouseId === params.warehouseId)!;
      const items = Object.entries(c.stock as Record<string, number>)
        .filter(([, q]) => q > 0)
        .map(([pid, q]) => {
          const p = prod(pid)!;
          return { productId: pid, name: p.name, sku: p.sku, baseUnit: 'шт', brandName: p.brandName, mainNumber: p.mainNumber, qty: String(q), reserved: '0', available: String(q), inTransit: '0', expected: '0', amount: null, unitCost: null, warehouses: [] };
        });
      return ok({ items, total: items.length, costRecalcPending: false });
    }

    // ── гарантия
    if (url === 'warranty' && method === 'get') {
      let list = claims.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (params.status) list = list.filter((w) => w.status === params.status);
      return ok({ items: list.map(claimRow), total: list.length });
    }
    if (url === 'warranty/report') {
      const agg = (rows: any[]) => ({ total: rows.length, replaced: rows.filter((w) => w.decision === 'replace').length, refunded: rows.filter((w) => w.decision === 'refund').length, rejected: rows.filter((w) => w.decision === 'reject').length, open: rows.filter((w) => w.status !== 'decided').length });
      const by = (key: (w: any) => string) => [...new Set(claims.map(key))].map((k) => ({ k, ...agg(claims.filter((w) => key(w) === k)) })).sort((a, b) => b.total - a.total);
      return ok({ byBrand: by((w) => prod(w.productId)?.brandName ?? 'Без бренда').map(({ k, ...x }) => ({ brand: k, ...x })), bySupplier: by((w) => w.supplierName ?? 'Неизвестен').map(({ k, ...x }) => ({ supplier: k, supplierId: null, ...x })) });
    }
    if (url === 'warranty' && method === 'post') {
      const card = body.customerId ? await data(deps.crm, `counterparties/${body.customerId}`) : null;
      const w = wr(32 + claims.length, Math.max(0, products.findIndex((p) => p.id === body.productId)), 'accepted', { complaint: body.complaint, qty: String(body.qty ?? 1), customerId: body.customerId ?? null, customerName: card?.name ?? null, createdAt: now(), history: [{ at: now(), status: 'accepted', by: null }], inWarranty: Math.random() > 0.3 });
      claims.unshift(w);
      return ok(w, 201);
    }
    m = url.match(/^warranty\/([\w-]+)(?:\/(status|decide))?$/);
    if (m) {
      const w = claims.find((x) => x.id === m![1]);
      if (!w) return err(404, 'NOT_FOUND', 'Обращение не найдено');
      if (m[2] && body.version !== w.version) return err(409, 'VERSION_CONFLICT', 'Обращение уже изменили');
      if (m[2] === 'status') {
        w.status = body.status;
        w.history = [...w.history, { at: now(), status: body.status, by: null, ...(body.note ? { note: body.note } : {}) }];
        w.version++;
      }
      if (m[2] === 'decide') {
        Object.assign(w, { status: 'decided', decision: body.decision, decisionReason: body.reason ?? null, decidedAt: now(), version: w.version + 1 });
        w.history = [...w.history, { at: now(), status: 'decided', by: null, note: body.decision }];
      }
      return ok(w);
    }

    // ── задания склада
    if (url === 'storage/tasks' && method === 'get') {
      let list = tasks.filter((t) => !params.warehouseId || t.warehouse_id === params.warehouseId);
      if (params.status) list = list.filter((t) => t.status === params.status);
      if (params.mine === 'true') list = list.filter((t) => !t.assignee_id || t.assignee_id === staff[0].id);
      return ok(list);
    }
    if (url === 'storage/tasks/pick' && method === 'post') {
      const assignee = staff.find((s) => s.id === body.assigneeId);
      const t = task(53 + tasks.length, 'pick', 'open', body.lines.map((l: any, k: number) => ({ productId: l.productId, qty: String(l.qty), fromLocationId: cell(k + 1) })), { warehouse_id: body.warehouseId, created_at: now(), assignee_id: assignee?.id ?? null, assigneeName: assignee?.name ?? null });
      tasks.unshift(t);
      return ok(t, 201);
    }
    m = url.match(/^storage\/tasks\/([\w-]+)\/line$/);
    if (m && method === 'post') {
      const t = tasks.find((x) => x.id === m![1]);
      if (!t) return err(404, 'NOT_FOUND', 'Задание не найдено');
      const l = t.lines[body.index];
      if (!l || l.productId !== body.productId) return err(400, 'WRONG_PRODUCT', 'Не тот товар');
      const extra: any = {};
      if (t.kind === 'count') {
        l.countedQty = String(body.qty);
        extra.diff = String(Number(body.qty) - Number(l.qty));
      } else if (body.shortage) {
        l.shortage = true;
        extra.alternative = { locationId: cell(5), qty: '2' };
      }
      if (body.locationId) t.kind === 'placement' ? (l.toLocationId = body.locationId) : (l.fromLocationId = body.locationId);
      l.doneQty = String(Number(l.doneQty ?? 0) + Number(body.qty));
      t.status = t.lines.every((x: any) => Number(x.doneQty ?? 0) >= Number(x.qty) || x.shortage || x.countedQty !== undefined) ? 'done' : 'in_progress';
      if (t.status === 'done') t.done_at = now();
      t.assignee_id ??= staff[0].id;
      t.assigneeName ??= staff[0].name;
      return ok({ task: { ...t, lines: t.lines.map((x: any) => ({ ...x })) }, ...extra });
    }
    m = url.match(/^storage\/warehouses\/([\w-]+)\/replenish$/);
    if (m && method === 'post') {
      if (tasks.some((t) => t.kind === 'replenish' && t.status !== 'done')) return ok({ created: 0 });
      tasks.unshift(task(53 + tasks.length, 'replenish', 'open', [{ productId: pr(30).id, qty: '4', fromLocationId: cell(4), toLocationId: cell(1) }], { warehouse_id: m[1], created_at: now() }));
      return ok({ created: 1 });
    }
    m = url.match(/^storage\/warehouses\/([\w-]+)\/workload$/);
    if (m)
      return ok([
        { name: keeper.name, open: tasks.filter((t) => t.assignee_id === keeper.id && t.status !== 'done').length, doneWeek: 23, avgMinutes: 7.5 },
        { name: staff[0].name, open: tasks.filter((t) => t.assignee_id === staff[0].id && t.status !== 'done').length, doneWeek: 4, avgMinutes: 11 },
      ]);
    if (url === 'storage/move' && method === 'post') return ok({ ok: true });
    return null;
  };
}
