import { PGlite } from "@electric-sql/pglite";
import {
  applyMigrations,
  defaultMigrationsDir,
  EnvSecretResolver,
  resolveDatabaseUrl,
  SqlPlatformStore,
  type SecretResolver,
  type SqlQuery,
} from "@refund/persist";
import { Platform } from "./platform.js";
import { assertManagedPostgresBinding } from "./bind.js";

export interface Runtime {
  platform: Platform;
  store: SqlPlatformStore;
  db?: PGlite;
  persistence: "pglite" | "postgres";
}

export async function createRuntime(
  options: {
    db?: PGlite;
    sql?: SqlQuery;
    persistence?: "pglite" | "postgres";
    secrets?: SecretResolver;
  } = {},
): Promise<Runtime> {
  if (options.sql) {
    return hydrate(options.sql, options.persistence ?? "postgres");
  }

  const secrets = options.secrets ?? new EnvSecretResolver();
  const databaseUrl = await resolveDatabaseUrl(secrets);
  assertManagedPostgresBinding(databaseUrl, { db: options.db, sql: options.sql });

  const db = options.db ?? new PGlite();
  const existing = await db.query<{ t: string | null }>("SELECT to_regclass('public.tenants') AS t");
  if (!existing.rows[0]?.t) {
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
  }
  const runtime = await hydrate(db, "pglite");
  return { ...runtime, db };
}

async function hydrate(sql: SqlQuery, persistence: "pglite" | "postgres"): Promise<Runtime> {
  const store = new SqlPlatformStore(sql);
  const snapshot = await store.loadSnapshot();
  const platform =
    snapshot.orders.length > 0 || snapshot.cases.length > 0 || snapshot.sources.length > 1
      ? Platform.fromSnapshot(snapshot)
      : new Platform();
  return { platform, store, persistence };
}
