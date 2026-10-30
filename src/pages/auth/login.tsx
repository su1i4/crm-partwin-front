import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth';
import { AuthLayout } from './auth-layout';

export default function LoginPage() {
  return (
    <AuthLayout
      title="Вход"
      sub="Телефон или email и пароль. Один логин — для всех ваших магазинов."
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Зарегистрировать магазин
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
