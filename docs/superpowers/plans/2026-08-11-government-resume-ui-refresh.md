# 政务简历采集前端 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何业务逻辑、API、状态或数据来源的前提下，将现有任务台和历史记录页高精度重构为用户上传参考图的统一 teal 政务工具视觉。

**Architecture:** 采用 CSS 优先、最小 DOM 包装方案。React 组件只增加布局 class、无障碍装饰图标节点和表格滚动容器；所有事件、state、API、条件渲染和原生控件属性保持不变。四个 Lucide SVG 作为本地静态资源通过 CSS mask 使用，运行时不依赖网络。

**Tech Stack:** React 19.2.8、TypeScript 6.0.3、Vite 8.2.0、Vitest 4.1.10、React Testing Library、原生 CSS、Lucide SVG。

## Global Constraints

- 只允许 UI 修改；不得修改 API URL、请求参数、响应解析、业务 state、handlers、stores、路由语义或后端代码。
- 保留所有现有 `value`、`checked`、`onChange`、`onClick`、`onSubmit`、`required`、`disabled`、表格数据源和条件渲染。
- 不得把参考图中的日期、时间、状态、数字或任务记录写入生产代码。
- 不新增 mock、demo、fixture、sample、fake、seed 或 fallback 业务数据。
- 不增加搜索、刷新、导出、删除、详情按钮、统计卡片、新筛选项或新导航。
- 保留现有历史分页并设计为低强调控件。
- 不引入 UI 框架、图标依赖、路由库、状态库或其他 npm 依赖。
- 图标只能引用 `apps/web/src/assets/icons/` 中的本地 SVG，页面运行时不得请求远程图标。
- 当前目录不是 Git 仓库；所有“提交”步骤改为记录文件清单和校验散列，不执行 `git commit`。

---

## 文件结构映射

### 新建文件

- `apps/web/src/assets/icons/file-user.svg`：品牌图标。
- `apps/web/src/assets/icons/layout-grid.svg`：任务台导航图标。
- `apps/web/src/assets/icons/clock.svg`：历史记录导航图标。
- `apps/web/src/assets/icons/circle-play.svg`：开始采集按钮图标。
- `apps/web/src/assets/icons/LICENSE`：Lucide 许可证副本。
- `apps/web/src/components/TaskHistory.test.tsx`：锁定历史筛选、真实数据渲染、分页和新增纯 UI wrapper。

### 修改文件

- `apps/web/src/app.tsx`：共享 Header 装饰节点、Header 内层、页面视觉 class；不改导航和任务逻辑。
- `apps/web/src/components/TaskForm.tsx`：增加任务台布局 wrapper、定向模式 Card、按钮图标；不改表单绑定。
- `apps/web/src/components/RegionPicker.tsx`：增加纯视觉结构 class；不改行政区逻辑。
- `apps/web/src/components/TaskHistory.tsx`：增加 table Card/scroll wrapper；不改加载、筛选、map、行点击和分页。
- `apps/web/src/app.css`：建立 Token 并重写两个页面及共享组件视觉。
- `apps/web/src/app.test.tsx`：锁定导航 active、Header 图标和开始按钮装饰结构。

### 明确不修改

- `apps/web/src/main.tsx`。
- `apps/backend/**`。
- `packages/**`。
- 所有 API、数据库、采集和任务控制实现。

---

### Task 1: 写 UI 结构保护测试并确认先失败

**Files:**
- Modify: `apps/web/src/app.test.tsx`
- Create: `apps/web/src/components/TaskHistory.test.tsx`

**Interfaces:**
- Consumes: 现有 `App`, `TaskHistory`, `ApiClient`。
- Produces: 对纯 UI class、装饰图标和既有业务交互的回归保护。

- [ ] **Step 1: 为共享 Header 与任务台写失败测试**

在 `app.test.tsx` 增加测试，验证：

