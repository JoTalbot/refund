import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SqlExec {
  exec(sql: string): Promise<unknown>;
}

export function loadMigrationSql(migrationsDir: string): Array<{ name: string; sql: string }> {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(migrationsDir, name), "utf8"),
    }));
}

export function sqlWithoutOptionalExtensions(sql: string): string {
  return sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/g, "");
}

export async function applyMigrations(
  client: SqlExec,
  migrationsDir: string,
  options: { allowMissingPgcrypto?: boolean } = {},
): Promise<string[]> {
  const applied: string[] = [];
  for (const file of loadMigrationSql(migrationsDir)) {
    const sql = options.allowMissingPgcrypto ? sqlWithoutOptionalExtensions(file.sql) : file.sql;
    await client.exec(sql);
    applied.push(file.name);
  }
  return applied;
}

export function defaultMigrationsDir(): string {
  return fileURLToPath(new URL("../../../db/migrations", import.meta.url));
}
