# Проверенные источники и репозитории

**Проверено:** 2026-08-22. Это стартовый список для технического исследования, не автоматическое разрешение на использование. Перед включением любого источника в продукт необходимо проверить актуальные ToS, API agreement, региональные требования и статус в `Source Registry`.

## Приоритетные легальные источники товарных данных

| Категория | Источник | Использование в проекте | Требование |
|---|---|---|---|
| Собственный магазин | Shopify Admin GraphQL API + webhooks | Заказы, товары, returns/refunds для магазина, который вы администрируете | OAuth/access token с минимальными scopes, merchant approval |
| Партнёрские каталоги | Официальный affiliate/API/feed конкретной площадки | Каталог, цена, ссылка, доступность | Письменное/договорное разрешение и соблюдение лимитов |
| Продавец | CSV/XML/JSON экспорт продавца | Надёжный импорт с явным согласием | Подписанный экспорт или authenticated API |
| Публичная страница | HTML только при разрешении условиями источника | Ограниченный обогащающий импорт | Проверка robots/ToS, rate limit, никаких обходов защиты |

### Shopify как первая рекомендуемая интеграция
Shopify документирует приложения для управления возвратами: возврат создаёт покупатель, магазин определяет eligibility/одобряет/отслеживает, а события доступны через webhooks. Управление returns выполняется через GraphQL Admin API. Ссылка: <https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps>.

Для возвратов доступны сущности refund и line items; необходимые scopes в документации включают `orders`/`marketplace_orders`. Ссылка: <https://shopify.dev/docs/api/admin-rest/latest/resources/refund>. Для новой реализации предпочтителен актуальный GraphQL return lifecycle, а не копирование legacy REST-примеров.


## Репозитории и компоненты для оценки

| Репозиторий / документация | Роль | Решение |
|---|---|---|
| [apify/crawlee](https://github.com/apify/crawlee) | TypeScript framework: HTTP + Playwright crawlers, очереди, retries, storage | Кандидат для коннекторов разрешённых каталогов; запретить stealth/anti-bot обходы в наших адаптерах |
| [apify/crawlee-python](https://github.com/apify/crawlee-python) | Python версия Crawlee | Вариант, если backend выбран на Python |
| [scrapy/scrapy](https://github.com/scrapy/scrapy) | Зрелый Python crawler для структурированных статичных/API источников | Альтернатива Crawlee при Python-first команде |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Браузерная автоматизация и тестирование | Только JS-rendered разрешённые страницы, UI tests и sandbox/provider flows |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | MCP browser automation для агентов | Использовать только в изолированном профиле и без передачи пользовательских сессий между агентами |
| [saleor/saleor](https://github.com/saleor/saleor) | Open-source commerce reference | Изучить доменную модель orders/payments/returns или поднять sandbox, не как готовый модуль для неконтролируемых возвратов |
| [anthropics/skills](https://github.com/anthropics/skills) и [agentskills.io](https://agentskills.io) | Формат переносимых agent skills | Основа для `.agents/skills/*/SKILL.md`; локальные skills уже добавлены в репозиторий |
| [wshobson/agents](https://github.com/wshobson/agents) | Каталог skills, включая coordination/workflow patterns | Только как библиотека идей; pin/review лицензии и содержимого до включения |

## Записи Source Registry

| slug | status | Комментарий |
|---|---|---|
| aliexpress-ua | draft | Только ручной гайд покупателя в Украине. См. `docs/sources/aliexpress-ua.md`. Импорт и Open Platform запрещены. |

## Рекомендованный выбор для MVP

**TypeScript-путь:** NestJS/Fastify + PostgreSQL + Temporal + Crawlee + Playwright + Shopify Admin GraphQL. Однородный TS-стек удобен для веб-консоли и коннекторов. Браузерный слой допустим только при одобрении источника.

**Python-путь:** FastAPI + PostgreSQL + Temporal SDK + Scrapy/Crawlee Python + Playwright Python. Выбирать, если команда сильнее в data engineering/Python.

Независимо от языка, модель данных, durable storage, аудит, approval gate и policy snapshots обязательны.

## Чек-лист допуска нового источника

1. Назначить владельца и бизнес-цель полей.
2. Найти официальный API/feed и договор/ToS; записать URL и дату ревизии.
3. Проверить право на автоматизированный доступ, частоту, атрибуцию, коммерческое использование и хранение данных.
4. Описать PII/чувствительные данные и retention.
5. Добавить источник как `draft`, пройти review и только затем `approved`.
6. Реализовать rate limit, source-specific user-agent/contact, retries и kill switch.
7. Внести fixture tests и метрики freshness/error/coverage.
8. Перепроверять ToS/API на schedule и при ошибках/жалобах; при сомнении перевести источник в `suspended`.
