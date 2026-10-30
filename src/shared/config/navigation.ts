import {
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutGrid,
  type LucideIcon,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';

/** Меню по ТЗ 23.2. stage — этап фронта, на котором экран появится (готовые — ready). */
export interface NavItem {
  label: string;
  to: string;
  permission?: string;
  ready?: boolean;
  stage?: number;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}
export interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  permission?: string;
  groups: NavGroup[];
}

export const NAV: NavSection[] = [
  {
    key: 'home',
    label: 'Главная',
    icon: LayoutGrid,
    to: '/',
    groups: [{ items: [{ label: 'Дашборд', to: '/', ready: true }, { label: 'Мои задачи', to: '/tasks', ready: true }] }],
  },
  {
    key: 'pos',
    label: 'Касса',
    icon: ShoppingCart,
    to: '/pos',
    permission: 'pos.use',
    groups: [{ items: [{ label: 'Касса точки', to: '/pos', ready: true }, { label: 'Смены', to: '/shifts', ready: true }, { label: 'Отложенные чеки', to: '/sales?status=deferred', ready: true }] }],
  },
  {
    key: 'requests',
    label: 'Заявки',
    icon: ClipboardList,
    to: '/requests/board',
    permission: 'requests.read',
    groups: [{ items: [{ label: 'Канбан', to: '/requests/board', ready: true }, { label: 'Список', to: '/requests', ready: true }, { label: 'Новая заявка', to: '/requests/new', ready: true }] }],
  },
  {
    key: 'sales',
    label: 'Продажи',
    icon: Receipt,
    to: '/sales',
    groups: [
      {
        items: [
          { label: 'Чеки', to: '/sales', ready: true },
          { label: 'Возврат по чеку', to: '/sales/returns', ready: true },
          { label: 'Заказы покупателей', to: '/sales/orders', ready: true },
          { label: 'Доставки', to: '/sales/deliveries', ready: true },
          { label: 'Выдачи на подбор', to: '/sales/selection', ready: true },
          { label: 'Реализация', to: '/sales/consignment', ready: true },
          { label: 'Гарантия', to: '/sales/warranty', ready: true },
        ],
      },
    ],
  },
  {
    key: 'products',
    label: 'Товары',
    icon: Package,
    to: '/products',
    permission: 'products.read',
    groups: [
      {
        title: 'Каталог',
        items: [
          { label: 'Все товары', to: '/products', ready: true },
          { label: 'Дозаполнить', to: '/products?missing=photo', ready: true },
          { label: 'Созданы на кассе', to: '/products?quick=1', ready: true },
          { label: 'Поиск и подбор', to: '/search', ready: true },
        ],
      },
      {
        title: 'Справочники',
        items: [
          { label: 'Категории', to: '/catalog/categories', ready: true },
          { label: 'Бренды', to: '/catalog/brands', ready: true },
          { label: 'Типы деталей', to: '/catalog/part-types', ready: true },
          { label: 'Аналоги', to: '/catalog/crosses', ready: true },
        ],
      },
      {
        title: 'Цены',
        items: [
          { label: 'Установка цен', to: '/prices', ready: true, permission: 'prices.write' },
          { label: 'Курс магазина', to: '/prices/rate', ready: true },
          { label: 'Акции и промокоды', to: '/prices/promo', ready: true },
          { label: 'Ценники и этикетки', to: '/labels', ready: true },
        ],
      },
    ],
  },
  {
    key: 'stock',
    label: 'Склад',
    icon: Boxes,
    to: '/stock',
    groups: [
      {
        items: [
          { label: 'Остатки', to: '/stock', ready: true },
          { label: 'Журнал документов', to: '/documents', ready: true },
          { label: 'Ввод остатков', to: '/documents?type=initial_stock', ready: true },
          { label: 'Перемещения', to: '/documents?type=transfer', ready: true },
          { label: 'Инвентаризации', to: '/stock/inventory', ready: true },
          { label: 'Списания', to: '/documents?type=writeoff', ready: true },
          { label: 'Оприходования', to: '/documents?type=surplus', ready: true },
          { label: 'Пересортица', to: '/documents?type=resort', ready: true },
          { label: 'Места и ячейки', to: '/stock/places', ready: true },
          { label: 'Задания склада', to: '/stock/tasks', ready: true },
        ],
      },
    ],
  },
  {
    key: 'purchasing',
    label: 'Закупки',
    icon: Truck,
    to: '/purchasing/orders',
    groups: [
      {
        items: [
          { label: 'Поставщики и соседи', to: '/purchasing/suppliers', ready: true },
          { label: 'Прайсы', to: '/purchasing/price-lists', ready: true },
          { label: 'Заказы поставщикам', to: '/purchasing/orders', ready: true },
          { label: 'Автозаказ', to: '/purchasing/auto-order', ready: true },
          { label: 'Приёмки', to: '/documents?type=receiving', ready: true },
          { label: 'Возвраты поставщикам', to: '/documents?type=supplier_return', ready: true },
          { label: 'Контейнеры', to: '/purchasing/containers', ready: true },
          { label: 'Доноры', to: '/purchasing/donors', ready: true },
        ],
      },
    ],
  },
  {
    key: 'customers',
    label: 'Клиенты',
    icon: Users,
    to: '/customers',
    groups: [
      {
        items: [
          { label: 'Клиенты и СТО', to: '/customers', ready: true },
          { label: 'Мастера и бонусы', to: '/customers/masters', ready: true },
          { label: 'Долги', to: '/customers/debts', ready: true },
          { label: 'Лояльность и карты', to: '/customers/loyalty', ready: true },
          { label: 'Лист ожидания', to: '/customers/waitlist', ready: true },
        ],
      },
    ],
  },
  {
    key: 'money',
    label: 'Деньги',
    icon: Banknote,
    to: '/money',
    groups: [
      {
        items: [
          { label: 'Счета и кошельки', to: '/money', ready: true },
          { label: 'Платежи', to: '/money/payments', ready: true },
          { label: 'Сверка переводов', to: '/money/transfers', ready: true },
          { label: 'Расходы', to: '/money/expenses', ready: true },
          { label: 'Взаиморасчёты', to: '/money/settlements', ready: true },
        ],
      },
    ],
  },
  {
    key: 'reports',
    label: 'Отчёты',
    icon: BarChart3,
    to: '/reports',
    groups: [{ items: [{ label: 'Все отчёты', to: '/reports', ready: true }, { label: 'Избранные', to: '/reports/saved', ready: true }] }],
  },
  {
    key: 'settings',
    label: 'Настройки',
    icon: Settings,
    to: '/settings',
    groups: [
      {
        items: [
          { label: 'Магазин и точки', to: '/settings', ready: true },
          { label: 'Склады', to: '/settings/warehouses', ready: true },
          { label: 'Кассы и устройства', to: '/settings/devices', ready: true },
          { label: 'Сотрудники и роли', to: '/settings/staff', ready: true },
          { label: 'Печатные формы', to: '/settings/print', ready: true },
          { label: 'Словарь синонимов', to: '/settings/synonyms', ready: true },
          { label: 'Импорт и экспорт', to: '/settings/import', ready: true },
          { label: 'Журнал действий', to: '/settings/audit', ready: true },
          { label: 'Мастер настройки', to: '/onboarding?again=1', ready: true, permission: 'settings.manage' },
          { label: 'Мобильная версия', to: '/m', ready: true },
        ],
      },
    ],
  },
];

