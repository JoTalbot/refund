# Research note: landscape and operating protocol for compliant returns, catalog ingestion and durable agents

- **Date / timezone:** 2026-08-22, Europe/Kyiv
- **Agent / branch / commit base:** agent/002-research-protocol, `30d236c`
- **Decision needed:** Select a safe technical direction and define how agents continuously learn from current external information without losing reproducibility.
- **Scope / exclusions:** Lawful merchant-authorised returns and permitted catalog ingestion only. Excludes refund fraud, access-control circumvention, CAPTCHA/anti-bot bypassing, data collection behind login without permission, and using community claims as facts.
- **Revalidate by:** 2026-11-22, and immediately before adding any provider/source integration.

## Search coverage

Reviewed official provider/API documentation, official open-source repositories, the Agent Skills standard, durable-workflow documentation and practitioner discussions. Community sources supplied operational signals only; they do not override provider terms, laws or primary documentation.

## Findings

### 1. Return/refund integrations: API-first and event-driven

Shopify’s current GraphQL Return object supports return workflows, exchanges, reverse fulfillment and `returnProcess`; it models the buyer’s intent to ship items back and is associated with an order. The returns application guide publishes return/refund/reverse-delivery webhook topics. Therefore Shopify is the strongest first **merchant-authorised sandbox integration**; our platform must represent provider events as immutable observations and retain a human approval gate before any `returnProcess` that includes refund transfer.

WooCommerce REST documentation exposes order refund records and optional payment/refund/restock flags. This makes it a viable second connector, but its payment operation must remain disabled by default behind policy/approval controls.

Loop’s public webhook schema demonstrates relevant external states (`open`, `cancelled`, `closed`, `expired`, `needs review`) and operational data that can include customer/address fields. If Loop is later integrated, reduce and classify PII, validate webhook signatures and retain only approved fields.

### 2. Product data: sanctioned feed/API first; deterministic extraction second

Crawlee offers a TypeScript crawler interface covering HTTP and browser crawling. Scrapy remains a mature Python framework. Playwright is appropriate for UI testing and JavaScript rendering. Community practice repeatedly converges on deterministic HTTP extraction for static pages and a browser only for truly JS-rendered content; it also notes selector ownership and change detection remain human-maintained. This confirms the design decision: use the project’s TypeScript stack with an adapter boundary, but make the first source an authorised feed/API rather than an HTML extractor.

We explicitly reject products/services and online advice that focus on rotating identities, CAPTCHA solving, fingerprint evasion or bypassing rate limits. The source registry will require permission basis, policy URL, rate limit and kill switch before a worker may run.

### 3. Durable multi-agent operation: workflow history is not sufficient without idempotency

Temporal’s official error-handling guidance states Activities can be retried and recommends idempotence; a worker can complete an activity then crash before it reports success, causing retry. Durable workflows and external side effects therefore need distinct controls: deterministic workflow history/checkpoints, database transactional outbox, an idempotency key at every provider call, external receipt recording, reconciliation and approval event.

Temporal is recommended after the basic API/RBAC/audit foundation, because the product needs days-long waits for shipment/provider webhooks and human approval. The initial `workflow_leases` table remains useful as a simple durable worker contract before Temporal is provisioned.

### 4. Skills: portable but subject to supply-chain review

The Agent Skills specification requires a `SKILL.md` with `name` and `description`, with optional scripts/references/assets and progressive disclosure. Its metadata constraints allow a portable in-repo policy. The external `wshobson/agents` catalog is useful for discovering skill categories (auth, security, workflow, Git, agent teams), but it is not a trusted dependency: never execute bundled scripts or vendor instructions without review. The new `research-intelligence` skill makes current research mandatory for material decisions and gives every new skill an evaluation requirement.

## Evidence register

