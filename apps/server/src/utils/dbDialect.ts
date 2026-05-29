import type { Knex } from "knex";

const MYSQL_CLIENTS = new Set(["mysql", "mysql2"]);

export function getDbClientName(knexDb: Knex): string {
  const client = (knexDb.client.config as any).client;
  return typeof client === "string" ? client : "";
}

export function isMysql(knexDb: Knex): boolean {
  return MYSQL_CLIENTS.has(getDbClientName(knexDb));
}

export function normalizeRawRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) return result[0] as T[];
    return result as T[];
  }
  if (Array.isArray(result?.rows)) return result.rows as T[];
  return [];
}

export async function listUserTables(knexDb: Knex): Promise<Array<{ name: string }>> {
  const rows = await knexDb.raw(`
    SELECT TABLE_NAME AS name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME NOT LIKE 'knex\\_%'
    ORDER BY TABLE_NAME
  `);
  return normalizeRawRows<{ name: string }>(rows);
}

export async function setForeignKeyChecks(knexDb: Knex, enabled: boolean): Promise<void> {
  await knexDb.raw(`SET FOREIGN_KEY_CHECKS = ${enabled ? 1 : 0}`);
}

export async function withForeignKeyChecksDisabled<T>(knexDb: Knex, action: () => Promise<T>): Promise<T> {
  await setForeignKeyChecks(knexDb, false);
  try {
    return await action();
  } finally {
    await setForeignKeyChecks(knexDb, true);
  }
}
