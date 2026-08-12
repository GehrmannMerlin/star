/**
 * Trace 上下文（规格 §25.1：每任务根 Trace）。
 * 轻量实现：traceId 贯穿结构化日志（pino），不引入 OpenTelemetry（R-06 无新依赖）。
 * 单进程内按 traceId 过滤日志即可回溯完整任务链路。
 */

/** Trace 上下文（携带到任务执行的各阶段）。 */
export interface TraceContext {
  traceId: string;
}

/** 生成简短唯一 traceId（无需外部依赖）。 */
export function newTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `tr_${ts}_${rand}`;
}
