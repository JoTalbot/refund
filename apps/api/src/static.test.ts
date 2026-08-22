import { describe, expect, it } from "vitest";
import { readPublicFile, resolvePublicFile } from "./static.js";

describe("static console", () => {
  it("serves the console and blocks path escape", () => {
    expect(resolvePublicFile("/")?.path.endsWith("index.html")).toBe(true);
    expect(readPublicFile("/")?.type).toContain("text/html");
    expect(readPublicFile("/")?.body.toString("utf8")).toContain("Refund Operations");
    expect(resolvePublicFile("/../../package.json")).toBeNull();
  });
});
