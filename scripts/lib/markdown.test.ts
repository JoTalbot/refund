import { describe, expect, it } from "vitest";
import { extractMarkdownLinks } from "./markdown.js";

describe("markdown link extraction", () => {
  it("collects inline and bare https links", () => {
    const links = extractMarkdownLinks(
      "See [policy](https://example.com/a) and https://example.com/b.",
    );
    expect(links).toContain("https://example.com/a");
    expect(links).toContain("https://example.com/b");
  });
});
