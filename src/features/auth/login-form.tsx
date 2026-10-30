import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, KeyRound, Phone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/entities/session';
import { ApiError } from '@/shared/api';
import { Button, Field, Input } from '@/shared/ui';
import { useAfterAuth } from './use-auth-actions';

const schema = z.object({
  login: z.string().trim().min(3, 'Телефон или email'),
  password: z.string().min(1, 'Введите пароль'),
  totpCode: z.string().regex(/^\d{6}$/, '6 цифр').optional().or(z.literal('')),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const [show, setShow] = useState(false);
  const [needTotp, setNeedTotp] = useState(false);
  const after = useAfterAuth();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema) });

  const m = useMutation({
    mutationFn: (v: Values) => authApi.login({ login: v.login, password: v.password, ...(v.totpCode ? { totpCode: v.totpCode } : {}) }),
    onSuccess: (r) => after(r, from),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'TOTP_REQUIRED') {
        setNeedTotp(true);
        return;
      }
      setError('root', { message: e instanceof Error ? e.message : 'Ошибка входа' });
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
      <Field label="Телефон или email" error={formState.errors.login?.message}>
        <Input icon={<Phone />} placeholder="0555 123 456" autoComplete="username" autoFocus invalid={!!formState.errors.login} {...register('login')} />
      </Field>
      <Field label="Пароль" error={formState.errors.password?.message}>
        <Input
          icon={<KeyRound />}
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          invalid={!!formState.errors.password}
          right={
            <button type="button" onClick={() => setShow(!show)} className="text-muted hover:text-ink" aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
          {...register('password')}
        />
      </Field>
      {needTotp && (
        <Field label="Код из приложения-аутентификатора" error={formState.errors.totpCode?.message}>
          <Input inputMode="numeric" maxLength={6} placeholder="123456" autoFocus {...register('totpCode')} />
        </Field>
      )}
      {formState.errors.root && <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{formState.errors.root.message}</div>}
      <Button type="submit" variant="dark" size="lg" className="w-full justify-center" loading={m.isPending}>
        Войти <ArrowRight />
      </Button>
    </form>
  );
}
