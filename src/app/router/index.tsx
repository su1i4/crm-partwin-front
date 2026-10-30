import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe, useSession } from '@/entities/session';
import { Skeleton } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';

const Dashboard = lazy(() => import('@/pages/dashboard'));
const Login = lazy(() => import('@/pages/auth/login'));
const Register = lazy(() => import('@/pages/auth/register'));
const SelectShop = lazy(() => import('@/pages/auth/select-shop'));
const Catalog = lazy(() => import('@/pages/catalog'));
const Product = lazy(() => import('@/pages/product'));
const Search = lazy(() => import('@/pages/search'));
const Profile = lazy(() => import('@/pages/profile'));
const Stub = lazy(() => import('@/pages/stub'));
const Pos = lazy(() => import('@/pages/pos'));
const Sales = lazy(() => import('@/pages/sales'));
const Returns = lazy(() => import('@/pages/sales/returns'));
const Shifts = lazy(() => import('@/pages/shifts'));
const Documents = lazy(() => import('@/pages/documents'));
const DocumentEditor = lazy(() => import('@/pages/documents/editor'));
const Stock = lazy(() => import('@/pages/stock'));
const Places = lazy(() => import('@/pages/stock/places'));
const InventoryList = lazy(() => import('@/pages/inventory').then((m) => ({ default: m.InventoryListPage })));
const Inventory = lazy(() => import('@/pages/inventory').then((m) => ({ default: m.InventoryPage })));
const Categories = lazy(() => import('@/pages/dictionaries').then((m) => ({ default: m.CategoriesPage })));
const Brands = lazy(() => import('@/pages/dictionaries').then((m) => ({ default: m.BrandsPage })));
const PartTypes = lazy(() => import('@/pages/dictionaries').then((m) => ({ default: m.PartTypesPage })));
const Crosses = lazy(() => import('@/pages/dictionaries/crosses'));
const PriceSettings = lazy(() => import('@/pages/prices').then((m) => ({ default: m.PriceSettingsPage })));
const PriceSetting = lazy(() => import('@/pages/prices').then((m) => ({ default: m.PriceSettingPage })));
const ShopRate = lazy(() => import('@/pages/prices').then((m) => ({ default: m.ShopRatePage })));
const Labels = lazy(() => import('@/pages/prices/labels'));
const Suppliers = lazy(() => import('@/pages/purchasing/suppliers').then((m) => ({ default: m.SuppliersPage })));
const Supplier = lazy(() => import('@/pages/purchasing/suppliers').then((m) => ({ default: m.SupplierPage })));
const PriceLists = lazy(() => import('@/pages/purchasing/price-lists').then((m) => ({ default: m.PriceListsPage })));
const PriceList = lazy(() => import('@/pages/purchasing/price-lists').then((m) => ({ default: m.PriceListPage })));
const Orders = lazy(() => import('@/pages/purchasing/orders').then((m) => ({ default: m.OrdersPage })));
const Order = lazy(() => import('@/pages/purchasing/orders').then((m) => ({ default: m.OrderPage })));
const AutoOrder = lazy(() => import('@/pages/purchasing/auto-order'));
const Containers = lazy(() => import('@/pages/purchasing/containers').then((m) => ({ default: m.ContainersPage })));
const ContainerP = lazy(() => import('@/pages/purchasing/containers').then((m) => ({ default: m.ContainerPage })));
const Donors = lazy(() => import('@/pages/purchasing/donors').then((m) => ({ default: m.DonorsPage })));
const DonorP = lazy(() => import('@/pages/purchasing/donors').then((m) => ({ default: m.DonorPage })));
const Customers = lazy(() => import('@/pages/customers').then((m) => ({ default: m.CustomersPage })));
const CustomerP = lazy(() => import('@/pages/customers').then((m) => ({ default: m.CustomerPage })));
const Debts = lazy(() => import('@/pages/customers/more').then((m) => ({ default: () => <m.DebtsPage /> })));
const Settlements = lazy(() => import('@/pages/customers/more').then((m) => ({ default: () => <m.DebtsPage defaultDirection="payable" /> })));
const Masters = lazy(() => import('@/pages/customers/more').then((m) => ({ default: m.MastersPage })));
const Loyalty = lazy(() => import('@/pages/customers/more').then((m) => ({ default: m.LoyaltyPage })));
const Waitlist = lazy(() => import('@/pages/customers/more').then((m) => ({ default: m.WaitlistPage })));
const Selections = lazy(() => import('@/pages/customers/more').then((m) => ({ default: m.SelectionsPage })));
const Tasks = lazy(() => import('@/pages/customers/more').then((m) => ({ default: m.TasksPage })));
const Requests = lazy(() => import('@/pages/requests').then((m) => ({ default: m.RequestsPage })));
const RequestsBoard = lazy(() => import('@/pages/requests').then((m) => ({ default: m.RequestsBoardPage })));
const RequestP = lazy(() => import('@/pages/requests').then((m) => ({ default: m.RequestPage })));
const Accounts = lazy(() => import('@/pages/money').then((m) => ({ default: m.AccountsPage })));
const Payments = lazy(() => import('@/pages/money').then((m) => ({ default: m.PaymentsPage })));
const Transfers = lazy(() => import('@/pages/money').then((m) => ({ default: m.TransfersPage })));
const Expenses = lazy(() => import('@/pages/money').then((m) => ({ default: m.ExpensesPage })));
const Reports = lazy(() => import('@/pages/reports').then((m) => ({ default: m.ReportsPage })));
const ReportP = lazy(() => import('@/pages/reports').then((m) => ({ default: m.ReportPage })));
const SavedReports = lazy(() => import('@/pages/reports').then((m) => ({ default: m.SavedReportsPage })));

