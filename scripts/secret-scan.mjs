import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const patterns = [
  { name: 'GitHub personal token', re: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { name: 'private key block', re: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/g },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g }
];
const findings = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const path = join(dir, name); const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (stat.size < 1_000_000) {
      const value = readFileSync(path, 'utf8');
      for (const { name: label, re } of patterns) if (re.test(value)) findings.push(`${relative(process.cwd(), path)}: ${label}`);
    }
  }
}
walk(process.cwd());
if (findings.length) { console.error(`Secret scan failed:\n${findings.join('\n')}`); process.exit(1); }
console.log('Secret scan passed.');
