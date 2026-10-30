import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { createDemoAdmin } from './demo-admin';
import { createDemoPos } from './demo-pos';
import { createDemoCrm } from './demo-crm';
import { createDemoPurchasing } from './demo-purchasing';
import { createDemoStock } from './demo-stock';
import type { AuthResponse, Category, Dashboard, Me, ProductCard, ProductListItem, SearchItem, SearchResult } from './types';

/**
 * Демо-режим (VITE_DEMO=true): ответы как у backend, без сервера и базы.
 * Нужен, чтобы смотреть интерфейс и вёрстку. В рабочей сборке не используется.
 */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const user = {
  id: uid(1), name: 'Бакыт Асанов', phone: '0555123456', email: null, locale: 'ru' as const,
  totpEnabled: false, telegramLinked: true, lastLoginAt: new Date().toISOString(),
};
const tenants = [
  { membershipId: uid(11), tenantId: uid(21), tenantName: 'Автозапчасти «Тетик»', tenantStatus: 'active', isOwner: true, onboardingCompleted: true },
  { membershipId: uid(12), tenantId: uid(22), tenantName: 'Japan Parts Ош', tenantStatus: 'trial', isOwner: false, onboardingCompleted: true },
];
const stores = [
  { id: uid(31), name: 'Дордой, контейнер 214', code: 'ДОР', timezone: 'Asia/Bishkek', registerMode: 'single' as const, isActive: true },
  { id: uid(32), name: 'Магазин на Жибек Жолу', code: 'ЖЖ', timezone: 'Asia/Bishkek', registerMode: 'multi' as const, isActive: true },
  { id: uid(33), name: 'Склад Ош', code: 'ОШ', timezone: 'Asia/Bishkek', registerMode: 'single' as const, isActive: true },
];

const PERMS = ['dashboard.owner', 'products.read', 'products.write', 'products.view_cost', 'pos.use', 'requests.read', 'requests.write', 'stock.receive', 'reports.sales', 'reports.money',
  'catalog.manage', 'documents.read', 'documents.write', 'documents.post', 'documents.unpost', 'stock.read', 'stock.transfer', 'stock.writeoff_approve', 'stock.inventory', 'stock.labels', 'stock.locations', 'prices.read', 'prices.write',
  'purchasing.suppliers', 'purchasing.pricelists', 'purchasing.orders', 'purchasing.containers',
  'customers.read', 'customers.write', 'customers.debts', 'customers.bonuses', 'money.read', 'money.write', 'money.verify_transfers', 'reports.profit', 'reports.stock', 'reports.staff', 'reports.export', 'sales.warranty',
  'sales.orders', 'sales.custom_price', 'deliveries.own', 'deliveries.manage', 'stock.tasks', 'settings.manage', 'staff.manage', 'audit.read'];

const me = (): Me => ({
  user,
  tenant: { id: uid(21), name: tenants[0].tenantName, status: 'active', shopType: 'city', language: 'ru', subscriptionUntil: '2027-01-31', onboardingCompleted: true },
  membership: { id: uid(11), isOwner: true, allStores: true, storeIds: null, roles: [{ id: uid(41), name: 'Владелец', code: 'owner' }], permissions: PERMS, maxDiscountPercent: null },
  stores,
});

const cats: Category[] = [
  ['Техобслуживание', null, 342], ['Двигатель', null, 518], ['Подвеска и рулевое', null, 731], ['Тормозная система', null, 406],
  ['Трансмиссия', null, 188], ['Электрика', null, 295], ['Охлаждение и кондиционер', null, 121], ['Кузов и оптика', null, 264],
  ['Масла и автохимия', null, 157], ['Шины и диски', null, 96], ['Агрегаты б/у', null, 38],
].map(([name, , count], i) => ({ id: uid(100 + i), parentId: null, name: name as string, path: `${i}.`, level: 0, sort: i, productsCount: count as number }));
const sub = (parent: number, names: string[]) =>
  names.forEach((n, j) => cats.push({ id: uid(200 + parent * 10 + j), parentId: uid(100 + parent), name: n, path: `${parent}.${j}.`, level: 1, sort: j, productsCount: 20 + ((parent * 7 + j * 13) % 90) }));
