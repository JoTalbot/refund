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
