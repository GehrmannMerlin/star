# P4「全国/多站点真实校准与准确率门槛」模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 推进「多行政区真实校准 + 准确率门槛量化」。分两部分：
- **A（离线，无需授权）**：D1 安徽 16 地市真实入口映射（`regionEntries` 扩展）；D3 离线金标准确率测量基础设施（precision/recall/F1 + §26.2 门槛）；D4 金标 fixture 扩展（`golden.json` 已知答案 + 安徽种子样本）。
- **B（真实 Canary，待 D2 逐站授权）**：安徽 16 地市只读校准，验证多行政区真实采集链路并回填金标。

**Architecture:** 延续模块化单体。D1 纯数据扩展（安徽适配器 `regionEntries`）；D3 新增 `packages/rules/src/evaluate.ts` 纯函数评估器（不依赖 DB/网络，可单测）；D4 新增 `packages/crawler/src/golden/golden.json` 声明已知答案。B 部分复用 `runMultiRegionPipeline` + `canary-anhui` 模式（真实 egress + SSRF + BrowserPool）。

**Tech Stack:** 复用全栈（TypeScript 6.0.3 / Node 24.18 / Vitest 4.1 / PostgreSQL 18）；无新依赖（R-06）。

## Global Constraints

- 本模块不改变已批准数据合同与证据链；`regionEntries` 为适配器数据扩展（§8.1 行政区→入口映射）。
- 准确率评估为**离线金标测量**：输入金标答案 + 系统输出，不触网、不依赖真实站点规模。
- 真实抓取（B 部分）仅限安徽 16 地市（D2 逐站授权）：只读、礼貌并发 ≤2、DNS-pinned SSRF、robots、不绕过访问控制；与 R-08/R-21 边界一致。
- 地市无领导信息页 → 如实「该机构无领导信息」（沿用 R-23 方向 2），不强行适配。
- 生产行为必须有先失败测试；禁止 `--passWithNoTests`。
- 无新依赖；不改驱动核心语义；P1 politeness/缓存/画像复用。

---

## 文件结构映射

### 新建文件

| 文件 | 单一责任 |
|---|---|
| `packages/crawler/src/golden/golden.json` | 金标已知答案（机构→两名主要自然人→URL） |
| `packages/rules/src/evaluate.ts` | 准确率评估器（precision/recall/F1 + 两名自然人 + 映射） |
| `packages/rules/src/evaluate.test.ts` | 评估器单元测试 |
| `apps/backend/src/scripts/canary-anhui-regions.ts` | 安徽 16 地市只读校准 Canary 脚本（B 部分，D2 授权后执行） |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `config/site-adapters/anhui-provincial-government.json` | `regionEntries` 扩展 16 地市（D1） |
| `packages/rules/src/index.ts` | 导出 evaluate |

### 复用（不修改）

- `runMultiRegionPipeline` / `runMultiInstitutionPipeline`（多行政区链路）；
- `canary-anhui.ts` 模式（production egress + SSRF + BrowserPool）；
- `selectTwoPrimary` / `assembleLeadership`（选人输出）；
- `mapResultRowToView`（result_row 投影）。

---

### Task 1（A·D1）: 安徽 16 地市真实入口映射

**Files:**
- Modify: `config/site-adapters/anhui-provincial-government.json`

**内容:**
- `regionEntries` 由 `{ "340000": "https://www.ah.gov.cn/" }` 扩展为 16 地市：
  ```json
  "regionEntries": {
    "340000": "https://www.ah.gov.cn/",
    "340100": "https://www.hefei.gov.cn/",
    "340200": "https://www.wuhu.gov.cn/",
    "340300": "https://www.bengbu.gov.cn/",
    "340400": "https://www.huainan.gov.cn/",
    "340500": "https://www.mas.gov.cn/",
    "340600": "https://www.huaibei.gov.cn/",
    "340700": "https://www.tongling.gov.cn/",
    "340800": "https://www.anqing.gov.cn/",
    "341000": "https://www.huangshan.gov.cn/",
    "341100": "https://www.chuzhou.gov.cn/",
    "341200": "https://www.fy.gov.cn/",
    "341300": "https://www.ahsz.gov.cn/",
    "341500": "https://www.luan.gov.cn/",
    "341600": "https://www.bozhou.gov.cn/",
    "341700": "https://www.chizhou.gov.cn/",
    "341800": "https://www.xuancheng.gov.cn/"
  }
  ```
  （16 地市代码来自 contracts 数据；域名经 DNS 核验解析成功。若个别域名实际不可达，在校准中记录并剔除。）

- [ ] **Step 1: 写失败测试**
`config` 验证测试：regionEntries 覆盖 340000 + 全部 16 地市；每个 URL 为合法 http(s) URL。
Expected: FAIL（regionEntries 未扩展）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`（app.test.ts 的适配器加载断言 + loadAdapter 验证）
- [ ] **Step 6: 独立验证检查点**
用 `loadAdapter` 断言 `regionEntries` 含 16 地市。

---

### Task 2（A·D4）: 金标 golden.json + 种子样本

**Files:**
- Create: `packages/crawler/src/golden/golden.json`

**内容:**
```json
{
  "version": "1",
  "regions": {
    "340000": {
      "institutions": [
        {
          "officialName": "安徽省人民政府",
          "entryUrl": "https://www.ah.gov.cn/szf/index.html",
          "primary": [
            { "personName": "王清宪", "url": "https://www.ah.gov.cn/content/column/6784021?liId=711" },
            { "personName": "王东伟", "url": "https://www.ah.gov.cn/content/column/6784021?liId=1201" }
          ]
        }
      ]
    }
  }
}
```
- 种子基于 R-21/R-27/R-37 已在线验证结果（安徽省人民政府两名领导非空 URL）；
- 结构预留多地区多机构扩展。

- [ ] **Step 1: 写失败测试**
`golden.json` 结构校验测试（读取 + JSON 校验 + 字段完整）。
Expected: FAIL（文件不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/crawler test`
- [ ] **Step 6: 独立验证检查点**