sub(0, ['Фильтры', 'Свечи', 'Ремни и ролики', 'Щётки стеклоочистителя']);
sub(2, ['Амортизаторы', 'Рычаги', 'Шаровые', 'Сайлентблоки', 'Ступицы']);
sub(3, ['Колодки', 'Диски', 'Суппорты', 'Тормозная жидкость']);
sub(5, ['Аккумуляторы', 'Лампы', 'Датчики']);

type Seed = [string, string, string, ProductListItem['qualityClass'], number, number, string];
const seeds: Seed[] = [
  ['Колодки тормозные передние', 'Toyota', '04465-33450', 'original', 4850, 7, 'Колодки'],
  ['Колодки тормозные передние', 'Akebono', 'AN-690WK', 'oem', 3200, 12, 'Колодки'],
  ['Колодки тормозные передние', 'Sangsin', 'SP1376', 'aftermarket', 2100, 24, 'Колодки'],
  ['Фильтр масляный', 'Toyota', '90915-YZZE1', 'original', 650, 46, 'Фильтры'],
  ['Фильтр масляный', 'Bosch', '0 986 452 041', 'aftermarket', 420, 80, 'Фильтры'],
  ['Фильтр воздушный Camry 40', 'Sakura', 'A-1181', 'aftermarket', 780, 15, 'Фильтры'],
  ['Свеча зажигания иридиевая', 'NGK', 'ILKAR7B11', 'oem', 980, 64, 'Свечи'],
  ['Свеча зажигания', 'Denso', 'K20HR-U11', 'oem', 410, 120, 'Свечи'],
  ['Амортизатор передний левый', 'KYB', '339025', 'aftermarket', 6900, 4, 'Амортизаторы'],
  ['Стойка стабилизатора передняя', 'CTR', 'CLT-42', 'aftermarket', 1150, 18, 'Рычаги'],
  ['Шаровая опора нижняя', '555', 'SB-3882', 'oem', 1450, 9, 'Шаровые'],
  ['Граната наружная (ШРУС)', 'GKN', '304905', 'aftermarket', 5400, 3, 'Трансмиссия'],
  ['Ремень поликлиновой 6PK1200', 'Gates', '6PK1200', 'aftermarket', 890, 22, 'Ремни и ролики'],
  ['Аккумулятор 75Ач обратная', 'Varta', '575 413 068', 'aftermarket', 9800, 6, 'Аккумуляторы'],
  ['Масло моторное 5W-30 4л', 'Mobil', '152566', 'original', 4200, 35, 'Масла и автохимия'],
  ['Лампа H4 галоген', 'Philips', '12342PRC1', 'oem', 380, 54, 'Лампы'],
  ['Сайлентблок переднего рычага', 'Febest', 'TAB-034', 'aftermarket', 690, 0, 'Сайлентблоки'],
  ['Датчик ABS передний правый', 'Китай', '89542-33030', 'copy', 1300, 2, 'Датчики'],
  ['Двигатель 2AZ-FE контрактный', 'Toyota', 'ENG-2AZ-0117', 'used', 98000, 1, 'Агрегаты б/у'],
  ['Диск тормозной передний', 'Brembo', '09.A713.11', 'aftermarket', 3600, 8, 'Диски'],
];
const products: (ProductListItem & { stock: number })[] = seeds.map(([name, brand, number, qc, price, stock, cat], i) => ({
  id: uid(1000 + i),
  sku: String(5100 + i).padStart(6, '0'),
  name,
  kind: 'goods',
  qualityClass: qc,
  qualityLabel: { original: 'Оригинал', oem: 'OEM', aftermarket: 'Аналог', copy: 'Копия (Китай)', used: 'Б/у контракт' }[qc],
  status: 'active',
  noStockControl: false,
  isSerial: qc === 'used',
  priceNegotiable: qc === 'used',
  quickCreated: i % 7 === 3,
  baseUnit: name.startsWith('Масло') ? 'шт' : 'шт',
  tags: [],
  version: 1,
  updatedAt: new Date(Date.now() - i * 3_600_000 * 5).toISOString(),
  brandId: uid(500 + i),
  brandName: brand,
  categoryId: cats.find((c) => c.name === cat)?.id ?? null,
  categoryName: cat,
  mainNumber: number,
  photoFileId: null,
  retailPrice: String(price),
  retailCurrency: 'KGS',
  stock,
}));

