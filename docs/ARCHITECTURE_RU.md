# ТЗ и архитектура: Refund Operations Platform

**Версия:** 0.1 · **Дата:** 2026-08-22 · **Статус:** проектное решение

## 1. Границы продукта

### Назначение
Система помогает магазину, оператору сервиса возвратов или владельцу заказа обрабатывать **правомерные** возвраты. Грабер/импортер собирает данные о товарах и политиках возврата из разрешённых источников, чтобы оператор мог проверить условия возврата по реальному заказу.

Система **не предназначена** для:
- поиска способов получить необоснованную компенсацию;
- автоматическая подача ложных заявок, подделка доказательств, обход защит и ограничений площадок;
- работа с чужими аккаунтами/заказами, cookie, паролями, платёжными данными;
- автосписания/возвраты без прав доступа продавца, подтверждения и аудита.

## 2. Пользователи и роли

| Роль | Права |
|---|---|
| Customer | Создать черновик по собственному заказу, добавить доказательства, подтвердить заявление. |
| Operator | Проверить данные, предложить допустимый сценарий, но не одобрить выплату в одиночку. |
| Approver | Подтвердить отправку запроса/операцию согласно политике. |
| Merchant admin | Подключить свой магазин/API, политики и сотрудников. |
| Auditor | Просмотр неизменяемого аудита и выгрузка отчётов. |
| Service agent | Выполняет только ограниченную задачу по short-lived identity; не получает постоянных секретов. |

RBAC обязателен. Для одобрения внешнего запроса и любой денежной операции — MFA/step-up и принцип двух пар глаз, если это требует внутренняя политика.

## 3. Функциональные модули

### A. Реестр источников (`Source Registry`)
Allowlist источников. Для каждого источника фиксируются: владелец, договорное/юридическое основание, URL условий, поддерживаемый API/фид, разрешённые поля, лимит запросов, срок хранения, статус `draft → review → approved → suspended`.

Коннектор запускается **только** при `approved`. При отзыве согласия или изменении правил он блокируется.

### B. Импорт/грабер товаров
Порядок методов: официальное API → партнёрский каталог/фид → экспорт продавца → разрешённый HTML-сбор. Нормализует:

```json
{
  "source_id": "uuid",
  "source_product_id": "string",
  "canonical_url": "https://…",
  "title": "string",
  "brand": "string|null",
  "sku": "string|null",
  "price": {"amount": "decimal", "currency": "ISO-4217"},
  "availability": "in_stock|out_of_stock|unknown",
  "return_policy_snapshot_id": "uuid|null",
  "provenance": {
    "extractor_version": "semver/git SHA",
    "fetched_at": "RFC-3339",
    "evidence_uri": "object storage URI",
    "field_confidence": {}
  }
}
```

Ограничения: настраиваемый rate limit на источник, retry с backoff, идемпотентный upsert `(source_id, source_product_id)`, append-only наблюдения цен, parser fixtures и schema validation. Не обходить CAPTCHA/anti-bot, логин-ограничения и `robots.txt`/ToS.

### C. Заказы и eligibility engine
Заказ импортируется через выданное владельцем разрешение либо из подтверждённого пользователем документа. Движок сопоставляет товар/заказ с **версионированным снимком** правил: срок, география, состояние, исключения, плата за обратную доставку, возможный способ возврата. Он не принимает решение о выплате: выдаёт объяснимый результат `eligible | ineligible | needs_review` и список отсутствующих сведений.

### D. Case management
Состояния: `draft → evidence_pending → submitted_for_approval → approved_for_submission → submitted → merchant_review → return_in_transit → received → resolved | rejected | cancelled`.

- Все переходы проверяются state machine.
- Пользователь подтверждает достоверность сведений и согласие до `submitted_for_approval`.
- Внешний запрос создаёт только Approver, с `idempotency_key`, policy snapshot, основанием и audit-event.
- Коннектор обновляет статус только по документированному API/webhook или проверяемому ответу продавца.

### E. Аудит, доказательства и обучение
`audit_event` append-only: actor, action, timestamp, case_id, policy_version, provider correlation ID, hashes артефактов. Доказательства шифруются в object storage; база содержит URI, checksum, классификацию PII, retention и legal hold.

«Обучение на действиях» означает не самопроизвольное изменение правил. Агент сохраняет обезличенные результаты запусков (версия экстрактора, метрики, исправление оператора); новая версия правила/парсера публикуется через тестовый набор, review и canary.

## 4. Техническая архитектура

```text
[Web Console] ──HTTPS──> [API / BFF]
                              ├─ [Identity + RBAC]
                              ├─ [Case Service] ─────> PostgreSQL (managed, backups/PITR)
                              ├─ [Policy / Eligibility Service]
                              ├─ [Source Registry]
                              ├─ [Audit Event Writer] ─> immutable/WORM audit archive
                              └─ [Workflow API] ──────> Temporal (durable workflows)
                                                         │
[Approved APIs/Feeds] ─> [Ingestion Workers] ─> Queue ──┼─> PostgreSQL
[Approved HTML pages] ─> [Limited Extractors] ───────────┤
                                                         └─> Object Storage (evidence/fixtures)

[Secrets Manager] -> short-lived workload identity only
[GitHub + CI] -> source, migrations, IaC, skills, tests; no runtime secrets/state
```

