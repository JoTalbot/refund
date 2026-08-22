import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
}

describe("documentation contracts", () => {
  it("keeps the AliExpress source draft and documents no connector", () => {
    const source = read("docs/sources/aliexpress-ua.md");
    expect(source).toMatch(/status:\s*`?draft`?/i);
    expect(source.toLowerCase()).toMatch(/no api, scrape, login or cookie/);
    expect(source.toLowerCase()).toMatch(/connector: none/);
  });

  it("covers the Ukraine buyer journeys in Russian", () => {
    const guide = read("docs/providers/ALIEXPRESS_UA_BUYER_GUIDE_RU.md");
    for (const heading of [
      "Отмена заказа",
      "Недоставка",
      "Проблема с товаром",
      "Возврат",
      "Сверка возврата",
      "Таможня",
      "Мошенничество",
    ]) {
      expect(guide).toContain(heading);
    }
    expect(guide).toContain("https://www.aliexpress.com/");
    expect(guide).toContain("https://zakon.rada.gov.ua/laws/show/4495-17");
  });

  it("records official evidence and region limits", () => {
    const research = read("docs/research/2026-08-22-aliexpress-ua-buyer.md");
    expect(research).toContain(
      "https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html",
    );
    expect(research).toContain(
      "https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress202201220006_10755.html",
    );
    expect(research).toContain("https://openservice.aliexpress.com/");
    expect(research.toLowerCase()).toContain("ukraine");
  });

  it("keeps Shopify as a draft own-store source", () => {
    const source = read("docs/sources/shopify-merchant.md");
    expect(source).toMatch(/status:\s*draft/i);
    expect(source.toLowerCase()).toContain("connector: none");
    expect(source).toContain("https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps");
  });
});
