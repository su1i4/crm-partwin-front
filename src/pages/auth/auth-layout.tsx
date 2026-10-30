import type { ReactNode } from 'react';
import { Logo } from '@/widgets/app-shell';
import { env } from '@/shared/config/env';

/** Экран входа: слева форма, справа малиновая панель со «штриховкой» и цифрами — в духе референса */
export function AuthLayout({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-full p-3 sm:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-6xl overflow-hidden rounded-[36px] bg-shell sm:min-h-[calc(100vh-40px)]">
        <div className="flex flex-1 flex-col px-6 py-8 sm:px-12">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="text-[15px] font-semibold text-ink">Автозапчасти CRM</div>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
            <h1 className="text-[34px] leading-tight font-medium tracking-tight text-ink">{title}</h1>
            {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
            {env.demo && <div className="mt-6 rounded-2xl bg-warn-soft px-4 py-3 text-xs text-warn">Демо-режим: любой логин и пароль от 3 символов.</div>}
          </div>
        </div>
        <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden rounded-[32px] bg-accent p-10 text-accent-ink lg:m-3 lg:flex">
          <div className="hatch absolute inset-0 opacity-40" />
          <div className="relative text-sm opacity-80">Каталог · Касса · Склад · Долги · Отчёты</div>
          <div className="relative space-y-6">
            <div className="text-[40px] leading-[1.05] font-semibold tracking-tight">
              Номер в любом формате.
              <br />
              Касса без интернета.
              <br />
              Долги мастерам.
            </div>
            <div className="flex flex-wrap gap-2">
              {['0 986-452.041', 'колодки камри 40', 'ACV40-1234567', '6PK1200'].map((t) => (
                <span key={t} className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm backdrop-blur">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[
              ['< 300 мс', 'поиск по 500 000 товаров'],
              ['15 сек', 'новый товар прямо на кассе'],
              ['KGS · USD', 'курс магазина одной кнопкой'],
            ].map(([a, b]) => (
              <div key={a} className="rounded-[22px] bg-white/12 p-4 backdrop-blur">
                <div className="text-lg font-semibold">{a}</div>
                <div className="mt-1 text-xs opacity-75">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
