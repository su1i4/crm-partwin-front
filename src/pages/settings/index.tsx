import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ClipboardCheck, Gift, MapPin, Plus, Receipt, Save, ShoppingCart, Store as StoreIcon, Warehouse as WarehouseIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useRegistersAll, useShopSettings, useStores, useTenant, type ShopSettings, type Store } from '@/entities/admin';
import { useCan } from '@/entities/session';
import { physical, useWarehouses } from '@/entities/warehouse';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Button, Card, Dialog, ErrorState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const sel = 'h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none';
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Строка настройки: подпись слева, пояснение, контрол справа */
function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      <div className="shrink-0 sm:w-72">{children}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-medium [&_svg]:size-4 [&_svg]:text-accent">
        {icon} {title}
      </div>
      {children}
    </Card>
  );
}

function TenantCard() {
  const { data } = useTenant();
  const qc = useQueryClient();
  const can = useCan();
  const [f, setF] = useState({ name: '', legalForm: 'ИП', inn: '', address: '', phone: '', city: '', bank: '', account: '', bik: '' });
  useEffect(() => {
    if (data) setF({ name: data.name, legalForm: data.legalForm ?? 'ИП', inn: data.inn ?? '', address: data.address ?? '', phone: data.phone ?? '', city: data.city ?? '', bank: data.requisites?.bank ?? '', account: data.requisites?.account ?? '', bik: data.requisites?.bik ?? '' });
  }, [data]);
  const save = useMutation({
    mutationFn: () => adminApi.updateTenant({ name: f.name, legalForm: f.legalForm, inn: f.inn || undefined, address: f.address, phone: f.phone, city: f.city, requisites: { ...(data?.requisites ?? {}), bank: f.bank, account: f.account, bik: f.bik } } as never),
    onSuccess: (t) => (qc.setQueryData(['tenant'], t), qc.invalidateQueries({ queryKey: ['me'] }), toast.success('Данные магазина сохранены')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return <Skeleton className="h-64 rounded-[24px]" />;
  const dirty = f.name !== data.name || f.legalForm !== (data.legalForm ?? 'ИП') || f.inn !== (data.inn ?? '') || f.address !== (data.address ?? '') || f.phone !== (data.phone ?? '') || f.city !== (data.city ?? '') || f.bank !== (data.requisites?.bank ?? '') || f.account !== (data.requisites?.account ?? '') || f.bik !== (data.requisites?.bik ?? '');
  const edit = can('settings.manage');
  return (
    <Section icon={<Building2 />} title="Магазин и реквизиты">
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Название" hint="В шапке чека и в документах">
          <Input disabled={!edit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Форма">
          <select disabled={!edit} className={sel} value={f.legalForm} onChange={(e) => setF({ ...f, legalForm: e.target.value })}>
            {['ИП', 'ОсОО', 'другое'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="ИНН">
          <Input disabled={!edit} inputMode="numeric" value={f.inn} onChange={(e) => setF({ ...f, inn: e.target.value.replace(/\D/g, '').slice(0, 14) })} />
        </Field>
        <Field label="Телефон">
          <Input disabled={!edit} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Город">
          <Input disabled={!edit} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Адрес">
          <Input disabled={!edit} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Банк">
          <Input disabled={!edit} value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder="Оптима Банк" />
        </Field>
        <Field label="Расчётный счёт">
          <Input disabled={!edit} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} />
        </Field>
        <Field label="БИК">
          <Input disabled={!edit} value={f.bik} onChange={(e) => setF({ ...f, bik: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>
          Подписка до <b className="text-ink">{data.subscriptionUntil ? new Date(data.subscriptionUntil).toLocaleDateString('ru-RU') : '—'}</b>
        </span>
        {edit && dirty && (
          <Button variant="dark" loading={save.isPending} onClick={() => save.mutate()}>
            <Save /> Сохранить
          </Button>
        )}
      </div>
    </Section>
  );
}

function StoreDialog({ store, onClose }: { store: Partial<Store> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', code: '', address: '', phone: '', isActive: true, createDefaults: true });
  useEffect(() => {
    if (store) setF({ name: store.name ?? '', code: store.code ?? '', address: store.address ?? '', phone: store.phone ?? '', isActive: store.isActive ?? true, createDefaults: true });
  }, [store]);
  const save = useMutation({
    mutationFn: () =>
      store?.id
        ? adminApi.updateStore(store.id, { version: store.version!, name: f.name, ...(f.code ? { code: f.code } : {}), address: f.address, phone: f.phone, isActive: f.isActive })
        : adminApi.createStore({ name: f.name, ...(f.code ? { code: f.code } : {}), address: f.address, phone: f.phone, createDefaults: f.createDefaults }),
    onSuccess: () => {
      for (const k of ['stores', 'me', 'warehouses', 'registers-all', 'registers']) qc.invalidateQueries({ queryKey: [k] });
      onClose();
      toast.success('Точка сохранена');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!store} onOpenChange={(v) => !v && onClose()} title={store?.id ? store.name : 'Новая точка'} description={store?.id ? undefined : 'Отдельный магазин или контейнер: свой торговый зал, касса и номера документов'}>
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Название">
            <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Дордой, контейнер 214" />
          </Field>
          <Field label="Код" hint="В номерах">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().slice(0, 10) })} placeholder="ДОР" />
          </Field>
        </div>
        <Field label="Адрес">
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Телефон точки">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        {store?.id ? <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Работает" /> : <Switch checked={f.createDefaults} onChange={(v) => setF({ ...f, createDefaults: v })} label="Сразу создать торговый зал и кассу" />}
        <div className="flex justify-end">
          <Button variant="dark" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function StoresCard() {
  const stores = useStores();
  const regs = useRegistersAll();
  const whs = useWarehouses();
  const qc = useQueryClient();
  const [store, setStore] = useState<Partial<Store> | null>(null);
  const [reg, setReg] = useState<{ id?: string; version?: number; storeId: string; name: string; code: string; warehouseId: string; isActive: boolean } | null>(null);
  const saveReg = useMutation({
    mutationFn: () =>
      reg!.id
        ? adminApi.updateRegister(reg!.id, { version: reg!.version!, name: reg!.name, ...(reg!.warehouseId ? { warehouseId: reg!.warehouseId } : {}), isActive: reg!.isActive })
        : adminApi.createRegister({ storeId: reg!.storeId, name: reg!.name, ...(reg!.code ? { code: reg!.code } : {}), ...(reg!.warehouseId ? { warehouseId: reg!.warehouseId } : {}) }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['registers-all'] }), qc.invalidateQueries({ queryKey: ['registers'] }), setReg(null), toast.success('Касса сохранена')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Section icon={<StoreIcon />} title="Точки и кассы">
      <div className="mt-3 space-y-3">
        {stores.data?.map((s) => {
          const rs = regs.data?.filter((r) => r.storeId === s.id) ?? [];
          return (
            <Tray key={s.id} className={cn('p-3', !s.isActive && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2 px-1">
                <MapPin className="size-4 text-accent" />
                <button onClick={() => setStore(s)} className="min-w-0 flex-1 text-left">
                  <span className="text-[14.5px] font-medium">{s.name}</span> <span className="font-mono text-xs text-muted">{s.code}</span>
                  {s.address && <span className="block truncate text-xs text-muted">{s.address}</span>}
                </button>
                {!s.isActive && <Pill tone="muted">закрыта</Pill>}
                <Button size="sm" variant="ghost" onClick={() => setReg({ storeId: s.id, name: `Касса ${rs.length + 1}`, code: '', warehouseId: '', isActive: true })}>
                  <Plus /> Касса
                </Button>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {rs.map((r) => (
                  <button key={r.id} onClick={() => setReg({ id: r.id, version: r.version, storeId: r.storeId, name: r.name, code: r.code, warehouseId: r.warehouseId, isActive: r.isActive })} className={cn('flex items-center gap-2 rounded-[14px] bg-card px-3 py-2 text-left text-[13px]', !r.isActive && 'opacity-50')}>
                    <ShoppingCart className="size-3.5 text-muted" />
                    <span className="flex-1">
                      {r.name} <span className="font-mono text-xs text-muted">{r.code}</span>
                    </span>
                    <span className="text-xs text-muted">{whs.data?.find((w) => w.id === r.warehouseId)?.name}</span>
                  </button>
                ))}
              </div>
            </Tray>
          );
        })}
        <Button onClick={() => setStore({})}>
          <Plus /> Точка
        </Button>
      </div>
      <StoreDialog store={store} onClose={() => setStore(null)} />
      <Dialog open={!!reg} onOpenChange={(v) => !v && setReg(null)} title={reg?.id ? 'Касса' : 'Новая касса'}>
        {reg && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
              <Field label="Название">
                <Input autoFocus value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
              </Field>
              <Field label="Код">
                <Input disabled={!!reg.id} value={reg.code} onChange={(e) => setReg({ ...reg, code: e.target.value.toUpperCase().slice(0, 6) })} placeholder="К2" />
              </Field>
            </div>
            <Field label="Списывать со склада" hint="По умолчанию — торговый зал точки">
              <select className={sel} value={reg.warehouseId} onChange={(e) => setReg({ ...reg, warehouseId: e.target.value })}>
                <option value="">Торговый зал</option>
                {physical(whs.data).filter((w) => w.storeId === reg.storeId).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            {reg.id && <Switch checked={reg.isActive} onChange={(v) => setReg({ ...reg, isActive: v })} label="Работает" />}
            <div className="flex justify-end">
              <Button variant="dark" disabled={!reg.name.trim()} loading={saveReg.isPending} onClick={() => saveReg.mutate()}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Section>
  );
}

type Tab = 'shop' | 'sale' | 'stock' | 'loyalty';

/** Настройки магазина (ТЗ 21): реквизиты, точки и кассы, правила продажи, склада, лояльности */
export default function SettingsPage() {
  const { data, isLoading, error, refetch } = useShopSettings();
  const can = useCan();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('shop');
  const [draft, setDraft] = useState<ShopSettings | null>(null);
  useEffect(() => {
    if (data) setDraft(data.settings);
  }, [data]);
  const patch = useMemo(() => {
    if (!data || !draft) return {};
    const p: Partial<ShopSettings> = {};
    for (const k of Object.keys(draft)) if (JSON.stringify(draft[k]) !== JSON.stringify(data.settings[k])) (p as Record<string, unknown>)[k] = draft[k];
    return p;
  }, [data, draft]);
  const save = useMutation({
    mutationFn: () => adminApi.updateSettings(data!.version, patch),
    onSuccess: (r) => (qc.setQueryData(['shop-settings'], r), toast.success('Настройки сохранены — видно в журнале действий')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const edit = can('settings.manage');
  const set = <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const num = <K extends keyof ShopSettings>(k: K, w = 'w-28') => (
    <Input disabled={!edit} inputMode="numeric" value={draft?.[k] == null ? '' : String(draft[k])} onChange={(e) => set(k, (e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, ''))) as ShopSettings[K])} className={cn('ml-auto', w)} />
  );
  const sw = <K extends keyof ShopSettings>(k: K) => (
    <div className="flex sm:justify-end">
      <Switch checked={!!draft?.[k]} onChange={(v) => edit && set(k, v as ShopSettings[K])} />
    </div>
  );
  const changed = Object.keys(patch).length;
  return (
    <div className="space-y-6 pb-20">
      <PageTitle title="Настройки" sub="Изменения видны всем сотрудникам сразу и записываются в журнал действий" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'shop', label: 'Магазин и точки' },
          { value: 'sale', label: 'Продажа и касса' },
          { value: 'stock', label: 'Склад и закупки' },
          { value: 'loyalty', label: 'Лояльность' },
        ]}
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {tab === 'shop' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <TenantCard />
          <StoresCard />
          <Card className="p-5 xl:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['/settings/warehouses', 'Склады', <WarehouseIcon key="w" />],
                ['/settings/staff', 'Сотрудники и роли', <ClipboardCheck key="s" />],
                ['/settings/devices', 'Кассы и устройства', <ShoppingCart key="d" />],
                ['/settings/print', 'Печатные формы', <Receipt key="p" />],
              ].map(([to, l, i]) => (
                <Link key={to as string} to={to as string} className="flex items-center gap-2 rounded-[16px] bg-card-muted px-4 py-3 text-[14px] hover:bg-line [&_svg]:size-4 [&_svg]:text-accent">
                  {i} {l}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
      {tab !== 'shop' && isLoading && <Skeleton className="h-96 rounded-[24px]" />}
      {tab === 'sale' && draft && (
        <Section icon={<ShoppingCart />} title="Продажа и касса">
          <Row title="Продажа в минус" hint="Нет остатка — запретить или продать с предупреждением (группа может переопределить)">
            <select disabled={!edit} className={sel} value={draft.negativeStock} onChange={(e) => set('negativeStock', e.target.value as ShopSettings['negativeStock'])}>
              <option value="forbid">Запретить</option>
              <option value="warn">Разрешить с предупреждением</option>
            </select>
          </Row>
          <Row title="Продажа ниже себестоимости">
            <select disabled={!edit} className={sel} value={draft.belowCostSale} onChange={(e) => set('belowCostSale', e.target.value as ShopSettings['belowCostSale'])}>
              <option value="forbid">Запретить</option>
              <option value="confirm">С PIN старшего</option>
              <option value="allow">Разрешить</option>
            </select>
          </Row>
          <Row title="Округление цен" hint="Розничная цена после наценки и пересчёта из $">
            <Segmented size="sm" value={String(draft.priceRounding) as '1' | '5' | '10'} onChange={(v) => edit && set('priceRounding', Number(v) as 1 | 5 | 10)} options={[{ value: '1', label: '1 с' }, { value: '5', label: '5 с' }, { value: '10', label: '10 с' }]} />
          </Row>
          <Row title="Быстрые купюры на кассе" hint="Через запятую">
            <Input disabled={!edit} value={draft.quickBanknotes.join(', ')} onChange={(e) => set('quickBanknotes', e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => x > 0))} />
          </Row>
          <Row title="Создавать товар прямо на кассе" hint="Черновик товара по номеру и цене — дозаполнят позже">{sw('allowQuickCreateAtPos')}</Row>
          <Row title="Свободные позиции" hint="Строка без товара из каталога (услуга, «что-то с витрины»)">{sw('allowFreeItems')}</Row>
          <Row title="Распознавание номера с фото">{sw('allowOcr')}</Row>
          <Row title="Удаление строки чека — по PIN">{sw('deleteLineRequiresPin')}</Row>
          <Row title="Повторный скан прибавляет +1">{sw('repeatScanIncrements')}</Row>
          <Row title="Передача кассы между продавцами" hint="Пересчёт при смене продавца в течение дня">{sw('cashHandover')}</Row>
          <Row title="Автозакрытие смены" hint="Пусто — не закрывать">
            <Input disabled={!edit} type="time" value={draft.shiftAutoCloseTime ?? ''} onChange={(e) => set('shiftAutoCloseTime', e.target.value || null)} />
          </Row>
          <Row title="Возврат в другой точке">{sw('returnInOtherStore')}</Row>
          <Row title="Подбор: дней на возврат" hint="Сколько мастер держит детали «на примерку»">{num('selectionIssueDays')}</Row>
          <Row title="Блокировать долг при просрочке, дн" hint="Пусто — не блокировать">{num('creditBlockOverdueDays')}</Row>
          <Row title="Окно сверки переводов с выпиской, мин">{num('transferMatchWindowMinutes')}</Row>
          <Row title="Вечерняя сводка владельцу в Telegram">
            <Input disabled={!edit} type="time" value={draft.eveningSummaryTime} onChange={(e) => set('eveningSummaryTime', e.target.value)} />
          </Row>
          <Row title="Товаров в кэше кассы без интернета">{num('offlineProductLimit')}</Row>
        </Section>
      )}
      {tab === 'stock' && draft && (
        <div className="space-y-4">
          <Section icon={<WarehouseIcon />} title="Склад и документы">
            <Row title="Редактировать документы старше, дн" hint="Дальше — только сторно; 0 — без ограничения">{num('editOldDocumentsDays')}</Row>
            <Row title="Резерв под заказ, дн">{num('reserveDays')}</Row>
            <Row title="Списание на согласование дороже, сом" hint="0 — без согласования">{num('writeoffApprovalAmount', 'w-36')}</Row>
            <Row title="Перемещение «зависло» через, дн">{num('transferStaleDays')}</Row>
            <Row title="Напоминать закрыть период">{sw('periodCloseReminder')}</Row>
            <Row title="Уровень хранения новых складов" hint="1 — место текстом, 2 — справочник мест, 3 — адресные ячейки">
              <Segmented size="sm" value={String(draft.defaultStorageLevel) as '1' | '2' | '3'} onChange={(v) => edit && set('defaultStorageLevel', Number(v) as 1 | 2 | 3)} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
            </Row>
          </Section>
          <Section icon={<ClipboardCheck />} title="Автозаказ и сезон">
            <Row title="Продажи за, дн">{num('autoOrderSalesDays')}</Row>
            <Row title="Запас на, дн">{num('autoOrderCoverDays')}</Row>
            <Row title="Летние месяцы" hint="Для сезонных мин./макс. (шины, аккумуляторы, кондиционер)">
              <div className="flex flex-wrap gap-1">
                {MONTHS.map((m, i) => {
                  const on = draft.summerMonths.includes(i + 1);
                  return (
                    <button key={m} disabled={!edit} onClick={() => set('summerMonths', on ? draft.summerMonths.filter((x) => x !== i + 1) : [...draft.summerMonths, i + 1].sort((a, b) => a - b))} className={cn('h-7 w-11 rounded-full text-xs ring-1', on ? 'bg-warn-soft text-ink ring-warn' : 'bg-card text-muted ring-line')}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </Row>
          </Section>
          <Section icon={<Receipt />} title="Каталог">
            <Row title="Каталог по умолчанию">
              <Segmented size="sm" value={draft.catalogDefaultView} onChange={(v) => edit && set('catalogDefaultView', v)} options={[{ value: 'groups', label: 'По группам' }, { value: 'makes', label: 'По маркам' }]} />
            </Row>
            <Row title="Дерево марок до">
              <select disabled={!edit} className={sel} value={draft.makeTreeDepth} onChange={(e) => set('makeTreeDepth', e.target.value as ShopSettings['makeTreeDepth'])}>
                <option value="make">Марки</option>
                <option value="model">Модели</option>
                <option value="generation">Поколения</option>
                <option value="modification">Модификации</option>
              </select>
            </Row>
            <Row title="Наши марки" hint="Сверху в подборе и фильтрах; через запятую, коды марок">
              <Input disabled={!edit} value={draft.ourMakes.join(', ')} onChange={(e) => set('ourMakes', e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))} placeholder="toyota, lexus, honda" />
            </Row>
          </Section>
        </div>
      )}
      {tab === 'loyalty' && draft && (
        <Section icon={<Gift />} title="Бонусная программа">
          <Row title="Программа лояльности включена">{sw('loyaltyEnabled')}</Row>
          <Row title="Начисление, % от покупки">{num('bonusAccrualPercent')}</Row>
          <Row title="Оплата бонусами, не больше % чека">{num('bonusMaxPayPercent')}</Row>
          <Row title="Бонусы сгорают через, дн" hint="0 — не сгорают">{num('bonusExpireDays')}</Row>
          <Row title="Уровни" hint="Сумма покупок за всё время → процент начисления">
            <div className="space-y-1.5">
              {draft.loyaltyLevels.map((l, i) => (
                <div key={i} className="flex gap-1">
                  <Input disabled={!edit} value={l.name} onChange={(e) => set('loyaltyLevels', draft.loyaltyLevels.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="h-9 flex-1" />
                  <Input disabled={!edit} value={l.threshold} inputMode="numeric" onChange={(e) => set('loyaltyLevels', draft.loyaltyLevels.map((x, k) => (k === i ? { ...x, threshold: e.target.value.replace(/\D/g, '') } : x)))} className="h-9 w-24" />
                  <Input disabled={!edit} value={l.percent} inputMode="decimal" onChange={(e) => set('loyaltyLevels', draft.loyaltyLevels.map((x, k) => (k === i ? { ...x, percent: e.target.value.replace(/[^\d.]/g, '') } : x)))} className="h-9 w-14" />
                </div>
              ))}
              {edit && (
                <button onClick={() => set('loyaltyLevels', [...draft.loyaltyLevels, { name: 'Новый', threshold: '0', percent: '3' }])} className="text-xs text-muted hover:text-ink">
                  + уровень
                </button>
              )}
            </div>
          </Row>
        </Section>
      )}
      {edit && changed > 0 && tab !== 'shop' && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:bottom-6">
          <div className="flex items-center gap-3 rounded-full bg-pill py-2 pr-2 pl-5 text-pill-ink shadow-2xl">
            <span className="text-sm">Изменено: {changed}</span>
            <Button size="sm" variant="ghost" className="text-pill-ink hover:bg-white/10" onClick={() => setDraft(data!.settings)}>
              Отменить
            </Button>
            <Button size="sm" variant="accent" loading={save.isPending} onClick={() => save.mutate()}>
              <Save /> Сохранить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
