import { isPostgresUrl } from "@refund/persist";

export function assertManagedPostgresBinding(
  databaseUrl: string | undefined,
  bound: { db?: unknown; sql?: unknown },
): void {
  if (databaseUrl && isPostgresUrl(databaseUrl) && !bound.db && !bound.sql) {
    throw new Error(
      "managed Postgres DSN resolved from secret id, but the pg pool is not bound in this process",
    );
  }
}
