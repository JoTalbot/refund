import type { SqlQuery } from "./sql.js";

export interface PgQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export class PgSqlQuery implements SqlQuery {
  constructor(private readonly client: PgQueryable) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    const result = await this.client.query(sql, params);
    return { rows: result.rows as T[] };
  }

  async exec(sql: string): Promise<unknown> {
    return this.client.query(sql);
  }
}

export function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export async function bindPgPool(connectionString: string): Promise<PgSqlQuery> {
  let PoolCtor: (new (options: { connectionString: string; max: number; connectionTimeoutMillis: number }) => PgQueryable) | undefined;
  try {
    const load = Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ default?: { Pool?: new (options: object) => PgQueryable }; Pool?: new (options: object) => PgQueryable }>;
    const mod = await load("pg");
    PoolCtor = (mod.Pool ?? mod.default?.Pool) as typeof PoolCtor;
  } catch {
    throw new Error("pg pool is not bound in this process");
  }
  if (!PoolCtor) {
    throw new Error("pg pool is not bound in this process");
  }
  const pool = new PoolCtor({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
  });
  return new PgSqlQuery(pool);
}
