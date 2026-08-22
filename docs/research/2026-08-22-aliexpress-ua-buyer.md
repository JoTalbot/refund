# Research: AliExpress buyer journey for Ukraine

**Date:** 2026-08-22 · **Issue:** #2 · **Source status:** `draft` · **Connector:** none

This is a compliance and help-center assessment for a person in Ukraine working with **their own** AliExpress order. It is not permission to scrape, log in on behalf of the user, store cookies, or call the Open Platform.

## Official evidence register

| Document | URL | Retrieved | Notes |
|---|---|---|---|
| AliExpress.com Privacy Policy (effective 30 Jul 2026) | https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html | 2026-08-22 | Contracting entity for most non-US / non-CN / non-KR buyers is Alibaba.com Singapore E-Commerce Private Limited. Ukraine is **not** listed in the CIS “Relevant Jurisdictions” set (RU, AZ, AM, BY, GE, KZ, KG, MD, TM, TJ, UZ). |
| AliExpress API Use Agreement (updated 25 Jan 2022) | https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress202201220006_10755.html | 2026-08-22 | Developer admission, App Key/Secret, Basic vs Value-Added APIs. Operation data vests in AliExpress; storage/use without written approval is prohibited (art. 7.6 / 9.3 family). |
| AliExpress Open Platform | https://openservice.aliexpress.com/ | 2026-08-22 | Seller/partner APIs, registration required. Not a consumer returns API. |
| Open Platform API docs | https://openservice.aliexpress.com/doc/api.htm | 2026-08-22 | Access after developer admission. |
| Alibaba.com Terms of Use (updated 11 Mar 2026, effective 17 Mar 2026) | https://rule.alibaba.com/rule/detail/2041.htm | 2026-08-22 | Referenced by AliExpress legal family. Current text is a **wholesale B2B** Alibaba.com document. Do not treat it as the complete AliExpress consumer contract. |
| Free Membership Agreement (in-product) | https://www.aliexpress.com/p/account-legacy/index.html?lang=en_US&type=membership | 2026-08-22 | Host `www.aliexpress.com` is operationally unstable from automated fetch (maintenance/404). Confirm in the signed-in Help/legal footer. |
| Buyer Protection explainer | https://www.aliexpress.com/buyerprotection/how_to_be_eligible.html | 2026-08-22 | Live fetch returned maintenance. Historical official copy describes Open Dispute from My AliExpress and AliExpress Case Management when seller negotiation fails. |
| Historical Free Return rules | https://sale.aliexpress.com/__mobile/UVYqyCdVV4.htm | 2026-08-22 | Promotional URL now 404. Archived text: 15-day no-reason local return for participating listings; free delivery service **once per order**; unused/complete goods; abuse may forfeit free shipping. |
| Historical seller-guaranteed services | https://sale.aliexpress.com/__pc/buyerprotection-seller_guaranteed.htm | 2026-08-22 | Now 404. Archived: on-time delivery window; returns & refund if not as described; one dispute per order; refund window commonly described as 15 days after order completion. |
| Customs Code of Ukraine | https://zakon.rada.gov.ua/laws/show/4495-17 | 2026-08-22 | Art. 374: non-excise goods in international postal/express consignments. Duty-free threshold **EUR 150** invoice value (one consignor → one consignee per dispatch). |
| Tax Code of Ukraine | https://zakon.rada.gov.ua/laws/show/2755-17 | 2026-08-22 | VAT on the taxable base defined with the Customs Code. |

## API assessment (no implementation)

1. Consumer refunds for a private buyer are performed **inside the AliExpress account**, not through an unofficial third-party bot.
2. AliExpress Open Platform is a **developer/seller** programme. Using it requires accepting the API Use Agreement, an approved application, App Key/Secret in a secret manager, and rate limits. Buyer order data is user/operation data: storing it without AliExpress written approval is contractually restricted.
3. There is no approved source-registry status and no merchant-of-record relationship. Therefore the connector stays **unbuilt** and the source stays **`draft`**.
4. HTML extraction, login automation, cookie reuse, CAPTCHA solving or anti-bot bypass are forbidden by project skills and by typical AliExpress technical controls.

## Region limitations (Ukraine)

- **Free Return / Choice local warehouse** is listing- and country-specific. Public buyer reports and the absence of a stable UA warehouse programme mean many UA orders have **no prepaid local label**. Treat Free Return as available only when the **current order page** shows it.
- Return without that badge usually means international shipment to the seller, paid by the buyer, often uneconomic.
- Buyer Protection (not received / not as described) still applies through **Returns/Refunds** and, if needed, escalation to AliExpress. Deadlines are shown on the order. Do not wait until the countdown expires.
- Logistics are slower and more failure-prone under wartime and rerouted transit. Tracking gaps are common; they are not by themselves proof of fraud, but they are a reason to open the official case **before** Buyer Protection ends.
- Customs: invoice value **> EUR 150** typically triggers 10% import duty on the excess plus 20% VAT on (excess + duty), excluding excise goods and subject to the operator’s process (Ukrposhta / Nova Poshta / courier). Confirm the live Customs Code text before advising a specific payment.
- Payments: refunds usually return to the original method. Bank/card timelines are outside AliExpress control. Bonuses/coupons may not refund as cash.
- Language: in-app Help and chat are the operational source of truth; English legal pages prevail over unofficial translations.

## What this repository will not do

- Log into the buyer’s AliExpress account, store cookies, or complete a dispute for them.
- Call Open Platform or any unofficial endpoint.
- Invent evidence, open duplicate claims, or coach false “item not received” stories.
- Promise a refund outcome.