/** Раздел по адресу — для подсветки иконки слева */
export function sectionFor(pathname: string, search = ''): NavSection {
  if (pathname === '/' || pathname.startsWith('/tasks')) return NAV[0];
  if (pathname.startsWith('/search') || pathname.startsWith('/catalog') || pathname.startsWith('/prices') || pathname.startsWith('/labels')) return NAV.find((s) => s.key === 'products')!;
  if (pathname.startsWith('/documents') && /type=(receiving|supplier_return)/.test(search)) return NAV.find((s) => s.key === 'purchasing')!;
  if (pathname.startsWith('/documents')) return NAV.find((s) => s.key === 'stock')!;
  if (pathname.startsWith('/purchasing')) return NAV.find((s) => s.key === 'purchasing')!;
  if (pathname.startsWith('/requests')) return NAV.find((s) => s.key === 'requests')!;
  if (pathname.startsWith('/sales/selection')) return NAV.find((s) => s.key === 'sales')!;
  if (pathname.startsWith('/shifts')) return NAV.find((s) => s.key === 'pos')!;
  const found = [...NAV].reverse().find((s) => s.to !== '/' && pathname.startsWith(s.to));
  return found ?? NAV[0];
}

export const STAGES: Record<number, string> = {
  2: 'Касса без интернета, камера и привязка устройств',
  3: 'Склад, документы и справочники каталога',
  4: 'Закупки, прайсы и контейнеры',
  5: 'Клиенты, заявки, СТО и долги',
  6: 'Деньги и отчёты',
  7: 'Настройки, сотрудники, устройства и мобильная версия',
};
