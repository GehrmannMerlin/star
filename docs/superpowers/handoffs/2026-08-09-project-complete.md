# 项目完成交接文档

> 创建日期：2026-08-09
> 项目：Stellaris 政务简历采集爬虫系统
> 状态：**P1~P6 全部规划模块完成并部署，项目收尾（R-69）**

## 一、项目状态总览

| 阶段 | 内容 | 决议 | 状态 |
|---|---|---|---|
| 模块一~八 | 单机构→多机构→多行政区→控制→浏览器→校准→行政区数据→省本级 | R-05~R-27 | ✅ 完成 |
| P1 | 性能与并发 | R-28~R-30 | ✅ 完成 |
| P2 | Recovery 完整策略链 + 搜索提供器 | R-31~R-33 | ✅ 完成 |
| P3 | Web 完整管理页面 | R-38~R-41 | ✅ 完成并部署 |
| P4 | 全国/多站点真实校准与准确率门槛 | R-42~R-56 | ✅ 完成 |
| P5 | Graphile Worker 持久队列 | R-57~R-61 | ✅ 完成并部署 |
| P6 | 可观测性、安全强化与站点画像学习 | R-62~R-68 | ✅ 完成并部署 |
| 收尾 | §30 验收清单核对 + 文档 | R-69 | ✅ 完成 |

**测试基线**：全量 198 测试通过（typecheck/test/build 8 工作区全绿）

## 二、线上部署现状

- **服务器**：47.238.145.24（/opt/stellaris，compose.yml）
- **域名**：`https://stellaris.ac.cn`
- **服务**：postgres（PG18）/ backend（API + Graphile Worker 一体，`STELLARIS_WORKER=1`）/ web（nginx）
- **镜像**：`stellaris-backend:test`（含 Chromium）/ `stellaris-web:test`
- **线上验证**：安徽省人民政府 → 王清宪/王东伟非空 URL；任务列表/行政区/控制/队列/metrics 均正常

## 三、关键能力清单

1. **采集链路**：任务创建 → 队列投递（Graphile Worker）→ worker 领取 → 驱动执行 → 证据/结果落库 → SSE 推送
2. **范围驱动任务台**：行政区多选/上传名单/展开层级、模式切换、控制按钮、历史回看
3. **机构发现**：声明式适配器 + 栏目递归 + 浏览器升级 + 行政区隔离 + 导航/国家级过滤
4. **准确率**：离线金标评估器（两名自然人/映射/召回/F1，种子样本 100%）
5. **可观测性**：traceId 结构化日志 + metrics 端点 + 爬虫陷阱（压缩炸弹/分页）
6. **安全**：DNS-pinned SSRF、逐跳重定向、robots、politeness 并发闸、429 退避

## 四、§30 验收清单结论（R-69）

**达成（✅）**：行政区选择展开/上传名单/机构定向模式/机构冻结/限速 robots/五类判型/领导结构可追溯/准确率门槛/Recovery/Reviewer 独立事件/空 URL 终态/暂停取消崩溃恢复/SSRF 重定向爬虫陷阱/网页 Excel 同源/Excel 单 Sheet/证据回溯/范围驱动任务台视觉。

**未达（⏳，需真实批量抓取授权）**：
- 30 秒内流式首批显示（未实现流式首批）
- 候选批次 P95 ≤60s 真实站点测量
- 禁止页面真实站点全面验证

## 五、运维事项（R-61/R-66 记录）

- compose.yml 为 root 所有，修改需 `sudo`（已备份 compose.yml.bak-p5）
- SSH known_hosts 因中文用户名路径转义需 `-o StrictHostKeyChecking=no`
- 安徽地市官网对服务器 IP 有 403/WAF 限制（外部限制如实标记，不绕过）；本地网络环境可访问

## 六、待决议 / 下一步

1. **真实批量抓取授权**：验证性能门槛（30s/P95）与全国准确率（需逐站授权）
2. **画像驱动路由学习策略**（P6 进阶项）
3. **Squid 统一出口**（运维基础设施，另行决议）
4. **真实 Brave 搜索提供器**（P2 待授权项）

## 七、权威文档索引

- 开发期决策日志：`docs/superpowers/brainstorming/2026-08-03-crawler-implementation-decision-log.md`（R-01~R-69）
- 进度总账：`docs/superpowers/progress/crawler-development-progress.md`
- 项目状态与规划：`docs/superpowers/progress/crawler-project-status-and-roadmap.md`
- 冻结总设计：`docs/superpowers/specs/2026-07-30-official-biography-crawler-design.md`
- 设计输入/实施计划：`docs/superpowers/brainstorming/` 与 `docs/superpowers/plans/`（各模块）

## 八、边界声明

- `E:\Stellaris` 非 Git 仓库，始终未初始化 Git（所有项目协议遵守）
- 未授权项：其他省/机构适配器扩展、真实反爬突破（WAF/验证码/登录墙禁止绕过）、批量抓取
