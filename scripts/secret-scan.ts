import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".cache",
]);

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "github-pat", regex: /ghp_[A-Za-z0-9]{20,}/g },
  { name: "github-fine-grained", regex: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "private-key", regex: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g },
  { name: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "generic-secret-assignment", regex: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{12,}['"]/gi },
];

const ALLOWED_SNIPPETS = [
  "secret_id_placeholder",
  "DATABASE_URL_SECRET_ID",
  "example-refund-",
];

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (stat.size > 1_500_000) continue;
    files.push(full);
  }
}

function isAllowed(line: string): boolean {
  return ALLOWED_SNIPPETS.some((snippet) => line.includes(snippet));
}

const files: string[] = [];
walk(ROOT, files);

const findings: string[] = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (rel === "scripts/secret-scan.ts") continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isAllowed(line)) return;
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push(`${rel}:${index + 1} ${pattern.name}`);
      }
      pattern.regex.lastIndex = 0;
    }
  });
}

if (findings.length > 0) {
  process.stderr.write(`secret-scan failed:\n${findings.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`secret-scan ok (${files.length} files)\n`);
