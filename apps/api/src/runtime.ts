import { PGlite } from "@electric-sql/pglite";
import { applyMigrations, defaultMigrationsDir, SqlPlatformStore } from "@refund/persist";
import { Platform } from "./platform.js";

export interface Runtime {
  platform: Platform;
  store: SqlPlatformStore;
  db: PGlite;
  persistence: "pglite";
}

export async function createRuntime(options: { db?: PGlite } = {}): Promise<Runtime> {
  const db = options.db ?? new PGlite();
  const existing = await db.query<{ t: string | null }>("SELECT to_regclass('public.tenants') AS t");
  if (!existing.rows[0]?.t) {
    await applyMigrations(db, defaultMigrationsDir(), { allowMissingPgcrypto: true });
  }
  const store = new SqlPlatformStore(db);
  const snapshot = await store.loadSnapshot();
  const platform =
    snapshot.orders.length > 0 || snapshot.cases.length > 0 || snapshot.sources.length > 1
      ? Platform.fromSnapshot(snapshot)
      : new Platform();
  return { platform, store, db, persistence: "pglite" };
}