| Tier | Source | Checked | Finding | Applicability / limitation |
|---|---|---|---|---|
| Primary | [Shopify Return GraphQL object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Return) | 2026-08-22 | Supports returns, exchanges, reverse fulfillment and `returnProcess`. | Only merchant-authorised Shopify installations. |
| Primary | [Shopify returns app guide](https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps) | 2026-08-22 | Documents return/refund lifecycle and webhook topics. | Verify API version/scopes at implementation. |
| Primary | [WooCommerce refund API](https://woocommerce.github.io/woocommerce-rest-api-docs/) | 2026-08-22 | Refund records and payment/restock-related controls. | Provider version/auth must be checked per store. |
| Primary | [Temporal: make Activities idempotent](https://docs.temporal.io/develop/python/best-practices/error-handling) | 2026-08-22 | Activities can retry; idempotency prevents duplicate effects. | Python page; semantic principle applies to TS SDK design. |
| Primary | [Agent Skills specification](https://agentskills.io/specification) | 2026-08-22 | Portable `SKILL.md` structure and progressive disclosure. | Tool support for optional fields varies. |
| Repository | [apify/crawlee](https://github.com/apify/crawlee) | 2026-08-22 | TS crawler with HTTP/browser modes and storage/queue capabilities. | Use only policy-compliant features. Review pinned release/license before install. |
| Repository | [scrapy/scrapy](https://github.com/scrapy/scrapy) | 2026-08-22 | Mature Python crawling framework. | Not selected for current TS-first MVP. |
| Repository | [microsoft/playwright](https://github.com/microsoft/playwright) | 2026-08-22 | Browser automation for JS rendering and testing. | Not a licence to automate protected pages or submit claims. |
| Repository | [medusajs/medusa](https://github.com/medusajs/medusa) | 2026-08-22 | Reference commerce model with orders, exchanges, returns, claims. | Evaluate as reference/sandbox; do not import whole platform. |
| Repository | [saleor/saleor](https://github.com/saleor/saleor) | 2026-08-22 | GraphQL commerce reference with returns. | Reference only until license/version review. |
| Community signal | [r/webscraping production tool discussion](https://www.reddit.com/r/scrapingtheweb/comments/1pswaed/whats_your_goto_web_scraper_for_production_in_2025/) | 2026-08-22 | Practitioners favour HTTP-first/Playwright for JS, with maintenance costs. | Anecdotal; does not establish legality or policy. |
| Community signal | [r/AI_Agents scraping discussion](https://www.reddit.com/r/AI_Agents/comments/1qjkotq/what_are_people_actually_using_for_web_scraping/) | 2026-08-22 | Agents do not eliminate selector/change-detection ownership. | Anecdotal; bypass recommendations are explicitly rejected. |

## Options and decision

| Option | Benefits | Costs/risks | Status |
|---|---|---|---|
| Build a generic HTML scraper first | Fast apparent demonstration | No approved source; legal/maintenance risk; weak business validation | Rejected |
| Begin with Shopify merchant-authorised sandbox | Documented lifecycle, webhooks, clear entities; validates case/audit design | Needs merchant app credentials and scopes | Recommended first provider integration |
| Adopt a full commerce platform | Rich domain features | Major scope/operational burden, upgrade and license review | Reference only |
| Use database leases initially, add Temporal after audit/RBAC | Incremental implementation, durable recovery path | Requires migration/integration later | Recommended |
| Install community skills automatically | Fast discovery | Supply-chain and instruction-injection risk | Rejected |

## Recommendation

1. Maintain a research note for each material decision with a 90-day revalidation maximum.
2. Keep TS as the implementation language; implement the first source as an authorised Shopify sandbox/API integration, not a marketplace scraper.
3. Build source allowlisting, provider-action idempotency, webhook verification, audit and RBAC before any external submission operation.
4. Treat agent memory as append-only iteration records plus durable runtime state, rather than relying on a machine’s filesystem or chat context.
5. Discover external skills continuously, but vendor none until review, pinning and eval are complete.

## Rejected / prohibited paths

- Automated/refund claims without order ownership, policy eligibility and human approval.
- HTML extraction that violates source terms or uses anti-bot/CAPTCHA/login/rate-limit circumvention.
- Unreviewed external `SKILL.md` scripts, repo code or forum instructions.
- Secrets, session data or PII in Git research, iteration notes or prompts.

## Follow-up and ownership

Next task: `agent/003-auth-audit-contracts` — research current Fastify/identity/RBAC patterns, then implement tenant-aware audit writer and provider-action approval interface. Revalidate Shopify GraphQL documentation and scopes immediately before provider code.
