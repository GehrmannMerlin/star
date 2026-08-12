import { describe, it, expect } from "vitest";
import { getTaskSignal, abortTask, resetTaskSignal } from "./task-signal.js";

describe("task-signal 注册表", () => {
  it("getTaskSignal 返回同一任务同一信号；abort 后 throwIfAborted 抛错", () => {
    const s1 = getTaskSignal("t-signal-1");
    const s2 = getTaskSignal("t-signal-1");
    expect(s2).toBe(s1);
    expect(() => s1.throwIfAborted()).not.toThrow();
    abortTask("t-signal-1", "pause");
    expect(s1.aborted).toBe(true);
    expect(() => s1.throwIfAborted()).toThrow();
  });

  it("resetTaskSignal 清掉已 abort 信号，新信号可继续", () => {
    abortTask("t-signal-2", "cancel");
    expect(getTaskSignal("t-signal-2").aborted).toBe(true);
    resetTaskSignal("t-signal-2");
    const fresh = getTaskSignal("t-signal-2");
    expect(fresh.aborted).toBe(false);
    expect(() => fresh.throwIfAborted()).not.toThrow();
  });
});
