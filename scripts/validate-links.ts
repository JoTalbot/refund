import { readFileSync } from "node:fs";
import { collectMarkdownFiles, extractMarkdownLinks } from "./lib/markdown.js";

const STABLE_HOSTS = new Set([
  "terms.alicdn.com",
  "openservice.aliexpress.com",
  "rule.alibaba.com",
  "rulechannel.alibaba.com",
  "zakon.rada.gov.ua",
  "github.com",
  "shopify.dev",
  "agentskills.io",
]);

const UNSTABLE_HOSTS = new Set(["www.aliexpress.com", "sale.aliexpress.com", "campaign.aliexpress.com"]);

const REQUIRED_OFFICIAL = [
  "https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress201909171350_82407.html",
  "https://terms.alicdn.com/legal-agreement/terms/suit_bu1_aliexpress/suit_bu1_aliexpress202201220006_10755.html",
  "https://openservice.aliexpress.com/",
  "https://zakon.rada.gov.ua/laws/show/4495-17",
];

function hostOf(url: string): string {
  return new URL(url).host;
}

const files = collectMarkdownFiles(process.cwd());
const allLinks: Array<{ file: string; href: string }> = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const href of extractMarkdownLinks(text)) {
    allLinks.push({ file, href });
  }
}

function isRelativeDocLink(href: string): boolean {
  if (href.startsWith("#") || href.startsWith("./") || href.startsWith("../") || href.startsWith("/")) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) {
    return false;
  }
  return true;
}

const errors: string[] = [];
for (const link of allLinks) {
  if (link.href.startsWith("mailto:")) continue;
  if (link.href.includes("…") || link.href.includes("...")) continue;
  if (isRelativeDocLink(link.href)) continue;
  try {
    const url = new URL(link.href);
    if (url.protocol !== "https:") {
      errors.push(`${link.file}: non-https ${link.href}`);
    }
  } catch {
    errors.push(`${link.file}: malformed ${link.href}`);
  }
}

const found = new Set(allLinks.map((link) => link.href));
for (const required of REQUIRED_OFFICIAL) {
  if (!found.has(required)) {
    errors.push(`missing required official link: ${required}`);
  }
}

const live = process.env.VALIDATE_LINKS_LIVE === "1";
if (live) {
  const unique = [...new Set(allLinks.map((link) => link.href))].filter((href) => href.startsWith("https://"));
  for (const href of unique) {
    const host = hostOf(href);
    if (UNSTABLE_HOSTS.has(host)) continue;
    if (!STABLE_HOSTS.has(host)) continue;
    try {
      const response = await fetch(href, { method: "GET", redirect: "follow" });
      if (response.status >= 400) {
        errors.push(`live fetch ${href} -> ${response.status}`);
      }
    } catch (error) {
      errors.push(`live fetch ${href} failed: ${(error as Error).message}`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`validate-links failed:\n${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`validate-links ok (${allLinks.length} links, ${files.length} files)\n`);
