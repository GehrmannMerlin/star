# 真实安徽多机构闭环 Canary 执行计划（待用户批准）

> 创建日期：2026-08-08
> 授权依据：R-08/R-09/R-13/R-14（安徽官网只读授权）+ R-20（浏览器升级接入后执行真实闭环 Canary）
> 前置条件（已满足）：浏览器升级已接入驱动、`classifyPage` 判型增强、`makeRequestKey` 机构维度、`regionEntries` 映射 `340000→https://www.ah.gov.cn/`、全量离线测试全绿（114 测试）

## 1. 目标

在真实安徽省政府官网（`https://www.ah.gov.cn/`）跑通**完整多机构闭环**：
机构发现（部门栏目递归）→ 机构清单冻结 → 每机构纵向链路（领导集合页→详情页 HTTP 优先/浏览器升级→硬门槛→Reviewer）→ 每机构两槽位 `result_row` → 单 Sheet Excel。

证明生产真实路径（无 fixtureUrl）下，从真实入口到最终结果的全链路成立，并校准适配器/规则在真实站点上的表现。

## 2. 执行范围与边界（只读，严格遵守 R-08/R-09 授权）

- **仅限** `https://www.ah.gov.cn/` 及其子页（安徽省本级 `340000`）。
- **只读**：不登录、不解验证码、不绕过 WAF/访问控制、不调用写接口、不扫描管理端点。
- **robots**：站点无 robots.txt（R-08 校准），默认允许。
- **礼貌**：单域并发 ≤ 2（初始），遵守 Retry-After；不触发限流。
- **SSRF**：DNS-pinned（`dns-lookup.ts` 拒绝私网/元数据 IP）+ 逐跳重定向复核（既有安全边界）。
- **浏览器**：仅渲染已授权 URL；图片/字体/视频默认阻断（规格 §23.3）；浏览器不直连 PostgreSQL/API。
- **范围上限**：机构数上限（部门栏目 `maxColumns: 6`）、每机构页面数/任务时长预算（既有约束）。

## 3. 执行方式

### 3.1 执行入口

用 `apps/backend` 的驱动直接调用（类似 `multi-institution-driver.test.ts` 但用 **production egress 模式** + 真实适配器）：

```ts
// canary-run.ts（临时脚本，不落库到正式代码；或作为 apps/backend/src/scripts/canary-anhui.ts）
const policy = createSafeEgressPolicy({ mode: "production" });  // 真实网络，DNS-pinned SSRF
const adapter = loadAdapter("anhui-provincial-government");
await runMultiInstitutionPipeline({
  taskRunId,
  repos,
  evidenceStore,
  policy,
  adapter,                    // 真实安徽适配器（memberDetail.render=playwright）
  browserPool: new BrowserPool({ maxPages: 2 }),
  emit,                       // 收集事件
  evidenceRoot,
  regionCode: "340000",
  regionName: "安徽省",
});
```

- 数据库：真实 PostgreSQL（Testcontainers 或本地，与测试一致）。
- 结果写入 `result_row`，可从 DB 直接核对。

### 3.2 执行步骤

1. **只读预检**：确认 `www.ah.gov.cn` DNS 解析为公网 IP、robots 可访问。
2. **机构发现**：`discoverInstitutions`（`regionEntries["340000"]` → 首页）→ 部门栏目递归 → 冻结机构清单。
3. **逐机构纵向链路**：领导集合页（适配器 `leadershipList` `/szf/index.html`，R-13 已验证 9 名成员）→ 详情页 HTTP 优先，JS 动态则浏览器升级 → 硬门槛 → Reviewer。
4. **结果核对**：`result_row` 每机构两槽位；统计非空 URL 数、空 URL 原因分布、Reviewer MATCH/CONFLICT、硬门槛失败 gate。
5. **Excel 导出**：确认单 Sheet 正确生成。
6. **报告**：输出校准结论（哪些 selector/规则需调整），不改变已批准数据合同。

## 4. 预期结果与判据

| 指标 | 成功判据 | 失败/校准点 |
|---|---|---|
| 机构发现 | ≥ 2 机构（部门栏目递归真实命中） | selector 需校准 |
| 领导集合页 | 成员抽取成功（R-13 已验证 9 名） | 适配器 selector |
| 详情页抽取 | 浏览器升级后简历抽取成功 | `classifyPage`/`bioSelector` |
| Reviewer | MATCH 或可解释的 CONFLICT（记录六方面） | Reviewer 六方面 |
| 非空 result_row | ≥ 1 个非空 URL（Reviewer MATCH + 硬门槛过） | 规则/适配器 |
| Excel | 单 Sheet 正确生成 | 导出器 |

**关键说明**：真实 Canary 可能暴露 selector/规则在真实站点的偏差——这正是目的。任何发现如实报告，**不静默修改已批准数据合同**；需改设计的先报告等待决议。

## 5. 边界与停止条件

- 出现 403/429/验证码/登录墙 → 立即停止该路径，标记外部限制，不绕过（规格 §8）。
- 出现 SSRF 告警/异常重定向 → 立即停止整个 Canary。
- 单机构失败不影响其他机构（既有语义）；全部失败则任务 FAILED/空 URL。
- Canary 结果用于校准下一阶段（多行政区真实 Canary），不改变已批准计划的数据合同。

## 6. 需要用户批准的事项

- 对 `https://www.ah.gov.cn/`（安徽省本级 `340000`）执行**只读真实多机构闭环 Canary**，范围限定本计划 §2。
- 许可使用 `BrowserPool` 渲染已授权的领导详情页（R-09 已授权同批 URL 的 Playwright 渲染）。
- Canary 为一次性执行；不授权扩大站点范围、批量抓取或性能压测。

## 7. 修订记录

- 2026-08-08：创建第一版，呈报待用户批准。
