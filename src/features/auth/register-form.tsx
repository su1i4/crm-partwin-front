import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, KeyRound, Phone, Store, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authApi } from '@/entities/session';
import { Button, Field, Input } from '@/shared/ui';
import { useAfterAuth } from './use-auth-actions';

const schema = z.object({
  name: z.string().trim().min(1, 'Как вас зовут'),
  login: z.string().trim().min(3, 'Телефон или email'),
  password: z.string().min(6, 'Не короче 6 символов'),
  shopName: z.string().trim().min(1, 'Название магазина'),
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const after = useAfterAuth();
  const { register, handleSubmit, formState, setError } = useForm<Values>({ resolver: zodResolver(schema) });
  const m = useMutation({
    mutationFn: (v: Values) => authApi.register({ ...v, locale: 'ru' }),
    onSuccess: (r) => after(r),
    onError: (e) => setError('root', { message: e instanceof Error ? e.message : 'Ошибка регистрации' }),
  });
  const err = formState.errors;
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
      <Field label="Ваше имя" error={err.name?.message}>
        <Input icon={<User />} placeholder="Бакыт" autoFocus invalid={!!err.name} {...register('name')} />
      </Field>
      <Field label="Название магазина" error={err.shopName?.message}>
        <Input icon={<Store />} placeholder="Автозапчасти на Дордое" invalid={!!err.shopName} {...register('shopName')} />
      </Field>
      <Field label="Телефон или email" error={err.login?.message}>
        <Input icon={<Phone />} placeholder="0555 123 456" autoComplete="username" invalid={!!err.login} {...register('login')} />
      </Field>
      <Field label="Пароль" error={err.password?.message} hint="Не короче 6 символов">
        <Input icon={<KeyRound />} type="password" autoComplete="new-password" invalid={!!err.password} {...register('password')} />
      </Field>
      {err.root && <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{err.root.message}</div>}
      <Button type="submit" variant="dark" size="lg" className="w-full justify-center" loading={m.isPending}>
        Создать магазин <ArrowRight />
      </Button>
    </form>
  );
}
