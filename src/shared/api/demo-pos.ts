/* Демо-данные кассы: смены, чеки, оплата, возвраты — в памяти браузера. Только для VITE_DEMO=true. */

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
}

const uid = () => crypto.randomUUID();
const r2 = (n: number) => Math.round(n * 100) / 100;
const now = () => new Date().toISOString();
const RATE = 87.4;

export function createDemoPos(products: P[], storeId: string) {
  const registers = [
    { id: '00000000-0000-4000-8000-000000000401', storeId, code: 'К1', name: 'Касса 1', warehouseId: '00000000-0000-4000-8000-000000000841', isActive: true, version: 1 },
  ];
  const reg = registers[0];
  const cash: Record<string, number> = { KGS: 12500, USD: 40 };
  let shift: any = {
    id: uid(), number: 45, status: 'open', registerId: reg.id, storeId, openedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    closedAt: null, opening: { KGS: '12500.00', USD: '40.00' }, counted: null, expected: null, diff: null, currentMembershipId: 'm', version: 1,
  };
  const closedShifts: any[] = [];
  const receipts = new Map<string, any>();
  let counter = 456;
  const wallets = [
    { id: uid(), type: 'wallet', name: 'MBank — Бакыт — 0555 123 456', currency: 'KGS', storeId, registerId: null, details: {} },
    { id: uid(), type: 'wallet', name: 'O!Деньги — Азамат', currency: 'KGS', storeId, registerId: null, details: {} },
  ];
  const acquiring = [{ id: uid(), type: 'acquiring', name: 'Терминал Optima', currency: 'KGS', storeId, registerId: null, details: {} }];
  const customers = [
    { id: uid(), name: 'Эрлан — СТО «Ак-Жол»', kind: 'company', phone: '0700 112 233', roles: ['sto', 'customer'], groupName: 'СТО', debtKgs: '18400', lastVisit: now() },
    { id: uid(), name: 'Айбек Токтогулов', kind: 'person', phone: '0555 908 070', roles: ['customer'], groupName: 'Розница', debtKgs: '0', lastVisit: now() },
    { id: uid(), name: 'Нурлан (такси)', kind: 'person', phone: '0779 404 404', roles: ['customer'], groupName: 'Таксопарки', debtKgs: '2500', lastVisit: now() },
    { id: uid(), name: 'Контейнер 118 — Улан', kind: 'person', phone: '0505 118 118', roles: ['neighbor'], groupName: null, debtKgs: '0', lastVisit: null },
  ];

  const view = (r: any) => {
    const lines = r.lines.map((l: any, i: number) => {
      const gross = r2(l.price * l.qty);
      const lineDisc = l.discountPercent ? r2((gross * Number(l.discountPercent)) / 100) : l.discountAmount ? Number(l.discountAmount) : 0;
      return { ...l, lineNo: i + 1, lineDiscount: lineDisc, promoDiscount: 0, receiptDiscount: 0, bonusPaid: 0, amount: r2(gross - lineDisc), _gross: gross };
    });
    const subtotal = r2(lines.reduce((a: number, l: any) => a + l._gross, 0));
    const lineDisc = lines.reduce((a: number, l: any) => a + l.lineDiscount, 0);
    const afterLine = subtotal - lineDisc;
    const rd = r.receiptDiscountPercent ? r2((afterLine * Number(r.receiptDiscountPercent)) / 100) : r.receiptDiscountAmount ? Number(r.receiptDiscountAmount) : 0;
    if (rd && afterLine > 0) for (const l of lines) {
      l.receiptDiscount = r2((rd * l.amount) / afterLine);
      l.amount = r2(l.amount - l.receiptDiscount);
    }
    const total = r2(afterLine - rd);
    for (const l of lines) delete l._gross;
    const c = customers.find((x) => x.id === r.customerId);
    return {
      ...r, lines, subtotal, discountTotal: r2(lineDisc + rd), total, totalUsd: (total / RATE).toFixed(2), rate: RATE,
      customerName: c?.name ?? null, customerPhone: c?.phone ?? null, registerName: reg.name, sellerName: 'Бакыт Асанов',
    };
  };

  const buildLines = (r: any, input: any[]) => {
    const old = new Map(r.lines.map((l: any) => [l.id, l]));
    return input.map((li) => {
      if (li.lineId && old.has(li.lineId)) {
        const o: any = old.get(li.lineId);
        return { ...o, qty: Number(li.qty), discountPercent: li.discountPercent ?? null, discountAmount: li.discountAmount ?? null, ...(li.price ? { price: Number(li.price), customPrice: true } : {}) };
      }
      const p = products.find((x) => x.id === li.productId);
      const name = li.free?.name ?? li.neighbor?.name ?? p?.name ?? 'Позиция';
      const price = li.price ? Number(li.price) : Number(p?.retailPrice ?? 0);
      return {
        id: uid(), productId: p?.id ?? uid(), name, sku: p?.sku ?? '', kind: 'goods', isSerial: false, unitId: uid(), unitName: p?.baseUnit ?? 'шт', factor: 1,
        qty: Number(li.qty), price, place: p ? ['A-3', 'B-1', 'Витрина', 'C-2'][p.name.length % 4] : null, discountPercent: li.discountPercent ?? null,
        discountAmount: li.discountAmount ?? null, customPrice: !!li.price, free: li.free ?? null, neighbor: li.neighbor ?? null, priceSource: 'retail_all',
      };
    });
  };

  const err = (status: number, code: string, message: string, details?: unknown) => ({ error: { status, code, message, details } });
  const ok = (data: unknown, status = 200) => ({ status, data });

  const report = () => {
    const done = [...receipts.values()].filter((r) => r.status === 'completed' && r.shiftId === shift.id);
    const sales = done.filter((r) => r.kind === 'sale').map(view);
    const byMethod: Record<string, any> = {};
    for (const r of done) for (const p of r.payments) {
      const k = p.method + p.currency;
      byMethod[k] ??= { method: p.method, currency: p.currency, amount: 0, amountKgs: 0 };
      byMethod[k].amount = r2(byMethod[k].amount + Number(p.amount) * (r.kind === 'return' ? -1 : 1));
    }
    return {
      shiftId: shift.id, number: shift.number, register: reg.name, status: shift.status, openedAt: shift.openedAt, closedAt: shift.closedAt,
      salesCount: sales.length + 28, salesTotal: r2(sales.reduce((a, r) => a + r.total, 0) + 71240), returnsCount: 1, returnsTotal: 1300,
      discountsTotal: 820, debtTotal: 4200,
      byMethod: [{ method: 'cash', currency: 'KGS', amount: 48300, amountKgs: 48300 }, { method: 'transfer', currency: 'KGS', amount: 18750, amountKgs: 18750 }, { method: 'card', currency: 'KGS', amount: 4190, amountKgs: 4190 }, ...Object.values(byMethod)],
      byAccount: [{ accountId: wallets[0].id, name: wallets[0].name, type: 'wallet', currency: 'KGS', amount: 11200, unverified: 4200 }, { accountId: wallets[1].id, name: wallets[1].name, type: 'wallet', currency: 'KGS', amount: 7550, unverified: 0 }],
      toOwner: { items: [{ holderName: 'Азамат', accountName: wallets[1].name, amount: 7550 }], total: '7550.00' },
      operations: [],
      cash: [
        { accountId: 'k', currency: 'KGS', opening: shift.opening.KGS, sales: 48300, refunds: -1300, debts: 0, operations: -20000, diffs: 0, balance: cash.KGS.toFixed(2) },
        { accountId: 'u', currency: 'USD', opening: shift.opening.USD, sales: 60, refunds: 0, debts: 0, operations: 0, diffs: 0, balance: cash.USD.toFixed(2) },
      ],
      counted: shift.counted, expected: shift.expected, diff: shift.diff,
    };
  };

  // Несколько оплаченных чеков для истории
  for (let i = 0; i < 6; i++) {
    const p = products[(i * 3) % products.length];
    const r: any = {
      id: uid(), kind: i === 4 ? 'return' : 'sale', number: `К1А-000${440 + i}`, status: 'completed', storeId, registerId: reg.id, shiftId: shift.id,
      customerId: i % 2 ? customers[i % 3].id : null, customerVehicleId: null, vehicleLabel: i === 1 ? '01KG 482 AKJ' : null, masterId: null, label: null,
      receiptDiscountPercent: null, receiptDiscountAmount: null, paid: 0, change: 0, changeCurrency: 'KGS', debtAmount: i === 3 ? 2100 : 0,
      createdAt: new Date(Date.now() - (i + 1) * 2_700_000).toISOString(), completedAt: new Date(Date.now() - (i + 1) * 2_700_000).toISOString(), version: 3,
      lines: buildLines({ lines: [] }, [{ productId: p.id, qty: String(1 + (i % 3)) }]), payments: [],
    };
    const v = view(r);
    r.payments = [{ id: uid(), method: i === 3 ? 'debt' : i % 2 ? 'transfer' : 'cash', accountId: null, accountName: i % 2 ? wallets[0].name : null, currency: 'KGS', amount: v.total, amountKgs: v.total, verifyStatus: i % 2 ? 'unverified' : null }];
    receipts.set(r.id, r);
  }
  const def: any = {
    id: uid(), kind: 'sale', number: 'ЧЕРН-1', status: 'deferred', storeId, registerId: reg.id, shiftId: null, customerId: customers[0].id, customerVehicleId: null,
    vehicleLabel: 'Camry 40', masterId: null, label: 'Эрлан, Камри — ждёт мастера', receiptDiscountPercent: null, receiptDiscountAmount: null, paid: 0, change: 0,
    changeCurrency: 'KGS', debtAmount: 0, createdAt: new Date(Date.now() - 1_800_000).toISOString(), completedAt: null, version: 2, payments: [],
    lines: buildLines({ lines: [] }, [{ productId: products[0].id, qty: '1' }, { productId: products[9].id, qty: '2' }]),
  };
  receipts.set(def.id, def);

  const listItem = (r: any) => {
    const v = view(r);
    return {
      id: r.id, number: r.number, kind: r.kind, status: r.status, label: r.label, total: v.total, paid: r.paid, debtAmount: r.debtAmount,
      createdAt: r.createdAt, completedAt: r.completedAt, registerId: reg.id, registerName: reg.name, customerId: r.customerId,
      customerName: v.customerName, sellerName: 'Бакыт Асанов', linesCount: r.lines.length, version: r.version,
    };
  };

  // ── Касса без интернета (демо) ──
  const tenantId = '00000000-0000-4000-8000-000000000021';
  const seller = { membershipId: '00000000-0000-4000-8000-000000000011', name: 'Бакыт Асанов' };
  const seller2 = { membershipId: '00000000-0000-4000-8000-000000000012', name: 'Айбек Токтогулов' };
  let lastOpSeq = 0;
  const cacheResponse = async () => {
    const { makePinHash } = await import('@/entities/pos-offline/pin');
    const secret = 'demo-device-secret';
    return {
      full: true, serverTime: now(), cursor: now(),
      device: { id: 'dev-1', series: 'А', numberPrefix: 'К1А', lastNumber: `К1А-000${counter}`, lastOpSeq: String(lastOpSeq) },
      store: { id: storeId, name: 'Дордой, контейнер 214', code: 'ДОР', timezone: 'Asia/Bishkek', registerMode: 'single', address: 'Дордой, контейнер 214', phone: '0555 123 456' },
      register: { id: reg.id, code: reg.code, name: reg.name, warehouseId: reg.warehouseId },
      offlineRules: { cash: true, card: true, transfer: true, debt: true, bonuses: true, serial: true, reserved: true, returnOwnRegister: true, returnOtherRegisterOrWithoutReceipt: true, promotions: true, oneTimePromocode: false, neighbor: true, createProduct: 'draft', newCustomer: true, shift: true, ocr: false },
      settings: { priceRounding: 1 },
      rates: [{ currency: 'USD', rate: String(RATE) }],
      priceTypes: [{ id: 'pt-retail', name: 'Розничная', code: 'retail', currency: 'KGS', isRetail: true }],
      categories: [],
      products: products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, kind: 'goods', brandName: p.brandName, categoryId: p.categoryId ?? null, qualityClass: p.qualityClass ?? 'aftermarket', baseUnit: p.baseUnit, isSerial: false, noStockControl: false, priceNegotiable: false, minPrice: null, searchText: `${p.name} ${p.brandName} ${p.mainNumber} ${p.categoryName ?? ''}`.toLowerCase(), units: null })),
      removed: { products: [] },
      barcodes: products.map((p, i) => ({ productId: p.id, unitId: 'u', barcode: `46000000000${String(i).padStart(2, '0')}` })),
      numbers: products.filter((p) => p.mainNumber).map((p) => {
        const n = (p.mainNumber as string).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return { productId: p.id, number: p.mainNumber, normalized: n, skeleton: n, type: 'manufacturer' };
      }),
      crosses: [],
      prices: products.map((p) => ({ productId: p.id, priceTypeId: 'pt-retail', storeId: null, unitId: null, price: String(p.retailPrice), currency: 'KGS', validFrom: '2026-01-01T00:00:00Z' })),
      stock: products.map((p) => ({ warehouseId: reg.warehouseId, productId: p.id, qty: String(p.stock) })),
      customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, groupId: null, priceTypeId: null, discountPercent: null, debtLimit: '50000', roles: c.roles, debt: c.debtKgs })),
      staff: [
        { ...seller, isOwner: true, active: true, pinHash: await makePinHash('1234', tenantId, seller.membershipId, secret), permissions: ['*'], maxDiscountPercent: 100 },
        { ...seller2, isOwner: false, active: true, pinHash: await makePinHash('5678', tenantId, seller2.membershipId, secret), permissions: ['pos.use'], maxDiscountPercent: 5 },
      ],
      accounts: [...wallets, ...acquiring].map((a) => ({ id: a.id, type: a.type, name: a.name, currency: a.currency, registerId: null, holderMembershipId: null })),
      receipts: [],
    };
  };

  return (url: string, method: string, params: Record<string, string>, body: any): Res | Promise<Res> => {
    if (url === 'pos-devices' && method === 'post')
      return ok({ deviceId: 'dev-1', token: 'demo-device-token', secret: 'demo-device-secret', series: 'А', numberPrefix: 'К1А', register: { id: reg.id, code: reg.code, name: reg.name, storeId, warehouseId: reg.warehouseId } });
    if (url === 'pos-device/cache') return cacheResponse().then((d) => ok(d));
    if (url === 'pos-device/sync') {
      const results = (body.ops as any[]).map((o) => {
        lastOpSeq = Math.max(lastOpSeq, o.seq);
        if (o.type === 'sale') counter = Math.max(counter, Number(String(o.payload.number).split('-')[1]));
        return { seq: o.seq, id: o.id, status: 'accepted', result: o.type === 'shift_open' ? { shiftId: o.id, number: shift.number + 1 } : o.type === 'sale' ? { receiptId: o.id, number: o.payload.number } : {} };
      });
      return ok({ results, lastOpSeq, serverTime: now(), clockSkewSec: 0, warnings: [] });
    }
    if (url === 'pos-device/pin-login') {
      if (body.pin === '1234') return ok({ accessToken: 'demo-token', refreshToken: 'r', ...seller });
      if (body.pin === '5678') return ok({ accessToken: 'demo-token', refreshToken: 'r', ...seller2 });
      return err(401, 'PIN_INVALID', 'Неверный PIN');
    }
    if (url === 'ocr/recognize') return err(503, 'OCR_UNAVAILABLE', 'Распознавание не подключено (демо)');
    if (url === 'registers') return ok(registers);
    if (url === 'rates') return ok({ current: [{ currency: 'USD', rate: String(RATE), setAt: now() }], history: [] });
    if (url === 'shifts/current') return ok({ register: reg, shift: shift.status === 'open' ? shift : null, lastClosed: shift.status === 'closed' ? shift : null, cashBalance: { KGS: cash.KGS.toFixed(2), USD: cash.USD.toFixed(2) } });
    if (url === 'shifts/open' && method === 'post') {
      shift = { ...shift, id: uid(), number: shift.number + 1, status: 'open', openedAt: now(), closedAt: null, opening: body.cash, counted: null, expected: null, diff: null, version: 1 };
      return ok(shift);
    }
    if (url === 'shifts') return ok({ items: [shift, ...closedShifts].map((s) => ({ ...s, registerName: reg.name, openedByName: 'Бакыт Асанов', closedByName: s.closedAt ? 'Бакыт Асанов' : null, autoClosed: false })), total: closedShifts.length + 1 });
    let m = url.match(/^shifts\/([\w-]+)\/(x-report|close|cash)$/);
    if (m) {
      if (m[2] === 'x-report') return ok(report());
      if (m[2] === 'cash') {
        const sign = body.type === 'cash_out' ? -1 : 1;
        cash[body.currency ?? 'KGS'] += sign * Number(body.amount);
        return ok({ ok: true });
      }
      if ([...receipts.values()].some((r) => r.status === 'open' && r.shiftId === shift.id && r.lines.length)) return err(409, 'OPEN_RECEIPTS', 'На кассе есть незавершённые чеки — оплатите, отложите или отмените их');
      const expected = { KGS: cash.KGS.toFixed(2), USD: cash.USD.toFixed(2) };
      const diff = Object.fromEntries(Object.entries(body.counted).map(([k, v]) => [k, (Number(v) - Number((expected as any)[k] ?? 0)).toFixed(2)]));
      shift = { ...shift, status: 'closed', closedAt: now(), counted: body.counted, expected, diff, version: shift.version + 1 };
      closedShifts.unshift(shift);
      return ok(shift);
    }

    if (url === 'pos/receipts' && method === 'post') {
      if (shift.status !== 'open') return err(409, 'SHIFT_CLOSED', 'Смена на кассе не открыта');
      const r: any = {
        id: uid(), kind: 'sale', number: `ЧЕРН-${Date.now().toString(36)}`, status: 'open', storeId, registerId: body.registerId, shiftId: shift.id,
        customerId: body.customerId ?? null, customerVehicleId: null, vehicleLabel: body.vehicleLabel ?? null, masterId: null, label: null,
        receiptDiscountPercent: body.receiptDiscountPercent ?? null, receiptDiscountAmount: body.receiptDiscountAmount ?? null,
        paid: 0, change: 0, changeCurrency: 'KGS', debtAmount: 0, createdAt: now(), completedAt: null, version: 1, payments: [], lines: [],
      };
      r.lines = buildLines(r, body.lines ?? []);
      receipts.set(r.id, r);
      return ok(view(r));
    }
    if (url === 'pos/receipts') {
      const st = (params.status ?? '').split(',').filter(Boolean);
      const list = [...receipts.values()].filter((r) => !st.length || st.includes(r.status)).sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt));
      return ok({ items: list.map(listItem), total: list.length });
    }
    m = url.match(/^pos\/receipts\/([\w-]+)(?:\/(pay|defer|resume|cancel|printable|share|print))?$/);
    if (m) {
      const r = receipts.get(m[1]);
      if (!r) return err(404, 'NOT_FOUND', 'Чек не найден');
      const action = m[2];
      if (!action && method === 'get') return ok(view(r));
      if (!action && method === 'patch') {
        if (body.version !== r.version) return err(409, 'VERSION_CONFLICT', 'Документ изменён другим пользователем, обновите страницу');
        if (body.lines) r.lines = buildLines(r, body.lines);
        for (const k of ['customerId', 'vehicleLabel', 'receiptDiscountPercent', 'receiptDiscountAmount', 'label']) if (k in body) r[k] = body[k];
        r.version++;
        return ok(view(r));
      }
      if (action === 'pay') {
        if (body.version !== r.version) return err(409, 'VERSION_CONFLICT', 'Документ изменён другим пользователем, обновите страницу');
        const v = view(r);
        if (r.receiptDiscountPercent && Number(r.receiptDiscountPercent) > 10 && !body.pin) return err(409, 'DISCOUNT_OVER_LIMIT', 'Скидка выше вашего лимита (10%) — нужен PIN управляющего', { requiresPin: true, action: 'discount' });
        if (body.payments.some((p: any) => p.method === 'debt') && !r.customerId) return err(400, 'CUSTOMER_REQUIRED', 'В долг — только клиенту из базы');
        const paidKgs = body.payments.reduce((a: number, p: any) => a + Number(p.amount) * (p.currency === 'USD' ? RATE : 1), 0);
        if (paidKgs + 0.01 < v.total) return err(400, 'UNDERPAID', 'Оплачено меньше суммы чека');
        for (const p of body.payments) if (p.method === 'cash') cash[p.currency ?? 'KGS'] += Number(p.amount);
        const change = r2(paidKgs - v.total);
        cash.KGS -= change;
        Object.assign(r, {
          status: 'completed', number: `К1А-000${++counter}`, completedAt: now(), version: r.version + 1, paid: r2(paidKgs), change, changeCurrency: body.changeCurrency ?? 'KGS',
          debtAmount: body.payments.filter((p: any) => p.method === 'debt').reduce((a: number, p: any) => a + Number(p.amount), 0),
          payments: body.payments.map((p: any) => ({ id: uid(), method: p.method, accountId: p.accountId ?? null, accountName: [...wallets, ...acquiring].find((w) => w.id === p.accountId)?.name ?? null, currency: p.currency ?? 'KGS', amount: Number(p.amount), amountKgs: Number(p.amount) * (p.currency === 'USD' ? RATE : 1), verifyStatus: p.method === 'transfer' ? 'unverified' : null })),
        });
        if (r.changeCurrency === 'USD') r.change = r2(change / RATE);
        return ok(view(r));
      }
      if (action === 'defer') {
        Object.assign(r, { status: 'deferred', label: body.label ?? null, shiftId: null, version: r.version + 1 });
        return ok(view(r));
      }
      if (action === 'resume') {
        Object.assign(r, { status: 'open', shiftId: shift.id, registerId: body.registerId, version: r.version + 1 });
        return ok(view(r));
      }
      if (action === 'cancel') {
        Object.assign(r, { status: 'cancelled', version: r.version + 1 });
        return ok(view(r));
      }
      if (action === 'print') return err(503, 'AGENT_OFFLINE', 'Агент печати не подключён');
      if (action === 'share') return ok({ url: 'https://example.kg/r/demo', text: `Чек ${r.number}`, whatsappUrl: `https://wa.me/?text=${encodeURIComponent('Чек ' + r.number)}` });
      if (action === 'printable') {
        const v = view(r);
        return ok({
          kind: r.kind, title: r.kind === 'return' ? 'Возврат' : 'Товарный чек', store: { name: 'Автозапчасти «Тетик»', address: 'Дордой, контейнер 214', phone: '0555 123 456' },
          number: r.number, date: new Date(r.completedAt ?? r.createdAt).toLocaleString('ru-RU'), register: reg.name, seller: 'Бакыт', customer: v.customerName, vehicle: r.vehicleLabel,
          lines: v.lines.map((l: any) => ({ name: l.free?.name ?? l.name, qty: String(l.qty), unit: l.unitName, price: String(l.price), discount: String(l.lineDiscount + l.receiptDiscount), amount: String(l.amount), warranty: 'Гарантия 30 дн.', returnRule: 'Возврат 14 дн.' })),
          subtotal: String(v.subtotal), discount: String(v.discountTotal), total: String(v.total), totalUsd: v.totalUsd, rate: String(RATE),
          payments: r.payments.map((p: any) => ({ method: ({ cash: 'Наличные', card: 'Карта', transfer: 'Перевод', debt: 'В долг' } as any)[p.method] ?? p.method, account: p.accountName, currency: p.currency, amount: String(p.amount) })),
          change: r.change ? { amount: String(r.change), currency: r.changeCurrency } : null, debt: r.debtAmount ? String(r.debtAmount) : null, qr: 'https://example.kg/r/demo', footer: 'Спасибо за покупку!',
        });
      }
    }
    m = url.match(/^products\/by-barcode\/(.+)$/);
    if (m) {
      const code = decodeURIComponent(m[1]);
      const i = Number(code.slice(-2)) % products.length;
      const p = /^\d{12,13}$/.test(code) ? products[i] : null;
      return ok({ barcode: code, matches: p ? [{ productId: p.id, unitId: uid(), unitName: p.baseUnit, factor: '1', name: p.name, sku: p.sku, status: 'active' }] : [], ambiguous: false });
    }
    if (url === 'money/accounts') return ok(params.type === 'wallet' ? wallets : params.type === 'acquiring' ? acquiring : [...wallets, ...acquiring]);
    if (url === 'counterparties') {
      const q = (params.q ?? '').toLowerCase();
      const list = customers.filter((c) => (!params.role || c.roles.includes(params.role)) && (!q || (c.name + c.phone).toLowerCase().includes(q)));
      return ok({ items: list, total: list.length });
    }
    if (url === 'pos/returns/lookup') {
      const code = (params.code ?? '').trim().toUpperCase();
      const r = [...receipts.values()].find((x) => x.kind === 'sale' && x.status === 'completed' && (x.number.toUpperCase() === code || code.endsWith(x.number.slice(-3))));
      if (!r) return err(404, 'NOT_FOUND', 'Чек продажи не найден');
      const v = view(r);
      return ok({ ...v, daysSinceSale: 0, lines: v.lines.map((l: any) => ({ ...l, returnedQty: '0', returnableQty: String(l.qty), returnableAmount: String(l.amount), returnPeriodExpired: false })) });
    }
    if (url === 'pos/returns' && method === 'post') {
      const sale = receipts.get(body.saleReceiptId);
      const sv = view(sale);
      const total = r2(body.lines.reduce((a: number, li: any) => {
        const l = sv.lines.find((x: any) => x.id === li.saleLineId);
        return a + (l ? (l.amount / l.qty) * Number(li.qty) : 0);
      }, 0));
      const r: any = { ...sale, id: uid(), kind: 'return', number: `К1А-000${++counter}`, status: 'completed', completedAt: now(), createdAt: now(), lines: sale.lines.filter((l: any) => body.lines.some((x: any) => x.saleLineId === l.id)), payments: [{ id: uid(), method: 'cash', currency: 'KGS', amount: total, amountKgs: total, accountId: null, accountName: null, verifyStatus: null }] };
      receipts.set(r.id, r);
      cash.KGS -= total;
      return ok({ ...view(r), total });
    }
    return null;
  };
}