const hours = Array.from({ length: 12 }, (_, i) => i + 9);
const dashboard = (period: string): Dashboard => ({
  today: new Date().toISOString().slice(0, 10),
  role: 'owner',
  tiles: [
    { key: 'revenue', today: 186450, yesterday: 171200, weekAgo: 158900, vsYesterday: 8.9, vsWeekAgo: 17.3 },
    { key: 'profit', today: 52310, yesterday: 49870, weekAgo: 41020, vsYesterday: 4.9, vsWeekAgo: 27.5 },
    { key: 'receipts', today: 64, yesterday: 71, weekAgo: 58, vsYesterday: -9.9, vsWeekAgo: 10.3 },
    { key: 'avg', today: 2913, yesterday: 2411, weekAgo: 2739, vsYesterday: 20.8, vsWeekAgo: 6.4 },
  ],
  chart:
    period === 'today'
      ? hours.map((h) => ({ x: h, revenue: Math.round(6000 + Math.sin(h / 1.7) * 5200 + (h % 3) * 3100 + (h > 15 ? 6000 : 0)) }))
      : Array.from({ length: period === 'week' ? 7 : 30 }, (_, i) => {
          const d = new Date(Date.now() - (period === 'week' ? 6 - i : 29 - i) * 86_400_000);
          return { x: d.toISOString().slice(0, 10), revenue: Math.round(140000 + Math.sin(i / 2) * 32000 + (i % 4) * 9000) };
        }),
  topProducts: [
    { id: products[14].id, name: 'Масло Mobil 5W-30 4л', qty: 6, revenue: 25200 },
    { id: products[13].id, name: 'АКБ Varta 75Ач', qty: 2, revenue: 19600 },
    { id: products[0].id, name: 'Колодки передние Toyota', qty: 4, revenue: 19400 },
    { id: products[6].id, name: 'Свеча NGK ILKAR7B11', qty: 12, revenue: 11760 },
    { id: products[3].id, name: 'Фильтр масляный Toyota 90915-YZZE1', qty: 14, revenue: 9100 },
  ],
  byStore: [
    { id: stores[0].id, name: stores[0].name, revenue: 74120, receipts: 29 },
    { id: stores[1].id, name: stores[1].name, revenue: 82310, receipts: 26 },
    { id: stores[2].id, name: stores[2].name, revenue: 30020, receipts: 9 },
  ],
  attention: [
    { key: 'below_min', title: 'Товары ниже минимума', count: 17, link: '/purchasing/auto-order' },
    { key: 'overdue_debts', title: 'Просроченные долги клиентов', count: 5, amount: 63400, link: '/reports/customers.debts_aging' },
    { key: 'unverified_transfers', title: 'Несверенные переводы', count: 8, amount: 21850, link: '/money/transfers' },
    { key: 'requests_new', title: 'Заявки без ответа', count: 3, link: '/requests?status=new' },
    { key: 'hanging_selection', title: 'Висит на подборе', count: 2, link: '/reports/customers.hanging' },
  ],
  myShift: { id: uid(901), number: 45, openedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(), register: 'Касса 1', receipts: 29, revenue: 74120 },
  myRequests: [
    { id: uid(951), number: 'З-000128', status: 'selecting', customer: 'Эрлан, СТО «Ак-Жол»', vehicle: 'Toyota Camry 40', dueAt: new Date(Date.now() + 86_400_000).toISOString() },
    { id: uid(952), number: 'З-000129', status: 'new', customer: 'Айбек', vehicle: 'Honda Fit GE6', dueAt: null },
    { id: uid(953), number: 'З-000124', status: 'ordered', customer: 'Нурлан', vehicle: 'Lexus RX 350', dueAt: new Date(Date.now() - 86_400_000).toISOString() },
  ],
  warehouse: { draftReceivings: 2, incomingTransfers: 1, inventorySheets: 0 },
  money: { byType: { cash: 128400, safe: 310000, wallet: 46250, bank: 512900, acquiring: 18300 }, totalKgs: 1015850 },
  quickActions: [
    { key: 'sale', title: 'Продажа', link: '/pos' },
    { key: 'receiving', title: 'Приёмка', link: '/documents/new?type=receiving' },
    { key: 'request', title: 'Заявка', link: '/requests/new' },
    { key: 'product', title: 'Новый товар', link: '/products/new' },
  ],
});