const Settings = lazy(() => import('@/pages/settings'));
const SettingsWarehouses = lazy(() => import('@/pages/settings/warehouses'));
const SettingsDevices = lazy(() => import('@/pages/settings/devices'));
const SettingsStaff = lazy(() => import('@/pages/settings/staff'));
const PrintForms = lazy(() => import('@/pages/settings/tools').then((m) => ({ default: m.PrintFormsPage })));
const Synonyms = lazy(() => import('@/pages/settings/tools').then((m) => ({ default: m.SynonymsPage })));
const ImportP = lazy(() => import('@/pages/settings/tools').then((m) => ({ default: m.ImportPage })));
const Audit = lazy(() => import('@/pages/settings/tools').then((m) => ({ default: m.AuditPage })));
const Onboarding = lazy(() => import('@/pages/onboarding'));
const SalesOrders = lazy(() => import('@/pages/sales/orders').then((m) => ({ default: m.OrdersPage })));
const SalesOrder = lazy(() => import('@/pages/sales/orders').then((m) => ({ default: m.OrderPage })));
const Deliveries = lazy(() => import('@/pages/sales/orders').then((m) => ({ default: m.DeliveriesPage })));
const Consignment = lazy(() => import('@/pages/sales/more').then((m) => ({ default: m.ConsignmentPage })));
const Warranty = lazy(() => import('@/pages/sales/more').then((m) => ({ default: m.WarrantyPage })));
const WhTasks = lazy(() => import('@/pages/stock/tasks'));
const MobileHome = lazy(() => import('@/pages/mobile'));
const PriceCheck = lazy(() => import('@/pages/mobile').then((m) => ({ default: m.PriceCheckPage })));
const PhoneScan = lazy(() => import('@/pages/mobile').then((m) => ({ default: m.PhoneScanPage })));
const CustomerDisplay = lazy(() => import('@/pages/mobile').then((m) => ({ default: m.CustomerDisplayPage })));

const PageFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-48 rounded-[28px]" />
  </div>
);
const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<PageFallback />}>{children}</Suspense>;

/** Только с токеном и выбранным магазином */
function Private() {
  const token = useSession((s) => s.accessToken);
  const tenant = useSession((s) => s.currentTenantId);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!tenant) return <Navigate to="/select-shop" replace />;
  return <WithShell />;
}

/** Владелец без пройденной первой настройки — в мастер (ТЗ 2.5) */
function WithShell() {
  const me = useMe();
  if (me.data?.tenant && !me.data.tenant.onboardingCompleted && me.data.membership?.isOwner) return <Navigate to="/onboarding" replace />;
  return (
    <AppShell>
      <S>
        <Outlet />
      </S>
    </AppShell>
  );
}

/** Без оболочки: мастер, мобильный режим, экран покупателя */
function Bare() {
  const token = useSession((s) => s.accessToken);
  const tenant = useSession((s) => s.currentTenantId);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!tenant) return <Navigate to="/select-shop" replace />;
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}

function Guest() {
  const token = useSession((s) => s.accessToken);
  const tenant = useSession((s) => s.currentTenantId);
  if (token && tenant) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}

