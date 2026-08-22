# Threat model (stage 0)

**Дата:** 2026-08-22

## Активы

- Заказы и доказательства с PII.
- Право инициировать возврат у провайдера.
- Секреты интеграций (secret manager).
- Целостность `audit_events`.
- Репутация и договорной статус источников.

## Акторы угроз

- Внешний злоумышленник без аккаунта.
- Скомпрометированный customer/operator.
- Вредоносный или сбитый агент в эфемерной среде.
- Инсайдер с доступом к БД.
- Продавец/площадка, подделывающая webhook.

## Нежелательные исходы

1. Автоматический возврат без human approval.
2. Импорт из `draft`/`suspended` источника.
3. Утечка токенов, cookies, платёжных данных.
4. Подмена audit trail.
5. Повторная отправка того же provider action.
6. Работа с чужим заказом.

## Контроли (уже в репозитории)

- RBAC + step-up на approve/submit.
- Two-person control на `approval_requests`.
- Hash-chained append-only audit + SQL triggers.
- Идемпотентность provider actions.
- Source allowlist, AliExpress остаётся `draft`.
- Secret scan в `npm run ci`.
- Запрет коннектора/stealth в `check-no-connector`.

## Остаточный риск

Суперпользователь PostgreSQL может переписать таблицу; поэтому обязателен внешний WORM-архив (Terraform skeleton: audit bucket). Агенты не держат единственную копию состояния на локальном диске.
