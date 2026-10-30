# Frontend — CRM для магазинов автозапчастей

React 18 + TypeScript + Vite · Tailwind CSS 4 · FSD · Zustand · TanStack Query · React Router · RHF + Zod · Radix · lucide · sonner

## Запуск

```bash
cd frontend
npm ci
cp .env.example .env      # VITE_API_PROXY — адрес backend (по умолчанию http://localhost:3000)
npm run dev               # http://localhost:5173, /api проксируется на backend
npm run dev:demo          # без backend: демо-данные (любой логин, пароль от 3 символов)
npm run build             # dist/ — отдать Apache как SPA (fallback на index.html)
```

На сервере фронт и API — на одном домене (`/api` → backend через Apache), тогда refresh-cookie (`path=/api/auth`, httpOnly) работает без CORS.

## Касса без интернета (F2b)

- Касса → меню смены → «Работа без интернета» → «Подготовить» (право `devices.manage`): браузер получает токен устройства, секрет для PIN и серию номеров чеков (`К1А-…`). Всё хранится в IndexedDB (`ap-pos-{tenant}`), привязка и очередь дублируются в localStorage.
- Кэш `GET /pos-device/cache`: полный раз в сутки, изменения раз в 3 минуты. Очередь `POST /pos-device/sync`: строго по `seq`, «retry» — стоп и повтор.
- Без сети: поиск по кэшу (штрихкод, артикул, номер с «скелетом» 0/O, слова), цены и итоги — `src/shared/lib/pricing-engine.ts` (**копия** серверного движка; после изменений на сервере — `npm run sync:engine`), оплата наличными/картой/переводом (в долг — только в режиме «одна касса»), смена, внесение/изъятие, закрытие — операциями в очереди.
- Связь пропала посреди онлайн-чека — строки переходят в офлайн-чек, брошенный онлайн-чек отменяется, когда связь вернётся.
- Смена продавца по PIN: онлайн — `POST /pos-device/pin-login`, без сети — PBKDF2 + HMAC(секрет устройства) как на сервере; 5 ошибок — блокировка 15 мин.
- Одна вкладка продаёт (Web Locks), закрыть вкладку / выйти с неотправленными — предупреждение / запрет.
- PWA (`vite-plugin-pwa`): после первого входа касса открывается без интернета; на iPhone — только с экрана «Домой».
- Камера: штрихкоды — `BarcodeDetector` или `@zxing/browser`; «Номер» — кадр рамки → `POST /ocr/recognize`. Камера работает только по HTTPS (или localhost).
- Демо: PIN `1234` (Бакыт, владелец), `5678` (Айбек, продавец). Обрыв связи имитируется офлайн-режимом браузера (DevTools → Network → Offline).

## Структура (FSD)

```
src/
  app/        main.tsx, providers (Query, тема, toaster, подключение сессии к API), router (guards), styles (токены темы)
  pages/      dashboard, auth (login, register, select-shop), catalog, product, search, profile, stub («раздел на этапе N»)
  widgets/    app-shell (иконки разделов, меню, верхняя панель, мобильная панель), dashboard (блоки главной)
  features/   auth, tenant-switch, store-switch, command-search (Ctrl+K), quick-product (товар за 15 сек), notifications-bell, theme
  entities/   session (токен, магазин, точка, /auth/me, права), product, category, dashboard, notification
  shared/     api (axios + refresh + X-Store-Id, типы ответов, демо-адаптер), ui (кнопки, «таблетки», карточки…), lib (формат денег/дат), config (меню)
```

Правило слоёв: слой импортирует только нижние. `shared/api` не знает про сессию — её подключает `app/providers` через `configureApi`.

## Договорённости

- **API**: ошибки `{ code, message, details }` → `ApiError`. 401 → один общий `POST /auth/refresh` (cookie) → повтор запроса; не вышло → выход.
- **Точка**: выбранная точка уходит в заголовке `X-Store-Id`; «Все точки» — без заголовка.
- **Права**: `useCan()('products.write')` — только скрывает кнопки и пункты меню; проверяет всё backend.
- **Деньги**: только через `money()` / `moneyParts()` из `shared/lib/format` (разделитель тысяч, «с» / «$»).
- **Фильтры списков** живут в адресе страницы (`?q=&category=&quality=&missing=&page=`) — ссылку можно отправить коллеге.
- **Дизайн**: токены в `app/styles/index.css` (`--accent`, `--pill`, `--card`…), светлая и тёмная темы. Акцент — малиновый, главные кнопки и счётчики — чёрные «таблетки», карточки — белые со скруглением 22–32 px, штриховка `.hatch` для второстепенных столбиков. Кнопки ≥ 40 px, в кассе будут ≥ 44 px.
- Новый раздел меню — `shared/config/navigation.ts` (`ready: true`, когда экран готов; иначе `stage` — номер этапа).
