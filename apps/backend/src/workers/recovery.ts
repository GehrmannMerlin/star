import type { Repositories } from "@stellaris/db";
import type { TaskControlDeps } from "./task-control.js";
import { relaunchPipeline } from "./task-control.js";

/**
 * 崩溃恢复入口（冻结 §18.2/18.3：Worker 异常退出后未完成作业重新可用；幂等不重复写已提交证据）。
 * 扫描 task_run 中处于「运行中」状态且已开始的任务（listRecoverable），
 * 逐个重新拉起对应驱动。institution_snapshot / result_row 的唯一约束保证不重复写入。
 */

export async function recoverInterruptedTasks(deps: TaskControlDeps): Promise<{ recovered: number }> {
  const repos: Repositories = deps.repos;
  try {
    const pending = await repos.taskRun.listRecoverable();
    let recovered = 0;
    for (const task of pending) {
      // 重新拉起驱动（协作式信号重置；result_row/institution_snapshot 幂等 upsert）。
      relaunchPipeline(task.id, task, deps);
      recovered += 1;
    }
    return { recovered };
  } catch (err) {
    // 恢复扫描容错：DB 不可用/未注入时记录并返回 0，不阻断 API 启动（下次启动或显式调用再试）。
    process.stderr.write(`[recovery] 崩溃恢复扫描失败（跳过）: ${err instanceof Error ? err.message : String(err)}\n`);
    return { recovered: 0 };
  }
}
