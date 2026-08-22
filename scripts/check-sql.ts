import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "db/migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length < 2) {
  process.stderr.write("expected at least two SQL migrations\n");
  process.exit(1);
}

const required = [
  "CREATE TABLE audit_events",
  "CREATE TABLE approval_requests",
  "CREATE TABLE provider_actions",
  "CREATE TABLE import_runs",
  "CREATE TABLE job_leases",
  "CREATE TABLE order_lines",
  "idempotency_key",
  "forbid_audit_mutation",
  "audit_events_enforce_chain",
  "provider_actions_require_approval",
  "'draft'",
  "aliexpress-ua",
  "shopify-merchant",
];

const combined = files.map((name) => readFileSync(join(dir, name), "utf8")).join("\n");
const missing = required.filter((token) => !combined.includes(token));
if (missing.length > 0) {
  process.stderr.write(`check-sql missing tokens:\n${missing.join("\n")}\n`);
  process.exit(1);
}

if (/EXECUTE PROCEDURE/i.test(combined)) {
  process.stderr.write("use EXECUTE FUNCTION for PostgreSQL 16 triggers\n");
  process.exit(1);
}

process.stdout.write(`check-sql ok (${files.join(", ")})\n`);
