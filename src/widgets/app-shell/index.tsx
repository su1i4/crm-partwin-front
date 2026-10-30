import { LogOut, Menu as MenuIcon, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, ShoppingCart, ClipboardList, Boxes, Sun, User, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { offline, useOffline } from '@/entities/pos-offline';
import { useCan, useMe, useSession } from '@/entities/session';
import { useOnline } from '@/shared/hooks/use-online';
import { useLogout } from '@/features/auth';
import { CommandSearch, useCommand } from '@/features/command-search';
import { NotificationsBell } from '@/features/notifications-bell';
import { QuickProductDialog } from '@/features/quick-product';
import { StoreSwitch } from '@/features/store-switch';
import { TenantSwitch } from '@/features/tenant-switch';
import { useTheme } from '@/features/theme';
import { NAV, sectionFor, type NavItem, type NavSection } from '@/shared/config/navigation';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Avatar, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/shared/ui';

const useShell = create<{ navOpen: boolean; toggleNav: () => void }>()(
  persist((set, get) => ({ navOpen: true, toggleNav: () => set({ navOpen: !get().navOpen }) }), { name: 'ap.shell' }),
);

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn('grid size-11 place-items-center rounded-full bg-pill text-pill-ink', className)} aria-label="Автозапчасти CRM">
    <svg viewBox="0 0 32 32" className="size-6" fill="none">
      <path d="M21 10.6a7 7 0 1 0 0 10.8" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  </span>
);

function isActive(item: NavItem, pathname: string, search: string, siblings: NavItem[] = []) {
  const [path, query] = item.to.split('?');
  if (query) return pathname === path && search.includes(query);
  if (path === '/documents') return pathname === '/documents' && !search.includes('type=');
  if (path === '/products') return pathname === '/products' && !search.includes('missing') && !search.includes('quick');
  if (pathname === path) return true;
  // Карточки (/customers/123) подсвечивают ближайший пункт, если у адреса нет своего пункта меню
  if (path === '/' || !pathname.startsWith(path + '/')) return false;
  const own = siblings.some((s) => s.to.split('?')[0] === pathname);
  const longer = siblings.some((s) => {
    const p = s.to.split('?')[0];
    return p.length > path.length && p !== pathname && pathname.startsWith(p + '/');
  });
  return !own && !longer && !/\/(rate|returns|places|inventory)$/.test(pathname);
}

/** Левая колонка с иконками разделов — как на референсе: белые круги, активный — малиновый */
function Rail({ sections, active }: { sections: NavSection[]; active: NavSection }) {
  const { theme, toggle } = useTheme();
  const { navOpen, toggleNav } = useShell();
  return (
    <aside className="hidden w-[84px] shrink-0 flex-col items-center gap-3 py-6 md:flex">
      <Link to="/" className="mb-5">
        <Logo />
      </Link>
      <nav className="scroll-thin flex flex-1 flex-col items-center gap-2.5 overflow-y-auto px-2 pb-2">
        {sections.map((s) => {
          const on = s.key === active.key;
          return (
            <NavLink
              key={s.key}
              to={s.to}
              title={s.label}
              aria-label={s.label}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full transition',
                on ? 'bg-accent text-accent-ink shadow-[0_8px_18px_-8px_var(--accent)]' : 'bg-card text-ink ring-1 ring-line hover:ring-line-strong',
              )}
            >
              <s.icon className="size-[19px]" strokeWidth={1.8} />
            </NavLink>
          );
        })}
      </nav>
      <button onClick={toggleNav} className="hidden size-11 place-items-center rounded-full text-muted hover:bg-card xl:grid" title={navOpen ? 'Свернуть меню' : 'Развернуть меню'}>
        {navOpen ? <PanelLeftClose className="size-[19px]" /> : <PanelLeftOpen className="size-[19px]" />}
      </button>
      <button onClick={toggle} className="grid size-11 place-items-center rounded-full bg-card text-ink ring-1 ring-line" title="Тема">
        {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
    </aside>
  );
}