```tsx
it("共享 Header 使用本地图标结构并保持导航 active 切换", async () => {
  render(<App deps={deps} />);

  const workspace = screen.getByRole("button", { name: "任务台" });
  const history = screen.getByRole("button", { name: "历史记录" });
  expect(workspace).toHaveClass("nav-active");
  expect(workspace.querySelector(".icon-task")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("政务简历采集").closest("header")?.querySelector(".app-mark"))
    .toHaveAttribute("aria-hidden", "true");

  await user.click(history);
  expect(history).toHaveClass("nav-active");
  expect(workspace).not.toHaveClass("nav-active");
});

it("开始采集按钮保留 submit 和 disabled 语义并带装饰图标", () => {
  render(<App deps={deps} />);
  const submit = screen.getByRole("button", { name: "开始采集" });
  expect(submit).toHaveAttribute("type", "submit");
  expect(submit).toBeDisabled();
  expect(submit.querySelector(".icon-play")).toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: 为历史记录写失败测试**

新建 `TaskHistory.test.tsx`，使用测试内 mock API，验证筛选参数、真实返回任务渲染、wrapper 和分页。测试数据只存在测试文件：

```tsx
it("使用 API 返回任务渲染 table card 并保持筛选逻辑", async () => {
  const api = makeApi({
    listTasks: vi.fn(async () => ({ tasks: [taskSummary], total: 1 })),
  });
  render(<TaskHistory api={api} onOpen={vi.fn()} />);

  expect(await screen.findByText(taskSummary.statusZh)).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "任务列表" }).closest(".table-scroll"))
    .toBeInTheDocument();
  expect(screen.getByRole("table", { name: "任务列表" }).closest(".history-table-card"))
    .toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("状态筛选"), "COMPLETED");
  await waitFor(() => expect(api.listTasks).toHaveBeenLastCalledWith({
    limit: 20,
    offset: 0,
    status: "COMPLETED",
  }));
});
```

- [ ] **Step 3: 运行测试确认失败原因只来自新 UI 结构**

Run:

```powershell
pnpm --filter @stellaris/web test
```

Expected: 新测试因 `.app-mark`、`.icon-task`、`.icon-play`、`.history-table-card` 或 `.table-scroll` 尚不存在而失败；既有业务测试继续通过。

---

### Task 2: 下载并验证 Lucide 本地图标

**Files:**
- Create: `apps/web/src/assets/icons/file-user.svg`
- Create: `apps/web/src/assets/icons/layout-grid.svg`
- Create: `apps/web/src/assets/icons/clock.svg`
- Create: `apps/web/src/assets/icons/circle-play.svg`
- Create: `apps/web/src/assets/icons/LICENSE`

**Interfaces:**
- Produces: CSS mask 可使用的本地 24×24 SVG 文件。

- [ ] **Step 1: 从 Lucide 官方仓库下载固定文件**

使用 PowerShell `Invoke-WebRequest` 从 `raw.githubusercontent.com/lucide-icons/lucide/main/icons/` 下载四个 SVG，并从 Lucide 官方仓库下载 `LICENSE`。下载目标必须是上面列出的五个显式路径，不使用通配符或远程运行时 URL。

- [ ] **Step 2: 验证 SVG 与许可证**

Run:

```powershell
Get-ChildItem -LiteralPath 'apps/web/src/assets/icons' -File
Select-String -Path 'apps/web/src/assets/icons/*.svg' -Pattern '<svg','viewBox="0 0 24 24"'
Get-FileHash -Algorithm SHA256 -LiteralPath 'apps/web/src/assets/icons/file-user.svg','apps/web/src/assets/icons/layout-grid.svg','apps/web/src/assets/icons/clock.svg','apps/web/src/assets/icons/circle-play.svg'
```

Expected: 四个 SVG 均存在、包含 SVG 根元素及 24×24 viewBox，并输出各自 SHA-256。

---

### Task 3: 实现共享 Header 与页面 Shell

**Files:**
- Modify: `apps/web/src/app.tsx`

**Interfaces:**
- Consumes: 现有 `view`, `navigate`, `WorkspaceView`, `TaskHistory`, `DetailView`。
- Produces: `.app-header-inner`、`.brand-lockup`、`.app-mark`、本地 mask icon class，以及页面宽度修饰 class。

- [ ] **Step 1: 只增加 Header 视觉包装**

将 Header 内容包进 `.app-header-inner`，保持两个按钮的 `type`、active class 和 `onClick` 原样：

```tsx
<header className="app-header">
  <div className="app-header-inner">
    <div className="brand-lockup">
      <span className="app-mark" aria-hidden="true" />
      <span className="brand">政务简历采集</span>
      <span className="runtime-status">本机运行</span>
    </div>
    <nav className="app-nav" aria-label="主要导航">
      <button ...>
        <span className="ui-icon icon-task" aria-hidden="true" />
        任务台
      </button>
      <button ...>
        <span className="ui-icon icon-history" aria-hidden="true" />
        历史记录
      </button>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: 为主区域增加纯视觉页面 class**

```tsx
<main className={`app-main app-main--${view.name}`}>
```

该 class 仅用于 CSS 宽度和背景，不改变条件渲染。

- [ ] **Step 3: 运行相关测试**

Run: `pnpm --filter @stellaris/web test -- app.test.tsx`

Expected: Header 新结构测试通过；其余新结构测试仍按实现顺序失败。

---

### Task 4: 实现任务台纯视觉结构

**Files:**
- Modify: `apps/web/src/components/TaskForm.tsx`
- Modify: `apps/web/src/components/RegionPicker.tsx`

