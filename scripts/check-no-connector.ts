import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const IGNORE = new Set([".git", "node_modules", "dist", "coverage"]);
const BANNED_NAME = /(aliexpress|shopify).*(client|connector|sdk|scrape|crawler)/i;
const BANNED_CONTENT = [
  "playwright.chromium",
  "puppeteer.launch",
  "stealth_plugin",
  "anti-bot bypass",
  "document.cookie",
];

const offenders: string[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    const rel = relative(ROOT, full).split(sep).join("/");
    if (rel.startsWith("docs/")) continue;
    if (rel === "scripts/check-no-connector.ts") continue;
    if (BANNED_NAME.test(rel)) {
      offenders.push(`${rel}: banned connector filename`);
    }
    if (!/\.(ts|js|json)$/.test(rel)) continue;
    const text = readFileSync(full, "utf8");
    for (const token of BANNED_CONTENT) {
      if (text.includes(token)) {
        offenders.push(`${rel}: contains ${token}`);
      }
    }
  }
}

walk(ROOT);

if (offenders.length > 0) {
  process.stderr.write(`check-no-connector failed:\n${offenders.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("check-no-connector ok\n");
