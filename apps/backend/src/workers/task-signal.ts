/**
 * 每任务协作式取消信号注册表。
 * - 取消/暂停通过 abortTask 触发 AbortSignal；驱动检查点调用 signal.throwIfAborted() 协作中止（冻结 §5.3/5.4）。
 * - resume 时 resetTaskSignal 清掉已 abort 信号，重新拉起驱动可继续。
 * 进程内注册表；崩溃恢复依赖持久 task_run 状态（recovery.ts），不依赖本注册表。
 */

const controllers = new Map<string, AbortController>();

/** 取某任务当前信号；不存在则创建（未触发过取消/暂停）。 */
export function getTaskSignal(taskRunId: string): AbortSignal {
  let c = controllers.get(taskRunId);
  if (!c) {
    c = new AbortController();
    controllers.set(taskRunId, c);
  }
  return c.signal;
}

/** 触发取消/暂停：中止信号，活动驱动在检查点协作中止。 */
export function abortTask(taskRunId: string, reason: "pause" | "cancel"): void {
  const c = controllers.get(taskRunId);
  if (c) {
    c.abort(new Error(`task ${taskRunId} ${reason === "pause" ? "暂停" : "取消"}`));
  } else {
    // 信号尚不存在（任务未启动或已被 reset）→ 创建并立即 abort，保证后续 getTaskSignal 拿到已中止信号。
    const c2 = new AbortController();
    c2.abort(new Error(`task ${taskRunId} ${reason === "pause" ? "暂停" : "取消"}`));
    controllers.set(taskRunId, c2);
  }
}

/** resume / 崩溃恢复时清掉已 abort 信号，新驱动可继续。 */
export function resetTaskSignal(taskRunId: string): void {
  controllers.delete(taskRunId);
}
