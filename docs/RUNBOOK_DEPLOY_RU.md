# Runbook: выкладка Refund Operations

**Секреты в этот файл не писать.** DSN и токены только в secret manager.

## 0. Доступ и репозиторий

1. Отозвать любой PAT, который попадал в чат или лог.
2. Скопировать [`docs/ci/github-actions-ci.yml`](ci/github-actions-ci.yml) в `.github/workflows/ci.yml` владельцем репозитория.
3. Защитить `main`: required checks, без force-push.

## 1. Данные

1. `terraform apply` в `infra/terraform` из CI с OIDC (не с ноутбука агента).
2. Взять master secret RDS из Secrets Manager; записать **ссылку** как `DATABASE_URL_SECRET_ID`.
3. Накатить миграции: `npx tsx scripts/apply-migrations.ts | psql "$DATABASE_URL"` (URL из secret store, не из Git).
4. Для триггеров аудита: `PERSIST_TRIGGER_WRITES=1`.

## 2. Идентичность

| Переменная | Назначение |
|---|---|
| `OIDC_ISSUER_URL` | issuer IdP |
| `OIDC_AUDIENCE` | `refund-api` |
| `OIDC_JWKS_URL` | JWKS |
| `ALLOW_DEV_ACTOR` | только не-prod |

В production dev-заголовки выключены (`NODE_ENV=production`).

## 3. Процессы

```bash
npm run dev:api          # API + консоль, PGlite если нет DSN
npm run start -w @refund/worker
```

Проверки:

- `GET /health` — процесс жив, поле `persistence`
- `GET /ready` — готов принимать трафик (`jobs`, `oidc`)
- `GET /v1/jobs` — очередь lease (нужны права import/audit)
- `GET /v1/outbox` / `POST /v1/outbox/publish` — неопубликованные доменные события
- `POST /v1/return-cases/{id}/transition` — сверка статуса после submit
- `POST /v1/return-cases/{id}/erasure` — стирание PII (compliance, не при legal hold)

## 4. Источники

| slug | prod |
|---|---|
| merchant-self-export | можно approve после review |
| aliexpress-ua | навсегда `draft` без коннектора |
| shopify-merchant | `draft`, пока нет OAuth своего магазина |

## 5. Откат

- Приложение: предыдущий image / `git revert`
- Схема: `db/ROLLBACK.md`
- Terraform: не `destroy` в prod; PITR + versioned audit bucket

## 6. Что ещё не в этом контуре

- Живой `pg.Pool` должен открыть деплой после резолва секрета (`bindPgPool` / `openPostgres`).
- Temporal Cloud — только если резолвится `TEMPORAL_ADDRESS_SECRET_ID`.
- Shopify Admin API client в репозитории отсутствует намеренно.
- Object store: `OBJECT_STORE_BUCKET` (secret manager). Без binding стирается только метаданные URI.
