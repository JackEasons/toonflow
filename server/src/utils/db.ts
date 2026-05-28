import "@/env";
import { readFile, writeFile } from "fs/promises";
import knex from "knex";
import type { Knex } from "knex";
import initDB from "@/lib/initDB";
// import fixDB from "@/lib/fixDB";
import type { DB } from "@/types/database";
import crypto from "crypto";
import fixDB from "@/lib/fixDB";
import { isMysql, normalizeRawRows } from "@/utils/dbDialect";

type TableName = keyof DB & string;
type RowType<TName extends TableName> = DB[TName];

type MysqlConnection = {
  host?: string;
  port?: number;
  socketPath?: string;
  user: string;
  password: string;
  database: string;
  charset: string;
  timezone: string;
  supportBigNumbers: boolean;
  bigNumberStrings: boolean;
};

function readEnv(name: string, fallback = ""): string {
  return process.env[name] ?? process.env[name.toLowerCase()] ?? fallback;
}

function readNumber(name: string, fallback: number): number {
  const value = Number.parseInt(readEnv(name), 10);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(name: string, fallback = false): boolean {
  const value = readEnv(name);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function resolveDbClient(): "mysql2" {
  const rawClient = readEnv("DB_CLIENT", readEnv("DATABASE_CLIENT", "mysql2")).toLowerCase();
  if (rawClient === "mysql" || rawClient === "mysql2") return "mysql2";
  throw new Error(`当前服务仅支持 MySQL 数据库客户端: ${rawClient}`);
}

function getMysqlConnection(): MysqlConnection {
  const socketPath = readEnv("MYSQL_SOCKET_PATH", readEnv("DB_SOCKET_PATH"));
  return {
    ...(socketPath
      ? { socketPath }
      : {
          host: readEnv("MYSQL_HOST", readEnv("DB_HOST", "127.0.0.1")),
          port: readNumber("MYSQL_PORT", readNumber("DB_PORT", 3306)),
        }),
    user: readEnv("MYSQL_USER", readEnv("DB_USER", "root")),
    password: readEnv("MYSQL_PASSWORD", readEnv("DB_PASSWORD")),
    database: readEnv("MYSQL_DATABASE", readEnv("MYSQL_DB", readEnv("DB_DATABASE", readEnv("DB_NAME", "dramastudio")))),
    charset: readEnv("MYSQL_CHARSET", "utf8mb4"),
    timezone: readEnv("MYSQL_TIMEZONE", "Z"),
    supportBigNumbers: true,
    bigNumberStrings: false,
  };
}

function createDbConfig(): Knex.Config {
  const client = resolveDbClient();
  const connection = getMysqlConnection();
  const location = connection.socketPath ? `${connection.socketPath}/${connection.database}` : `${connection.host}:${connection.port}/${connection.database}`;
  console.log("数据库:", `mysql://${location}`);
  return {
    client,
    connection,
    pool: {
      min: 0,
      max: readNumber("MYSQL_CONNECTION_LIMIT", readNumber("DB_CONNECTION_LIMIT", 10)),
    },
  };
}

async function ensureMysqlDatabase(config: Knex.Config): Promise<void> {
  const connection = config.connection as MysqlConnection;
  if (!connection?.database) return;

  const { database, ...serverConnection } = connection;
  const serverDb = knex({
    client: "mysql2",
    connection: serverConnection,
    pool: { min: 0, max: 1 },
  });

  try {
    const rows = normalizeRawRows<{ SCHEMA_NAME: string }>(
      await serverDb.raw("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", [database]),
    );
    if (!rows.length) {
      await serverDb.raw("CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [database]);
    }
  } finally {
    await serverDb.destroy();
  }
}

const dbConfig = createDbConfig();
const db = knex(dbConfig);

export const dbReady = (async () => {
  if (isMysql(db) && readBoolean("MYSQL_AUTO_CREATE_DATABASE")) await ensureMysqlDatabase(dbConfig);
  await initDB(db);
  await fixDB(db);
  if (process.env.NODE_ENV == "dev") initKnexType(db);
})().catch((err) => {
  console.error("[数据库初始化失败]", err);
  throw err;
});

const dbClient = Object.assign(<TName extends TableName>(table: TName) => db<RowType<TName>, RowType<TName>[]>(table), db);
dbClient.schema = db.schema;
export default dbClient;

export { db };

async function initKnexType(knexDb: any) {
  const { Client } = await import("@rmp135/sql-ts");
  const outFile = "src/types/database.d.ts";
  const dbClient = Client.fromConfig({
    interfaceNameFormat: "${table}",
    typeMap: {
      number: ["bigint"],
      string: ["text", "varchar", "char"],
    },
  }).fetchDatabase(knexDb);
  const declarations = await dbClient.toTypescript();
  const dbObject = await dbClient.toObject();
  const customHeader = `//该文件由脚本自动生成，请勿手动修改`;
  // 清除上次的注释头
  let declBody = declarations.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
  declBody = declBody.replace(/(\n\s*)\/\*([^*][\s\S]*?)\*\//g, "$1/**$2*/");
  const tableInterfaces = dbObject.schemas.flatMap((schema) => schema.tables.map((table) => table.interfaceName));
  const aggregateTypes = `
export interface DB {
${tableInterfaces.map((name) => `  ${JSON.stringify(name)}: ${name};`).join("\n")}
}
`;
  // 哈希仅基于结构化信息，header和空格不算
  const hashSource = JSON.stringify({
    tableInterfaces,
    declBody,
  });
  const hash = crypto.createHash("md5").update(hashSource).digest("hex");
  // 文件内容
  const content = `// @db-hash ${hash}\n${customHeader}\n\n` + declBody + aggregateTypes;
  let needWrite = true;
  try {
    const current = await readFile(outFile, "utf8");
    // 文件头已存在相同 hash，不需要写
    const match = current.match(/^\/\/\s*@db-hash\s*([a-zA-Z0-9]+)\n/);
    const currentHash = match ? match[1] : null;
    if (currentHash === hash) {
      needWrite = false;
    }
  } catch (err) {
    needWrite = true;
  }
  if (needWrite) await writeFile(outFile, content, "utf8");
}