function SectionNav({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
  const { pathname, search } = useLocation();
  const can = useCan();
  return (
    <div className="space-y-5">
      {section.groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <div className="mb-1.5 px-1 text-[13px] font-medium text-ink">{g.title}</div>}
          <div className={cn('space-y-0.5', g.title && 'ml-2 border-l border-line pl-3')}>
            {g.items
              .filter((i) => can(i.permission))
              .map((i) => {
                const on = isActive(i, pathname, search, section.groups.flatMap((x) => x.items));
                return (
                  <Link
                    key={i.to}
                    to={i.to}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[13.5px] transition',
                      on ? 'font-medium text-accent' : i.ready ? 'text-ink-2 hover:text-ink' : 'text-muted hover:text-ink-2',
                    )}
                  >
                    <span className="truncate">{i.label}</span>
                    {!i.ready && i.stage && <span className="shrink-0 rounded-full bg-card px-1.5 py-px text-[10px] text-faint ring-1 ring-line">эт. {i.stage}</span>}
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NavColumn({ sections, active }: { sections: NavSection[]; active: NavSection }) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col py-6 pr-4 pl-1 xl:flex">
      <div className="mb-6 flex h-11 items-center px-1">
        <TenantSwitch />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto pr-1">
        <div className="mb-4 space-y-0.5 border-b border-line pb-4">
          <div className="px-1 pb-2 text-[11px] font-medium tracking-wider text-faint uppercase">{active.label}</div>
          <SectionNav section={active} />
        </div>
        <div className="space-y-0.5">
          <div className="px-1 pb-2 text-[11px] font-medium tracking-wider text-faint uppercase">Разделы</div>
          {sections
            .filter((s) => s.key !== active.key)
            .map((s) => (
              <Link key={s.key} to={s.to} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-[13.5px] text-muted hover:text-ink">
                <s.icon className="size-4" strokeWidth={1.8} />
                {s.label}
              </Link>
            ))}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ onPlus, onOpenMobileNav }: { onPlus: () => void; onOpenMobileNav: () => void }) {
  const openSearch = useCommand((s) => s.set);
  const { data: me } = useMe();
  const logout = useLogout();
  const can = useCan();
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  return (
    <header className="flex items-center gap-2 px-4 pt-4 sm:gap-3 md:px-0 md:pt-6">
      <button onClick={onOpenMobileNav} className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line md:hidden" aria-label="Меню">
        <MenuIcon className="size-[18px]" />
      </button>
      <button
        onClick={() => openSearch(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-card px-4 text-left text-[13.5px] text-muted ring-1 ring-line hover:ring-line-strong md:max-w-[380px]"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Поиск: номер, товар, клиент…</span>
        <Kbd className="ml-auto hidden sm:inline">Ctrl K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:block">
          <StoreSwitch />
        </div>
        <NotificationsBell />
        <Menu>
          <MenuTrigger className="flex h-10 items-center gap-2 rounded-full bg-card pr-1 pl-3 ring-1 ring-line outline-none hover:ring-line-strong">
            <MenuIcon className="size-4 text-ink" />
            <Avatar name={me?.user.name} size={32} />
          </MenuTrigger>
          <MenuContent className="w-64">
            <MenuLabel>{me?.user.name ?? 'Профиль'}</MenuLabel>
            <div className="px-3 pb-2 text-xs text-muted">{me?.membership?.roles.map((r) => r.name).join(', ')}</div>
            <MenuSeparator />
            <div className="px-1.5 py-1 sm:hidden">
              <StoreSwitch />
            </div>
            <MenuItem onSelect={() => nav('/profile')}>
              <User /> Профиль и сессии
            </MenuItem>
            <MenuItem onSelect={toggle}>
              {theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={logout} className="text-accent">
              <LogOut /> Выйти
            </MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger
            className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_8px_18px_-8px_var(--accent)] outline-none hover:brightness-95"
            aria-label="Создать"
          >
            <Plus className="size-5" />
          </MenuTrigger>
          <MenuContent className="w-56">
            <MenuLabel>Быстрые действия</MenuLabel>
            {can('pos.use') && <MenuItem onSelect={() => nav('/pos')}>Продажа</MenuItem>}
            {can('products.write') && <MenuItem onSelect={onPlus}>Новый товар</MenuItem>}
            {can('stock.receive') && <MenuItem onSelect={() => nav('/purchasing/receivings')}>Приёмка</MenuItem>}
            {can('requests.write') && <MenuItem onSelect={() => nav('/requests')}>Заявка клиента</MenuItem>}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

/** Нижняя панель на телефоне: Касса, Поиск, Заявки, Склад, Ещё (ТЗ 23.1) */
function MobileBar({ onMore }: { onMore: () => void }) {
  const openSearch = useCommand((s) => s.set);
  const items = [
    { to: '/pos', label: 'Касса', icon: ShoppingCart },
    { to: '/requests', label: 'Заявки', icon: ClipboardList },
    { to: '/stock', label: 'Склад', icon: Boxes },
  ];
  const cls = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted';
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex rounded-full bg-card px-2 shadow-xl ring-1 ring-line md:hidden">
      <NavLink to={items[0].to} className={({ isActive }) => cn(cls, isActive && 'text-accent')}>
        <ShoppingCart className="size-5" /> Касса
      </NavLink>
      <button onClick={() => openSearch(true)} className={cls}>
        <Search className="size-5" /> Поиск
      </button>
      {items.slice(1).map((i) => (
        <NavLink key={i.to} to={i.to} className={({ isActive }) => cn(cls, isActive && 'text-accent')}>
          <i.icon className="size-5" /> {i.label}
        </NavLink>
      ))}
      <button onClick={onMore} className={cls}>
        <MenuIcon className="size-5" /> Ещё
      </button>
    </nav>
  );
}

function MobileDrawer({ open, onClose, sections, active }: { open: boolean; onClose: () => void; sections: NavSection[]; active: NavSection }) {
  const [sec, setSec] = useState(active.key);
  const cur = sections.find((s) => s.key === sec) ?? active;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[min(360px,90vw)] flex-col rounded-r-[32px] bg-shell">
        <div className="flex items-center justify-between px-5 pt-5">
          <TenantSwitch />
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-card" aria-label="Закрыть">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 gap-3 p-4">
          <div className="flex flex-col gap-2">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSec(s.key)}
                className={cn('grid size-11 place-items-center rounded-full', s.key === cur.key ? 'bg-accent text-accent-ink' : 'bg-card ring-1 ring-line')}
                aria-label={s.label}
              >
                <s.icon className="size-[18px]" strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <div className="scroll-thin min-w-0 flex-1 overflow-y-auto">
            <div className="px-1 pb-3 text-lg font-semibold text-ink">{cur.label}</div>
            <SectionNav section={cur} onNavigate={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Очередь кассы отправляется и с других страниц, не только с экрана кассы */
function useOfflineAutoSync() {
  const tenant = useSession((s) => s.currentTenantId);
  const online = useOnline();
  const device = useOffline((s) => s.device);
  useEffect(() => {
    if (tenant) void offline.init(tenant);
  }, [tenant]);
  useEffect(() => {
    if (!device || !online) return;
    void offline.flush();
    const t = setInterval(() => void offline.flush(), 30_000);
    return () => clearInterval(t);
  }, [device, online]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useOfflineAutoSync();
  const { pathname, search } = useLocation();
  const can = useCan();
  const sections = NAV.filter((s) => can(s.permission));
  const active = sectionFor(pathname, search);
  const navOpen = useShell((s) => s.navOpen);
  const online = useOnline();
  const [quick, setQuick] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="h-full md:p-3 lg:p-5">
      <div className="flex h-full overflow-hidden bg-shell md:rounded-[36px] md:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)]">
        <Rail sections={sections} active={active} />
        {navOpen && !pathname.startsWith('/pos') && <NavColumn sections={sections} active={active} />}
        <div className="flex min-w-0 flex-1 flex-col md:pr-4 lg:pr-5">
          <TopBar onPlus={() => setQuick(true)} onOpenMobileNav={() => setDrawer(true)} />
          {!online && !pathname.startsWith('/pos') && (
            <div className="mx-4 mt-3 rounded-full bg-accent-soft px-4 py-1.5 text-center text-xs text-accent md:mx-0">Нет связи с сервером — показаны последние загруженные данные. Касса работает без сети.</div>
          )}
          {env.demo && (
            <div className="mx-4 mt-3 rounded-full bg-warn-soft px-4 py-1.5 text-center text-xs text-warn md:mx-0">Демо-режим: данные ненастоящие, backend не подключён</div>
          )}
          <main className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto pb-24 md:mt-4 md:mb-4 md:rounded-[32px] md:bg-panel md:pb-0 lg:mb-5">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-2 md:p-6 lg:p-7">{children}</div>
          </main>
        </div>
      </div>
      <MobileBar onMore={() => setDrawer(true)} />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} sections={sections} active={active} />
      <CommandSearch />
      <QuickProductDialog open={quick} onOpenChange={setQuick} />
    </div>
  );
}

export { useShell };
