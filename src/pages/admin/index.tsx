import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  KeyRound,
  LifeBuoy,
  LogOut,
  Plus,
  ScrollText,
  Search,
  ShieldAlert,
  Store,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import {
  platformApi,
  SHOP_TYPE,
  TENANT_STATUS,
  useAdminSession,
  useAdminTenant,
  useAdminTenants,
  useDictionary,
  useJournal,
  useMonitoring,
  type DictKind,
  type SupportSession,
  type TenantCard,
} from "@/entities/platform";
import { ApiError, errorMessage } from "@/shared/api";
import { env } from "@/shared/config/env";
import { cn } from "@/shared/lib/cn";
import { ago, date, num } from "@/shared/lib/format";
import {
  Avatar,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageTitle,
  Pill,
  Segmented,
  Skeleton,
  Switch,
  Tray,
} from "@/shared/ui";

const useIsAdmin = () => useAdminSession((s) => s.admin?.role === "admin");

// ── Вход ────────────────────────────────────────────────

/** Вход сотрудника платформы: email + пароль + код из приложения (2FA обязательна) */
export function AdminLoginPage() {
  const token = useAdminSession((s) => s.token);
  const set = useAdminSession((s) => s.set);
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "", code: "" });
  const m = useMutation({
    mutationFn: () =>
      platformApi.login({
        email: f.email.trim(),
        password: f.password,
        code: f.code.trim(),
      }),
    onSuccess: (r) => (
      set(r.accessToken, r.admin),
      nav("/admin", { replace: true })
    ),
    onError: (e) =>
      toast.error(
        e instanceof ApiError && e.status === 429
          ? "Слишком много попыток — подождите 15 минут"
          : e instanceof ApiError && e.code === "ADMIN_LOGIN_FAILED"
            ? "Неверный email, пароль или код"
            : errorMessage(e),
      ),
  });
  if (token) return <Navigate to="/admin" replace />;
  return (
    <div className="hatch grid min-h-dvh place-items-center bg-bg p-4">
      <Card className="w-full max-w-sm space-y-5 p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-pill text-pill-ink">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">
              Админка платформы
            </div>
            <div className="text-xs text-muted">
              Только для сотрудников сервиса
            </div>
          </div>
        </div>
        <form
          onSubmit={(e) => (e.preventDefault(), m.mutate())}
          className="space-y-3"
        >
          <Field label="Email">
            <Input
              autoFocus
              type="email"
              autoComplete="username"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              autoComplete="current-password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          </Field>
          <Field label="Код из приложения" hint="Google Authenticator — 6 цифр">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              icon={<KeyRound />}
              value={f.code}
              onChange={(e) =>
                setF({
                  ...f,
                  code: e.target.value.replace(/\D/g, "").slice(0, 6),
                })
              }
              className="font-mono tracking-[0.3em]"
            />
          </Field>
          <Button
            type="submit"
            variant="dark"
            size="lg"
            className="w-full"
            disabled={!f.email || f.password.length < 3 || f.code.length !== 6}
            loading={m.isPending}
          >
            Войти
          </Button>
        </form>
        {env.demo && (
          <div className="rounded-full bg-warn-soft px-3 py-1.5 text-center text-xs text-warn">
            Демо: любой email и пароль, код — любые 6 цифр
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Оболочка ────────────────────────────────────────────

const NAV = [
  { to: "/admin", label: "Магазины", icon: Store, end: true },
  { to: "/admin/monitoring", label: "Мониторинг", icon: Activity },
  { to: "/admin/dictionaries", label: "Справочники", icon: BookOpen },
  { to: "/admin/journal", label: "Журнал", icon: ScrollText, adminOnly: true },
];

export function AdminLayout() {
  const { token, admin, logout } = useAdminSession();
  const qc = useQueryClient();
  if (!token) return <Navigate to="/admin/login" replace />;
  const items = NAV.filter((n) => !n.adminOnly || admin?.role === "admin");
  return (
    <div className="min-h-dvh bg-bg md:p-3 lg:p-5">
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col bg-shell md:flex-row md:rounded-[36px] md:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)] lg:min-h-[calc(100dvh-2.5rem)]">
        <aside className="flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-3 md:w-60 md:flex-col md:items-stretch md:gap-1 md:px-4 md:py-6">
          <div className="mr-2 flex items-center gap-2.5 md:mr-0 md:mb-6 md:px-2">
            <span className="grid size-10 place-items-center rounded-full bg-pill text-pill-ink">
              <ShieldAlert className="size-5" />
            </span>
            <span className="hidden text-[15px] leading-tight font-semibold md:block">
              Платформа
              <span className="block text-xs font-normal text-muted">
                админка
              </span>
            </span>
          </div>
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex h-10 shrink-0 items-center gap-2.5 rounded-full px-4 text-[14px] transition",
                  isActive
                    ? "bg-pill text-pill-ink"
                    : "text-ink-2 hover:bg-card",
                )
              }
            >
              <n.icon className="size-4" /> {n.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-2 md:mt-auto md:ml-0 md:flex-col md:items-stretch">
            <div className="hidden items-center gap-2 rounded-[18px] bg-card p-2.5 md:flex">
              <Avatar name={admin?.name ?? "?"} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">
                  {admin?.name}
                </span>
                <span className="block text-xs text-muted">
                  {admin?.role === "admin" ? "администратор" : "поддержка"}
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={() => (
                logout(),
                qc.removeQueries({ queryKey: ["adm"] })
              )}
            >
              <LogOut /> <span className="hidden md:inline">Выйти</span>
            </Button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 md:my-4 md:mr-4 md:rounded-[32px] md:bg-panel lg:my-5 lg:mr-5">
          {env.demo && (
            <div className="mx-4 mt-3 rounded-full bg-warn-soft px-4 py-1.5 text-center text-xs text-warn md:mx-6">
              Демо-режим: данные ненастоящие
            </div>
          )}
          <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:p-6 lg:p-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Магазины ────────────────────────────────────────────

const STATUS_TABS = [
  { value: "", label: "Все" },
  { value: "trial", label: "Пробные" },
  { value: "active", label: "Активные" },
  { value: "suspended", label: "Приостановлены" },
];

/** Подписка закончится скоро или уже закончилась — подсветка */
const untilTone = (until: string | null) => {
  if (!until) return "text-muted";
  const days = (new Date(until).getTime() - Date.now()) / 86_400_000;
  return days < 0
    ? "text-accent font-medium"
    : days < 7
      ? "text-warn font-medium"
      : "text-ink-2";
};

export function AdminTenantsPage() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get("status") ?? "";
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [dq, setDq] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, error, refetch } = useAdminTenants({
    search: dq.trim() || undefined,
    status: status || undefined,
  });
  const counts = (data ?? []).reduce<Record<string, number>>(
    (a, t) => ((a[t.status] = (a[t.status] ?? 0) + 1), a),
    {},
  );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Магазины"
        sub={
          data
            ? `${data.length} магазинов · активных ${counts.active ?? 0} · пробных ${counts.trial ?? 0} · приостановлено ${counts.suspended ?? 0}`
            : "Подписки, активность, вход поддержки"
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          icon={<Search />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название или телефон владельца"
          className="w-72"
        />
        <Segmented
          value={status}
          onChange={(v) => setSp(v ? { status: v } : {}, { replace: true })}
          options={STATUS_TABS}
        />
      </div>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-72 rounded-[24px]" />}
      {data && (
        <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
          <table className="w-full min-w-[980px] text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-normal">Магазин</th>
                <th className="px-3 py-3 font-normal">Владелец</th>
                <th className="px-3 py-3 font-normal">Статус</th>
                <th className="px-3 py-3 font-normal">Подписка до</th>
                <th className="px-3 py-3 text-right font-normal">
                  Точки · кассы · люди
                </th>
                <th className="px-3 py-3 text-right font-normal">Товары</th>
                <th className="px-3 py-3 text-right font-normal">
                  Чеков 30 дн
                </th>
                <th className="px-4 py-3 font-normal">Активность</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => {
                const st = TENANT_STATUS[t.status] ?? {
                  label: t.status,
                  tone: "muted" as const,
                };
                return (
                  <tr
                    key={t.id}
                    className="border-b border-line last:border-0 hover:bg-card-muted"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/admin/tenants/${t.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {[
                          t.shopType && SHOP_TYPE[t.shopType],
                          t.city,
                          `с ${date(t.createdAt, "DD.MM.YY")}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{t.ownerName ?? "—"}</div>
                      <div className="text-xs text-muted">{t.ownerPhone}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {t.plan && (
                        <div className="mt-0.5 text-xs text-muted">
                          {t.plan}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 tabular-nums",
                        untilTone(t.subscriptionUntil),
                      )}
                    >
                      {t.subscriptionUntil
                        ? date(t.subscriptionUntil, "DD.MM.YYYY")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {t.stores} · {t.registers} · {t.staff}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num(t.products)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        !t.receipts30d && "text-faint",
                      )}
                    >
                      {num(t.receipts30d)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {t.lastActivity ? ago(t.lastActivity) : "нет"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.length && <EmptyState icon={<Store />} title="Не нашли" />}
        </div>
      )}
    </div>
  );
}

// ── Карточка магазина ───────────────────────────────────

const SS: Record<
  SupportSession["status"],
  { label: string; tone: "warn" | "ok" | "muted" | "accent-outline" }
> = {
  requested: { label: "ждёт владельца", tone: "warn" },
  active: { label: "идёт", tone: "ok" },
  ended: { label: "завершён", tone: "muted" },
  declined: { label: "отклонён", tone: "accent-outline" },
};

/** Открыть магазин глазами поддержки — новая вкладка с токеном сеанса (не трогает вход в админку) */
const openShop = (token: string, tenantId: string) =>
  window.open(
    `/support/enter#t=${encodeURIComponent(token)}&tenant=${tenantId}`,
    "_blank",
  );

export function AdminTenantPage() {
  const { id } = useParams();
  const { data: t, isLoading, error, refetch } = useAdminTenant(id);
  const isAdmin = useIsAdmin();
  const [sub, setSub] = useState(false);
  const [sup, setSup] = useState(false);
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !t) return <Skeleton className="h-96 rounded-[28px]" />;
  const st = TENANT_STATUS[t.status] ?? {
    label: t.status,
    tone: "muted" as const,
  };
  return (
    <div className="space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <Link
              to="/admin"
              className="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line hover:ring-ink"
              aria-label="Назад"
            >
              <ArrowLeft className="size-4" />
            </Link>
            {t.name}
          </span>
        }
        sub={[
          t.shop_type && SHOP_TYPE[t.shop_type],
          t.city,
          t.phone,
          `зарегистрирован ${date(t.created_at, "D MMM YYYY")}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button onClick={() => setSup(true)}>
              <LifeBuoy /> Вход поддержки
            </Button>
            {isAdmin && (
              <Button variant="dark" onClick={() => setSub(true)}>
                Подписка
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Точки", t.stores],
          ["Кассы", t.registers],
          ["Сотрудники", t.staff],
          ["Товары", num(t.products)],
          ["Чеков за 30 дней", num(t.receipts30d)],
          ["Активность", t.lastActivity ? ago(t.lastActivity) : "нет"],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <div className="text-xs text-muted">{l}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{v}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">Подписка</span>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          {[
            [
              "До",
              t.subscription_until
                ? date(t.subscription_until, "D MMMM YYYY")
                : "не указано",
            ],
            ["Тариф", t.plan ?? "—"],
            [
              "Лимиты",
              t.limits
                ? `точек ${t.limits.stores ?? "∞"}, касс ${t.limits.registers ?? "∞"}, людей ${t.limits.staff ?? "∞"}`
                : "без ограничений",
            ],
            ["ИНН", t.inn ?? "—"],
            ["Адрес", t.address ?? "—"],
            [
              "Мастер настройки",
              t.onboarding_completed_at
                ? `пройден ${date(t.onboarding_completed_at, "DD.MM.YY")}`
                : "не пройден",
            ],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 text-sm">
              <span className="text-muted">{l}</span>
              <span
                className={cn(
                  "text-right",
                  l === "До" && untilTone(t.subscription_until),
                )}
              >
                {v}
              </span>
            </div>
          ))}
          {t.status === "suspended" && (
            <div className="rounded-[14px] bg-card-muted px-3 py-2 text-xs text-muted">
              Приостановлен: в магазине работает только просмотр и выгрузка,
              офлайн-чеки касс принимаются
            </div>
          )}
          {isAdmin && (
            <Link
              to={`/admin/journal?tenantId=${t.id}`}
              className="block text-sm text-accent underline"
            >
              Действия админов по магазину
            </Link>
          )}
        </Card>
        <Tray className="h-fit p-3">
          <div className="px-1 pb-2 text-[14px] font-medium">
            Сеансы поддержки
          </div>
          <SupportSessions t={t} />
        </Tray>
      </div>
      {isAdmin && (
        <SubscriptionDialog t={t} open={sub} onClose={() => setSub(false)} />
      )}
      <SupportDialog t={t} open={sup} onClose={() => setSup(false)} />
    </div>
  );
}

function SupportSessions({ t }: { t: TenantCard }) {
  const qc = useQueryClient();
  const me = useAdminSession((s) => s.admin);
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["adm", "tenant", t.id] });
  const enter = useMutation({
    mutationFn: (sid: string) => platformApi.enterSupport(sid),
    onSuccess: (r) => (
      openShop(r.supportToken, t.id),
      toast.success(
        `Сеанс до ${date(r.expiresAt, "HH:mm")} · ${r.canWrite ? "с изменениями" : "только просмотр"}`,
      )
    ),
    onError: (e) => (toast.error(errorMessage(e)), refresh()),
  });
  const end = useMutation({
    mutationFn: (sid: string) => platformApi.endSupport(sid),
    onSuccess: () => (refresh(), toast.success("Сеанс завершён")),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!t.support.length)
    return (
      <div className="rounded-[16px] bg-card px-4 py-3 text-sm text-muted">
        Поддержка в этот магазин не входила
      </div>
    );
  return (
    <div className="space-y-1.5">
      {t.support.map((s) => {
        const alive =
          s.status === "active" &&
          s.expiresAt &&
          new Date(s.expiresAt) > new Date();
        const mine = s.adminId === me?.id;
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] bg-card px-4 py-2.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px]">
                {s.emergency && (
                  <AlertTriangle className="mr-1 inline size-3.5 text-accent" />
                )}
                {s.reason}
              </span>
              <span className="block text-xs text-muted">
                {date(s.createdAt, "DD.MM HH:mm")}
                {s.expiresAt && ` · до ${date(s.expiresAt, "HH:mm")}`} ·{" "}
                {s.canWrite ? "с изменениями" : "только просмотр"}
                {s.showMoney ? " · деньги видны" : ""}
              </span>
            </span>
            <Pill
              tone={
                alive || s.status !== "active" ? SS[s.status].tone : "muted"
              }
            >
              {alive || s.status !== "active" ? SS[s.status].label : "истёк"}
            </Pill>
            {mine && (s.status === "requested" || alive) && (
              <>
                <Button
                  size="sm"
                  variant="dark"
                  loading={enter.isPending && enter.variables === s.id}
                  onClick={() => enter.mutate(s.id)}
                >
                  <ExternalLink />{" "}
                  {s.status === "requested" ? "Проверить и войти" : "Открыть"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={end.isPending && end.variables === s.id}
                  onClick={() => end.mutate(s.id)}
                >
                  Завершить
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SupportDialog({
  t,
  open,
  onClose,
}: {
  t: TenantCard;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  useEffect(() => {
    if (open) (setReason(""), setEmergency(false), setCanWrite(false));
  }, [open]);
  const m = useMutation({
    mutationFn: () =>
      platformApi.requestSupport(t.id, {
        reason: reason.trim(),
        ...(emergency ? { emergency: true } : {}),
        ...(canWrite && !emergency ? { canWrite: true } : {}),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["adm", "tenant", t.id] });
      onClose();
      if (r.supportToken) {
        toast.success(
          r.session.emergency
            ? "Аварийный вход: только просмотр, владелец уведомлён"
            : "Владелец заранее разрешил доступ — открываем магазин",
        );
        openShop(r.supportToken, t.id);
      } else
        toast.info(
          "Запрос отправлен владельцу — когда подтвердит, нажмите «Проверить и войти»",
        );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Вход поддержки"
      description="Только с согласия владельца: если он заранее разрешил — сразу, иначе ему уйдёт запрос. Сеанс — 60 минут"
    >
      <div className="mt-4 space-y-4">
        <Field
          label="Причина — её увидит владелец"
          error={
            reason.trim().length > 0 && reason.trim().length < 5
              ? "Минимум 5 символов"
              : undefined
          }
        >
          <Input
            autoFocus
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Не проводится приёмка ПР-000318, обращение от 30.10"
          />
        </Field>
        <Switch
          checked={canWrite}
          onChange={setCanWrite}
          label="Нужны изменения (если владелец разрешил)"
        />
        <div
          className={cn(
            "rounded-[18px] p-3",
            emergency ? "bg-accent-soft" : "bg-card-muted",
          )}
        >
          <Switch
            checked={emergency}
            onChange={setEmergency}
            label="Аварийно, без согласия"
          />
          <div className="mt-1.5 text-xs text-muted">
            Только просмотр. Владелец сразу получит уведомление в системе и в
            Telegram с причиной. Используйте, только если магазин стоит.
          </div>
        </div>
        <div className="text-xs text-muted">
          Закупочные цены, маржа и деньги скрыты, пока владелец не разрешит.
          Каждое действие попадёт в журнал магазина с пометкой «поддержка».
        </div>
        <Button
          variant={emergency ? "accent" : "dark"}
          size="lg"
          className="w-full"
          disabled={reason.trim().length < 5}
          loading={m.isPending}
          onClick={() => m.mutate()}
        >
          {emergency ? "Войти аварийно" : "Запросить доступ"}
        </Button>
      </div>
    </Dialog>
  );
}

function SubscriptionDialog({
  t,
  open,
  onClose,
}: {
  t: TenantCard;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    status: t.status as string,
    until: "",
    plan: "",
    stores: "",
    registers: "",
    staff: "",
    note: "",
  });
  useEffect(() => {
    if (open)
      setF({
        status: t.status,
        until: t.subscription_until
          ? String(t.subscription_until).slice(0, 10)
          : "",
        plan: t.plan ?? "",
        stores: t.limits?.stores != null ? String(t.limits.stores) : "",
        registers:
          t.limits?.registers != null ? String(t.limits.registers) : "",
        staff: t.limits?.staff != null ? String(t.limits.staff) : "",
        note: "",
      });
  }, [open, t]);
  const plus = (months: number) => {
    const base =
      f.until && new Date(f.until) > new Date()
        ? new Date(f.until)
        : new Date();
    base.setMonth(base.getMonth() + months);
    setF({
      ...f,
      until: base.toISOString().slice(0, 10),
      status:
        f.status === "suspended" || f.status === "trial" ? "active" : f.status,
    });
  };
  const limits = Object.fromEntries(
    (["stores", "registers", "staff"] as const)
      .filter((k) => f[k].trim() !== "")
      .map((k) => [k, Number(f[k])]),
  );
  const m = useMutation({
    mutationFn: () =>
      platformApi.subscription(t.id, {
        status: f.status,
        subscriptionUntil: f.until
          ? new Date(`${f.until}T23:59:59`).toISOString()
          : null,
        ...(f.plan.trim() ? { plan: f.plan.trim() } : {}),
        ...(Object.keys(limits).length ? { limits } : {}),
        ...(f.note.trim() ? { note: f.note.trim() } : {}),
      }),
    onSuccess: (r) => (
      qc.setQueryData(["adm", "tenant", t.id], r),
      qc.invalidateQueries({ queryKey: ["adm", "tenants"] }),
      onClose(),
      toast.success("Подписка обновлена — действует сразу")
    ),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Подписка"
      description={t.name}
      className="max-w-lg"
    >
      <div className="mt-4 space-y-4">
        <Segmented
          value={f.status}
          onChange={(v) => setF({ ...f, status: v })}
          options={[
            { value: "trial", label: "Пробный" },
            { value: "active", label: "Активен" },
            { value: "suspended", label: "Приостановлен" },
          ]}
        />
        {f.status === "suspended" && (
          <div className="rounded-[14px] bg-accent-soft px-3 py-2 text-xs text-accent">
            Сразу после сохранения магазин сможет только смотреть и выгружать
            данные
          </div>
        )}
        <Field label="Оплачено до">
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={f.until}
              onChange={(e) => setF({ ...f, until: e.target.value })}
              className="w-44"
            />
            {[1, 3, 12].map((mm) => (
              <Button
                key={mm}
                size="sm"
                variant="soft"
                className="h-11"
                onClick={() => plus(mm)}
              >
                +{mm} мес
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Тариф">
          <Input
            value={f.plan}
            onChange={(e) => setF({ ...f, plan: e.target.value })}
            placeholder="Старт / Магазин / Опт"
          />
        </Field>
        <Field label="Лимиты" hint="Пусто — без ограничения">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["stores", "точек"],
                ["registers", "касс"],
                ["staff", "сотрудников"],
              ] as const
            ).map(([k, l]) => (
              <Input
                key={k}
                inputMode="numeric"
                value={f[k]}
                onChange={(e) =>
                  setF({ ...f, [k]: e.target.value.replace(/\D/g, "") })
                }
                placeholder={l}
              />
            ))}
          </div>
        </Field>
        <Field label="Заметка об оплате" hint="Попадёт в журнал админов">
          <Input
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="Оплата MBank 30.10, 3 мес"
          />
        </Field>
        <Button
          variant="dark"
          size="lg"
          className="w-full"
          loading={m.isPending}
          onClick={() => m.mutate()}
        >
          Сохранить
        </Button>
      </div>
    </Dialog>
  );
}

// ── Мониторинг ──────────────────────────────────────────

export function AdminMonitoringPage() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useMonitoring();
  return (
    <div className="space-y-6">
      <PageTitle
        title="Мониторинг"
        sub={
          data
            ? `Проверено магазинов: ${data.checkedTenants} · обновлено ${date(new Date(dataUpdatedAt), "HH:mm:ss")}`
            : "Очередь событий, кассы, импорты, остатки, распознавание"
        }
        actions={
          <Button onClick={() => refetch()}>
            <Activity /> Обновить
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card
              className={cn(
                "p-5",
                data.outbox.failed ? "ring-2 ring-accent" : "",
              )}
            >
              <div className="text-xs text-muted">
                Очередь событий — с ошибкой
              </div>
              <div
                className={cn(
                  "mt-1 text-3xl font-semibold tabular-nums",
                  data.outbox.failed ? "text-accent" : "",
                )}
              >
                {data.outbox.failed ?? "—"}
              </div>
              <div className="text-xs text-muted">
                уведомления, Telegram, пересчёты
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-muted">Очередь событий — ждут</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {data.outbox.pending ?? "—"}
              </div>
            </Card>
            <Card
              className={cn(
                "p-5",
                data.problems.length ? "ring-2 ring-warn" : "",
              )}
            >
              <div className="text-xs text-muted">Магазинов с проблемами</div>
              <div
                className={cn(
                  "mt-1 text-3xl font-semibold tabular-nums",
                  data.problems.length ? "text-warn" : "text-ok",
                )}
              >
                {data.problems.length}
              </div>
              <div className="text-xs text-muted">из {data.checkedTenants}</div>
            </Card>
          </div>
          <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-3 font-normal">Магазин</th>
                  <th
                    className="px-3 py-3 text-right font-normal"
                    title="Касса на связи, но не отправила офлайн-чеки 30+ минут"
                  >
                    Кассы с неотправленными
                  </th>
                  <th
                    className="px-3 py-3 text-right font-normal"
                    title="Импорт висит больше часа"
                  >
                    Зависшие импорты
                  </th>
                  <th
                    className="px-3 py-3 text-right font-normal"
                    title="Ночная сверка остатков нашла расхождения (2 дня)"
                  >
                    Расхождения остатков
                  </th>
                  <th
                    className="px-4 py-3 text-right font-normal"
                    title="Доля распознанных номеров с фото за 30 дней"
                  >
                    Распознавание
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.problems.map((p) => {
                  const ocr =
                    p.ocrFoundRate == null ? null : Number(p.ocrFoundRate);
                  const bad = (v: number) =>
                    v ? "font-semibold text-accent" : "text-faint";
                  return (
                    <tr
                      key={p.tenantId}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/admin/tenants/${p.tenantId}`}
                          className="font-medium hover:text-accent"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          bad(p.offlineUnsent),
                        )}
                      >
                        {p.offlineUnsent}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          bad(p.stuckImports),
                        )}
                      >
                        {p.stuckImports}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          bad(p.stockMismatches),
                        )}
                      >
                        {p.stockMismatches}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular-nums",
                          ocr != null && ocr < 60
                            ? "font-semibold text-warn"
                            : "text-faint",
                        )}
                      >
                        {ocr == null ? "—" : `${ocr}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.problems.length && (
              <EmptyState
                icon={<Activity />}
                title="Всё спокойно"
                hint="Ни у одного магазина нет проблем"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Справочники ─────────────────────────────────────────

const KINDS: { value: DictKind; label: string }[] = [
  { value: "makes", label: "Марки машин" },
  { value: "brands", label: "Бренды запчастей" },
  { value: "synonyms", label: "Синонимы" },
  { value: "wmi", label: "VIN (WMI)" },
];
const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
const split = (s: string) =>
  s
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function AdminDictionariesPage() {
  const [kind, setKind] = useState<DictKind>("makes");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, error, refetch } = useDictionary(kind, dq);
  const isAdmin = useIsAdmin();
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const colMap: Record<
    DictKind,
    [string, string, (r: Record<string, unknown>) => ReactNode][]
  > = {
    makes: [
      [
        "code",
        "Код",
        (r) => <span className="font-mono">{String(r.code)}</span>,
      ],
      ["name", "Название", (r) => String(r.name)],
      [
        "aliases",
        "Как ещё пишут",
        (r) => <span className="text-muted">{list(r.aliases)}</span>,
      ],
    ],
    brands: [
      ["name", "Бренд", (r) => String(r.name)],
      [
        "aliases",
        "Варианты написания",
        (r) => <span className="text-muted">{list(r.aliases)}</span>,
      ],
      ["country", "Страна", (r) => String(r.country ?? "—")],
      [
        "isCarMaker",
        "",
        (r) =>
          r.isCarMaker ? <Pill tone="soft">автопроизводитель</Pill> : null,
      ],
    ],
    synonyms: [
      ["word", "Слово", (r) => String(r.word)],
      ["target", "Значит", (r) => <b>{String(r.target)}</b>],
      ["lang", "Язык", (r) => String(r.lang ?? "ru")],
    ],
    wmi: [
      ["wmi", "WMI", (r) => <span className="font-mono">{String(r.wmi)}</span>],
      ["make", "Марка", (r) => String(r.make ?? "—")],
      ["country", "Страна", (r) => String(r.country ?? "—")],
    ],
  };
  const cols = colMap[kind];
  return (
    <div className="space-y-6">
      <PageTitle
        title="Общие справочники"
        sub="Видны всем магазинам. Свои синонимы и бренды магазины добавляют сами — здесь общая база"
        actions={
          isAdmin && (
            <Button variant="dark" onClick={() => setEdit({})}>
              <Plus /> Добавить
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={(v) => (setKind(v), setQ(""))}
          options={KINDS}
        />
        <Input
          icon={<Search />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти"
          className="w-64"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {error && <ErrorState error={error} onRetry={refetch} />}
          {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
          {data && (
            <div className="overflow-x-auto rounded-[24px] bg-card ring-1 ring-line">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    {cols.map(([k, l]) => (
                      <th key={k} className="px-4 py-3 font-normal">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr
                      key={String(r.id ?? i)}
                      onClick={() =>
                        isAdmin && kind !== "synonyms" && setEdit(r)
                      }
                      className={cn(
                        "border-b border-line last:border-0",
                        isAdmin &&
                          kind !== "synonyms" &&
                          "cursor-pointer hover:bg-card-muted",
                      )}
                    >
                      {cols.map(([k, , render]) => (
                        <td key={k} className="max-w-80 truncate px-4 py-2">
                          {render(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.length && <EmptyState icon={<BookOpen />} title="Пусто" />}
              {data.length >= 500 && (
                <div className="px-4 py-2 text-xs text-muted">
                  Показаны первые 500 — уточните поиск
                </div>
              )}
            </div>
          )}
        </div>
        {isAdmin && <VehiclesImport />}
      </div>
      {edit && (
        <DictDialog kind={kind} row={edit} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}

function DictDialog({
  kind,
  row,
  onClose,
}: {
  kind: DictKind;
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !row.id && !row.wmi;
  const [f, setF] = useState<Record<string, string | boolean>>({
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    aliases: list(row.aliases),
    country: String(row.country ?? ""),
    isCarMaker: !!row.isCarMaker,
    word: "",
    target: "",
    wmi: String(row.wmi ?? ""),
    make: "",
  });
  const s = (k: string) => String(f[k] ?? "");
  const body: Record<string, unknown> =
    kind === "makes"
      ? {
          code: s("code").trim().toLowerCase(),
          name: s("name").trim(),
          aliases: split(s("aliases")),
        }
      : kind === "brands"
        ? {
            name: s("name").trim(),
            aliases: split(s("aliases")),
            country: s("country").trim() || null,
            isCarMaker: !!f.isCarMaker,
          }
        : kind === "synonyms"
          ? { word: s("word").trim(), target: s("target").trim() }
          : {
              wmi: s("wmi").trim().toUpperCase(),
              make: s("make").trim().toLowerCase(),
              country: s("country").trim() || null,
            };
  const valid =
    kind === "makes"
      ? !!s("code").trim() && !!s("name").trim()
      : kind === "brands"
        ? !!s("name").trim()
        : kind === "synonyms"
          ? !!s("word").trim() && !!s("target").trim()
          : s("wmi").trim().length === 3 && !!s("make").trim();
  const m = useMutation({
    mutationFn: () => platformApi.saveDictionary(kind, body),
    onSuccess: () => (
      qc.invalidateQueries({ queryKey: ["adm", "dict", kind] }),
      onClose(),
      toast.success("Сохранено — все магазины увидят сразу")
    ),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const inp = (
    k: string,
    label: string,
    ph?: string,
    hint?: string,
    extra?: string,
  ) => (
    <Field label={label} hint={hint}>
      <Input
        value={s(k)}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        placeholder={ph}
        className={extra}
      />
    </Field>
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`${isNew ? "Добавить" : "Изменить"}: ${KINDS.find((x) => x.value === kind)?.label}`}
      description={
        isNew ? "" : "Запись найдётся по коду / названию и обновится"
      }
    >
      <div className="mt-4 space-y-3">
        {kind === "makes" && (
          <>
            {inp(
              "code",
              "Код",
              "toyota",
              "латиницей, для импорта и WMI",
              "font-mono",
            )}
            {inp("name", "Название", "Toyota")}
            {inp("aliases", "Как ещё пишут", "тойота, таёта", "через запятую")}
          </>
        )}
        {kind === "brands" && (
          <>
            {inp("name", "Бренд", "Akebono")}
            {inp(
              "aliases",
              "Варианты написания",
              "акебоно, akebono brake",
              "через запятую",
            )}
            {inp("country", "Страна", "Япония")}
            <Switch
              checked={!!f.isCarMaker}
              onChange={(v) => setF({ ...f, isCarMaker: v })}
              label="Автопроизводитель (оригинал)"
            />
          </>
        )}
        {kind === "synonyms" && (
          <>
            {inp("word", "Слово клиента", "бочонок")}
            {inp("target", "Что это", "глушитель")}
          </>
        )}
        {kind === "wmi" && (
          <>
            {inp(
              "wmi",
              "WMI — первые 3 символа VIN",
              "JTN",
              undefined,
              "font-mono uppercase",
            )}
            {inp(
              "make",
              "Код марки",
              "toyota",
              "как в справочнике марок",
              "font-mono",
            )}
            {inp("country", "Страна сборки", "Япония")}
          </>
        )}
        <Button
          variant="dark"
          size="lg"
          className="w-full"
          disabled={!valid}
          loading={m.isPending}
          onClick={() => m.mutate()}
        >
          Сохранить
        </Button>
      </div>
    </Dialog>
  );
}

function VehiclesImport() {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<Awaited<
    ReturnType<typeof platformApi.importVehicles>
  > | null>(null);
  const m = useMutation({
    mutationFn: (f: File) => platformApi.importVehicles(f),
    onSuccess: (r) => (
      setRes(r),
      qc.invalidateQueries({ queryKey: ["adm", "dict"] }),
      toast.success("Импорт машин готов")
    ),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Tray className="h-fit space-y-2 p-3">
      <div className="px-1 text-[14px] font-medium">Импорт машин</div>
      <div className="rounded-[16px] bg-card p-3 text-xs text-muted">
        CSV (разделитель «;») или Excel: марки, модели, поколения, модификации,
        коды кузова. <span className="font-mono">make</span> — код марки из
        справочника, списки в ячейке — через «|».
        <div className="mt-2 overflow-x-auto rounded-[10px] bg-card-muted p-2 font-mono text-[10.5px] whitespace-nowrap text-ink-2">
          make;model;generation;year_from;year_to;body_codes;modification;engine_code;…
          <br />
          toyota;Mark X;x130;2010;2015;GRX130;2.5 4GR-FSE;4GR-FSE;…
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept=".csv,.xlsx"
        hidden
        onChange={(e) =>
          e.target.files?.[0] &&
          (m.mutate(e.target.files[0]), (e.target.value = ""))
        }
      />
      <Button
        className="w-full"
        loading={m.isPending}
        onClick={() => file.current?.click()}
      >
        <Upload /> Выбрать файл
      </Button>
      {res && (
        <div className="grid grid-cols-2 gap-1.5 text-center">
          {[
            ["Строк", res.rows],
            ["Моделей", res.models],
            ["Поколений", res.generations],
            ["Модификаций", res.modifications],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[14px] bg-card px-2 py-2">
              <div className="text-[11px] text-muted">{l}</div>
              <div className="font-semibold tabular-nums">{num(v)}</div>
            </div>
          ))}
          {res.skipped > 0 && (
            <div className="col-span-2 rounded-[14px] bg-warn-soft px-2 py-1.5 text-xs text-warn">
              Пропущено строк: {res.skipped}
            </div>
          )}
        </div>
      )}
    </Tray>
  );
}

// ── Журнал ──────────────────────────────────────────────

const ACTION: Record<string, string> = {
  "admin.login": "Вход в админку",
  "tenant.subscription": "Подписка изменена",
  "support.request": "Запрос входа поддержки",
  "support.emergency": "Аварийный вход поддержки",
  "support.end": "Сеанс поддержки завершён",
  "dictionary.makes": "Справочник марок",
  "dictionary.brands": "Справочник брендов",
  "dictionary.synonyms": "Синонимы",
  "dictionary.wmi": "VIN (WMI)",
  "dictionary.vehicles_import": "Импорт машин",
};

/** Журнал действий сотрудников платформы — изменить или удалить нельзя (триггер в базе) */
export function AdminJournalPage() {
  const [sp, setSp] = useSearchParams();
  const tenantId = sp.get("tenantId") ?? undefined;
  const { data, isLoading, error, refetch } = useJournal({ tenantId });
  const tenants = useAdminTenants({});
  const name = (id: string | null) =>
    id
      ? (tenants.data?.find((t) => t.id === id)?.name ?? id.slice(0, 8))
      : null;
  if (!useIsAdmin()) return <Navigate to="/admin" replace />;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Журнал админов"
        sub="Кто из сотрудников платформы что делал. Записи нельзя изменить или удалить"
      />
      <select
        className="h-10 w-72 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none"
        value={tenantId ?? ""}
        onChange={(e) =>
          setSp(e.target.value ? { tenantId: e.target.value } : {}, {
            replace: true,
          })
        }
      >
        <option value="">Все магазины</option>
        {tenants.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading && <Skeleton className="h-64 rounded-[24px]" />}
      {data && (
        <div className="overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
          {data.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-0"
            >
              <span className="w-28 text-[13px] text-muted">
                {date(r.created_at, "DD.MM HH:mm")}
              </span>
              <span className="w-36 truncate text-[13px] font-medium">
                {r.adminName ?? "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px]">
                  {ACTION[r.action] ?? r.action}
                  {r.tenant_id && (
                    <Link
                      to={`/admin/tenants/${r.tenant_id}`}
                      className="ml-2 text-accent hover:underline"
                    >
                      {name(r.tenant_id)}
                    </Link>
                  )}
                </span>
                {Object.keys(r.details ?? {}).length > 0 && (
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {JSON.stringify(r.details)}
                  </span>
                )}
              </span>
              <span className="font-mono text-[11px] text-faint">{r.ip}</span>
            </div>
          ))}
          {!data.length && (
            <EmptyState icon={<ScrollText />} title="Записей нет" />
          )}
        </div>
      )}
    </div>
  );
}
