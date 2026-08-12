import { GenericContainer, Wait, type StartedTestContainer, type StartedNetwork } from "testcontainers";
import pg from "pg";

export interface StartedPostgres {
  container: StartedTestContainer;
  host: string;
  port: number;
  /** Kysely/pg 连接配置。 */
  config: { host: string; port: number; user: string; password: string; database: string };
  stop(): Promise<void>;
}

/**
 * 启动一个真实 PostgreSQL 18 容器（Testcontainers）。
 *
 * postgres:18 官方镜像没有内置 HEALTHCHECK，且 entrypoint 初始化会先后
 * 打印两次 "database system is ready to accept connections"（临时 init 服务器
 * 先就绪再关闭）。因此不能用 Wait.forLogMessage / Wait.forHealthCheck，
 * 改为以「SELECT 1 成功」作为就绪信号（等待真实服务器接受连接）。
 */
export async function startPostgres(opts: {
  password?: string;
  network?: StartedNetwork;
} = {}): Promise<StartedPostgres> {
  const password = opts.password ?? "stellaris_dev";
  const container = await new GenericContainer("postgres:18")
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_USER: "stellaris",
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: "stellaris",
    })
    .withWaitStrategy(Wait.forSuccessfulCommand("pg_isready -U stellaris -d stellaris"))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const config = { host, port, user: "stellaris", password, database: "stellaris" };

  // 二次确认：等待 SELECT 1 真正成功（绕过容器已起但 PG 尚未接受连接的竞态）。
  // 每轮新建一个独立池，成功查询后 end 一次；避免在同一池上重复 end。
  for (let attempt = 0; attempt < 30; attempt++) {
    const pool = new pg.Pool({ ...config, connectionTimeoutMillis: 10_000, max: 1 });
    try {
      await pool.query("SELECT 1");
      await pool.end();
      break;
    } catch {
      await pool.end();
      await new Promise((r) => setTimeout(r, 1000));
      if (attempt === 29) {
        await container.stop();
        throw new Error("PostgreSQL 容器就绪超时（SELECT 1 未成功）");
      }
    }
  }

  return {
    container,
    host,
    port,
    config,
    stop: async () => {
      await container.stop();
    },
  };
}
