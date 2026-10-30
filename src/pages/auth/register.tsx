import { Link } from 'react-router-dom';
import { RegisterForm } from '@/features/auth';
import { AuthLayout } from './auth-layout';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Новый магазин"
      sub="Точка, склад, касса и роли создадутся сами. Тип магазина и марки выберете на следующем шаге."
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Войти
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
