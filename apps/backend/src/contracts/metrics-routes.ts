import type { FastifyInstance } from "fastify";
import type { Metrics } from "../workers/metrics.js";

/** 指标 API（P6-D2，规格 §25.2）：GET /api/metrics 返回进程内指标快照。 */
export async function registerMetricsRoutes(app: FastifyInstance, metrics: Metrics): Promise<void> {
  app.get("/api/metrics", async () => metrics.snapshot());
}