const toSearch = (p: (typeof products)[number], i: number): SearchItem => ({
  id: p.id, sku: p.sku, name: p.name, qualityClass: p.qualityClass, qualityLabel: p.qualityLabel, brandName: p.brandName,
  mainNumber: p.mainNumber, photoFileId: null, price: p.retailPrice, currency: 'KGS', baseUnit: p.baseUnit,
  stockHere: String(Math.max(0, p.stock - (i % 3))), stockTotal: String(p.stock), availableHere: p.stock - (i % 3) > 0,
  availableElsewhere: p.stock > 0, matchKind: i === 0 ? 'number' : 'text',
});

function search(q: string): SearchResult {
  const t = q.toLowerCase().replace(/[\s.-]/g, '');
  const hits = products.filter((p) => (p.name + p.brandName + p.mainNumber + p.categoryName).toLowerCase().replace(/[\s.-]/g, '').includes(t) || (t.includes('колод') && p.categoryName === 'Колодки'));
  const items = hits.map(toSearch);
  const ladderOrder = ['original', 'oem', 'aftermarket', 'copy', 'used'] as const;
  return {
    query: q,
    selection: /камри|camry/i.test(q) ? { title: 'Toyota Camry XV40 (2006–2011)' } : null,
    clarify: /камри|camry/i.test(q) ? [{ key: 'restyle', question: 'До или после рестайлинга?', options: [{ value: 'pre', label: 'До' }, { value: 'post', label: 'После' }] }] : [],
    groups: {
      here: items.filter((i) => i.availableHere),
      elsewhere: items.filter((i) => !i.availableHere && i.availableElsewhere),
      analogs: [],
      noStock: items.filter((i) => !i.availableElsewhere),
      suppliers: hits.length ? [{ supplierName: 'Emex Бишкек', brand: hits[0].brandName, number: hits[0].mainNumber ?? '', name: hits[0].name, price: Number(hits[0].retailPrice) * 0.62, currency: 'KGS', deliveryDays: 3 }] : [],
    },
    ladder: ladderOrder
      .map((qc) => {
        const l = items.filter((i) => i.qualityClass === qc);
        return l.length ? { qualityClass: qc, label: l[0].qualityLabel, count: l.length, minPrice: String(Math.min(...l.map((x) => Number(x.price)))), stockTotal: String(l.reduce((a, x) => a + Number(x.stockTotal), 0)) } : null;
      })
      .filter(Boolean) as SearchResult['ladder'],
    total: items.length,
    actions: items.length ? [] : ['create_product', 'from_neighbor', 'customer_request'],
    tookMs: 18,
  };
}

function card(id: string): ProductCard | null {
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id, sku: p.sku, name: p.name, kind: p.kind, qualityClass: p.qualityClass, qualityLabel: p.qualityLabel, status: p.status,
    version: 3, baseUnit: p.baseUnit, description: null, sellerNote: 'Обычно берут парой — предложи вторую сторону.',
    noStockControl: false, isSerial: p.isSerial, priceNegotiable: p.priceNegotiable, minPrice: String(Math.round(Number(p.retailPrice) * 0.85)),
    recommendedPrice: null, tags: ['ходовой'], attributes: { Сторона: 'Передняя', 'Датчик износа': 'Да', Страна: 'Япония' },
    createdAt: '2026-08-11T09:00:00Z', updatedAt: p.updatedAt,
    brand: { id: p.brandId!, name: p.brandName! }, category: { id: p.categoryId ?? '', name: p.categoryName ?? '', path: '' },
    partType: { id: uid(700), name: 'Колодки' }, attributeDefs: [], mainNumber: p.mainNumber,
    numbers: [
      { id: uid(801), type: 'manufacturer', number: p.mainNumber ?? '', brandName: p.brandName },
      { id: uid(802), type: 'oem', number: '04465-33471', brandName: 'Toyota' },
      { id: uid(803), type: 'oem', number: '04465-06090', brandName: 'Toyota' },
      { id: uid(804), type: 'supplier', number: 'EMX-77812', brandName: null },
    ],
    units: [{ id: uid(811), name: 'шт', factor: '1', isBase: true, barcodes: [{ id: uid(812), barcode: '2500000051007', isInternal: true }] }],
    photos: [],
    prices: [
      { priceTypeId: uid(821), priceTypeName: 'Розничная', storeId: null, unitId: null, price: p.retailPrice ?? 0, currency: 'KGS' },
      { priceTypeId: uid(822), priceTypeName: 'Для СТО', storeId: null, unitId: null, price: Math.round(Number(p.retailPrice) * 0.92), currency: 'KGS' },
      { priceTypeId: uid(823), priceTypeName: 'Оптовая', storeId: null, unitId: null, price: Math.round(Number(p.retailPrice) * 0.85), currency: 'KGS' },
    ],
    applicability: [
      { id: uid(831), title: 'Toyota Camry XV40 (2006–2011)', precision: 'generation' },
      { id: uid(832), title: 'Toyota Camry XV50 (2011–2017)', precision: 'generation' },
      { id: uid(833), title: 'Lexus ES', precision: 'model' },
    ],
    stock: [
      { warehouseId: uid(841), warehouseName: 'Дордой — торговый зал', storeId: stores[0].id, qty: String(Math.ceil(p.stock / 2)) },
      { warehouseId: uid(842), warehouseName: 'Жибек Жолу — склад', storeId: stores[1].id, qty: String(Math.floor(p.stock / 2)) },
    ],
    fitWarning: p.qualityClass === 'aftermarket' ? 'Есть возвраты «не подошло»: Toyota Ipsum 2003' : null,
    effective: { warrantyDays: 30, returnDays: 14, returnConditions: 'Только без следов установки', pairHint: true },
  };
}