**Interfaces:**
- Consumes: 全部现有 state、handlers、props、原生表单属性。
- Produces: `.task-form__content`、`.targeted-card`、`.targeted-fields`、`.start-action`、`.icon-play` 及 RegionPicker 布局 class。

- [ ] **Step 1: 包装任务台内容但保留 form 绑定**

保持 `<form className="task-form" onSubmit={handleSubmit}>` 不变，在内部增加 `.task-form__content`；模式 radio 仍使用原 `name`、`checked` 和 `onChange`。

- [ ] **Step 2: 将指定机构字段放入视觉 Card**

只在 TARGETED 分支增加：

```tsx
<fieldset className="targeted-card" aria-label="指定机构信息">
  <legend>指定机构</legend>
  <div className="targeted-fields">
    {/* 原四个 label/input 原样移动到此 */}
  </div>
</fieldset>
```

不得修改四个 input 的 value、onChange、required、type 或 placeholder。

- [ ] **Step 3: 给开始采集按钮增加装饰图标包装**

保持现有 disabled 表达式逐字不变：

```tsx
<button
  type="submit"
  className="primary start-action"
  disabled={disabled || (mode === "FULL_INSTITUTION" && regionSelection.codes.length === 0)}
>
  <span className="ui-icon icon-play" aria-hidden="true" />
  开始采集
</button>
```

- [ ] **Step 4: 为 RegionPicker 添加纯视觉 class**

给三个 `.rp-block` 分别追加 `rp-block--selectors`、`rp-block--upload`、`rp-block--levels`；不改变任何内部控件和 handler。

- [ ] **Step 5: 运行表单与行政区测试**

Run:

```powershell
pnpm --filter @stellaris/web test -- app.test.tsx RegionPicker.test.tsx
```

Expected: 全部通过，包括原行政区加载、校验、展开层级和提交 payload 测试。

---

### Task 5: 实现历史记录 Card 与滚动结构

**Files:**
- Modify: `apps/web/src/components/TaskHistory.tsx`

**Interfaces:**
- Consumes: 现有 `tasks`, `loading`, `error`, `load`, `onOpen`, `page`, `pageCount`。
- Produces: `.history-table-card` 和 `.table-scroll`。

- [ ] **Step 1: 只包装现有 table**

将原表格放进：

```tsx
<div className="history-table-card">
  <div className="table-scroll">
    <table className="results-table" aria-label="任务列表">
      {/* 原 thead、tasks.map、onClick 全部保持 */}
    </table>
  </div>
</div>
```

分页仍保留在 Card 后方，所有 disabled 和 load 参数保持不变。

- [ ] **Step 2: 运行历史记录测试**

Run:

```powershell
pnpm --filter @stellaris/web test -- TaskHistory.test.tsx app.test.tsx
```

Expected: wrapper、筛选、真实 API 返回渲染、导航和现有视图切换测试全部通过。

---

### Task 6: 建立视觉 Token 并高精度还原两页

**Files:**
- Modify: `apps/web/src/app.css`

**Interfaces:**
- Consumes: Tasks 2–5 建立的 class 和本地 SVG。
- Produces: 共享 Header、背景、任务台、历史页、响应式和既有详情区完整样式。

- [ ] **Step 1: 建立 Token 与基础层**

使用以下核心变量：

```css
:root {
  --color-primary: #159c91;
  --color-primary-hover: #128a81;
  --color-primary-soft: #eaf8f6;
  --color-bg-page: #f8fbfa;
  --color-bg-card: #ffffff;
  --color-text-primary: #172321;
  --color-text-body: #263533;
  --color-text-secondary: #7e8a88;
  --color-text-placeholder: #9aa5a3;
  --color-border: #dde8e6;
  --radius-control: 8px;
  --radius-card: 12px;
  --shadow-card: 0 8px 24px rgba(27, 79, 72, 0.07);
  --shadow-header: 0 3px 12px rgba(24, 74, 68, 0.06);
}
```

设置 `html`、`body`、`#root`、`.app` 的最小高度及页面背景，保留系统字体并增加中文字体 fallback。

- [ ] **Step 2: 实现 Header 和本地图标 mask**

Header 高 84px，内部最大宽度约 1680px；按钮高 48px。图标 mask 必须只引用本地相对路径：

```css
.icon-task { --icon-mask: url("./assets/icons/layout-grid.svg"); }
.icon-history { --icon-mask: url("./assets/icons/clock.svg"); }
.icon-play { --icon-mask: url("./assets/icons/circle-play.svg"); }
.app-mark::before { mask-image: url("./assets/icons/file-user.svg"); }
```

- [ ] **Step 3: 实现页面背景装饰**

