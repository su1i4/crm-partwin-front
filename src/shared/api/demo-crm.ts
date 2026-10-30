/* Демо-данные клиентов, заявок, долгов, лояльности, денег и отчётов. Только для VITE_DEMO=true. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Category } from './types';

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
  qualityClass: string;
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const ago = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const s2 = (n: number) => r2(n).toFixed(2);
const pdf = () => new Blob(['%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'], { type: 'application/pdf' });

export function createDemoCrm(products: P[], storeId: string, cats: Category[], stock: Handler) {
  void stock;
  const prod = (id: string) => products.find((p) => p.id === id);

  // ── группы и клиенты
  const groups = [
    { id: uid(), name: 'Розница', priceTypeId: null, discountPercent: '0', debtLimit: '0', debtDays: null, sort: 0, version: 1 },
    { id: uid(), name: 'СТО', priceTypeId: '00000000-0000-4000-8000-000000000a02', discountPercent: '0', debtLimit: '100000', debtDays: 30, sort: 1, version: 1 },
    { id: uid(), name: 'Таксопарки', priceTypeId: null, discountPercent: '5', debtLimit: '30000', debtDays: 14, sort: 2, version: 1 },
  ];
  const gName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;
  const cust = (name: string, roles: string[], g: number | null, extra: any = {}) => ({
    id: uid(), name, kind: extra.kind ?? 'person', phone: extra.phone ?? null, phones: [], inn: null, address: extra.address ?? null, roles, tags: extra.tags ?? [], note: extra.note ?? null,
    birthday: extra.birthday ?? null, groupId: g == null ? null : groups[g].id, priceTypeId: null, discountPercent: null, debtLimit: null, debtDays: null, messengers: {}, version: 1, createdAt: ago(extra.age ?? 200),
    lastVisit: extra.last != null ? ago(extra.last) : null, purchasesTotal: extra.total ?? 0, receipts: extra.receipts ?? 0,
    vehicles: (extra.cars ?? []).map((c: any) => ({ id: uid(), title: c[0], plate: c[1] ?? null, year: c[2] ?? null, vin: c[3] ?? null, bodyCode: null, mileage: c[4] ?? null, note: null, makeId: null, modelId: null, version: 1 })),
    contacts: extra.contacts ?? [],
  });
  const customers: any[] = [
    cust('Эрлан — СТО «Ак-Жол»', ['sto', 'customer'], 1, { kind: 'company', phone: '0700 112 233', address: 'ул. Жибек Жолу 412', last: 1, total: 486_300, receipts: 64, tags: ['опт'], cars: [['Клиентские машины']], contacts: [{ id: uid(), name: 'Эрлан', position: 'владелец', phone: '0700 112 233', note: null }, { id: uid(), name: 'Мирлан', position: 'приёмщик', phone: '0555 112 234', note: null }] }),
    cust('Айбек Токтогулов', ['customer'], 0, { phone: '0555 908 070', last: 3, total: 38_400, receipts: 7, birthday: '1989-11-02', cars: [['Камри 40 белая', '01 KG 123 ABC', 2009, 'JTNBE40K403123456', 214000], ['Хонда Фит', '01 KG 777 AAA', 2004]] }),
    cust('Нурлан (такси)', ['customer'], 2, { phone: '0779 404 404', last: 6, total: 91_200, receipts: 22, tags: ['такси'], cars: [['Приус 30 серый', '01 KG 404 TAX', 2011]] }),
    cust('Бакыт — мастер ходовой', ['master', 'customer'], 1, { phone: '0505 222 111', last: 2, total: 152_000, receipts: 31, note: 'Приводит клиентов с Ахунбаева, бонус 5%' }),
    cust('Гульнара Асанова', ['customer'], 0, { phone: '0557 818 181', last: 41, total: 12_900, receipts: 3, cars: [['Лексус RX 300', '01 KG 300 RX', 2005]] }),
    cust('ОсОО «Бишкек Логистик»', ['customer'], 2, { kind: 'company', phone: '0312 66 77 88', last: 14, total: 233_000, receipts: 18, tags: ['безнал'] }),
    cust('Улан — СТО «Мотор»', ['sto', 'customer'], 1, { kind: 'company', phone: '0702 300 300', last: 9, total: 118_000, receipts: 19 }),
    cust('Азамат', ['customer'], 0, { phone: '0555 123 456', last: 120, total: 4_200, receipts: 1 }),
    cust('Канат — мастер электрик', ['master'], null, { phone: '0709 909 090', last: 20, total: 18_000, receipts: 4 }),
  ];
  const cById = (id: string) => customers.find((c) => c.id === id);

  // ── долги
  const debts: any[] = [];
  const debt = (c: any, amount: number, days: number, extra: any = {}) => {
    const due = extra.dueDays != null ? day(extra.dueDays - days) : null;
    const veh = extra.veh != null ? c.vehicles[extra.veh] : null;
    debts.push({
      id: uid(), counterpartyId: c.id, direction: extra.direction ?? 'receivable', kind: extra.kind ?? 'sale', currency: extra.currency ?? 'KGS', amount: s2(amount), remaining: s2(extra.remaining ?? amount),
      openedAt: ago(days), dueDate: due, documentId: null, documentNumber: extra.doc ?? `К1А-000${300 + debts.length}`, vehicleId: veh?.id ?? null, vehicleTitle: veh?.title ?? null, plate: veh?.plate ?? null,
      description: extra.desc ?? null, what: extra.what ?? null,
    });
  };
  debt(customers[0], 18_400, 12, { dueDays: 30, what: 'Колодки, диски, ШРУС' });
  debt(customers[0], 9_600, 45, { dueDays: 30, what: 'Амортизаторы KYB ×2' });
  debt(customers[0], 6_200, 75, { dueDays: 30, what: 'Масло, фильтры', remaining: 3_100 });
  debt(customers[1], 4_850, 8, { veh: 0, dueDays: 14, what: 'Колодки тормозные передние' });
  debt(customers[1], 1_150, 33, { veh: 1, dueDays: 14, what: 'Стойка стабилизатора' });
  debt(customers[2], 2_500, 4, { dueDays: 14, what: 'Лампы H4, свечи' });
  debt(customers[5], 41_800, 22, { dueDays: 30, what: 'Аккумуляторы ×4', doc: 'РН-000041' });
  debt(customers[6], 12_300, 96, { dueDays: 30, what: 'Шаровые, рычаги' });
  debt(customers[3], 3_400, 5, { direction: 'payable', kind: 'master_bonus', desc: 'Бонус за октябрь', doc: null });
  debt(customers[8], 900, 18, { direction: 'payable', kind: 'master_bonus', desc: 'Бонус', doc: null });
  // поставщики (из демо закупок)
  const supDebt = (id: string, name: string, amount: number, days: number) => debts.push({ id: uid(), counterpartyId: id, _name: name, direction: 'payable', kind: 'purchase', currency: 'KGS', amount: s2(amount), remaining: s2(amount), openedAt: ago(days), dueDate: day(14 - days), documentId: null, documentNumber: `ПР-0001${20 + debts.length}`, vehicleId: null, vehicleTitle: null, plate: null, description: null, what: 'Приёмка' });
  supDebt('00000000-0000-4000-8000-000000000951', 'ОсОО «Азия Партс»', 36_600, 6);
  supDebt('00000000-0000-4000-8000-000000000951', 'ОсОО «Азия Партс»', 12_000, 22);
  supDebt('00000000-0000-4000-8000-000000000954', 'Контейнер 118 — Улан', 7_400, 3);
  const nameOf = (id: string) => cById(id)?.name ?? debts.find((d) => d.counterpartyId === id)?._name ?? 'Контрагент';
  const phoneOf = (id: string) => cById(id)?.phone ?? null;
  const daysOld = (d: any) => Math.floor((Date.now() - new Date(d.openedAt).getTime()) / 86_400_000);
  const debtSummary = (cid: string) => {
    const m = new Map<string, any>();
    for (const d of debts.filter((x) => x.counterpartyId === cid && Number(x.remaining) > 0)) {
      const k = d.direction + d.currency;
      const e = m.get(k) ?? { direction: d.direction, currency: d.currency, amount: 0, overdue: 0 };
      e.amount += Number(d.remaining);
      if (d.dueDate && d.dueDate < day(0)) e.overdue += Number(d.remaining);
      m.set(k, e);
    }
    return [...m.values()].map((e) => ({ ...e, amount: s2(e.amount), overdue: e.overdue ? s2(e.overdue) : null }));
  };
  const itemView = (d: any) => {
    const { _name, counterpartyId, ...x } = d;
    void _name;
    void counterpartyId;
    return { ...x, overdue: !!d.dueDate && d.dueDate < day(0) && Number(d.remaining) > 0 };
  };

  // ── деньги
  const acc = (type: string, name: string, currency: string, balance: number, extra: any = {}) => ({ id: extra.id ?? uid(), type, name, currency, storeId, registerId: extra.registerId ?? null, holderMembershipId: null, details: extra.details ?? {}, isActive: true, version: 1, _balance: balance });
  const accounts: any[] = [
    acc('cash', 'Касса 1', 'KGS', 48_350, { registerId: '00000000-0000-4000-8000-000000000401' }),
    acc('cash', 'Касса 1 — доллары', 'USD', 120, { registerId: '00000000-0000-4000-8000-000000000401' }),
    acc('safe', 'Сейф', 'KGS', 312_000),
    acc('safe', 'Сейф — доллары', 'USD', 4_200),
    acc('bank', 'Оптима Банк — р/с', 'KGS', 186_400, { details: { provider: 'Оптима Банк' } }),
    acc('wallet', 'MBank — Бакыт — 0555 123 456', 'KGS', 64_200, { details: { provider: 'MBank', phone: '0555 123 456' } }),
    acc('wallet', 'O!Деньги — Азамат', 'KGS', 18_900, { details: { provider: 'O!Деньги', commissionPercent: '0' } }),
    acc('acquiring', 'Терминал Optima', 'KGS', 22_700, { details: { provider: 'Optima', commissionPercent: '1.8' } }),
  ];
  const movements: any[] = [];
  const mv = (a: any, amount: number, kind: string, hours: number, extra: any = {}) =>
    movements.push({ id: uid(), accountId: a.id, currency: a.currency, amount: s2(amount), amountKgs: s2(amount * (a.currency === 'USD' ? 87.4 : 1)), kind, movedAt: ago(0, hours), documentId: null, documentNumber: extra.doc ?? null, shiftId: null, counterpartyId: extra.cp?.id ?? null, counterpartyName: extra.cp?.name ?? null, verifyStatus: extra.verify ?? null, comment: extra.comment ?? null, _seller: extra.seller ?? null });
  const sellers = ['Бакыт', 'Азамат', 'Айгуль'];
  for (let i = 0; i < 26; i++) mv(accounts[0], 900 + ((i * 731) % 7400), 'sale', i * 3 + 1, { doc: `К1А-000${460 - i}` });
  for (let i = 0; i < 14; i++) mv(accounts[5 + (i % 2)], 1200 + ((i * 977) % 9000), 'sale', i * 7 + 2, { doc: `К1А-000${440 - i}`, verify: i < 9 ? 'unverified' : 'verified', seller: sellers[i % 3], cp: i % 4 === 0 ? customers[1] : i % 5 === 0 ? customers[2] : null });
  mv(accounts[0], -20_000, 'transfer', 20, { comment: 'В сейф' });
  mv(accounts[2], 20_000, 'transfer', 20, { comment: 'Из кассы' });
  mv(accounts[0], 12_300, 'debt_in', 30, { cp: customers[6], comment: 'Оплата долга' });
  mv(accounts[4], -36_000, 'debt_out', 50, { comment: 'Азия Партс' });
  mv(accounts[0], -1_500, 'expense', 26, { comment: 'Вода, чай' });
  const balance = (a: any) => s2(a._balance);
  const accView = (a: any) => {
    const { _balance, ...x } = a;
    void _balance;
    return { ...x, balance: balance(a), unverified: s2(movements.filter((m) => m.accountId === a.id && m.verifyStatus === 'unverified').reduce((s, m) => s + Number(m.amount), 0)) };
  };
  const addMoney = (accountId: string, amount: number, kind: string, extra: any = {}) => {
    const a = accounts.find((x) => x.id === accountId);
    if (!a) return;
    a._balance += amount;
    mv(a, amount, kind, 0, extra);
    movements.unshift(movements.pop());
  };

  // ── расходы
  const articles = [
    ['Аренда', 'rent', 'expense'], ['Зарплата', 'salary', 'salary'], ['Электричество', 'power', 'expense'], ['Интернет и связь', 'net', 'expense'], ['Охрана', null, 'expense'],
    ['Хозяйственные', null, 'expense'], ['Доставка', null, 'expense'], ['Налоги', 'tax', 'expense'], ['Изъятие владельцем', 'owner', 'owner'],
  ].map(([name, code, kind], i) => ({ id: uid(), name, code, kind, isSystem: i < 3, isActive: true }));
  const expenses: any[] = [];
  const exp = (ai: number, amount: number, days: number, ac = 2, extra: any = {}) =>
    expenses.push({ id: uid(), date: day(-days), articleId: articles[ai].id, articleName: articles[ai].name, articleKind: articles[ai].kind, accountId: accounts[ac].id, accountName: accounts[ac].name, currency: 'KGS', amount: s2(amount), amountKgs: s2(amount), storeId, counterpartyId: null, counterpartyName: null, membershipId: null, memberName: extra.member ?? null, recurringId: extra.rec ?? null, comment: extra.comment ?? null, status: 'posted' });
  const recurring: any[] = [
    { id: uid(), version: 1, articleId: articles[0].id, articleName: 'Аренда', accountId: accounts[4].id, accountName: accounts[4].name, storeId, amount: '45000.00', currency: 'KGS', dayOfMonth: 1, nextDate: `${day(30).slice(0, 8)}01`, comment: 'Контейнер 214', isActive: true, lastRunAt: ago(25) },
    { id: uid(), version: 1, articleId: articles[3].id, articleName: 'Интернет и связь', accountId: accounts[5].id, accountName: accounts[5].name, storeId, amount: '1200.00', currency: 'KGS', dayOfMonth: 10, nextDate: day(15), comment: null, isActive: true, lastRunAt: ago(15) },
  ];
  exp(0, 45_000, 25, 4, { rec: recurring[0].id, comment: 'Контейнер 214' });
  exp(1, 35_000, 20, 2, { member: 'Азамат' });
  exp(1, 32_000, 20, 2, { member: 'Айгуль' });
  exp(2, 6_800, 18, 0);
  exp(3, 1_200, 15, 5, { rec: recurring[1].id });
  exp(5, 2_300, 9, 0, { comment: 'Моющие, пакеты' });
  exp(6, 3_500, 4, 0, { comment: 'Такси до Дордоя' });
  exp(4, 5_000, 2, 2);

  // ── лояльность, мастера, задачи, подбор
  const loyalty: Record<string, any> = {};
  const loy = (c: any, bal: number, level: string | null) =>
    (loyalty[c.id] = {
      card: { id: uid(), number: `2700${String(1000 + Object.keys(loyalty).length * 37).padStart(8, '0')}`, createdAt: ago(100) },
      balance: s2(bal), level, accrualPercent: level === 'Золото' ? '5.00' : '3.00', expiringSoon: { amount: bal > 500 ? '300.00' : '0.00', at: day(21) },
      history: [
        { id: uid(), kind: 'accrue', amount: s2(bal * 0.6), receiptId: null, expiresAt: day(180), comment: null, createdAt: ago(3) },
        { id: uid(), kind: 'spend', amount: s2(-bal * 0.2), receiptId: null, expiresAt: null, comment: null, createdAt: ago(12) },
        { id: uid(), kind: 'accrue', amount: s2(bal * 0.6), receiptId: null, expiresAt: day(150), comment: null, createdAt: ago(30) },
      ],
    });
  loy(customers[1], 1_240, 'Серебро');
  loy(customers[2], 3_180, 'Золото');
  loy(customers[4], 420, null);
  const promotions: any[] = [
    { id: uid(), name: 'Зима: −10% на аккумуляторы', kind: 'percent', percent: '10.00', min_amount: null, starts_on: day(-10), ends_on: day(50), stackable: false, by_code: false, is_active: true, version: 1, category_ids: [cats.find((c) => c.name === 'Электрика')?.id].filter(Boolean), brand_ids: [], quality_classes: [], codes: null },
    { id: uid(), name: 'Таксистам −7% по промокоду', kind: 'percent', percent: '7.00', min_amount: null, starts_on: null, ends_on: null, stackable: false, by_code: true, is_active: true, version: 1, category_ids: [], brand_ids: [], quality_classes: [], codes: [{ id: uid(), code: 'TAXI7', maxUses: null, usedCount: 41, isActive: true }] },
    { id: uid(), name: 'От 20 000 — скидка 3%', kind: 'receipt_amount', percent: '3.00', min_amount: '20000.00', starts_on: day(-60), ends_on: day(-5), stackable: true, by_code: false, is_active: true, version: 1, category_ids: [], brand_ids: [], quality_classes: [], codes: null },
  ];
  const rules: any[] = [
    { id: uid(), masterId: null, categoryId: null, kind: 'percent_sales', value: '3.00', isActive: true, version: 1 },
    { id: uid(), masterId: customers[3].id, categoryId: null, kind: 'percent_sales', value: '5.00', isActive: true, version: 1 },
    { id: uid(), masterId: null, categoryId: cats.find((c) => c.name === 'Масла и автохимия')?.id ?? null, kind: 'fixed', value: '100.00', isActive: true, version: 1 },
  ];
  const tasks: any[] = [
    { id: uid(), title: 'Перезвонить Айбеку — пришли колодки', description: null, status: 'open', dueAt: ago(0, -2), assigneeId: null, assigneeName: 'Бакыт', counterpartyId: customers[1].id, customerName: customers[1].name, version: 1, createdAt: ago(1) },
    { id: uid(), title: 'Замена масла: Нурлан (6 мес. с покупки)', description: null, status: 'open', dueAt: ago(1), assigneeId: null, assigneeName: 'Бакыт', counterpartyId: customers[2].id, customerName: customers[2].name, version: 1, createdAt: ago(2) },
    { id: uid(), title: 'Забрать подбор у СТО «Мотор»', description: null, status: 'open', dueAt: ago(0, -26), assigneeId: null, assigneeName: 'Бакыт', counterpartyId: customers[6].id, customerName: customers[6].name, version: 1, createdAt: ago(3) },
    { id: uid(), title: 'Сверка долга с «Бишкек Логистик»', description: null, status: 'done', dueAt: ago(4), assigneeId: null, assigneeName: 'Бакыт', counterpartyId: customers[5].id, customerName: customers[5].name, version: 1, createdAt: ago(6) },
  ];
  const selections = [
    { id: uid(), number: 'ПБ-000014', status: 'open', dueDate: day(-1), overdue: true, lines: [products[8], products[10], products[9]].map((p) => ({ productId: p.id, name: p.name, qty: '1' })), counterpartyId: customers[6].id, customer: customers[6].name, phone: customers[6].phone, receiptId: null, createdAt: ago(4), closedAt: null },
    { id: uid(), number: 'ПБ-000015', status: 'open', dueDate: day(2), overdue: false, lines: [products[0], products[19]].map((p) => ({ productId: p.id, name: p.name, qty: '2' })), counterpartyId: customers[0].id, customer: customers[0].name, phone: customers[0].phone, receiptId: null, createdAt: ago(1), closedAt: null },
    { id: uid(), number: 'ПБ-000011', status: 'closed', dueDate: day(-9), overdue: false, lines: [{ productId: products[12].id, name: products[12].name, qty: '1' }], counterpartyId: customers[3].id, customer: customers[3].name, phone: customers[3].phone, receiptId: null, createdAt: ago(12), closedAt: ago(10) },
  ];
  const personal: Record<string, any[]> = { [customers[0].id]: products.slice(0, 4).map((p) => ({ id: uid(), productId: p.id, name: p.name, sku: p.sku, price: s2(Number(p.retailPrice) * 0.88), currency: 'KGS', updatedAt: ago(20) })) };
  const feed: Record<string, any[]> = {};
  const feedOf = (id: string) =>
    (feed[id] ??= [
      { type: 'receipt', id: uid(), at: ago(1, 3), text: 'Покупка К1А-000458 на 6 900 сом' },
      { type: 'call', id: uid(), at: ago(2), text: 'Спрашивал про амортизаторы на Камри, перезвонить когда придут' },
      { type: 'request', id: uid(), at: ago(5), text: 'Заявка З-000126: колодки задние' },
      { type: 'receipt', id: uid(), at: ago(14), text: 'Покупка К1А-000401 на 2 300 сом' },
      { type: 'note', id: uid(), at: ago(40), text: 'Любит оригинал, торгуется — давать скидку не больше 3%' },
    ]);

  // ── заявки
  const STATUS_LABEL: Record<string, string> = { new: 'Новая', selecting: 'Подбирается', offered: 'Предложено клиенту', ordered: 'Заказано', arrived: 'Привезли', issued: 'Выдано', refused: 'Отказ' };
  const NEXT: Record<string, string[]> = { new: ['selecting', 'offered', 'ordered', 'refused'], selecting: ['offered', 'ordered', 'refused'], offered: ['ordered', 'selecting', 'refused', 'arrived'], ordered: ['arrived', 'refused'], arrived: ['refused'], issued: [], refused: [] };
  const requests: any[] = [];
  let rseq = 120;
  const offer = (name: string, brand: string, qc: string, price: number, extra: any = {}) => ({ id: uid(), name, brand, qualityClass: qc, price: s2(price), inStock: !!extra.inStock, leadDays: extra.lead ?? null, supplierId: extra.sup ?? null, purchasePrice: extra.pp ? s2(extra.pp) : null, productId: extra.productId ?? null, chosen: !!extra.chosen });
  const mkReq = (status: string, hours: number, c: any | null, text: { name?: string; phone?: string; vehicle?: string }, items: any[], extra: any = {}) => {
    const r: any = {
      id: uid(), number: `З-000${++rseq}`, storeId, kind: extra.kind ?? 'order', status, customerId: c?.id ?? null, customerName: c ? null : text.name ?? null, customerPhone: c ? null : text.phone ?? null,
      customerVehicleId: extra.veh != null && c ? c.vehicles[extra.veh]?.id ?? null : null, vehicleText: text.vehicle ?? null, assigneeId: null, dueAt: extra.due != null ? ago(0, -extra.due) : null, prepaid: s2(extra.prepaid ?? 0),
      receiptId: null, refuseReason: extra.refuse ?? null, comment: extra.comment ?? null, createdAt: ago(0, hours), closedAt: ['issued', 'refused'].includes(status) ? ago(0, hours - 20) : null, version: 1,
      history: [{ at: ago(0, hours), status: 'new', by: 'Бакыт' }, ...(status !== 'new' ? [{ at: ago(0, hours - 2), status, by: 'Бакыт' }] : [])],
      items: items.map((it, i) => ({ id: uid(), lineNo: i + 1, number: it.number ?? null, name: it.name, qty: s2(it.qty ?? 1), photoFileIds: [], productId: it.productId ?? null, productName: it.productId ? prod(it.productId)?.name ?? null : null, salePrice: it.offers?.find((o: any) => o.chosen)?.price ?? null, sourceId: it.sourceId ?? null, sourceKind: it.sourceKind ?? null, sourceName: it.sourceName ?? null, purchasePrice: null, purchaseOrderLineId: null, purchaseOrderNumber: it.po ?? null, arrivedAt: status === 'arrived' ? ago(0, 3) : null, offers: it.offers ?? [] })),
    };
    requests.unshift(r);
    return r;
  };
  mkReq('new', 1, null, { name: 'Мирбек', phone: '0556 404 040', vehicle: 'Honda Fit GE6 2010' }, [{ name: 'Стойка передняя левая', number: '51606-TF0-J02' }], { due: 48 });
  mkReq('new', 3, customers[2], { vehicle: 'Prius 30' }, [{ name: 'Аккумулятор гибридный — проверить', number: null }], { kind: 'select' });
  mkReq('selecting', 20, customers[1], {}, [{ name: 'Колодки задние', number: '04466-33160' }, { name: 'Диски задние', number: null, qty: 2 }], { veh: 0, due: -4, comment: 'Нужно до пятницы' });
  mkReq('offered', 28, customers[4], {}, [{ name: 'Фара левая', number: '81170-48140', offers: [offer('Фара левая Toyota (оригинал)', 'Toyota', 'original', 28_500, { lead: 5, pp: 21_000 }), offer('Фара левая Depo', 'Depo', 'aftermarket', 9_800, { lead: 2, pp: 6_400 }), offer('Фара левая б/у Япония', '—', 'used', 7_500, { inStock: true })] }], { veh: 0, due: 30 });
  mkReq('ordered', 50, customers[0], {}, [{ name: 'ШРУС наружный', number: '43460-09F60', sourceId: '00000000-0000-4000-8000-000000000951', sourceKind: 'supplier', sourceName: 'ОсОО «Азия Партс»', po: 'ЗП-000060', offers: [offer('ШРУС GKN', 'GKN', 'aftermarket', 5_900, { lead: 2, chosen: true })] }], { prepaid: 2_000, due: 20 });
  mkReq('ordered', 70, null, { name: 'Таалай', phone: '0700 555 666', vehicle: 'Lexus GX 470' }, [{ name: 'Подушка двигателя', number: '12361-50160', sourceId: '00000000-0000-4000-8000-000000000954', sourceKind: 'neighbor', sourceName: 'Контейнер 118 — Улан', offers: [offer('Подушка Febest', 'Febest', 'aftermarket', 4_200, { lead: 0, chosen: true })] }], { due: -6 });
  mkReq('arrived', 96, customers[3], {}, [{ name: 'Помпа', number: '16100-29415', productId: products[11].id, offers: [offer('Помпа GMB', 'GMB', 'aftermarket', 3_800, { chosen: true })] }], { prepaid: 1_000 });
  mkReq('issued', 200, customers[6], {}, [{ name: 'Ремень ГРМ комплект', number: null, offers: [offer('Gates K015', 'Gates', 'aftermarket', 6_400, { chosen: true })] }]);
  mkReq('refused', 260, null, { name: 'Чынгыз', phone: '0705 101 010', vehicle: 'BMW E39' }, [{ name: 'Блок ABS', number: '34.51-6 756 289' }], { refuse: 'Дорого, нашёл б/у на разборке' });
  const reqView = (r: any) => {
    const c = r.customerId ? cById(r.customerId) : null;
    return { ...r, statusLabel: STATUS_LABEL[r.status], overdue: !!r.dueAt && r.dueAt < now() && !['issued', 'refused', 'arrived'].includes(r.status), customer: c ? { id: c.id, name: c.name, phone: c.phone } : null, nextStatuses: NEXT[r.status] };
  };
  const reqItem = (r: any) => {
    const v = reqView(r);
    const c = v.customer;
    const veh = c ? cById(c.id)?.vehicles.find((x: any) => x.id === r.customerVehicleId) : null;
    return { id: r.id, number: r.number, kind: r.kind, status: r.status, createdAt: r.createdAt, dueAt: r.dueAt, prepaid: r.prepaid, version: r.version, customerName: c?.name ?? r.customerName, customerPhone: c?.phone ?? r.customerPhone, vehicle: veh?.title ?? r.vehicleText, overdue: v.overdue, what: r.items.map((i: any) => i.name).join(', ') };
  };
  const setItems = (r: any, items: any[]) => {
    r.items = items.map((it: any, i: number) => {
      const prev = r.items.find((x: any) => x.id === it.id);
      return prev ? { ...prev, lineNo: i + 1, number: it.number ?? null, name: it.name ?? prev.name, qty: s2(Number(it.qty ?? prev.qty)) } : { id: uid(), lineNo: i + 1, number: it.number ?? null, name: it.name ?? '', qty: s2(Number(it.qty ?? 1)), photoFileIds: [], productId: it.productId ?? null, productName: null, salePrice: null, sourceId: null, sourceKind: null, sourceName: null, purchasePrice: null, purchaseOrderLineId: null, purchaseOrderNumber: null, arrivedAt: null, offers: [] };
    });
  };
  const waitlist: any[] = [
    { id: uid(), status: 'waiting', productId: products[16].id, productName: products[16].name, query: null, qty: '2', customerId: null, customerName: 'Темир', customerPhone: '0555 707 070', createdAt: ago(3), notifiedAt: null, note: null, version: 1 },
    { id: uid(), status: 'notified', productId: products[11].id, productName: products[11].name, query: null, qty: '1', customerId: customers[1].id, customerName: customers[1].name, customerPhone: customers[1].phone, createdAt: ago(9), notifiedAt: ago(1), note: 'Звонить после 18:00', version: 1 },
    { id: uid(), status: 'waiting', productId: null, productName: null, query: 'Фара левая Ipsum 2003', qty: '1', customerId: null, customerName: 'Алмаз', customerPhone: '0703 333 222', createdAt: ago(12), notifiedAt: null, note: null, version: 1 },
  ];

  // ── отчёты
  const G = { sales: 'Продажи', profit: 'Прибыль', stock: 'Склад', parts: 'Автозапчасти', purchases: 'Закупки', customers: 'Клиенты', staff: 'Сотрудники', money: 'Деньги' };
  const PERIOD = ['from', 'to', 'storeId'];
  const PROD = ['categoryId', 'brandId', 'qualityClass'];
  const gb = (vals: string[]) => vals.map((v) => ({ value: v, label: ({ product: 'Товар', category: 'Группа', brand: 'Бренд', quality: 'Класс', make: 'Марка', model: 'Модель', store: 'Точка', seller: 'Продавец', customer: 'Клиент', day: 'День', month: 'Месяц', hour: 'Час', weekday: 'День недели' } as any)[v] }));
  const REPORTS = [
    { code: 'sales.by', group: 'sales', title: 'Продажи', filters: [...PERIOD, ...PROD, 'sellerId', 'customerId', 'groupBy'], groupBy: gb(['product', 'category', 'brand', 'quality', 'make', 'seller', 'customer', 'day', 'month']) },
    { code: 'sales.by_time', group: 'sales', title: 'Продажи по часам и дням недели', filters: [...PERIOD, 'groupBy'], groupBy: gb(['hour', 'weekday']) },
    { code: 'sales.discounts', group: 'sales', title: 'Скидки', filters: [...PERIOD] },
    { code: 'profit.by', group: 'profit', title: 'Валовая прибыль и маржа', filters: [...PERIOD, ...PROD, 'groupBy'], groupBy: gb(['category', 'brand', 'quality', 'product', 'month']) },
    { code: 'profit.below_cost', group: 'profit', title: 'Продажи ниже себестоимости', filters: [...PERIOD] },
    { code: 'stock.on_date', group: 'stock', title: 'Остатки на дату', filters: ['date', 'warehouseId', ...PROD] },
    { code: 'stock.stale', group: 'stock', title: 'Залежалые товары', filters: ['warehouseId', 'days', ...PROD] },
    { code: 'stock.abc_xyz', group: 'stock', title: 'ABC и XYZ', filters: [...PERIOD, ...PROD] },
    { code: 'stock.days_left', group: 'stock', title: 'Оборачиваемость: на сколько дней хватит', filters: [...PERIOD, ...PROD] },
    { code: 'parts.neighbors', group: 'parts', title: 'Что брали у соседей', filters: [...PERIOD] },
    { code: 'parts.not_fit', group: 'parts', title: 'Возвраты «не подошло» по моделям', filters: [...PERIOD] },
    { code: 'purchases.by_supplier', group: 'purchases', title: 'Закупки по поставщикам', filters: [...PERIOD] },
    { code: 'customers.top', group: 'customers', title: 'Топ клиентов', filters: [...PERIOD] },
    { code: 'customers.debts_aging', group: 'customers', title: 'Долги и возраст долгов', filters: [] },
    { code: 'customers.lapsed', group: 'customers', title: 'Давно не покупали', filters: ['days'] },
    { code: 'staff.sales', group: 'staff', title: 'Продажи и маржа по продавцам', filters: [...PERIOD] },
    { code: 'staff.shift_diffs', group: 'staff', title: 'Расхождения смен', filters: [...PERIOD] },
    { code: 'money.pnl', group: 'money', title: 'Прибыль', filters: [...PERIOD] },
    { code: 'money.cash_flow', group: 'money', title: 'Движение денег', filters: [...PERIOD] },
    { code: 'money.who_has', group: 'money', title: 'У кого сколько денег', filters: [] },
    { code: 'money.unverified', group: 'money', title: 'Несверенные переводы', filters: [...PERIOD] },
  ];
  const EXTERNAL = [{ code: 'parts.unfound', group: 'parts', title: 'Что спрашивают, но нет', path: '/search/unfound' }];
  const views: any[] = [{ id: uid(), report: 'sales.by', name: 'Продажи по брендам', params: { groupBy: 'brand' }, shared: true, mine: true }, { id: uid(), report: 'stock.stale', name: 'Лежит больше 90 дней', params: { days: '90' }, shared: false, mine: true }];
  const seed = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9973, 7);
  const runReport = (code: string, p: Record<string, string>) => {
    const meta = REPORTS.find((r) => r.code === code)!;
    const k = seed(code + (p.groupBy ?? '') + (p.from ?? ''));
    const rnd = (i: number, m: number) => ((k * (i + 3) * 7919) % m) + m / 10;
    const by = (label: string, names: string[]) => {
      const rows = names.map((n, i) => {
        const revenue = Math.round(rnd(i, 400_000));
        const cost = Math.round(revenue * (0.58 + ((i * 7) % 15) / 100));
        return { key: n, qty: Math.round(rnd(i, 300)), receipts: Math.round(rnd(i, 120)), revenue, cost, profit: revenue - cost, margin: r2(((revenue - cost) / revenue) * 100), share: 0 };
      }).sort((a, b) => b.revenue - a.revenue);
      const tot = rows.reduce((a, r) => a + r.revenue, 0);
      rows.forEach((r) => (r.share = r2((r.revenue / tot) * 100)));
      return { label, rows, tot };
    };
    const brands = [...new Set(products.map((x) => x.brandName!))];
    const groupNames: Record<string, string[]> = {
      product: products.map((x) => x.name + (x.brandName ? ` ${x.brandName}` : '')),
      category: cats.filter((c) => c.level === 0).map((c) => c.name),
      brand: brands,
      quality: ['Оригинал', 'OEM', 'Аналог', 'Копия', 'Б/у'],
      make: ['Toyota', 'Honda', 'Lexus', 'Nissan', 'Mitsubishi', 'Hyundai', 'Mercedes-Benz'],
      seller: ['Бакыт', 'Азамат', 'Айгуль'],
      customer: customers.map((c) => c.name),
      day: Array.from({ length: 14 }, (_, i) => day(-i)),
      month: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
      hour: Array.from({ length: 11 }, (_, i) => `${i + 9}:00`),
      weekday: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    };
    const g = p.groupBy ?? meta.groupBy?.[0]?.value ?? 'product';
    const money = (key: string, title: string) => ({ key, title, type: 'money' });
    if (code === 'sales.by' || code === 'profit.by' || code === 'sales.by_time' || code === 'staff.sales' || code === 'purchases.by_supplier' || code === 'customers.top') {
      const names = code === 'staff.sales' ? groupNames.seller : code === 'purchases.by_supplier' ? ['ОсОО «Азия Партс»', 'Автомир Опт', 'Guangzhou Hongda', 'Контейнер 118 — Улан'] : code === 'customers.top' ? groupNames.customer : groupNames[g] ?? groupNames.product;
      const b = by(meta.groupBy?.find((x) => x.value === g)?.label ?? 'Название', names);
      const columns = [{ key: 'key', title: code === 'staff.sales' ? 'Продавец' : code === 'purchases.by_supplier' ? 'Поставщик' : code === 'customers.top' ? 'Клиент' : b.label, type: g === 'day' ? 'date' : 'text' }, { key: 'receipts', title: code === 'purchases.by_supplier' ? 'Приёмок' : 'Чеков', type: 'int' }, { key: 'qty', title: 'Кол-во', type: 'qty' }, money('revenue', code === 'purchases.by_supplier' ? 'Закуплено' : 'Выручка'), ...(code === 'purchases.by_supplier' ? [] : [money('cost', 'Себестоимость'), money('profit', 'Прибыль'), { key: 'margin', title: 'Маржа', type: 'percent' }]), { key: 'share', title: 'Доля', type: 'percent' }];
      const t = b.rows.reduce((a, r) => ({ receipts: a.receipts + r.receipts, qty: a.qty + r.qty, revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit }), { receipts: 0, qty: 0, revenue: 0, cost: 0, profit: 0 });
      return { columns, rows: g === 'day' || g === 'month' || g === 'hour' || g === 'weekday' ? b.rows.sort((a, c) => names.indexOf(a.key) - names.indexOf(c.key)) : b.rows, totals: { ...t, margin: r2((t.profit / t.revenue) * 100), share: 100 }, note: code === 'profit.by' ? 'Себестоимость — средняя на момент продажи; доп. расходы приёмок включены' : undefined };
    }
    if (code === 'money.pnl') {
      const rows = [
        { item: 'Выручка', amount: 2_418_600 }, { item: 'Себестоимость проданного', amount: -1_533_900 }, { item: 'Валовая прибыль', amount: 884_700 }, { item: 'Аренда', amount: -45_000 }, { item: 'Зарплата', amount: -67_000 },
        { item: 'Электричество', amount: -6_800 }, { item: 'Прочие расходы', amount: -12_000 }, { item: 'Бонусы мастерам', amount: -18_400 }, { item: 'Комиссии эквайринга', amount: -4_100 }, { item: 'Курсовые разницы', amount: 2_300 }, { item: 'Чистая прибыль', amount: 733_700 },
      ];
      return { columns: [{ key: 'item', title: 'Статья', type: 'text' }, money('amount', 'Сумма')], rows, note: 'Прибыль по отгрузке: выручка − себестоимость − расходы периода' };
    }
    if (code === 'money.who_has') return { columns: [{ key: 'name', title: 'Где', type: 'text' }, { key: 'type', title: 'Вид', type: 'text' }, { key: 'currency', title: 'Валюта', type: 'text' }, money('balance', 'Остаток')], rows: accounts.map((a) => ({ name: a.name, type: ({ cash: 'Касса', safe: 'Сейф', bank: 'Банк', wallet: 'Кошелёк', acquiring: 'Эквайринг' } as any)[a.type], currency: a.currency, balance: a._balance })) };
    if (code === 'customers.debts_aging') {
      const rows = customers.map((c) => ({ c, d: debts.filter((x) => x.counterpartyId === c.id && x.direction === 'receivable' && Number(x.remaining) > 0) })).filter((x) => x.d.length).map(({ c, d }) => {
        const s = (f: (x: any) => boolean) => d.filter(f).reduce((a, x) => a + Number(x.remaining), 0);
        return { name: c.name, total: s(() => true), a30: s((x) => daysOld(x) <= 30), a60: s((x) => daysOld(x) > 30 && daysOld(x) <= 60), a90: s((x) => daysOld(x) > 60 && daysOld(x) <= 90), a90p: s((x) => daysOld(x) > 90) };
      });
      return { columns: [{ key: 'name', title: 'Клиент', type: 'text' }, money('total', 'Долг'), money('a30', '0–30'), money('a60', '31–60'), money('a90', '61–90'), money('a90p', '90+')], rows, totals: rows.reduce((a: any, r: any) => ({ total: a.total + r.total, a30: a.a30 + r.a30, a60: a.a60 + r.a60, a90: a.a90 + r.a90, a90p: a.a90p + r.a90p }), { total: 0, a30: 0, a60: 0, a90: 0, a90p: 0 }) };
    }
    if (code.startsWith('stock.')) {
      const rows = products.map((x, i) => ({ name: x.name, number: x.mainNumber, brand: x.brandName, qty: x.stock, cost: Math.round(Number(x.retailPrice) * 0.62 * x.stock), lastSale: day(-((i * 13) % 140)), days: (i * 13) % 140, abc: ['A', 'B', 'C'][i % 3], xyz: ['X', 'Y', 'Z'][(i * 2) % 3], left: Math.round(rnd(i, 120)) }));
      const st = rows.filter((r) => code !== 'stock.stale' || r.days >= Number(p.days ?? 90));
      const cols: any[] = [{ key: 'name', title: 'Товар', type: 'text' }, { key: 'number', title: 'Номер', type: 'text' }, { key: 'brand', title: 'Бренд', type: 'text' }, { key: 'qty', title: 'Остаток', type: 'qty' }, money('cost', 'Себестоимость')];
      if (code === 'stock.stale') cols.push({ key: 'lastSale', title: 'Последняя продажа', type: 'date' }, { key: 'days', title: 'Дней без продаж', type: 'int' });
      if (code === 'stock.abc_xyz') cols.push({ key: 'abc', title: 'ABC', type: 'text' }, { key: 'xyz', title: 'XYZ', type: 'text' });
      if (code === 'stock.days_left') cols.push({ key: 'left', title: 'Хватит, дней', type: 'int' });
      return { columns: cols, rows: st, totals: { qty: st.reduce((a, r) => a + r.qty, 0), cost: st.reduce((a, r) => a + r.cost, 0) }, note: code === 'stock.abc_xyz' ? 'ABC — по выручке (80/15/5%), XYZ — по стабильности спроса по неделям' : undefined };
    }
    if (code === 'money.unverified') {
      const rows = movements.filter((m) => m.verifyStatus === 'unverified').map((m) => ({ at: m.movedAt, wallet: accounts.find((a) => a.id === m.accountId)?.name, seller: m._seller, amount: Number(m.amount) }));
      return { columns: [{ key: 'at', title: 'Когда', type: 'datetime' }, { key: 'wallet', title: 'Кошелёк', type: 'text' }, { key: 'seller', title: 'Продавец', type: 'text' }, money('amount', 'Сумма')], rows, totals: { amount: rows.reduce((a, r) => a + r.amount, 0) } };
    }
    if (code === 'money.cash_flow') {
      const rows = ['Продажи', 'Оплата долгов клиентов', 'Оплата поставщикам', 'Расходы', 'Зарплата', 'Изъятия владельца'].map((n, i) => ({ item: n, inflow: i < 2 ? Math.round(rnd(i, 2_000_000)) : 0, outflow: i >= 2 ? Math.round(rnd(i, 900_000)) : 0 }));
      return { columns: [{ key: 'item', title: 'Статья', type: 'text' }, money('inflow', 'Приход'), money('outflow', 'Расход')], rows, totals: { inflow: rows.reduce((a, r) => a + r.inflow, 0), outflow: rows.reduce((a, r) => a + r.outflow, 0) } };
    }
    const rows = Array.from({ length: 8 }, (_, i) => ({ name: products[i].name, date: ago(i * 3), amount: Math.round(rnd(i, 20_000)), note: ['Toyota Camry 40', 'Honda Fit', 'Lexus RX'][i % 3] }));
    return { columns: [{ key: 'date', title: 'Дата', type: 'date' }, { key: 'name', title: 'Товар', type: 'text' }, { key: 'note', title: 'Машина / комментарий', type: 'text' }, money('amount', 'Сумма')], rows, totals: { amount: rows.reduce((a, r) => a + r.amount, 0) } };
  };

  const err = (status: number, code: string, message: string, details?: unknown) => ({ error: { status, code, message, details } });
  const ok = (data: unknown, status = 200) => ({ status, data });
  const custItem = (c: any) => ({
    id: c.id, name: c.name, kind: c.kind, phone: c.phone, inn: c.inn, roles: c.roles, tags: c.tags, groupId: c.groupId, groupName: gName(c.groupId), version: c.version, lastVisit: c.lastVisit, purchasesTotal: s2(c.purchasesTotal),
    debtKgs: s2(debts.filter((d) => d.counterpartyId === c.id && d.direction === 'receivable' && d.currency === 'KGS').reduce((a, d) => a + Number(d.remaining), 0)),
  });
  const card = (c: any) => {
    const g = groups.find((x) => x.id === c.groupId) ?? null;
    const { lastVisit, purchasesTotal, receipts, ...base } = c;
    const dbv = new Map<string, any>();
    for (const d of debts.filter((x) => x.counterpartyId === c.id && x.direction === 'receivable' && Number(x.remaining) > 0)) {
      const k = (d.vehicleId ?? 'none') + d.currency;
      const e = dbv.get(k) ?? { vehicleId: d.vehicleId, title: d.vehicleTitle ?? 'Без машины', plate: d.plate, currency: d.currency, amount: 0 };
      e.amount += Number(d.remaining);
      dbv.set(k, e);
    }
    return {
      ...base, group: g ? { id: g.id, name: g.name } : null,
      terms: { priceTypeId: c.priceTypeId ?? g?.priceTypeId ?? null, discountPercent: s2(Number(c.discountPercent ?? g?.discountPercent ?? 0)), debtLimit: c.debtLimit ?? g?.debtLimit ?? null, debtDays: c.debtDays ?? g?.debtDays ?? null, groupName: g?.name ?? null },
      stats: { receiptsCount: receipts, purchasesTotal: s2(purchasesTotal), averageReceipt: s2(receipts ? purchasesTotal / receipts : 0), lastVisit },
      debts: debtSummary(c.id), debtsByVehicle: [...dbv.values()].map((e) => ({ ...e, amount: s2(e.amount) })),
    };
  };

  return async (url: string, method: string, params: Record<string, any>, body: any): Promise<Res> => {
    // ── клиенты
    if (url === 'counterparty-groups') return ok(groups);
    if (url === 'counterparties' && method === 'get') {
      const q = String(params.q ?? '').toLowerCase();
      const digits = q.replace(/\D/g, '');
      let list = customers.filter((c) => !params.role || c.roles.includes(params.role));
      if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)) || c.vehicles.some((v: any) => (v.plate ?? '').replace(/\s/g, '').toLowerCase().includes(q.replace(/\s/g, ''))));
      if (params.hasDebt === true || params.hasDebt === 'true') list = list.filter((c) => Number(custItem(c).debtKgs) > 0);
      if (params.noPurchaseDays) list = list.filter((c) => !c.lastVisit || Date.now() - new Date(c.lastVisit).getTime() > Number(params.noPurchaseDays) * 86_400_000);
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit).map(custItem), total: list.length });
    }
    if (url === 'counterparties' && method === 'post') {
      if (body.phone && customers.some((c) => (c.phone ?? '').replace(/\D/g, '') === body.phone.replace(/\D/g, '')) && !body.confirmDuplicatePhone) return err(409, 'DUPLICATE_PHONE', `С этим телефоном уже есть «${customers.find((c) => (c.phone ?? '').replace(/\D/g, '') === body.phone.replace(/\D/g, ''))!.name}»`);
      const c = cust(body.name, body.roles ?? ['customer'], null, { kind: body.kind, phone: body.phone, address: body.address, tags: body.tags, note: body.note, birthday: body.birthday, age: 0 });
      Object.assign(c, { groupId: body.groupId ?? null, priceTypeId: body.priceTypeId ?? null, discountPercent: body.discountPercent ?? null, debtLimit: body.debtLimit ?? null, debtDays: body.debtDays ?? null, messengers: body.messengers ?? {} });
      customers.unshift(c);
      return ok(card(c), 201);
    }
    let m = url.match(/^counterparties\/([\w-]+)(?:\/(card|feed|activities|personal-prices|price-list|price-list\/link|vehicles|debts|debts\/statement|debts\/statement\.pdf))?$/);
    if (m) {
      const id = m[1];
      const act = m[2];
      const c = cById(id);
      if (act === 'debts') return ok(debts.filter((d) => d.counterpartyId === id && (!params.direction || d.direction === params.direction) && (params.open === false || params.open === 'false' || Number(d.remaining) > 0)).map(itemView));
      if (act === 'debts/statement') {
        const items = debts.filter((d) => d.counterpartyId === id && d.direction === 'receivable' && Number(d.remaining) > 0).map(itemView);
        const tot = items.reduce((a, d) => a + Number(d.remaining), 0);
        const text = [`${nameOf(id)}, сверка на ${new Date().toLocaleDateString('ru-RU')}:`, ...items.map((i) => `${new Date(i.openedAt).toLocaleDateString('ru-RU').slice(0, 5)} — ${i.vehicleTitle ?? 'без машины'} — ${i.what ?? 'покупка'} — ${Number(i.remaining).toLocaleString('ru-RU')} сом`), `Итого долг: ${tot.toLocaleString('ru-RU')} сом`].join('\n');
        const phone = (phoneOf(id) ?? '').replace(/\D/g, '').replace(/^0/, '996');
        return ok({ counterparty: { id, name: nameOf(id), phone: phoneOf(id) }, items, totals: { KGS: s2(tot) }, text, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, telegramUrl: `https://t.me/share/url?url=%20&text=${encodeURIComponent(text)}` });
      }
      if (act === 'debts/statement.pdf' || act === 'price-list') return ok(pdf());
      if (!c) return null;
      if (!act && method === 'get') return ok(card(c));
      if (!act && method === 'patch') {
        Object.assign(c, { name: body.name ?? c.name, kind: body.kind ?? c.kind, phone: body.phone ?? null, inn: body.inn ?? null, address: body.address ?? null, roles: body.roles ?? c.roles, tags: body.tags ?? c.tags, groupId: body.groupId ?? null, priceTypeId: body.priceTypeId ?? null, discountPercent: body.discountPercent ?? null, debtLimit: body.debtLimit ?? null, debtDays: body.debtDays ?? null, birthday: body.birthday ?? null, note: body.note ?? null, messengers: body.messengers ?? c.messengers, version: c.version + 1 });
        return ok(card(c));
      }
      if (act === 'card') return ok(card(c));
      if (act === 'feed') return ok(feedOf(id));
      if (act === 'activities') {
        feedOf(id).unshift({ type: body.kind, id: uid(), at: now(), text: body.text });
        return ok({ id: uid() }, 201);
      }
      if (act === 'personal-prices') {
        personal[id] ??= [];
        if (method === 'put') {
          const i = personal[id].findIndex((x) => x.productId === body.productId);
          if (body.price == null) {
            if (i >= 0) personal[id].splice(i, 1);
            return ok({ deleted: true });
          }
          const p = prod(body.productId);
          const row = { id: uid(), productId: body.productId, name: p?.name ?? '', sku: p?.sku ?? '', price: s2(Number(body.price)), currency: 'KGS', updatedAt: now() };
          if (i >= 0) personal[id][i] = row;
          else personal[id].unshift(row);
          return ok({ productId: body.productId, price: row.price });
        }
        return ok(personal[id]);
      }
      if (act === 'price-list/link') return ok({ link: `https://demo.autoparts.kg/p/${id.slice(0, 8)}` });
      if (act === 'vehicles' && method === 'post') {
        const v = { id: uid(), title: body.title, plate: body.plate ?? null, year: body.year ?? null, vin: body.vin ?? null, bodyCode: null, mileage: body.mileage ?? null, note: body.note ?? null, makeId: null, modelId: null, version: 1 };
        c.vehicles.push(v);
        return ok(v, 201);
      }
      if (act === 'vehicles') return ok(c.vehicles);
    }
    m = url.match(/^customer-vehicles\/([\w-]+)$/);
    if (m) {
      for (const c of customers) {
        const i = c.vehicles.findIndex((v: any) => v.id === m![1]);
        if (i < 0) continue;
        if (method === 'delete') {
          c.vehicles.splice(i, 1);
          return ok(null, 204);
        }
        Object.assign(c.vehicles[i], { ...body, version: c.vehicles[i].version + 1 });
        return ok(c.vehicles[i]);
      }
      return err(404, 'NOT_FOUND', 'Машина не найдена');
    }

    // ── долги
    if (url === 'debts') {
      const dir = params.direction ?? 'receivable';
      const q = String(params.q ?? '').toLowerCase();
      const by = new Map<string, any>();
      for (const d of debts.filter((x) => x.direction === dir && Number(x.remaining) > 0)) {
        const k = d.counterpartyId + d.currency;
        const e = by.get(k) ?? { counterpartyId: d.counterpartyId, name: nameOf(d.counterpartyId), phone: phoneOf(d.counterpartyId), currency: d.currency, amount: 0, overdue: 0, age0_30: 0, age31_60: 0, age61_90: 0, age90plus: 0, oldestAt: d.openedAt };
        const r = Number(d.remaining);
        const a = daysOld(d);
        e.amount += r;
        if (d.dueDate && d.dueDate < day(0)) e.overdue += r;
        if (a <= 30) e.age0_30 += r;
        else if (a <= 60) e.age31_60 += r;
        else if (a <= 90) e.age61_90 += r;
        else e.age90plus += r;
        if (d.openedAt < e.oldestAt) e.oldestAt = d.openedAt;
        by.set(k, e);
      }
      let list = [...by.values()].map((e) => ({ ...e, amount: s2(e.amount), overdue: s2(e.overdue), age0_30: s2(e.age0_30), age31_60: s2(e.age31_60), age61_90: s2(e.age61_90), age90plus: s2(e.age90plus) }));
      if (q) list = list.filter((e) => (e.name + (e.phone ?? '')).toLowerCase().includes(q));
      if (params.overdueOnly === true || params.overdueOnly === 'true') list = list.filter((e) => Number(e.overdue) > 0);
      list.sort((a, b) => Number(b.amount) - Number(a.amount));
      return ok({ items: list, total: list.length });
    }
    if (url === 'debts/payments') {
      const dir = body.direction === 'in' ? 'receivable' : 'payable';
      let left = Number(body.amount);
      const pool = debts.filter((d) => d.counterpartyId === body.counterpartyId && d.direction === dir && d.currency === (body.currency ?? 'KGS') && Number(d.remaining) > 0 && (body.allocation?.mode !== 'items' || body.allocation.itemIds.includes(d.id))).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
      const allocations: any[] = [];
      for (const d of pool) {
        if (left <= 0) break;
        const x = Math.min(left, Number(d.remaining));
        d.remaining = s2(Number(d.remaining) - x);
        left -= x;
        allocations.push({ debtItemId: d.id, amount: s2(x) });
      }
      addMoney(body.accountId, body.direction === 'in' ? Number(body.amount) : -Number(body.amount), body.direction === 'in' ? 'debt_in' : 'debt_out', { cp: { id: body.counterpartyId, name: nameOf(body.counterpartyId) }, comment: body.comment });
      return ok({ payment: { id: uid() }, allocations, balance: debtSummary(body.counterpartyId) }, 201);
    }
    if (url === 'debts/offset') {
      const rec = debts.filter((d) => d.counterpartyId === body.counterpartyId && d.direction === 'receivable' && Number(d.remaining) > 0);
      const pay = debts.filter((d) => d.counterpartyId === body.counterpartyId && d.direction === 'payable' && Number(d.remaining) > 0);
      let amt = Math.min(rec.reduce((a, d) => a + Number(d.remaining), 0), pay.reduce((a, d) => a + Number(d.remaining), 0));
      const total = amt;
      for (const list of [rec, pay]) {
        let l = amt;
        for (const d of list) {
          const x = Math.min(l, Number(d.remaining));
          d.remaining = s2(Number(d.remaining) - x);
          l -= x;
        }
      }
      amt = 0;
      return ok({ amount: s2(total), currency: 'KGS', balance: debtSummary(body.counterpartyId) });
    }

    // ── лояльность
    m = url.match(/^loyalty\/customers\/([\w-]+)(?:\/(card|adjust))?$/);
    if (m) {
      const id = m[1];
      const L = (loyalty[id] ??= { card: null, balance: '0.00', level: null, accrualPercent: '3.00', expiringSoon: { amount: '0.00', at: null }, history: [] });
      if (m[2] === 'card') L.card = { id: uid(), number: body.number ?? `2700${Math.floor(Math.random() * 1e8)}`, createdAt: now() };
      if (m[2] === 'adjust') {
        L.balance = s2(Number(L.balance) + Number(body.amount));
        L.history.unshift({ id: uid(), kind: 'manual', amount: s2(Number(body.amount)), receiptId: null, expiresAt: null, comment: body.comment, createdAt: now() });
      }
      return ok(L);
    }
    if (url === 'loyalty/liability') {
      const total = Object.values(loyalty).reduce((a: number, l: any) => a + Number(l.balance), 0);
      return ok({ onCards: s2(total), customers: Object.keys(loyalty).length, thisMonth: { accrued: '6840.00', spent: '2310.00', expired: '420.00' } });
    }
    if (url === 'loyalty/bot-link') return ok({ link: 'https://t.me/autoparts_demo_bot?start=shop' });
    if (url === 'loyalty/promotions' && method === 'get') return ok(promotions);
    if (url === 'loyalty/promotions' && method === 'post') {
      const p = { id: uid(), name: body.name, kind: body.kind, percent: s2(Number(body.percent)), min_amount: body.minAmount ? s2(Number(body.minAmount)) : null, starts_on: body.startsOn ?? null, ends_on: body.endsOn ?? null, stackable: !!body.stackable, by_code: !!body.byCode, is_active: body.isActive ?? true, version: 1, category_ids: body.categoryIds ?? [], brand_ids: [], quality_classes: [], codes: null };
      promotions.unshift(p);
      return ok(p, 201);
    }
    m = url.match(/^loyalty\/promotions\/([\w-]+)(\/codes)?$/);
    if (m) {
      const p = promotions.find((x) => x.id === m![1]);
      if (!p) return err(404, 'NOT_FOUND', 'Акция не найдена');
      if (m[2]) {
        const codes = body.generate ? Array.from({ length: Math.min(body.generate, 30) }, () => Math.random().toString(36).slice(2, 8).toUpperCase()) : body.codes;
        p.codes = [...(p.codes ?? []), ...codes.map((c: string) => ({ id: uid(), code: c, maxUses: body.maxUses ?? null, usedCount: 0, isActive: true }))];
        return ok(p);
      }
      Object.assign(p, { name: body.name, kind: body.kind, percent: s2(Number(body.percent)), min_amount: body.minAmount ? s2(Number(body.minAmount)) : null, starts_on: body.startsOn ?? null, ends_on: body.endsOn ?? null, stackable: !!body.stackable, by_code: !!body.byCode, is_active: !!body.isActive, category_ids: body.categoryIds ?? [], version: p.version + 1 });
      return ok(p);
    }

    // ── мастера, задачи, подбор
    if (url === 'master-bonuses/rules' && method === 'get') return ok(rules);
    if (url === 'master-bonuses/rules' && method === 'post') {
      const r = { id: uid(), version: 1, masterId: body.masterId ?? null, categoryId: body.categoryId ?? null, kind: body.kind, value: s2(Number(body.value)), isActive: body.isActive ?? true };
      rules.unshift(r);
      return ok(r, 201);
    }
    m = url.match(/^master-bonuses\/rules\/([\w-]+)$/);
    if (m) {
      const r = rules.find((x) => x.id === m![1]);
      if (!r) return err(404, 'NOT_FOUND', 'Правило не найдено');
      Object.assign(r, { masterId: body.masterId ?? null, categoryId: body.categoryId ?? null, kind: body.kind ?? r.kind, value: s2(Number(body.value ?? r.value)), isActive: body.isActive ?? r.isActive, version: r.version + 1 });
      return ok(r);
    }
    if (url === 'master-bonuses') {
      return ok(customers.filter((c) => c.roles.includes('master') || c.roles.includes('sto')).map((c, i) => {
        const owed = debts.filter((d) => d.counterpartyId === c.id && d.kind === 'master_bonus').reduce((a, d) => a + Number(d.remaining), 0);
        const accrued = owed + 1500 * (i + 1);
        return { masterId: c.id, name: c.name, receipts: 4 + i * 3, accrued: s2(accrued), paid: s2(accrued - owed), owed: s2(owed) };
      }).sort((a, b) => Number(b.accrued) - Number(a.accrued)));
    }
    if (url === 'tasks' && method === 'get') return ok(tasks.filter((t) => !params.status || t.status === params.status).filter((t) => !params.counterpartyId || t.counterpartyId === params.counterpartyId));
    if (url === 'tasks' && method === 'post') {
      const t = { id: uid(), title: body.title, description: body.description ?? null, status: 'open', dueAt: body.dueAt ?? null, assigneeId: null, assigneeName: 'Бакыт', counterpartyId: body.counterpartyId ?? null, customerName: body.counterpartyId ? nameOf(body.counterpartyId) : null, version: 1, createdAt: now() };
      tasks.unshift(t);
      return ok(t, 201);
    }
    m = url.match(/^tasks\/([\w-]+)$/);
    if (m) {
      const t = tasks.find((x) => x.id === m![1]);
      if (!t) return err(404, 'NOT_FOUND', 'Задача не найдена');
      Object.assign(t, { ...(body.status ? { status: body.status } : {}), ...(body.title ? { title: body.title } : {}), version: t.version + 1 });
      return ok(t);
    }
    if (url === 'selections' && method === 'get') return ok(selections.filter((s) => !params.status || s.status === params.status));

    // ── заявки
    if (url === 'requests' && method === 'get') {
      const q = String(params.q ?? '').toLowerCase();
      let list = requests.map(reqItem);
      if (q) list = list.filter((r) => (r.number + r.what + (r.customerName ?? '')).toLowerCase().includes(q));
      if (params.view === 'kanban') {
        list = list.filter((r) => !['issued', 'refused'].includes(r.status) || requests.find((x) => x.id === r.id).closedAt > ago(3));
        return ok({ columns: Object.entries(STATUS_LABEL).map(([status, label]) => ({ status, label, items: list.filter((i) => i.status === status) })), total: list.length });
      }
      if (params.status) list = list.filter((r) => String(params.status).split(',').includes(r.status));
      list.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.createdAt.localeCompare(a.createdAt));
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit), total: list.length });
    }
    if (url === 'requests' && method === 'post') {
      const c = body.customerId ? cById(body.customerId) : null;
      const r = mkReq('new', 0, c, { name: body.customerName, phone: body.customerPhone, vehicle: body.vehicleText }, [], { kind: body.kind, comment: body.comment });
      r.customerVehicleId = body.customerVehicleId ?? null;
      r.dueAt = body.dueAt ?? null;
      r.history = [{ at: now(), status: 'new', by: 'Бакыт' }];
      setItems(r, body.items ?? []);
      return ok(reqView(r), 201);
    }
    m = url.match(/^requests\/([\w-]+)(?:\/(suggest|offer|choose|order|status|prepay|issue|refuse|message))?$/);
    if (m) {
      const r = requests.find((x) => x.id === m![1]);
      if (!r) return err(404, 'NOT_FOUND', 'Заявка не найдена');
      const act = m[2];
      const bump = (status?: string, note?: string) => {
        if (status && status !== r.status) (r.status = status), r.history.push({ at: now(), status, by: 'Бакыт', ...(note ? { note } : {}) });
        r.version++;
        return ok(reqView(r));
      };
      if (!act && method === 'get') return ok(reqView(r));
      if (!act && method === 'patch') {
        Object.assign(r, { kind: body.kind ?? r.kind, customerId: body.customerId ?? null, customerName: body.customerName ?? null, customerPhone: body.customerPhone ?? null, customerVehicleId: body.customerVehicleId ?? null, vehicleText: body.vehicleText ?? null, dueAt: body.dueAt ?? null, comment: body.comment ?? null });
        if (body.items) setItems(r, body.items);
        return bump();
      }
      if (act === 'suggest')
        return ok(r.items.map((it: any) => {
          const n = (it.number ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const hit = products.filter((p) => n && (p.mainNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) === n.slice(0, 5)).slice(0, 3);
          const cat = (hit.length ? hit : products.filter((p) => p.name.toLowerCase().includes(it.name.toLowerCase().split(' ')[0] ?? '')).slice(0, 3)).map((p) => ({ productId: p.id, name: p.name, qualityClass: p.qualityClass, brand: p.brandName, stock: String(p.stock) }));
          const sup = [
            { id: uid(), priceListId: uid(), priceListName: 'Прайс Азия Партс (опт)', supplierId: '00000000-0000-4000-8000-000000000951', supplierName: 'ОсОО «Азия Партс»', number: it.number ?? 'TB-4120', brand: 'Masuma', name: it.name, price: '2100', priceKgs: '2100', currency: 'KGS', stockText: '5', stockQty: '5', leadDays: 1, multiplicity: null, productId: null, updatedAt: ago(0, 3), analog: null },
            { id: uid(), priceListId: uid(), priceListName: 'Hongda FOB', supplierId: '00000000-0000-4000-8000-000000000953', supplierName: 'Guangzhou Hongda', number: it.number ?? 'HD-8820', brand: 'Toyota', name: it.name, price: '42', priceKgs: '3671', currency: 'USD', stockText: '>10', stockQty: '10', leadDays: 30, multiplicity: null, productId: null, updatedAt: ago(9), analog: null },
            { id: uid(), priceListId: uid(), priceListName: 'Улан', supplierId: '00000000-0000-4000-8000-000000000954', supplierName: 'Контейнер 118 — Улан', number: it.number ?? '—', brand: 'б/у Япония', name: it.name, price: '1500', priceKgs: '1500', currency: 'KGS', stockText: '1', stockQty: '1', leadDays: 0, multiplicity: null, productId: null, updatedAt: ago(3), analog: null },
          ];
          return { itemId: it.id, name: it.name, number: it.number, catalog: cat, suppliers: sup };
        }));
      if (act === 'offer') {
        const it = r.items.find((x: any) => x.id === body.itemId);
        it.offers = body.offers.map((o: any) => ({ ...o, id: uid(), price: s2(Number(o.price)) }));
        return bump(['new', 'selecting'].includes(r.status) ? 'offered' : undefined);
      }
      if (act === 'choose') {
        const it = r.items.find((x: any) => x.id === body.itemId);
        it.offers = it.offers.map((o: any) => ({ ...o, chosen: o.id === body.offerId }));
        it.salePrice = it.offers.find((o: any) => o.chosen)?.price ?? null;
        return bump();
      }
      if (act === 'order') {
        for (const it of r.items.filter((x: any) => !body.itemIds?.length || body.itemIds.includes(x.id))) Object.assign(it, { sourceId: body.sourceId, sourceKind: body.sourceKind, sourceName: body.sourceKind === 'neighbor' ? 'Контейнер 118 — Улан' : 'ОсОО «Азия Партс»', purchaseOrderNumber: body.sourceKind === 'supplier' ? 'ЗП-000063' : null });
        return bump('ordered');
      }
      if (act === 'status') return bump(body.status, body.note);
      if (act === 'prepay') {
        r.prepaid = s2(Number(r.prepaid) + Number(body.amount));
        addMoney(accounts[0].id, Number(body.amount), 'sale', { comment: `Предоплата ${r.number}` });
        return bump(undefined);
      }
      if (act === 'refuse') {
        r.refuseReason = body.reason;
        r.closedAt = now();
        return bump('refused', body.reason);
      }
      if (act === 'issue') {
        r.closedAt = now();
        const res = bump('issued');
        return ok({ request: (res as any).data, receipt: { id: uid(), number: 'К1А-000470' } });
      }
      if (act === 'message') {
        const v = reqView(r);
        const text = `Здравствуйте${v.customer?.name ? `, ${v.customer.name}` : r.customerName ? `, ${r.customerName}` : ''}! Ваша деталь пришла: ${r.items.map((i: any) => i.name).join(', ')}. Заявка ${r.number}. Автозапчасти «Тетик», Дордой, конт. 214`;
        const phone = (v.customer?.phone ?? r.customerPhone ?? '').replace(/\D/g, '').replace(/^0/, '996');
        return ok({ text, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` });
      }
    }
    if (url === 'waitlist' && method === 'get') return ok(waitlist.filter((w) => !params.status || String(params.status).split(',').includes(w.status)));
    if (url === 'waitlist' && method === 'post') {
      const p = body.productId ? prod(body.productId) : null;
      const w = { id: uid(), status: 'waiting', productId: body.productId ?? null, productName: p?.name ?? null, query: body.query ?? null, qty: s2(Number(body.qty ?? 1)), customerId: body.customerId ?? null, customerName: body.customerName ?? null, customerPhone: body.customerPhone ?? null, createdAt: now(), notifiedAt: null, note: body.note ?? null, version: 1 };
      waitlist.unshift(w);
      return ok(w, 201);
    }
    m = url.match(/^waitlist\/([\w-]+)\/status$/);
    if (m) {
      const w = waitlist.find((x) => x.id === m![1]);
      if (!w) return err(404, 'NOT_FOUND', 'Запись не найдена');
      Object.assign(w, { status: body.status, version: w.version + 1 });
      return ok(w);
    }

    // ── деньги
    if (url === 'money/accounts' && method === 'get') {
      let list = accounts.filter((a) => (params.includeInactive === true || params.includeInactive === 'true' ? true : a.isActive));
      if (params.type) list = list.filter((a) => a.type === params.type);
      return ok(list.map(accView));
    }
    if (url === 'money/accounts' && method === 'post') {
      const a = acc(body.type, body.name, body.currency ?? 'KGS', 0, { details: body.details });
      accounts.push(a);
      return ok(accView(a), 201);
    }
    m = url.match(/^money\/accounts\/([\w-]+)$/);
    if (m) {
      const a = accounts.find((x) => x.id === m![1]);
      if (!a) return err(404, 'NOT_FOUND', 'Счёт не найден');
      Object.assign(a, { name: body.name ?? a.name, details: body.details ?? a.details, isActive: body.isActive ?? a.isActive, version: a.version + 1 });
      return ok(accView(a));
    }
    if (url === 'money/movements') {
      let list = movements.filter((x) => (!params.accountId || x.accountId === params.accountId) && (!params.from || x.movedAt >= params.from) && (!params.to || x.movedAt <= params.to));
      list = [...list].sort((a, b) => b.movedAt.localeCompare(a.movedAt));
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit).map((x) => ({ ...x, accountName: accounts.find((a) => a.id === x.accountId)?.name })), total: list.length });
    }
    if (url === 'money/operations') {
      const amt = Number(body.amount);
      const from = accounts.find((a) => a.id === body.fromAccountId);
      if (from && body.type !== 'cash_in' && from._balance < amt) return err(422, 'NOT_ENOUGH_MONEY', `На счёте «${from.name}» только ${from._balance.toLocaleString('ru-RU')}`);
      if (body.type !== 'cash_in') addMoney(body.fromAccountId, -amt, body.type === 'exchange' ? 'exchange' : body.type === 'cash_out' ? 'cash_out' : 'transfer', { comment: body.comment });
      if (body.type !== 'cash_out') addMoney(body.toAccountId, body.type === 'exchange' ? Number(body.toAmount) : amt, body.type === 'exchange' ? 'exchange' : body.type === 'cash_in' ? 'cash_in' : 'transfer', { comment: body.comment });
      return ok({ ok: true }, 201);
    }
    if (url === 'money/transfers/summary') {
      const un = movements.filter((x) => x.verifyStatus === 'unverified');
      const grp = (key: (x: any) => string) => {
        const mm = new Map<string, any[]>();
        for (const x of un) mm.set(key(x), [...(mm.get(key(x)) ?? []), x]);
        return [...mm.entries()].map(([k, xs]) => ({ k, count: xs.length, amount: s2(xs.reduce((a, x) => a + Number(x.amount), 0)), x: xs[0] }));
      };
      return ok({
        byDay: grp((x) => x.movedAt.slice(0, 10)).map((g) => ({ day: g.k, count: g.count, amount: g.amount })).sort((a, b) => b.day.localeCompare(a.day)),
        bySeller: grp((x) => x._seller ?? '—').map((g) => ({ membershipId: null, seller: g.k, count: g.count, amount: g.amount })),
        byWallet: grp((x) => x.accountId).map((g) => ({ accountId: g.k, wallet: accounts.find((a) => a.id === g.k)?.name, count: g.count, amount: g.amount })),
      });
    }
    if (url === 'money/transfers' && method === 'get') {
      const st = params.status ?? 'unverified';
      const list = movements.filter((x) => x.verifyStatus === st && (!params.accountId || x.accountId === params.accountId));
      return ok({ items: list.map((x) => ({ id: x.id, accountId: x.accountId, accountName: accounts.find((a) => a.id === x.accountId)?.name, amount: x.amount, currency: x.currency, movedAt: x.movedAt, status: x.verifyStatus, documentId: null, receiptId: uid(), receiptNumber: x.documentNumber, customerName: x.counterpartyName, sellerName: x._seller, fileId: null })), total: list.length });
    }
    if (url === 'money/transfers/verify') {
      let n = 0;
      for (const x of movements) if (body.ids.includes(x.id) && x.verifyStatus === 'unverified') (x.verifyStatus = 'verified'), n++;
      return ok({ verified: n });
    }
    m = url.match(/^money\/transfers\/([\w-]+)\/not-received$/);
    if (m) {
      const x = movements.find((y) => y.id === m![1]);
      if (!x) return err(404, 'NOT_FOUND', 'Перевод не найден');
      x.verifyStatus = 'not_received';
      const a = accounts.find((y) => y.id === x.accountId);
      if (a) a._balance -= Number(x.amount);
      if (body.action === 'debt' && x.counterpartyId) debt(cById(x.counterpartyId), Number(x.amount), 0, { kind: 'not_received', what: `Перевод не поступил (${x.documentNumber})` });
      return ok({ ok: true });
    }
    if (url === 'money/transfers/match') {
      const un = movements.filter((x) => x.verifyStatus === 'unverified' && x.accountId === body.accountId);
      const matches = un.slice(0, Math.max(1, un.length - 1)).map((x, i) => ({ transferId: x.id, row: i + 2, amount: x.amount }));
      return ok({ matches, unmatchedStatementRows: [{ row: 30, at: ago(1), amount: '3500.00' }], unmatchedTransfers: un.slice(matches.length).map((x) => x.id) });
    }
    if (url === 'money/expense-articles' && method === 'get') return ok(articles);
    if (url === 'money/expense-articles' && method === 'post') {
      const a = { id: uid(), name: body.name, code: null, kind: body.kind ?? 'expense', isSystem: false, isActive: true };
      articles.push(a);
      return ok(a, 201);
    }
    if (url === 'money/expenses' && method === 'get') {
      const list = expenses.filter((e) => (!params.from || e.date >= params.from) && (!params.to || e.date <= params.to) && (!params.articleId || e.articleId === params.articleId)).sort((a, b) => b.date.localeCompare(a.date));
      const page = Number(params.page ?? 1);
      const limit = Number(params.limit ?? 50);
      return ok({ items: list.slice((page - 1) * limit, page * limit), total: list.length, totalKgs: s2(list.filter((e) => e.status === 'posted').reduce((a, e) => a + Number(e.amountKgs), 0)) });
    }
    if (url === 'money/expenses' && method === 'post') {
      const a = articles.find((x) => x.id === body.articleId)!;
      const ac = accounts.find((x) => x.id === body.accountId)!;
      const e = { id: uid(), date: body.date ?? day(0), articleId: a.id, articleName: a.name, articleKind: a.kind, accountId: ac.id, accountName: ac.name, currency: ac.currency, amount: s2(Number(body.amount)), amountKgs: s2(Number(body.amount)), storeId, counterpartyId: null, counterpartyName: null, membershipId: null, memberName: null, recurringId: null, comment: body.comment ?? null, status: 'posted' };
      expenses.unshift(e);
      addMoney(ac.id, -Number(body.amount), 'expense', { comment: a.name });
      return ok(e, 201);
    }
    m = url.match(/^money\/expenses\/([\w-]+)\/cancel$/);
    if (m) {
      const e = expenses.find((x) => x.id === m![1]);
      if (!e) return err(404, 'NOT_FOUND', 'Расход не найден');
      e.status = 'cancelled';
      addMoney(e.accountId, Number(e.amount), 'expense', { comment: `Отмена: ${e.articleName}` });
      return ok(e);
    }
    if (url === 'money/recurring-expenses' && method === 'get') return ok(recurring);
    if (url === 'money/recurring-expenses' && method === 'post') {
      const a = articles.find((x) => x.id === body.articleId)!;
      const ac = accounts.find((x) => x.id === body.accountId)!;
      const r = { id: uid(), version: 1, articleId: a.id, articleName: a.name, accountId: ac.id, accountName: ac.name, storeId, amount: s2(Number(body.amount)), currency: ac.currency, dayOfMonth: body.dayOfMonth, nextDate: day(10), comment: body.comment ?? null, isActive: true, lastRunAt: null };
      recurring.push(r);
      return ok(r, 201);
    }
    m = url.match(/^money\/recurring-expenses\/([\w-]+)$/);
    if (m) {
      const r = recurring.find((x) => x.id === m![1]);
      if (!r) return err(404, 'NOT_FOUND', 'Не найдено');
      Object.assign(r, { ...(body.isActive !== undefined ? { isActive: body.isActive } : {}), ...(body.amount ? { amount: s2(Number(body.amount)) } : {}), version: r.version + 1 });
      return ok(r);
    }

    // ── отчёты
    if (url === 'reports')
      return ok(Object.entries(G).map(([group, title]) => ({ group, title, reports: [...REPORTS.filter((r) => r.group === group), ...EXTERNAL.filter((r) => r.group === group)] })).filter((g) => g.reports.length));
    if (url === 'reports/views' && method === 'get') return ok(views);
    if (url === 'reports/views' && method === 'post') {
      const v = { id: uid(), report: body.report, name: body.name, params: body.params, shared: !!body.shared, mine: true };
      views.unshift(v);
      return ok(v, 201);
    }
    m = url.match(/^reports\/views\/([\w-]+)$/);
    if (m && method === 'delete') {
      const i = views.findIndex((v) => v.id === m![1]);
      if (i >= 0) views.splice(i, 1);
      return ok(null, 204);
    }
    m = url.match(/^reports\/([\w.]+)(?:\/(xlsx|pdf))?$/);
    if (m && REPORTS.some((r) => r.code === m![1])) {
      if (m[2] === 'xlsx') return ok(new Blob(['demo'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      if (m[2] === 'pdf') return ok(pdf());
      const meta = REPORTS.find((r) => r.code === m![1])!;
      return ok({ report: { code: meta.code, title: meta.title }, filters: params, ...runReport(meta.code, params) });
    }
    return null;
  };
}