function NeedsShop() {
  const token = useSession((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <Guest />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
    ],
  },
  { element: <NeedsShop />, children: [{ path: '/select-shop', element: <SelectShop /> }] },
  {
    element: <Bare />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/m', element: <MobileHome /> },
      { path: '/m/check', element: <PriceCheck /> },
      { path: '/m/scan', element: <PhoneScan /> },
      { path: '/pos/display', element: <CustomerDisplay /> },
    ],
  },
  {
    element: <Private />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/products', element: <Catalog /> },
      { path: '/products/:id', element: <Product /> },
      { path: '/search', element: <Search /> },
      { path: '/profile', element: <Profile /> },
      { path: '/pos', element: <Pos /> },
      { path: '/sales', element: <Sales /> },
      { path: '/sales/returns', element: <Returns /> },
      { path: '/shifts', element: <Shifts /> },
      { path: '/documents', element: <Documents /> },
      { path: '/documents/new', element: <DocumentEditor /> },
      { path: '/documents/:id', element: <DocumentEditor /> },
      { path: '/stock', element: <Stock /> },
      { path: '/stock/places', element: <Places /> },
      { path: '/stock/inventory', element: <InventoryList /> },
      { path: '/stock/inventory/:id', element: <Inventory /> },
      { path: '/catalog/categories', element: <Categories /> },
      { path: '/catalog/brands', element: <Brands /> },
      { path: '/catalog/part-types', element: <PartTypes /> },
      { path: '/catalog/crosses', element: <Crosses /> },
      { path: '/prices', element: <PriceSettings /> },
      { path: '/prices/rate', element: <ShopRate /> },
      { path: '/prices/:id', element: <PriceSetting /> },
      { path: '/labels', element: <Labels /> },
      { path: '/purchasing', element: <Navigate to="/purchasing/orders" replace /> },
      { path: '/purchasing/suppliers', element: <Suppliers /> },
      { path: '/purchasing/suppliers/:id', element: <Supplier /> },
      { path: '/purchasing/price-lists', element: <PriceLists /> },
      { path: '/purchasing/price-lists/:id', element: <PriceList /> },
      { path: '/purchasing/orders', element: <Orders /> },
      { path: '/purchasing/orders/new', element: <Order /> },
      { path: '/purchasing/orders/:id', element: <Order /> },
      { path: '/purchasing/auto-order', element: <AutoOrder /> },
      { path: '/purchasing/containers', element: <Containers /> },
      { path: '/purchasing/containers/:id', element: <ContainerP /> },
      { path: '/purchasing/donors', element: <Donors /> },
      { path: '/purchasing/donors/:id', element: <DonorP /> },
      { path: '/tasks', element: <Tasks /> },
      { path: '/customers', element: <Customers /> },
      { path: '/customers/debts', element: <Debts /> },
      { path: '/customers/masters', element: <Masters /> },
      { path: '/customers/loyalty', element: <Loyalty /> },
      { path: '/customers/waitlist', element: <Waitlist /> },
      { path: '/customers/:id', element: <CustomerP /> },
      { path: '/prices/promo', element: <Loyalty /> },
      { path: '/sales/selection', element: <Selections /> },
      { path: '/requests', element: <Requests /> },
      { path: '/requests/board', element: <RequestsBoard /> },
      { path: '/requests/new', element: <RequestP /> },
      { path: '/requests/:id', element: <RequestP /> },
      { path: '/money', element: <Accounts /> },
      { path: '/money/payments', element: <Payments /> },
      { path: '/money/transfers', element: <Transfers /> },
      { path: '/money/expenses', element: <Expenses /> },
      { path: '/money/settlements', element: <Settlements /> },
      { path: '/reports', element: <Reports /> },
      { path: '/reports/saved', element: <SavedReports /> },
      { path: '/reports/:code', element: <ReportP /> },
      { path: '/sales/orders', element: <SalesOrders /> },
      { path: '/sales/orders/:id', element: <SalesOrder /> },
      { path: '/sales/deliveries', element: <Deliveries /> },
      { path: '/sales/consignment', element: <Consignment /> },
      { path: '/sales/warranty', element: <Warranty /> },
      { path: '/stock/tasks', element: <WhTasks /> },
      { path: '/settings', element: <Settings /> },
      { path: '/settings/warehouses', element: <SettingsWarehouses /> },
      { path: '/settings/devices', element: <SettingsDevices /> },
      { path: '/settings/staff', element: <SettingsStaff /> },
      { path: '/settings/print', element: <PrintForms /> },
      { path: '/settings/synonyms', element: <Synonyms /> },
      { path: '/settings/import', element: <ImportP /> },
      { path: '/settings/audit', element: <Audit /> },
      { path: '*', element: <Stub /> },
    ],
  },
]);