用 `.app-main::before` 和 `.app-main::after` 实现左上、右下低透明度薄荷曲线；设置 `pointer-events: none`，内容层使用 `position: relative; z-index: 1`。

- [ ] **Step 4: 实现任务台**

关键目标：

- `.app-main--workspace` 内部内容最大宽 1120px。
- `.task-form__content` 宽约 640px，左侧在大屏上距容器约 160px。
- `.tf-mode` 高度和间距接近参考图。
- radio 使用 `accent-color: var(--color-primary)`，保留原生可访问性。
- `.region-picker` / `.targeted-card` 白底、12px 圆角、约 28px padding 和轻阴影。
- select/input 高 50px；textarea 高约 104px。
- `.rp-block--levels` 使用浅色 `border-top`。
- `.start-action` 高 52px，居中，teal 主按钮。

- [ ] **Step 5: 实现历史记录**

关键目标：

- `.app-main--history` 内容最大宽 1320px。
- 标题 21px、筛选器 160×46px。
- `.history-table-card` 白底、12px 圆角、约 10px padding、浅边框和轻阴影。
- 任务列表表头 mint 背景、高约 44px。
- 行高约 50px、浅分隔线、极浅 teal hover。
- table 最小宽度避免列挤压；`.table-scroll { overflow-x: auto; }`。
- 分页保持可见但低强调。

- [ ] **Step 6: 兼容任务详情和窄屏**

保留 `.task-detail`、`.results-table`、`.evidence-drawer`、`.task-controls`、`.activity-line`、`.back-link` 等既有功能样式。添加 900px 和 640px 响应式规则，使 Header、筛选器、selectors 和 targeted fields 自然换行。

- [ ] **Step 7: 运行 Web 测试、类型检查和构建**

Run:

```powershell
pnpm --filter @stellaris/web test
pnpm --filter @stellaris/web typecheck
pnpm --filter @stellaris/web build
```

Expected: 全部 PASS，Vite 构建产物中包含本地图标资源。

---

### Task 7: 视觉验证、业务回归与全项目终验

**Files:**
- Verify only; no planned production changes unless verification exposes a defect.

- [ ] **Step 1: 启动本地 Web 并生成桌面截图**

在不改 API 的前提下运行当前 Vite 前端，使用项目已有浏览器能力在 1920×1080、1440×900、1366×768 检查任务台和历史页。历史接口为空时验证现有空态，不创建演示记录。

- [ ] **Step 2: 对照视觉验收清单**

逐项核对 Header 高度、Logo、标题、本机运行、导航 active、任务台 Card、控件高度、留白、历史标题、筛选器、表格 Card、表头、行高、hover、圆角、阴影和两页一致性。

- [ ] **Step 3: 执行业务回归**

验证：导航切换、两个模式、行政区 selector、textarea、校验按钮、层级 radio、开始采集 disabled/loading、历史加载、两个筛选器、表格、空态、行点击和分页均保持原行为。

- [ ] **Step 4: 扫描演示数据和远程资源**

Run:

```powershell
Get-ChildItem -LiteralPath 'apps/web/src' -Recurse -File |
  Select-String -Pattern '2026/8/11|10:59|11:05|16:56|mockData|demoTasks|fixture|sampleRecords|fake|https?://.*\.svg'
Get-ChildItem -LiteralPath 'apps/web/src/assets/icons' -File
```

Expected: 生产代码不含截图演示记录或远程 SVG；命中的既有测试 mock 应单独标记为既有测试数据，不算生产数据。

- [ ] **Step 5: 执行根项目命令并记录实际结果**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

分别记录 PASS、FAIL 或脚本不存在。不得删除测试、使用 `--passWithNoTests` 或隐瞒已有失败。

- [ ] **Step 6: 汇总最终文件与风险**

列出所有修改文件、每页 UI 说明、Lucide 来源和目录、业务保护声明、演示数据检查、四项验证结果及无法完全复刻的原生多选/现有分页/定向字段差异。

---

## 自审记录

1. 规格覆盖：共享 Header、背景、任务台、历史页、图标本地化、响应式、业务冻结、演示数据扫描和四项根命令全部有对应任务。
2. 占位符扫描：计划不包含 TBD、TODO 或“稍后实现”等占位步骤。
3. 接口一致性：所有新增 class 在测试、JSX 和 CSS 任务中名称一致。
4. 数据保护：生产改动不新增任何任务数组、日期、状态或计数；历史页继续使用 `tasks.map()`。
5. 业务保护：计划没有修改 `main.tsx`、API、后端、合同、stores 或 handlers。
6. 依赖保护：计划不安装任何依赖；Lucide 以四个本地 SVG 和许可证文件交付。
7. 环境限制：项目不是 Git 仓库，无法执行提交步骤；以测试输出和 SHA-256 作为可核验记录。