### Рекомендуемый стек
- **Backend:** TypeScript + NestJS/Fastify или Python + FastAPI; единый язык стоит выбрать после команды. Для TS-стека: Crawlee + Playwright только для разрешённых браузерных источников.
- **Данные:** managed PostgreSQL, Redis для кэша/краткоживущих locks, S3-совместимое object storage, Temporal Cloud/self-hosted с резервным планом.
- **Интерфейс:** Next.js/React, API через BFF.
- **Инфраструктура:** Terraform/OpenTofu, Docker, Kubernetes/ECS/Cloud Run; GitHub Actions с OIDC и environment approvals.
- **Наблюдаемость:** OpenTelemetry, Sentry, метрики freshness/success/error/queue lag, alert на policy violation.

## 5. Устойчивость к пропаже среды и параллельным агентам

1. Локальный диск — disposable: нет БД, очереди, секретов, единственной копии артефактов или checkpoint на машине агента.
2. Задача имеет `run_id`, lease с TTL, checkpoint URI и идемпотентные side effects. Новый worker продолжает истёкший lease.
3. Использовать transactional outbox: запись в PostgreSQL и событие создаются атомарно; publisher делает доставку at-least-once, consumers — идемпотентны.
4. В Git хранятся код, IaC, миграции, схемы, fixtures, `SKILL.md`, ADR. Артефакты/PII — только вне Git.
5. Каждый агент работает в собственной ветке; PR — единица интеграции. Защита ветки: required CI, code owner review, signed commits при возможности, secret scan и dependency/license scan.
6. Обязательный handoff в задаче/PR: SHA, сделанное, незавершённое, тесты, ссылки на durable run/artifacts, откат.

## 6. Минимальная схема данных

| Таблица | Ключевые поля |
|---|---|
| `sources` | id, owner, base_url, permission_basis, policy_url, status, rate_limit |
| `source_products` | source_id, external_id, canonical_url, normalized fields, extractor_version, updated_at |
| `product_observations` | id, source_product_id, observed_at, price, availability, evidence_uri |
| `policy_snapshots` | id, source_id, version/hash, effective_at, rules_json, evidence_uri |
| `orders` | id, tenant_id, provider, external_id, ownership_verified_at, pii_ref |
| `return_cases` | id, tenant_id, order_id, state, eligibility, policy_snapshot_id, version |
| `case_evidence` | id, case_id, object_uri, checksum, classification, expires_at |
| `approval_requests` | id, case_id, requested_by, approved_by, decision, idempotency_key |
| `provider_actions` | id, case_id, provider, idempotency_key, request_ref, response_ref, status |
| `audit_events` | id, occurred_at, actor, action, entity, before_hash, after_hash, trace_id |
| `agent_runs` | id, skill_version, tool_versions, input_ref, output_ref, metrics_json, outcome |

В `return_cases.version` используется optimistic concurrency. PII отделяется от операционных таблиц и шифруется.

## 7. API MVP

- `POST /v1/sources` — создать источник; по умолчанию `draft`.
- `POST /v1/sources/{id}/approve` — approve только compliance/admin.
- `POST /v1/import-runs` — старт разрешённого импорта.
- `GET /v1/products?source_id=&q=` — поиск нормализованных товаров.
- `POST /v1/orders/import` — импорт авторизованного заказа.
- `POST /v1/return-cases` — создать черновик.
- `POST /v1/return-cases/{id}/eligibility` — пересчитать с указанием версии политики.
- `POST /v1/return-cases/{id}/attestations` — подтверждение пользователя.
- `POST /v1/return-cases/{id}/approval-requests` — запрос одобрения.
- `POST /v1/return-cases/{id}/submit` — отправка только для approver; нужен idempotency key.
- `GET /v1/audit-events?case_id=` — аудит с redaction по роли.

## 8. План поставки

### Этап 0 — foundation
- Этот репозиторий, agent skills, threat model, source registry, CI, secret scanning, Terraform skeleton.
- Статус 2026-08-22: доменный пакет `@refund/domain`, миграции `db/migrations`, `npm run ci`, источник `aliexpress-ua` в `draft`. Коннекторов нет.

### Этап 1 — законный каталог
- Один официально разрешённый API/фид, нормализатор, fixtures, source registry, продукты/наблюдения, dashboard ingestion runs.
- Статус 2026-08-22: парсер `merchant-export@1.0.0` и `POST /v1/import-runs` для экспорта продавца. Marketplace HTTP-коннекторов нет.

### Этап 2 — кейсы без внешней отправки
- Заказы, policy snapshots, eligibility, evidence store, case state machine, RBAC, audit.
- Статус 2026-08-22: in-memory API покрывает §7; внешняя отправка только `manual_guidance_only` после approval.

### Этап 3 — одобренная интеграция возврата
- Один провайдер (например, собственный Shopify-магазин с правами merchant), approval gate, idempotency, webhook reconciliation и sandbox tests.

### Этап 4 — hardening
- Backups/restore drill, chaos test потери worker, SLO, retention jobs, DLP, pen-test, review legal/ToS по каждому источнику.

## 9. Критерии приёмки MVP

- Worker можно прервать на любой стадии и безопасно продолжить с другого окружения без дубля внешнего действия.
- Нельзя запустить импорт неразрешённого источника или провести submission без explicit approval.
- Каждая карточка товара имеет источник, время, версию экстрактора и ссылку на доказательство.
- Каждый кейс имеет проверяемую ownership/attestation trail и версию политики.
- Секреты не присутствуют в git history, логах, issue, artifacts или frontend bundle.
- Автотесты покрывают state transitions, idempotency, source authorization, parser fixtures и permission checks.
