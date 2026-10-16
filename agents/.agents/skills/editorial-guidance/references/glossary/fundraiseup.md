# Глоссарий Fundraise Up

Термины продукта, кода и команды Fundraise Up для правил §С1–§С3 и §С9 из
[prose-rules.md](../prose-rules.md). Применяется, только если документ про Fundraise Up.
Общие термины лежат в соседних файлах каталога.

## Содержание

- Не переводить
- Заменять

## Не переводить

### Термины команды

Не переводятся по §С1.

- аудит-лог — устоявшийся термин для журнала действий и изменений (модуль `auditLog`). В прозе пишется кириллицей через дефис (аудит-лог, в аудит-логе). Не переводить как «журнал аудита» и не разворачивать. Продуктовый модуль называется Audit Log (см. названия модулей ниже).

### Имена сущностей кода

В формате кода, регистр как в коде.

- Агрегаты и модели: `Subscription`, `Widget`, `Charge`, `Customer`, `PaymentIntent`.
- Классы и сервисы: `CreateEntitiesFactory`, `JobProcessor`, `WidgetSession`.
- Поля: `checkoutTypes.pledge`, `isPledge`.
- Перечисления: `ECheckoutType`, `ECheckoutType.Pledge`, `IWidgetCheckoutTypes`.
- Типы TypeScript: `Record<ECheckoutType, X>`.
- Методы и декораторы: `Subscription.create`, `@IsEnum`.
- Очереди и каналы: `payment finish`, `post-donation`.

### Названия

- **Модули продукта:** Campaign Pages, Campaign Page, Checkout Modal, Dashboard, Donor Portal, Integrations, Insights, Virtual Terminal, Elements, Gift Catalog, P2P, Audit Log, Ticketing.
- **Внутренние инструменты:** FruAI.
- **Фичи (имена собственные):** Pledges, Faith-Based, Pledge.
- **Технологии:** MongoDB, ClickHouse, Kafka, AJV, Redis, S3, NestJS, Koa, Mongoose, Sentry, TypeScript.
- **Архитектурные стандарты:** ADR-NN, NeverError.

### Термины

- **Аббревиатуры:** TD (tech design).
- **Предметная область:** recurring, pledge, installment, upsell, donation, donor, fundraiser, supporter, tribute, designation, recurring plan (в коде это `Subscription`, для пользователя Recurring Plan).

## Заменять

| Термин | Замена |
|---|---|
| донация | «донат» |
| feature-gate, per-company flag | «feature-флаг». Если важен уровень, «feature-флаг на уровне организации» |
| session-events | «события сессии» |
| bucket, бакет (в трекинге) | «источник» (например, «бакет CAMPAIGN_PAGE» → «источник CAMPAIGN_PAGE») |
