import pg from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "./schema.js";

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** 连接池上限。 */
  max?: number;
  /** 语句超时（毫秒）。 */
  statementTimeoutMs?: number;
}

const { Pool } = pg;

/**
 * 创建 Kysely 数据库客户端。
 * 使用显式 `pg` Pool；业务 SQL 均为显式事务，不留长事务句柄（规格 §16/§17）。
 */
export function createDb(config: DbConfig): Kysely<Database> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: config.max ?? 10,
    statement_timeout: config.statementTimeoutMs ?? 30_000,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

/** 从环境变量读取开发数据库配置（默认 127.0.0.1:5432）。 */
export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    host: env.PGHOST ?? "127.0.0.1",
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER ?? "stellaris",
    password: env.PGPASSWORD ?? "stellaris_dev",
    database: env.PGDATABASE ?? "stellaris",
  };
}