const ok = <T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> => ({ data, status, statusText: 'OK', headers: {}, config });
const fail = (config: InternalAxiosRequestConfig, status: number, code: string, message: string, details?: unknown) =>
  Promise.reject(Object.assign(new Error(message), { isAxiosError: true, config, response: { status, data: { code, message, details }, headers: {}, config, statusText: '' } }));

const authResponse = (tenantId: string | null): AuthResponse => ({ accessToken: 'demo-token', sessionId: uid(2), user, tenants, currentTenantId: tenantId });

let pos: ReturnType<typeof createDemoPos> | null = null;
let stock: ReturnType<typeof createDemoStock> | null = null;
let purchasing: ReturnType<typeof createDemoPurchasing> | null = null;
let crm: ReturnType<typeof createDemoCrm> | null = null;
let admin: ReturnType<typeof createDemoAdmin> | null = null;

export const demoAdapter: AxiosAdapter = async (config) => {
  pos ??= createDemoPos(products, stores[0].id);
  stock ??= createDemoStock(products, stores[0].id, cats);
  purchasing ??= createDemoPurchasing(products, stores[0].id, stock);
  crm ??= createDemoCrm(products, stores[0].id, cats, stock);
  admin ??= createDemoAdmin(products, stores, user, { stock, crm, pos });
  // Имитация обрыва связи: браузер офлайн → запрос «не дошёл»
  if (!navigator.onLine) return Promise.reject(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', config }));
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
  const url = (config.url ?? '').replace(/^\//, '');
  const method = (config.method ?? 'get').toLowerCase();
  const params = (config.params ?? {}) as Record<string, string>;
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data ?? {});

  if (method === 'post' && url === 'auth/login') {
    if (!body.password || body.password.length < 3) return fail(config, 401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль');
    return ok(config, authResponse(null));
  }
  if (method === 'post' && url === 'auth/register') return ok(config, authResponse(uid(21)));
  if (method === 'post' && url === 'auth/refresh') return ok(config, { accessToken: 'demo-token', sessionId: uid(2), tenantDropped: false });
  if (method === 'post' && url === 'auth/select-tenant') return ok(config, authResponse(body.tenantId));
  if (method === 'post' && url.startsWith('auth/logout')) return ok(config, null, 204);
  if (url === 'auth/me') return ok(config, me());
  if (url === 'auth/tenants') return ok(config, tenants);
  if (url === 'auth/sessions')
    return ok(config, [
      { id: uid(2), userAgent: 'Chrome 130 · Windows 11', ip: '212.112.100.4', createdAt: new Date(Date.now() - 7_200_000).toISOString(), current: true },
      { id: uid(3), userAgent: 'Chrome Mobile · Android 13', ip: '31.186.52.17', createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), current: false },
    ]);
  if (url === 'dashboard') return ok(config, dashboard(params.period ?? 'today'));
  const ad = await admin(url, method, params, body);
  if (ad) return 'error' in ad ? fail(config, ad.error.status, ad.error.code, ad.error.message, ad.error.details) : ok(config, ad.data, ad.status);
  const pu = await purchasing(url, method, params, config.data instanceof FormData ? config.data : body);
  if (pu) return 'error' in pu ? fail(config, pu.error.status, pu.error.code, pu.error.message, pu.error.details) : ok(config, pu.data, pu.status);
  const cr = await crm(url, method, params, body);
  if (cr) return 'error' in cr ? fail(config, cr.error.status, cr.error.code, cr.error.message, cr.error.details) : ok(config, cr.data, cr.status);
  const sr = await stock(url, method, params, body);
  if (sr) return 'error' in sr ? fail(config, sr.error.status, sr.error.code, sr.error.message, sr.error.details) : ok(config, sr.data, sr.status);
  if (url === 'products/meta') return ok(config, { qualityClasses: [], baseUnits: ['шт', 'л', 'м', 'кг', 'компл', 'пара'], priceTypes: [] });
  if (url === 'search') return ok(config, search(params.q ?? ''));
  if (url === 'notifications') {
    const items = [
      { id: uid(61), type: 'stock.below_min', title: 'Фильтр масляный Toyota — ниже минимума', body: 'Осталось 3 шт при минимуме 10', link: '/products', readAt: null, createdAt: new Date(Date.now() - 600_000).toISOString() },
      { id: uid(62), type: 'request.new', title: 'Новая заявка З-000129', body: 'Honda Fit GE6 — стойка передняя левая', link: '/requests', readAt: null, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
      { id: uid(63), type: 'transfer.unverified', title: 'Перевод MBank 4 200 с — не сверен', body: null, link: '/money/transfers', readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 86_400_000).toISOString() },
    ];
    return ok(config, { items, total: items.length, unread: 2 });
  }
  if (method === 'post' && url === 'notifications/read') return ok(config, null);
  if (method === 'post' && url === 'products/quick') {
    const p = { ...products[0], id: uid(1999), name: body.name, mainNumber: body.number ?? null, brandName: body.brand ?? null, retailPrice: body.price ?? null, quickCreated: true, stock: 0 };
    products.unshift(p);
    return ok(config, p);
  }
  if (url === 'products') {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 50);
    let list = products.slice();
    if (params.q) {
      const t = params.q.toLowerCase().replace(/[\s.-]/g, '');
      list = list.filter((p) => (p.name + p.brandName + p.mainNumber + p.sku).toLowerCase().replace(/[\s.-]/g, '').includes(t));
    }
    if (params.categoryId) {
      const ids = new Set([params.categoryId, ...cats.filter((c) => c.parentId === params.categoryId).map((c) => c.id)]);
      list = list.filter((p) => p.categoryId && ids.has(p.categoryId));
    }
    if (params.qualityClass) list = list.filter((p) => p.qualityClass === params.qualityClass);
    if (params.missing === 'photo') list = list.filter((p) => !p.photoFileId);
    if (params.quickCreated === 'true') list = list.filter((p) => p.quickCreated);
    if (params.sort) {
      const desc = params.sort.startsWith('-');
      const f = params.sort.replace('-', '') as 'name' | 'sku' | 'updatedAt';
      list.sort((a, b) => String(a[f]).localeCompare(String(b[f])) * (desc ? -1 : 1));
    }
    return ok(config, { items: list.slice((page - 1) * limit, page * limit), total: list.length });
  }
  const m = url.match(/^products\/([\w-]+)$/);
  if (m) {
    const c = card(m[1]);
    return c ? ok(config, c) : fail(config, 404, 'NOT_FOUND', 'Товар не найден');
  }
  const pr = await pos(url, method, params, body);
  if (pr) return 'error' in pr ? fail(config, pr.error.status, pr.error.code, pr.error.message, pr.error.details) : ok(config, pr.data, pr.status);
  if (/^files\/.+\/link$/.test(url)) return fail(config, 404, 'NOT_FOUND', 'Нет файла');
  return fail(config, 501, 'DEMO_NOT_IMPLEMENTED', 'В демо-режиме этот раздел пока без данных');
};