---

### Task 3（A·D3）: 离线金标准确率评估器

**Files:**
- Create: `packages/rules/src/evaluate.ts`
- Create: `packages/rules/src/evaluate.test.ts`
- Modify: `packages/rules/src/index.ts`

**Interfaces:**
```ts
// evaluate.ts
export interface GoldenPrimary {
  personName: string;
  url: string | null;
}
export interface GoldenInstitution {
  officialName: string;
  entryUrl: string;
  primary: GoldenPrimary[];
}
export interface EvaluatedRow {
  institutionName: string;
  slot: "PRIMARY_1" | "PRIMARY_2";
  predictedName: string | null;
  goldenName: string | null;
  predictedUrl: string | null;
  goldenUrl: string | null;
}
export interface AccuracyReport {
  /** 两名主要自然人选择准确率（人名命中/总数）。 */
  twoPrimaryAccuracy: number;
  /** 人员—机构—岗位映射准确率（人+机构+岗位全命中/总数）。 */
  mappingAccuracy: number;
  /** 已知合格 URL 召回率。 */
  recall: number;
  /** precision / F1。 */
  precision: number;
  f1: number;
  rows: EvaluatedRow[];
}
export function evaluateAccuracy(
  golden: { regions: Record<string, { institutions: GoldenInstitution[] }> },
  predicted: Array<{ institutionName: string; slot: string; personName: string | null; positionUrl: string | null }>,
): AccuracyReport;
// 语义：按 institutionName + slot 配对金标与预测；人名相等 + URL 相等为命中。
// 两名自然人准确率 = 命中人名槽位 / 总槽位；映射准确率 = 人+URL 全命中 / 总数。
// recall = 命中金标 URL / 金标 URL 总数；precision = 命中 / 预测非空数；F1 = 调和均值。
```

- [ ] **Step 1: 写失败测试**
evaluate.test.ts：给定金标 2 机构 × 2 槽位 + 预测部分命中 → 断言 twoPrimaryAccuracy / mappingAccuracy / recall / precision / f1。
Expected: FAIL（模块不存在）。

- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/rules test`
- [ ] **Step 6: 独立验证检查点**
用 golden.json + 安徽已知 result_row 跑评估，输出 ≥95% 两名自然人准确率。

---

### Task 4（A）: 全量终验（离线部分）

- [ ] **Step 1: 全量验证**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 全部 PASS。
- [ ] **Step 2: 独立验证检查点**
运行评估器对 golden.json + 安徽省级已知结果，确认两名自然人准确率 ≥95%（§26.2）。
- [ ] **Step 3: 合同一致性自查**
  - `evaluateAccuracy` 从 rules index 导出；
  - `regionEntries` 覆盖 340000 + 16 地市；
  - 无 `--passWithNoTests`；无新依赖。

---

### Task 5（B·D2，待逐站授权）: 安徽 16 地市只读校准 Canary

**Files:**
- Create: `apps/backend/src/scripts/canary-anhui-regions.ts`

**内容:**
- 仿 `canary-anhui.ts`：production egress + 真实安徽适配器 + BrowserPool；
- 对 16 地市依次跑 `runMultiRegionPipeline`（regionCode 列表 = 16 地市）；
- 只读边界：每站初始并发 ≤2、DNS-pinned SSRF、robots、不绕过访问控制；
- 输出：每地市机构数 / 领导信息有无 / 两名自然人是否命中 / 无领导页如实标记。

- [ ] **Step 1: 写失败测试**
脚本结构测试（参数校验 + 边界断言）——Canary 本体为手动执行脚本，自动化测试覆盖参数解析与地市列表完整性。
- [ ] **Step 2: 运行确认先失败**
- [ ] **Step 3: 最小实现**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 相关全量验证**
Run: `pnpm --filter @stellaris/backend test`
- [ ] **Step 6: 独立验证检查点**
（真实执行需 D2 授权 + 真实网络；本步标记「待 D2 授权后执行」，不在此任务内发起真实请求。）

---

## 自审记录

1. **规格覆盖**：设计输入 D1-D5 全部映射（regionEntries→T1、金标→T2、评估器→T3、终验→T4、Canary→T5）；冻结 §8.1/§26.2/§27.1/§30 覆盖。
2. **占位符扫描**：无 TBD/TODO；关键接口含实际签名。
3. **接口一致性**：`evaluateAccuracy`/`GoldenInstitution` 跨任务一致；复用 `loadAdapter`/`runMultiRegionPipeline`/`selectTwoPrimary`。
4. **依赖顺序**：映射→金标→评估器→终验→Canary。
5. **先失败测试**：每任务含"写失败→确认失败→最小实现→通过→全量验证→独立检查点"。
6. **无越权动作**：T1-T4 纯离线无网络；T5 Canary 仅脚本骨架，真实请求待 D2 授权。
7. **风险**：部分地市官网可能无领导信息页（如实标记）；个别域名可能实际不可达（校准中剔除）；评估器语义需与金标字段对齐。

### 设计输入 → 计划任务映射

| 设计输入章节 | 计划任务 |
|---|---|
| D1 地市入口映射 | Task 1 |
| D4 金标 fixture 扩展 | Task 2 |
| D3 准确率评估器 | Task 3 |
| D5 边界 + 终验 | Task 4 |
| D2 地市真实 Canary（待授权） | Task 5 |
