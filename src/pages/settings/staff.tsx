import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Crown, KeyRound, Lock, MessageCircle, Plus, ShieldCheck, Trash2, UserPlus, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, useInvitations, usePermissionCatalog, useRoles, useStaff, useStores, type Member, type Role } from '@/entities/admin';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { ago, date } from '@/shared/lib/format';
import { Avatar, Button, Card, Dialog, EmptyState, Field, Input, PageTitle, Pill, Segmented, Skeleton, Switch, Tray } from '@/shared/ui';

const GROUP_LABEL: Record<string, string> = {
  dashboard: 'Главная', pos: 'Касса', sales: 'Продажи', requests: 'Заявки', products: 'Товары', catalog: 'Справочники', prices: 'Цены', stock: 'Склад', documents: 'Документы',
  purchasing: 'Закупки', customers: 'Клиенты', money: 'Деньги', reports: 'Отчёты', settings: 'Настройки', staff: 'Сотрудники', audit: 'Журнал', period: 'Период', deliveries: 'Доставка',
};

function AccessEditor({ roleIds, allStores, storeIds, onChange }: { roleIds: string[]; allStores: boolean; storeIds: string[]; onChange: (p: { roleIds?: string[]; allStores?: boolean; storeIds?: string[] }) => void }) {
  const roles = useRoles();
  const stores = useStores();
  return (
    <div className="space-y-4">
      <Field label="Роли" hint="Права складываются">
        <div className="flex flex-wrap gap-1.5">
          {roles.data?.filter((r) => r.code !== 'owner').map((r) => (
            <button key={r.id} onClick={() => onChange({ roleIds: roleIds.includes(r.id) ? roleIds.filter((x) => x !== r.id) : [...roleIds, r.id] })} className={cn('h-8 rounded-full px-3.5 text-[13px] ring-1', roleIds.includes(r.id) ? 'bg-pill text-pill-ink ring-pill' : 'bg-card text-ink-2 ring-line')}>
              {r.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Точки">
        <div className="space-y-2">
          <Switch checked={allStores} onChange={(v) => onChange({ allStores: v })} label="Все точки, включая будущие" />
          {!allStores && (
            <div className="flex flex-wrap gap-1.5">
              {stores.data?.map((s) => (
                <button key={s.id} onClick={() => onChange({ storeIds: storeIds.includes(s.id) ? storeIds.filter((x) => x !== s.id) : [...storeIds, s.id] })} className={cn('h-8 rounded-full px-3.5 text-[13px] ring-1', storeIds.includes(s.id) ? 'bg-accent text-accent-ink ring-accent' : 'bg-card text-ink-2 ring-line')}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
    </div>
  );
}

function MemberDialog({ m, onClose }: { m: Member | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ roleIds: [] as string[], allStores: false, storeIds: [] as string[], position: '' });
  const [temp, setTemp] = useState<string | null>(null);
  useEffect(() => {
    if (m) (setF({ roleIds: m.roles.map((r) => r.id), allStores: m.allStores, storeIds: m.storeIds, position: m.position ?? '' }), setTemp(null));
  }, [m]);
  const inval = () => qc.invalidateQueries({ queryKey: ['staff'] });
  const save = useMutation({ mutationFn: () => adminApi.updateMember(m!.id, { roleIds: f.roleIds, allStores: f.allStores, storeIds: f.allStores ? [] : f.storeIds, position: f.position }), onSuccess: () => (inval(), onClose(), toast.success('Доступ изменён')), onError: (e) => toast.error(errorMessage(e)) });
  const toggle = useMutation({ mutationFn: () => (m!.status === 'active' ? adminApi.disableMember(m!.id) : adminApi.enableMember(m!.id)), onSuccess: () => (inval(), onClose(), toast.success(m!.status === 'active' ? 'Сотрудник отключён — все его сессии завершены' : 'Сотрудник снова работает')), onError: (e) => toast.error(errorMessage(e)) });
  const reset = useMutation({ mutationFn: () => adminApi.resetPassword(m!.id), onSuccess: (r) => setTemp(r.temporaryPassword), onError: (e) => toast.error(errorMessage(e)) });
  if (!m) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={m.name} description={[m.phone, m.email].filter(Boolean).join(' · ')} className="max-w-xl">
      <div className="mt-4 space-y-4">
        {m.isOwner ? (
          <div className="flex items-center gap-2 rounded-[16px] bg-accent-soft px-4 py-3 text-sm text-accent">
            <Crown className="size-4" /> Владелец — все права и все точки
          </div>
        ) : (
          <>
            <Field label="Должность">
              <Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder="Продавец-консультант" />
            </Field>
            <AccessEditor roleIds={f.roleIds} allStores={f.allStores} storeIds={f.storeIds} onChange={(p) => setF({ ...f, ...p })} />
          </>
        )}
        {temp && (
          <div className="rounded-[16px] bg-warn-soft px-4 py-3 text-sm">
            Временный пароль: <b className="font-mono text-base">{temp}</b> — передайте сотруднику, при входе он задаст свой
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {!m.isOwner && (
            <div className="flex gap-1">
              <Button variant="ghost" loading={reset.isPending} onClick={() => reset.mutate()}>
                <KeyRound /> Сбросить пароль
              </Button>
              <Button variant="ghost" className={m.status === 'active' ? 'text-accent' : ''} loading={toggle.isPending} onClick={() => (m.status !== 'active' || confirm(`Отключить ${m.name}? Он сразу потеряет доступ`)) && toggle.mutate()}>
                <UserX /> {m.status === 'active' ? 'Отключить' : 'Включить'}
              </Button>
            </div>
          )}
          {!m.isOwner && (
            <Button variant="dark" disabled={!f.roleIds.length || (!f.allStores && !f.storeIds.length)} loading={save.isPending} onClick={() => save.mutate()}>
              Сохранить
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', login: '', position: '', roleIds: [] as string[], allStores: false, storeIds: [] as string[] });
  const [res, setRes] = useState<{ code: string; link: string } | null>(null);
  useEffect(() => {
    if (open) (setF({ name: '', login: '', position: '', roleIds: [], allStores: false, storeIds: [] }), setRes(null));
  }, [open]);
  const invite = useMutation({
    mutationFn: () => adminApi.invite({ ...(f.name ? { name: f.name } : {}), ...(f.login ? { login: f.login } : {}), ...(f.position ? { position: f.position } : {}), roleIds: f.roleIds, allStores: f.allStores, storeIds: f.allStores ? [] : f.storeIds }),
    onSuccess: (r) => (qc.invalidateQueries({ queryKey: ['invitations'] }), setRes({ code: r.code ?? '', link: r.link ?? '' })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const text = res ? `Приглашение в магазин. Откройте ссылку и зарегистрируйтесь: ${res.link} (код ${res.code})` : '';
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="Пригласить сотрудника" description="Сотрудник регистрируется по ссылке со своим телефоном и паролем" className="max-w-xl">
      {!res ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Имя">
              <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Азамат" />
            </Field>
            <Field label="Телефон" hint="Принять сможет только он; пусто — любой по коду">
              <Input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} placeholder="0555 123 456" />
            </Field>
          </div>
          <Field label="Должность">
            <Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
          </Field>
          <AccessEditor roleIds={f.roleIds} allStores={f.allStores} storeIds={f.storeIds} onChange={(p) => setF({ ...f, ...p })} />
          <div className="flex justify-end">
            <Button variant="dark" disabled={!f.roleIds.length || (!f.allStores && !f.storeIds.length)} loading={invite.isPending} onClick={() => invite.mutate()}>
              <UserPlus /> Создать приглашение
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-[22px] bg-pill py-5 text-center font-mono text-[34px] font-semibold tracking-[0.25em] text-pill-ink">{res.code}</div>
          <div className="truncate rounded-[14px] bg-card-muted px-4 py-2.5 font-mono text-xs">{res.link}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Скопировано'))}>
              <Copy /> Копировать
            </Button>
            <a href={`https://wa.me/${f.login.replace(/\D/g, '').replace(/^0/, '996')}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
              <Button variant="dark" className="w-full">
                <MessageCircle /> WhatsApp
              </Button>
            </a>
          </div>
          <div className="text-xs text-muted">Приглашение действует 7 дней</div>
        </div>
      )}
    </Dialog>
  );
}

function RoleDialog({ role, onClose }: { role: Partial<Role> | null; onClose: () => void }) {
  const cat = usePermissionCatalog();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', description: '', permissions: [] as string[], maxDiscountPercent: '0' });
  useEffect(() => {
    if (role) setF({ name: role.name ?? '', description: role.description ?? '', permissions: role.permissions ?? [], maxDiscountPercent: String(role.maxDiscountPercent ?? 0) });
  }, [role]);
  const save = useMutation({
    mutationFn: () => (role?.id ? adminApi.updateRole(role.id, { version: role.version!, name: f.name, description: f.description, permissions: f.permissions, maxDiscountPercent: Number(f.maxDiscountPercent) || 0 }) : adminApi.createRole({ name: f.name, description: f.description, permissions: f.permissions, maxDiscountPercent: Number(f.maxDiscountPercent) || 0 })),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['roles'] }), onClose(), toast.success('Роль сохранена')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: () => adminApi.removeRole(role!.id!), onSuccess: () => (qc.invalidateQueries({ queryKey: ['roles'] }), onClose()), onError: (e) => toast.error(errorMessage(e)) });
  const locked = role?.code === 'owner';
  const toggle = (c: string) => setF((x) => ({ ...x, permissions: x.permissions.includes(c) ? x.permissions.filter((p) => p !== c) : [...x.permissions, c] }));
  return (
    <Dialog open={!!role} onOpenChange={(v) => !v && onClose()} title={role?.id ? role.name : 'Новая роль'} description={locked ? 'Владелец — все права, менять нельзя' : 'Отметьте, что может делать сотрудник с этой ролью'} className="max-w-3xl">
      {role && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
            <Field label="Название">
              <Input disabled={locked} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Старший продавец" />
            </Field>
            <Field label="Описание">
              <Input disabled={locked} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <Field label="Скидка до, %">
              <Input disabled={locked} inputMode="decimal" value={f.maxDiscountPercent} onChange={(e) => setF({ ...f, maxDiscountPercent: e.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
          </div>
          <div className="scroll-thin max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {cat.data?.map((g) => {
              const all = g.permissions.every((p) => f.permissions.includes(p.code));
              return (
                <div key={g.group} className="rounded-[18px] bg-card-muted p-3">
                  <label className="flex items-center gap-2 text-[13.5px] font-medium">
                    <input type="checkbox" disabled={locked} checked={all} onChange={() => setF((x) => ({ ...x, permissions: all ? x.permissions.filter((p) => !g.permissions.some((q) => q.code === p)) : [...new Set([...x.permissions, ...g.permissions.map((q) => q.code)])] }))} className="size-4 accent-[var(--accent)]" />
                    {GROUP_LABEL[g.group] ?? g.group}
                  </label>
                  <div className="mt-2 grid gap-1 pl-6 sm:grid-cols-2">
                    {g.permissions.map((p) => (
                      <label key={p.code} className="flex items-center gap-2 text-[13px] text-ink-2">
                        <input type="checkbox" disabled={locked} checked={f.permissions.includes(p.code)} onChange={() => toggle(p.code)} className="size-3.5 accent-[var(--accent)]" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {!locked && (
            <div className="flex justify-between">
              {role.id && !role.isSystem ? (
                <Button variant="ghost" className="text-accent" loading={remove.isPending} onClick={() => confirm('Удалить роль?') && remove.mutate()}>
                  <Trash2 /> Удалить
                </Button>
              ) : (
                <span />
              )}
              <Button variant="dark" disabled={!f.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
                Сохранить · {f.permissions.length} прав
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Сотрудники и роли (ТЗ 3): приглашения, роли с правами, доступ к точкам, отключение */
export default function StaffPage() {
  const [tab, setTab] = useState<'staff' | 'roles'>('staff');
  const [status, setStatus] = useState('active');
  const staff = useStaff({ status, limit: 200 });
  const inv = useInvitations();
  const roles = useRoles();
  const stores = useStores();
  const qc = useQueryClient();
  const [m, setM] = useState<Member | null>(null);
  const [invite, setInvite] = useState(false);
  const [role, setRole] = useState<Partial<Role> | null>(null);
  const cancel = useMutation({ mutationFn: (id: string) => adminApi.cancelInvitation(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }), onError: (e) => toast.error(errorMessage(e)) });
  const sName = (ids: string[]) => ids.map((i) => stores.data?.find((s) => s.id === i)?.name).filter(Boolean).join(', ');
  return (
    <div className="space-y-6">
      <PageTitle
        title="Сотрудники и роли"
        sub="Каждый входит под своим логином — в журнале видно, кто что сделал. Роль задаёт права и предел скидки"
        actions={
          tab === 'staff' ? (
            <Button variant="dark" onClick={() => setInvite(true)}>
              <UserPlus /> Пригласить
            </Button>
          ) : (
            <Button variant="dark" onClick={() => setRole({ permissions: ['pos.use', 'products.read'] })}>
              <Plus /> Роль
            </Button>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'staff', label: 'Сотрудники' },
            { value: 'roles', label: 'Роли и права' },
          ]}
        />
        {tab === 'staff' && (
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Работают' },
              { value: 'disabled', label: 'Отключены' },
            ]}
          />
        )}
      </div>
      {tab === 'staff' && (
        <>
          {staff.isLoading && <Skeleton className="h-48 rounded-[24px]" />}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {staff.data?.items.map((s) => (
              <button key={s.id} onClick={() => setM(s)} className={cn('flex items-start gap-3 rounded-[22px] bg-card p-4 text-left ring-1 ring-line transition hover:ring-line-strong', s.status !== 'active' && 'opacity-60')}>
                <Avatar name={s.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[14.5px] font-medium">
                    {s.name} {s.isOwner && <Crown className="size-3.5 text-accent" />} {s.totpEnabled && <ShieldCheck className="size-3.5 text-ok" />}
                  </span>
                  <span className="block truncate text-xs text-muted">{s.position || s.phone || s.email}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {s.isOwner ? <Pill tone="accent">владелец</Pill> : s.roles.map((r) => <Pill key={r.id} tone="soft">{r.name}</Pill>)}
                  </span>
                  <span className="mt-1.5 block truncate text-xs text-muted">
                    {s.allStores || s.isOwner ? 'все точки' : sName(s.storeIds)} · {s.lastLoginAt ? `вход ${ago(s.lastLoginAt)}` : 'не входил'}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {staff.data && !staff.data.items.length && (
            <Card>
              <EmptyState title="Никого нет" />
            </Card>
          )}
          {(inv.data?.length ?? 0) > 0 && (
            <Tray className="p-3">
              <div className="px-1 pb-2 text-[14px] font-medium">Приглашения</div>
              {inv.data!.map((i) => (
                <div key={i.id} className="mb-1 flex items-center gap-3 rounded-[14px] bg-card px-3 py-2 text-[13px]">
                  <UserPlus className="size-4 text-muted" />
                  <span className="flex-1">
                    {i.name ?? 'Без имени'} {i.login && <span className="text-muted">· {i.login}</span>}
                  </span>
                  <span className="text-xs text-muted">до {date(i.expiresAt, 'D MMM')}</span>
                  <button onClick={() => cancel.mutate(i.id)} className="text-muted hover:text-accent" aria-label="Отменить">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </Tray>
          )}
        </>
      )}
      {tab === 'roles' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.data?.map((r) => (
            <button key={r.id} onClick={() => setRole(r)} className="rounded-[22px] bg-card p-4 text-left ring-1 ring-line transition hover:ring-line-strong">
              <div className="flex items-center gap-2">
                {r.code === 'owner' ? <Crown className="size-4 text-accent" /> : r.isSystem ? <Lock className="size-4 text-muted" /> : <ShieldCheck className="size-4 text-accent" />}
                <span className="flex-1 text-[14.5px] font-medium">{r.name}</span>
                <span className="text-xs text-muted">{r.membersCount} чел.</span>
              </div>
              {r.description && <div className="mt-1 text-xs text-muted">{r.description}</div>}
              <div className="mt-2 flex gap-1.5 text-xs">
                <Pill tone="soft">{r.permissions.length} прав</Pill>
                <Pill tone="outline">скидка до {r.maxDiscountPercent}%</Pill>
              </div>
            </button>
          ))}
        </div>
      )}
      <MemberDialog m={m} onClose={() => setM(null)} />
      <InviteDialog open={invite} onClose={() => setInvite(false)} />
      <RoleDialog role={role} onClose={() => setRole(null)} />
    </div>
  );
}
