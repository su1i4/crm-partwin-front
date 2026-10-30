import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi, useOnboarding, type OnboardingState } from '@/entities/admin';
import { meKey, useMe } from '@/entities/session';
import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Button, Card, ErrorState, Field, Input, Skeleton } from '@/shared/ui';

const STEPS = ['Магазин', 'Тип', 'Марки', 'Точка', 'Деньги'];
const WALLETS = [
  ['mbank', 'MBank'],
  ['odengi', 'О!Деньги'],
  ['optima', 'Optima'],
  ['elsom', 'Элсом'],
  ['balance', 'Balance.kg'],
];
type Wallet = { provider: string; holderName: string; phone: string };

/** Мастер первого входа (ТЗ 2.5): 5 коротких шагов, потом — чек-лист «что сделать дальше» */
export default function OnboardingPage() {
  const { data, isLoading, error, refetch } = useOnboarding();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  // ?again=1 — пройти мастер ещё раз (смена типа магазина, марок)
  const again = sp.get('again') === '1';
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ shopName: '', city: 'Бишкек', shopType: '', ourMakes: [] as string[], storeName: 'Основная точка', storeCode: 'К1', storeAddress: '', shopRateUsd: '' });
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [done, setDone] = useState<OnboardingState['checklist'] | null>(null);
  const [allMakes, setAllMakes] = useState(false);
  useEffect(() => {
    if (data) setF((x) => ({ ...x, shopName: x.shopName || data.tenant.name, city: data.tenant.city ?? x.city, shopType: x.shopType || data.tenant.shopType || '' }));
  }, [data]);
  const finish = useMutation({
    mutationFn: () =>
      adminApi.completeOnboarding({
        shopName: f.shopName.trim() || undefined,
        city: f.city.trim() || undefined,
        shopType: f.shopType,
        ourMakes: f.ourMakes.length ? f.ourMakes : undefined,
        storeName: f.storeName.trim() || undefined,
        storeCode: f.storeCode.trim() || undefined,
        storeAddress: f.storeAddress.trim() || undefined,
        shopRateUsd: f.shopRateUsd.trim() ? f.shopRateUsd.replace(',', '.') : undefined,
        wallets: wallets.filter((w) => w.phone.trim()).length ? wallets.filter((w) => w.phone.trim()) : undefined,
      }),
    onSuccess: (r) => (setDone(r.checklist), qc.invalidateQueries({ queryKey: meKey }), qc.invalidateQueries({ queryKey: ['onboarding'] })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const owner = me.data?.membership?.isOwner;
  const canNext = [f.shopName.trim().length > 1, !!f.shopType, true, f.storeName.trim().length > 0, true][step];
  const makes = data?.makes ?? [];
  const shownMakes = allMakes ? makes : makes.filter((m) => m.popular);
  const checklist = done ?? (data?.completed && !again ? data.checklist : null);

  return (
    <div className="hatch min-h-dvh bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-14">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-pill text-pill-ink">
            <Sparkles className="size-5" />
          </span>
          <div>
            <div className="text-[13px] text-muted">Первый запуск</div>
            <h1 className="text-2xl font-semibold tracking-tight">{checklist ? 'Магазин готов к работе' : 'Настроим магазин за 2 минуты'}</h1>
          </div>
        </div>
        {error && <ErrorState error={error} onRetry={refetch} />}
        {isLoading && <Skeleton className="h-96 rounded-[28px]" />}

        {checklist && (
          <Card className="space-y-4 p-6">
            <div className="text-[15px] text-muted">Что ещё стоит сделать — список будет на главной, пока всё не отметится</div>
            <div className="space-y-1.5">
              {checklist.map((c) => (
                <div key={c.key} className={cn('flex items-center gap-3 rounded-[16px] px-4 py-3', c.done ? 'bg-ok-soft' : 'bg-card-muted')}>
                  {c.done ? <CheckCircle2 className="size-5 text-ok" /> : <Circle className="size-5 text-faint" />}
                  <span className={cn('text-[14.5px]', c.done && 'text-muted line-through')}>{c.title}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="dark" size="lg" onClick={() => nav('/', { replace: true })}>
                На главную <ArrowRight />
              </Button>
              <Button size="lg" onClick={() => nav('/settings/import')}>
                Загрузить товары из Excel
              </Button>
              <Button size="lg" variant="ghost" onClick={() => nav('/settings/staff')}>
                Пригласить сотрудников
              </Button>
            </div>
          </Card>
        )}

        {data && !checklist && owner === false && (
          <Card className="p-6 text-[15px]">
            Первую настройку делает владелец магазина. <Link to="/" className="text-accent underline">На главную</Link>
          </Card>
        )}

        {data && !checklist && owner !== false && (
          <>
            <div className="mb-4 flex gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  className={cn('flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] transition', i === step ? 'bg-pill text-pill-ink' : i < step ? 'bg-card text-ink ring-1 ring-line' : 'bg-card-muted text-faint')}
                >
                  {i < step ? <Check className="size-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                  <span className="hidden sm:inline">{s}</span>
                </button>
              ))}
            </div>
            <Card className="min-h-80 space-y-5 p-6">
              {step === 0 && (
                <>
                  <div className="text-lg font-medium">Как называется магазин?</div>
                  <Field label="Название — будет на чеках и ценниках">
                    <Input autoFocus value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} placeholder="Автозапчасти «Тетик»" />
                  </Field>
                  <Field label="Город">
                    <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="text-lg font-medium">Как вы работаете?</div>
                  <div className="text-sm text-muted">От этого зависят готовые роли, меню и стартовые настройки. Поменять можно потом</div>
                  <div className="grid gap-2">
                    {data.shopTypes.map((t) => (
                      <button key={t.type} onClick={() => setF({ ...f, shopType: t.type })} className={cn('rounded-[20px] p-4 text-left ring-1 transition', f.shopType === t.type ? 'bg-pill text-pill-ink ring-pill' : 'bg-card ring-line hover:ring-line-strong')}>
                        <div className="text-[16px] font-medium">{t.name}</div>
                        <div className={cn('mt-0.5 text-[13px]', f.shopType === t.type ? 'opacity-75' : 'text-muted')}>{t.description}</div>
                        <div className={cn('mt-2 text-xs', f.shopType === t.type ? 'opacity-60' : 'text-faint')}>Роли: {t.suggestedRoles.join(', ')}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="text-lg font-medium">На каких марках специализируетесь?</div>
                  <div className="text-sm text-muted">Эти марки будут сверху в подборе по машине. Можно пропустить</div>
                  <div className="flex flex-wrap gap-1.5">
                    {shownMakes.map((m) => {
                      const on = f.ourMakes.includes(m.code);
                      return (
                        <button
                          key={m.code}
                          onClick={() => setF({ ...f, ourMakes: on ? f.ourMakes.filter((x) => x !== m.code) : [...f.ourMakes, m.code] })}
                          className={cn('h-9 rounded-full px-4 text-[13.5px] ring-1 transition', on ? 'bg-accent text-white ring-accent' : 'bg-card ring-line hover:ring-line-strong')}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                  {!allMakes && makes.length > shownMakes.length && (
                    <Button size="sm" variant="ghost" onClick={() => setAllMakes(true)}>
                      Все марки ({makes.length})
                    </Button>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <div className="text-lg font-medium">Первая точка продаж</div>
                  <div className="text-sm text-muted">Создадим точку, склад и кассу. Ещё точки — в «Настройках»</div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <Field label="Название точки">
                      <Input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} />
                    </Field>
                    <Field label="Код" hint="в номерах чеков">
                      <Input value={f.storeCode} maxLength={4} onChange={(e) => setF({ ...f, storeCode: e.target.value.toUpperCase() })} />
                    </Field>
                  </div>
                  <Field label="Адрес">
                    <Input value={f.storeAddress} onChange={(e) => setF({ ...f, storeAddress: e.target.value })} placeholder="Рынок «Кудайберген», ряд 4, контейнер 12" />
                  </Field>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="text-lg font-medium">Курс и кошельки для переводов</div>
                  <Field label="Курс магазина, сом за $1" hint="Для цен из долларовых прайсов. Можно оставить пустым — возьмём курс НБКР">
                    <Input inputMode="decimal" value={f.shopRateUsd} onChange={(e) => setF({ ...f, shopRateUsd: e.target.value })} placeholder="89,50" className="max-w-40" />
                  </Field>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Кошельки, на которые клиенты переводят</div>
                    {wallets.map((w, i) => (
                      <div key={i} className="grid gap-2 rounded-[18px] bg-card-muted p-2 sm:grid-cols-[140px_1fr_1fr_auto]">
                        <select className="h-11 rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none" value={w.provider} onChange={(e) => setWallets(wallets.map((x, j) => (j === i ? { ...x, provider: e.target.value } : x)))}>
                          {WALLETS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <Input value={w.holderName} onChange={(e) => setWallets(wallets.map((x, j) => (j === i ? { ...x, holderName: e.target.value } : x)))} placeholder="На кого (Азамат Т.)" />
                        <Input inputMode="tel" value={w.phone} onChange={(e) => setWallets(wallets.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="+996 …" />
                        <Button size="icon" variant="ghost" onClick={() => setWallets(wallets.filter((_, j) => j !== i))} aria-label="Убрать">
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" onClick={() => setWallets([...wallets, { provider: 'mbank', holderName: '', phone: '' }])}>
                      <Plus /> Кошелёк
                    </Button>
                  </div>
                </>
              )}
            </Card>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" size="lg" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Назад
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="dark" size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  Дальше <ArrowRight />
                </Button>
              ) : (
                <Button variant="accent" size="lg" loading={finish.isPending} onClick={() => finish.mutate()}>
                  Готово, начать работу
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
