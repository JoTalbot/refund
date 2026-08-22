# Refund Operations Platform

> Платформа для **законной** работы с возвратами: сбор публичного или разрешённого каталога товаров, проверка условий возврата и ведение возвратных кейсов. Она не предназначена для ложных претензий, обхода правил площадок, массовой подачи запросов или несанкционированного доступа.

## Цель MVP

1. Импортировать товары только из утверждённых источников (официальные API, партнёрские фиды, страницы, где сбор разрешён правилами и `robots.txt`).
2. Нормализовать товар, цену, доступность, политику возврата и доказательства происхождения данных.
3. Сопоставлять **реальные, принадлежащие пользователю** заказы с товарами и правилами продавца.
4. Создавать кейс возврата, формировать чек-лист и отправлять запрос **только после подтверждения пользователем** и при наличии разрешённой интеграции.
5. Надёжно переживать исчезновение временного окружения: состояние, очередь, артефакты и журнал действий хранятся во внешних сервисах, а код и конфигурация — в Git.

Полное ТЗ: [`docs/ARCHITECTURE_RU.md`](docs/ARCHITECTURE_RU.md). Реестр проверенных источников и репозиториев: [`docs/SOURCES_AND_REPOS_RU.md`](docs/SOURCES_AND_REPOS_RU.md).

## Принципы безопасности и комплаенса

- API-first; HTML-сбор — только после проверки условий конкретного домена и с ограничением нагрузки.
- Не обходить CAPTCHA, антибот-защиту, rate limits, авторизацию или технические ограничения сайта.
- Не хранить пароли, платёжные реквизиты, токены, cookies и сканы документов в Git.
- Возврат/компенсация не создаётся автоматически: требуется подтверждение уполномоченного человека и аудит-лог.
- Минимизировать персональные данные; шифровать PII и делать её удаляемой по политике хранения.

## Структура

```text
.agents/skills/       переносимые навыки для рабочих агентов (SKILL.md)
apps/api/             тонкий HTTP-фасад (health + draft source)
packages/domain/      RBAC, audit, approval gate, state machines
db/migrations/        PostgreSQL 16, append-only audit
docs/                 ТЗ, research, source registry, buyer guides
infra/terraform/      каркас managed Postgres + WORM audit bucket
scripts/              secret-scan, link validation, SQL/connector checks
AGENTS.md             правила параллельной работы и устойчивости
```

## Разработка

```bash
npm ci
npm run ci
```

Шаблон GitHub Actions: [`docs/ci/github-actions-ci.yml`](docs/ci/github-actions-ci.yml). Скопируйте его в `.github/workflows/ci.yml` владельцем репозитория (у GitHub App нет permission `workflows`).

Секреты не коммитить. Локальные значения — secret manager или незакоммиченный `.env` из `.env.example`.

Гайд покупателя AliExpress (UA, только ручной сценарий): [`docs/providers/ALIEXPRESS_UA_BUYER_GUIDE_RU.md`](docs/providers/ALIEXPRESS_UA_BUYER_GUIDE_RU.md). Источник `aliexpress-ua` остаётся `draft`. Shopify своего магазина: [`docs/sources/shopify-merchant.md`](docs/sources/shopify-merchant.md) (`draft`, без Admin API client).

Выкладка: [`docs/RUNBOOK_DEPLOY_RU.md`](docs/RUNBOOK_DEPLOY_RU.md).

Локальный API и консоль (заголовки актора только вне `production`):

```bash
npm run dev:api
# консоль: http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/health
```

Старт поднимает PGlite, накатывает миграции и гидратирует снимок. OIDC: `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`. DSN Postgres — только через `DATABASE_URL_SECRET_ID` (значение инжектит secret manager). Worker: `npm run start -w @refund/worker`.

Миграции проверяются в CI через PGlite. Живой Postgres 16: `docker compose up -d`, затем `npx tsx scripts/apply-migrations.ts | psql postgres://refund@localhost:5432/refund`.

## Статус

Этапы 0–2: foundation, API MVP, eligibility, экспорт продавца, SQL-снимок, boot, JWKS, durable import worker. Коннекторов маркетплейсов нет. `aliexpress-ua` остаётся `draft`.
