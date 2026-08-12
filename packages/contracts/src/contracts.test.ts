import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { HEALTH_SERVICE_NAME, HEALTH_VERSION } from "./health.js";
import { TaskRunStatusZh, PageTypeZh } from "./enums.js";
import { CreateTaskRequest, CreateTaskResponse, TaskDetail } from "./task.js";
import { ResultRowView, EvidenceSummary } from "./result.js";
import { ExportStatus } from "./export-status.js";
import { SseEvent } from "./sse.js";

describe("contracts baseline", () => {
  it("health 常量存在且为字符串", () => {
    expect(typeof HEALTH_SERVICE_NAME).toBe("string");
    expect(typeof HEALTH_VERSION).toBe("string");
  });
  it("12 项任务状态都有中文映射", () => {
    expect(Object.keys(TaskRunStatusZh)).toHaveLength(12);
    expect(TaskRunStatusZh.COMPLETED).toBe("已完成");
  });
  it("五类页面都有中文映射", () => {
    expect(Object.keys(PageTypeZh)).toHaveLength(5);
    expect(PageTypeZh.OFFICIAL_BIOGRAPHY).toBe("个人简介页");
  });
});

describe("contracts 边界合同", () => {
  it("CreateTaskRequest 拒绝缺 regionCode 的负载", () => {
    const bad = {
      clientIdempotencyKey: "key-12345678",
      regionName: "北京市",
      institutionName: "某某区人民政府",
      institutionType: "government",
      ruleVersion: "v1",
    };
    expect(Value.Check(CreateTaskRequest, bad)).toBe(false);
  });
  it("CreateTaskRequest 接受合法负载（TARGETED 默认）", () => {
    const good = {
      clientIdempotencyKey: "key-12345678",
      regionCode: "110000",
      regionName: "北京市",
      institutionName: "某某区人民政府",
      institutionType: "government",
      ruleVersion: "v1",
    };
    expect(Value.Check(CreateTaskRequest, good)).toBe(true);
  });
  it("CreateTaskRequest 接受 FULL_INSTITUTION 负载（无需 institutionName）", () => {
    const good = {
      clientIdempotencyKey: "key-12345678",
      mode: "FULL_INSTITUTION",
      regionCode: "340000",
      regionName: "安徽省",
      ruleVersion: "v1",
    };
    expect(Value.Check(CreateTaskRequest, good)).toBe(true);
  });
  it("CreateTaskResponse 判别 idempotencyResult", () => {
    const task = {
      id: "t1",
      status: "PENDING",
      statusZh: "待开始",
      mode: "TARGETED",
      expandLevel: "COUNTY",
      ruleVersion: "v1",
      totalInstitutions: 1,
      processedInstitutions: 0,
      reviewedSlots: 0,
      recoveryCount: 0,
      blockedCount: 0,
      requestedAt: new Date().toISOString(),
      controlable: true,
    };
    expect(Value.Check(CreateTaskResponse, { task, idempotencyResult: "created" })).toBe(true);
    expect(Value.Check(CreateTaskResponse, { task, idempotencyResult: "replayed" })).toBe(true);
  });
  it("ResultRowView 允许空 positionUrl", () => {
    const row = {
      id: "r1",
      taskRunId: "t1",
      institutionSnapshotId: "i1",
      slot: "PRIMARY_1",
      regionCode: "110000",
      institutionName: "某某区人民政府",
      positionDisplay: "某某区人民政府 区长",
      currentStatusZh: "正式在任",
      resultZh: "完整搜索后无合格URL",
      collectedAt: new Date().toISOString(),
    };
    expect(Value.Check(ResultRowView, row)).toBe(true);
  });
  it("SseEvent 判别联合按 type 区分", () => {
    const ev = {
      type: "result.upserted",
      taskRunId: "t1",
      result: {
        id: "r1",
        taskRunId: "t1",
        institutionSnapshotId: "i1",
        slot: "PRIMARY_1",
        regionCode: "110000",
        institutionName: "某某区人民政府",
        positionDisplay: "某某区人民政府 区长",
        currentStatusZh: "正式在任",
        resultZh: "已找到并复核",
        collectedAt: new Date().toISOString(),
      },
      seq: 1,
    };
    expect(Value.Check(SseEvent, ev)).toBe(true);
    expect(Value.Check(SseEvent, { ...ev, type: "no.such" })).toBe(false);
  });
});
