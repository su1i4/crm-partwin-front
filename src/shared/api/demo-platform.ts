/* Демо админки платформы и доступа поддержки. Только для VITE_DEMO=true. */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Res = { status: number; data: unknown } | { error: { status: number; code: string; message: string; details?: unknown } } | null;

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const ago = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ok = (data: unknown, status = 200) => ({ status, data });
const err = (status: number, code: string, message: string) => ({ error: { status, code, message } });

export function createDemoPlatform(ownTenantId: string) {
  const me = { id: uid(), name: 'Улан Сатыбалдиев', role: 'admin' as const };
  const t = (id: string, name: string, shopType: string, city: string, status: string, until: number | null, owner: string, phone: string, stats: [number, number, number, number, number, number | null], created: number, extra: any = {}) => ({
    id, name, shopType, city, phone, status, plan: status === 'trial' ? null : shopType === 'wholesale' ? 'Опт' : 'Магазин', limits: shopType === 'container' ? { stores: 1, registers: 2, staff: 3 } : null,
    subscriptionUntil: until == null ? null : inDays(until), createdAt: ago(created), ownerName: owner, ownerPhone: phone,
    stores: stats[0], registers: stats[1], staff: stats[2], products: stats[3], receipts30d: stats[4], lastActivity: stats[5] == null ? null : ago(0, stats[5]), ...extra,
  });
  const tenants: any[] = [
    t(ownTenantId, 'Автозапчасти «Тетик»', 'city', 'Бишкек', 'active', 64, 'Бакыт Асанов', '0555 123 456', [3, 4, 7, 3412, 1840, 0.1], 120, { inn: '20101199000123', address: 'Дордой, контейнер 214' }),
    t(uid(), 'Japan Parts Ош', 'city', 'Ош', 'trial', 5, 'Мирлан Абдыкадыров', '0772 445 566', [1, 1, 2, 640, 212, 3], 9),
    t(uid(), 'Контейнер 118 — Нурик', 'container', 'Бишкек', 'active', 3, 'Нурбек Т.', '0700 118 118', [1, 1, 1, 288, 403, 20], 61),
    t(uid(), 'Азия Партс Опт', 'wholesale', 'Бишкек', 'active', 201, 'Чынгыз Осмонов', '0555 900 900', [2, 3, 14, 12840, 3120, 0.5], 210),
    t(uid(), 'Авто-Лидер Каракол', 'city', 'Каракол', 'suspended', -12, 'Эркин С.', '0703 222 333', [1, 2, 3, 1990, 0, 300], 150),
    t(uid(), 'Ремонт-Сервис Токмок', 'container', 'Токмок', 'trial', -2, 'Азамат К.', '0505 444 222', [1, 1, 1, 40, 6, 72], 16),
  ];
  const sessions: any[] = [
    { id: uid(), tenantId: tenants[0].id, adminId: me.id, status: 'ended', reason: 'Не проводилась приёмка ПР-000318', emergency: false, canWrite: true, showMoney: false, startedAt: ago(9), expiresAt: ago(9, -1), endedAt: ago(9, -0.5), createdAt: ago(9), adminName: me.name },
    { id: uid(), tenantId: tenants[4].id, adminId: me.id, status: 'declined', reason: 'Проверка перед приостановкой', emergency: false, canWrite: false, showMoney: false, startedAt: null, expiresAt: null, endedAt: ago(13), createdAt: ago(13), adminName: me.name },
  ];
  let grant: any = null;
  const journal: any[] = [
    { id: uid(), created_at: ago(0, 1), admin_id: me.id, adminName: me.name, action: 'admin.login', tenant_id: null, details: {}, ip: '212.112.100.4' },
    { id: uid(), created_at: ago(2), admin_id: me.id, adminName: me.name, action: 'tenant.subscription', tenant_id: tenants[3].id, details: { after: { status: 'active', plan: 'Опт', note: 'Оплата MBank, 12 мес' } }, ip: '212.112.100.4' },
    { id: uid(), created_at: ago(9), admin_id: me.id, adminName: me.name, action: 'support.request', tenant_id: tenants[0].id, details: { reason: 'Не проводилась приёмка ПР-000318' }, ip: '212.112.100.4' },
    { id: uid(), created_at: ago(12), admin_id: me.id, adminName: me.name, action: 'tenant.subscription', tenant_id: tenants[4].id, details: { after: { status: 'suspended', note: 'Не оплачено 2 мес' } }, ip: '212.112.100.4' },
    { id: uid(), created_at: ago(20), admin_id: me.id, adminName: me.name, action: 'dictionary.vehicles_import', tenant_id: null, details: { rows: 18420, models: 812, generations: 2310, modifications: 9644, skipped: 37 }, ip: '212.112.100.4' },
  ];
  const log = (action: string, tenantId: string | null, details: any = {}) => journal.unshift({ id: uid(), created_at: now(), admin_id: me.id, adminName: me.name, action, tenant_id: tenantId, details, ip: '127.0.0.1' });
  const dict: Record<string, any[]> = {
    makes: [['toyota', 'Toyota', ['тойота', 'таёта']], ['lexus', 'Lexus', ['лексус']], ['honda', 'Honda', ['хонда']], ['nissan', 'Nissan', ['ниссан']], ['mitsubishi', 'Mitsubishi', ['митсубиси', 'мицубиси']], ['subaru', 'Subaru', ['субару']], ['mazda', 'Mazda', ['мазда']], ['hyundai', 'Hyundai', ['хендай', 'хундай']], ['kia', 'Kia', ['киа']], ['mercedes', 'Mercedes-Benz', ['мерс', 'мерседес']], ['bmw', 'BMW', ['бмв']], ['audi', 'Audi', ['ауди']], ['volkswagen', 'Volkswagen', ['фольксваген', 'вольксваген']], ['lada', 'ВАЗ / Lada', ['ваз', 'лада', 'жигули']]].map(([code, name, aliases]) => ({ id: uid(), code, name, aliases })),
    brands: [['Toyota', [], 'Япония', true], ['Akebono', ['акебоно'], 'Япония', false], ['Bosch', ['бош'], 'Германия', false], ['NGK', ['нгк'], 'Япония', false], ['Denso', ['денсо'], 'Япония', false], ['Sangsin', ['сангсин', 'hi-q'], 'Корея', false], ['Sakura', ['сакура'], 'Индонезия', false], ['KYB', ['kayaba', 'каяба'], 'Япония', false], ['CTR', ['ctr korea'], 'Корея', false], ['555', ['san ko ken'], 'Япония', false]].map(([name, aliases, country, isCarMaker]) => ({ id: uid(), name, aliases, country, isCarMaker })),
    synonyms: [['аморт', 'амортизатор'], ['стойка', 'амортизатор'], ['масляник', 'фильтр масляный'], ['воздушник', 'фильтр воздушный'], ['граната', 'шрус'], ['косточка', 'стойка стабилизатора'], ['бочонок', 'глушитель'], ['генка', 'генератор'], ['радик', 'радиатор'], ['лямбда', 'лямбда-зонд']].map(([word, target]) => ({ id: uid(), word, target, lang: 'ru' })),
    wmi: [['JTN', 'Toyota', 'Япония'], ['JTD', 'Toyota', 'Япония'], ['JHM', 'Honda', 'Япония'], ['JN1', 'Nissan', 'Япония'], ['KMH', 'Hyundai', 'Корея'], ['WDB', 'Mercedes-Benz', 'Германия'], ['WBA', 'BMW', 'Германия'], ['XTA', 'ВАЗ / Lada', 'Россия']].map(([wmi, make, country]) => ({ id: uid(), wmi, make, country })),
  };
  const card = (x: any) => ({
    ...x, shop_type: x.shopType, subscription_until: x.subscriptionUntil, created_at: x.createdAt, onboarding_completed_at: x.receipts30d ? x.createdAt : null, inn: x.inn ?? null, address: x.address ?? null,
    support: sessions.filter((s) => s.tenantId === x.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
  // В демо у каждой вкладки своя память — данные сеанса едут в самом токене
  const token = (s: any) => `demo-support.${btoa(encodeURIComponent(JSON.stringify({ id: s.id, status: 'active', canWrite: s.canWrite, showMoney: s.showMoney, expiresAt: s.expiresAt, adminName: s.adminName })))}`;
  const ownerState = () => {
    const list = sessions.filter((s) => s.tenantId === ownTenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (grant && new Date(grant.until) < new Date()) grant = null;
    return { grant, sessions: list, activeSession: list.find((s) => s.status === 'active' && new Date(s.expiresAt) > new Date()) ?? null };
  };
  // Поддержка по запросу: в демо «владелец» подтверждает сам через 20 секунд, если не ответил в «Настройках»
  const autoApprove = (s: any) =>
    setTimeout(() => {
      if (s.status === 'requested') Object.assign(s, { status: 'active', startedAt: now(), expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    }, 20_000);

  return {
    supportSession: (auth: string | undefined) => {
      const raw = auth?.match(/demo-support\.([\w+/=]+)/)?.[1];
      if (!raw) return null;
      try {
        return JSON.parse(decodeURIComponent(atob(raw)));
      } catch {
        return null;
      }
    },
    handle: async (url: string, method: string, params: Record<string, any>, body: any, auth?: string): Promise<Res> => {
      if (url.startsWith('admin/')) {
        const path = url.slice(6);
        if (path === 'auth/login' && method === 'post') {
          if (!/^\d{6}$/.test(String(body.code ?? '')) || !body.password) return err(401, 'ADMIN_LOGIN_FAILED', 'Неверный вход');
          log('admin.login', null);
          return ok({ accessToken: 'demo-admin-token', admin: me });
        }
        if (!auth?.includes('demo-admin-token')) return err(401, 'ADMIN_UNAUTHORIZED', 'Войдите в админку платформы');
        if (path === 'tenants') {
          const q = String(params.search ?? '').toLowerCase();
          return ok(tenants.filter((x) => (!q || x.name.toLowerCase().includes(q) || x.ownerPhone.includes(q)) && (!params.status || x.status === params.status)));
        }
        let m = path.match(/^tenants\/([\w-]+)(?:\/(subscription|support))?$/);
        if (m) {
          const x = tenants.find((y) => y.id === m![1]);
          if (!x) return err(404, 'NOT_FOUND', 'Магазин не найден');
          if (m[2] === 'subscription') {
            const before = { status: x.status, plan: x.plan, subscriptionUntil: x.subscriptionUntil };
            if (body.status) x.status = body.status;
            if ('subscriptionUntil' in body) x.subscriptionUntil = body.subscriptionUntil;
            if (body.plan) x.plan = body.plan;
            if (body.limits) x.limits = body.limits;
            log('tenant.subscription', x.id, { before, after: body });
            return ok(card(x));
          }
          if (m[2] === 'support') {
            const g = x.id === ownTenantId && grant && new Date(grant.until) > new Date() ? grant : null;
            const active = !!g || !!body.emergency;
            const s = {
              id: uid(), tenantId: x.id, adminId: me.id, adminName: me.name, status: active ? 'active' : 'requested', reason: body.reason, emergency: !!body.emergency && !g, canWrite: g ? g.canWrite && !!body.canWrite : false,
              showMoney: g ? g.showMoney : false, startedAt: active ? now() : null, expiresAt: active ? new Date(Date.now() + 3_600_000).toISOString() : null, endedAt: null, createdAt: now(),
            };
            sessions.unshift(s);
            log(body.emergency ? 'support.emergency' : 'support.request', x.id, { sessionId: s.id, reason: body.reason });
            if (!active) autoApprove(s);
            return ok({ session: s, ...(active ? { supportToken: token(s), expiresAt: s.expiresAt } : {}) });
          }
          return ok(card(x));
        }
        m = path.match(/^support\/([\w-]+)\/(enter|end)$/);
        if (m) {
          const s = sessions.find((y) => y.id === m![1]);
          if (!s) return err(404, 'NOT_FOUND', 'Сеанс не найден');
          if (m[2] === 'end') return (s.status === 'active' || s.status === 'requested') && Object.assign(s, { status: 'ended', endedAt: now() }), log('support.end', null, { sessionId: s.id }), ok({ ended: true });
          if (s.status !== 'active' || new Date(s.expiresAt) < new Date()) return err(400, 'SUPPORT_NOT_ACTIVE', 'Владелец ещё не подтвердил (в демо — подождите 20 секунд)');
          return ok({ supportToken: token(s), expiresAt: s.expiresAt, canWrite: s.canWrite, showMoney: s.showMoney });
        }
        m = path.match(/^dictionaries\/(makes|brands|synonyms|wmi)$/);
        if (m && method === 'get') {
          const q = String(params.q ?? '').toLowerCase();
          return ok(dict[m[1]].filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q)));
        }
        if (m && method === 'put') {
          const k = m[1];
          const key = k === 'makes' ? 'code' : k === 'brands' ? 'name' : k === 'wmi' ? 'wmi' : 'word';
          const row = k === 'wmi' ? { ...body, make: dict.makes.find((x) => x.code === body.make)?.name ?? body.make } : body;
          const ex = dict[k].find((r) => String(r[key]).toLowerCase() === String(row[key]).toLowerCase() && (k !== 'synonyms' || r.target === row.target));
          if (ex) Object.assign(ex, row);
          else dict[k].unshift({ id: uid(), ...row });
          log(`dictionary.${k}`, null, body);
          return ok(ex ?? dict[k][0]);
        }
        if (path === 'dictionaries/vehicles/import' && method === 'post') {
          const r = { rows: 1240, models: 64, generations: 158, modifications: 702, skipped: 3 };
          log('dictionary.vehicles_import', null, r);
          return ok(r);
        }
        if (path === 'monitoring')
          return ok({
            outbox: { failed: 2, pending: 14 },
            checkedTenants: tenants.length,
            problems: [
              { tenantId: tenants[1].id, name: tenants[1].name, offlineUnsent: 1, stuckImports: 0, stockMismatches: 0, ocrFoundRate: 74 },
              { tenantId: tenants[2].id, name: tenants[2].name, offlineUnsent: 0, stuckImports: 1, stockMismatches: 3, ocrFoundRate: 48 },
            ],
          });
        if (path === 'journal') return ok(journal.filter((j) => (!params.tenantId || j.tenant_id === params.tenantId) && (!params.adminId || j.admin_id === params.adminId)));
        return err(404, 'NOT_FOUND', 'Нет такого метода');
      }
      // ── владелец магазина
      if (url === 'support' && method === 'get') return ok(ownerState());
      if (url === 'support/grant' && method === 'post') {
        grant = { id: uid(), until: new Date(Date.now() + (body.hours ?? 24) * 3_600_000).toISOString(), canWrite: !!body.canWrite, showMoney: !!body.showMoney };
        return ok(ownerState());
      }
      if (url === 'support/revoke' && method === 'post') {
        grant = null;
        sessions.filter((s) => s.tenantId === ownTenantId && (s.status === 'active' || s.status === 'requested')).forEach((s) => Object.assign(s, { status: 'ended', endedAt: now() }));
        return ok(ownerState());
      }
      const m = url.match(/^support\/requests\/([\w-]+)\/(approve|decline)$/);
      if (m && method === 'post') {
        const s = sessions.find((y) => y.id === m[1] && y.status === 'requested');
        if (!s) return err(404, 'NOT_FOUND', 'Запрос не найден');
        if (m[2] === 'approve') Object.assign(s, { status: 'active', canWrite: !!body.canWrite, showMoney: !!body.showMoney, startedAt: now(), expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
        else Object.assign(s, { status: 'declined', endedAt: now() });
        return ok(ownerState());
      }
      return null;
    },
  };
}
