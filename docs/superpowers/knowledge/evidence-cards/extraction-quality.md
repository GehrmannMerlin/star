# 解析与数据质量证据卡（共享证据层）

> 本文件是共享可追溯证据层中与解析与数据质量诊断相关的证据卡集合。每张卡表达一条可验证知识声明，绑定固定版本资料、原始位置与适用边界。
>
> 来源：批次 3 固定源码快照，全部以 `third-party/crawler-knowledge-sources/manifest.md` 记录的 ref 与 Commit 为唯一版本基线。
>
> 证据等级：规范证据（官方规范/文档/Release）＞实现证据（同版本官方源码/测试）＞工程证据（官方运行指南/手册）＞案例证据（事故资料，只用于启发）。
>
> 维护规则：本文件由资料治理 Skill 按既定准入、许可证复核与版本固定流程维护；不得静默改写已固定证据卡，更新只通过新增修订进行。

## 来源身份与版本基线

| 仓库 | 权威 ref | Commit | 本地路径 |
|---|---|---|---|
| jhy/jsoup | `jsoup-1.23.1` | `bb077a8b0da1203cf11d5139967f0d52fe8f5a59` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/jsoup` |
| mozilla/readability | `0.6.0` | `04fd32f72b448c12b02ba6c40928b67e510bac49` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/readability` |
| whatwg/url | `main` | `9dc3827fc722ac4af3f11061aa3e9adb44a17c8b` | `third-party/crawler-knowledge-sources/repos/batch-03-crawler-pipeline/url` |

---

## HTML/DOM 解析

### VE-HTML-001 HTML 解析行为

- **知识声明**：jsoup `Parser` 与 `ParseSettings` 定义 HTML 解析行为（容错、标签/属性大小写处理、解析错误跟踪）；解析失败或容错差异会导致 DOM 结构与预期不符。
- **证据类型/等级**：实现证据。
- **来源身份**：jhy/jsoup（`jsoup-1.23.1`）。
- **版本/ref/Commit**：`jsoup-1.23.1`；`bb077a8b0da1203cf11d5139967f0d52fe8f5a59`。
- **原始位置**：`src/main/java/org/jsoup/parser/Parser.java`、`ParseSettings.java`、`HtmlTreeBuilder.java`、`ParseErrorList.java`。
- **支持说明**：`Parser` 驱动解析，`ParseSettings` 控制大小写/标签处理，`HtmlTreeBuilder` 维护解析状态。
- **适用条件**：诊断 DOM 解析结果与预期不符（节点缺失/错位）时比对。
- **限制**：HTML 容错解析与具体实现相关；不同框架/版本的容错行为不同。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-HTML-002 DOM 节点模型

- **知识声明**：jsoup `org/jsoup/nodes` 定义 DOM 节点模型（`Element`/`TextNode`/`Document`/`Attribute`），选择器与抽取基于该节点树。
- **证据类型/等级**：实现证据。
- **来源身份**：jhy/jsoup（`jsoup-1.23.1`）。
- **版本/ref/Commit**：`jsoup-1.23.1`；`bb077a8b0da1203cf11d5139967f0d52fe8f5a59`。
- **原始位置**：`src/main/java/org/jsoup/nodes/Element.java`、`TextNode.java`、`Document.java`、`Attribute.java`。
- **支持说明**：`Element` 提供选择/文本/属性访问，`TextNode` 表示文本节点。
- **适用条件**：诊断 DOM 结构遍历/文本抽取异常时比对。
- **限制**：节点模型语义与实现相关；本卡是 jsoup 实现证据。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-HTML-003 正文提取算法

- **知识声明**：mozilla/readability `_grabArticle` 通过节点评分/去除非候选/正文容器选择提取文章正文；`_getArticleMetadata` 提取元数据。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability.js`（`_grabArticle` 1031 行起、`_getArticleMetadata` 1757 行起、`_cleanConditionally` 2434 行起）。
- **支持说明**：`_grabArticle` 循环遍历文档树评分候选节点并抽取正文；`_cleanConditionally` 移除低质量节点。
- **适用条件**：诊断正文抽取不完整/含噪声内容时比对。
- **限制**：正文提取算法依赖页面结构；页面行为变化会导致提取偏差（页面行为变化分类）。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

---

## JSON/结构化数据

### VE-JSON-001 JSON/结构化数据解析

- **知识声明**：readability 在 `_grabArticle` 内对 `application/ld+json` 等结构化数据用 `JSON.parse` 解析并提取元数据。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability.js`（`JSON.parse` 1648 行附近、`_getArticleMetadata` 1757 行）。
- **支持说明**：`_getArticleMetadata` 解析 JSON-LD 结构化数据并提取标题/作者/日期等字段。
- **适用条件**：诊断 JSON-LD 字段提取缺失/错位时比对。
- **限制**：JSON-LD 提取只覆盖特定 schema 字段；无效 JSON 需容错处理。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-JSON-002 结构化数据引用处理

- **知识声明**：whatwg/url 规范定义 URL 解析与规范化；结构化数据中的 URL 引用应按该规范解析，URL 规范化错误会导致引用断裂或重复。
- **证据类型/等级**：规范证据。
- **来源身份**：whatwg/url（`main`）。
- **版本/ref/Commit**：`main`；`9dc3827fc722ac4af3f11061aa3e9adb44a17c8b`。
- **原始位置**：`url.bs`。
- **支持说明**：URL 规范定义解析/序列化/百分号编码语义。
- **适用条件**：诊断结构化数据中 URL 引用错误（相对路径解析错误、编码异常）时比对。
- **限制**：具体实现遵循程度不同；本卡是规范语义。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-JSON-003 数据字段映射

- **知识声明**：readability `_getArticleMetadata` 把 JSON-LD/meta 标签映射到规范字段（标题/作者/日期/语言）；映射逻辑错误会导致字段缺失或错位。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability.js`（`_getArticleMetadata` 1757-2430 行附近）。
- **支持说明**：元数据提取遍历 JSON-LD 与 meta 标签，按字段名映射。
- **适用条件**：诊断字段映射错位/缺失时比对。
- **限制**：映射规则覆盖特定元数据；不同页面结构需重新取证。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

---

## 文本编码

### VE-ENC-001 字符集检测与处理

- **知识声明**：jsoup `helper/DataUtil` 处理文档字符集检测与编码转换；编码声明错误或检测失败会导致乱码。
- **证据类型/等级**：实现证据。
- **来源身份**：jhy/jsoup（`jsoup-1.23.1`）。
- **版本/ref/Commit**：`jsoup-1.23.1`；`bb077a8b0da1203cf11d5139967f0d52fe8f5a59`。
- **原始位置**：`src/main/java/org/jsoup/helper/DataUtil.java`。
- **支持说明**：`DataUtil` 负责文档解析时的编码处理。
- **适用条件**：诊断文本乱码/编码声明错误时比对。
- **限制**：字符集检测逻辑随实现/版本变化；本卡是 jsoup 实现证据。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-ENC-002 百分号编码

- **知识声明**：whatwg/url 规范定义百分号编码语义；URL 中非 ASCII/保留字符须正确编码，编码错误会导致数据引用异常。
- **证据类型/等级**：规范证据。
- **来源身份**：whatwg/url（`main`）。
- **版本/ref/Commit**：`main`；`9dc3827fc722ac4af3f11061aa3e9adb44a17c8b`。
- **原始位置**：`url.bs`（百分号编码相关小节）。
- **支持说明**：URL 规范定义百分号编码的编码集合与规则。
- **适用条件**：诊断 URL 编码错误导致的数据问题（乱码/引用断裂）时比对。
- **限制**：不同实现编码行为不同；本卡是规范语义。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

---

## Selector/字段映射

### VE-SEL-001 CSS 选择器语义

- **知识声明**：jsoup `select/Evaluator` 定义 CSS 选择器求值语义（Tag/Id/Class/Attribute/Index 等各类求值器），选择器错误会导致元素检索失败或误选。
- **证据类型/等级**：实现证据。
- **来源身份**：jhy/jsoup（`jsoup-1.23.1`）。
- **版本/ref/Commit**：`jsoup-1.23.1`；`bb077a8b0da1203cf11d5139967f0d52fe8f5a59`。
- **原始位置**：`src/main/java/org/jsoup/select/Evaluator.java`（`Evaluator` 抽象类、`Tag`/`Id`/`Class`/`Attribute`/`Index` 等求值器）、`Collector.java`。
- **支持说明**：`Evaluator` 定义各类选择器求值器；`Collector.collect` 收集匹配元素。
- **适用条件**：诊断 CSS 选择器未命中/误选/只匹配首个元素时比对。
- **限制**：CSS 选择器支持范围随实现/版本变化；页面结构变化导致选择器失效（页面行为变化分类）。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-SEL-002 字段提取与元数据

- **知识声明**：readability `_getArticleMetadata` 通过选择器/meta 标签提取标题/作者/日期等元数据字段；字段映射错误导致字段缺失或错位。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability.js`（`_getArticleMetadata` 1757-2430 行附近）。
- **支持说明**：元数据提取按字段名选择 meta 标签与 JSON-LD。
- **适用条件**：诊断字段映射错位/缺失（如作者/日期错位）时比对。
- **限制**：映射规则覆盖特定元数据；不同页面结构需重新取证。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-SEL-003 内容评分

- **知识声明**：readability `_grabArticle` 通过节点评分（正文密度/链接密度/标签权重）选择正文容器；评分阈值错误导致正文选择偏差。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability.js`（`_grabArticle` 1031 行起，节点评分逻辑）。
- **支持说明**：`_grabArticle` 对候选节点累计评分并选择正文容器。
- **适用条件**：诊断正文选择偏差（含导航/广告噪声、正文截断）时比对。
- **限制**：评分算法依赖页面结构；页面行为变化会导致评分偏差。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

---

## 数据校验/数据质量

### VE-VAL-001 内容安全清洗

- **知识声明**：jsoup `org/jsoup/safety` 定义内容安全清洗（白名单标签/属性），用于去除危险或不相关内容；清洗规则错误会丢失合法内容或保留噪声。
- **证据类型/等级**：实现证据。
- **来源身份**：jhy/jsoup（`jsoup-1.23.1`）。
- **版本/ref/Commit**：`jsoup-1.23.1`；`bb077a8b0da1203cf11d5139967f0d52fe8f5a59`。
- **原始位置**：`src/main/java/org/jsoup/safety/`。
- **支持说明**：安全清洗按白名单保留标签/属性。
- **适用条件**：诊断清洗后内容丢失/含噪声时比对。
- **限制**：清洗规则随版本/配置变化；本卡描述清洗机制。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

### VE-VAL-002 内容质量判定

- **知识声明**：readability `isProbablyReaderable` 通过文本长度/链接密度/可见性评分判断页面是否可读；`minScore`/`minContentLength` 阈值影响判定。
- **证据类型/等级**：实现证据。
- **来源身份**：mozilla/readability（`0.6.0`）。
- **版本/ref/Commit**：`0.6.0`；`04fd32f72b448c12b02ba6c40928b67e510bac49`。
- **原始位置**：`Readability-readerable.js`（`isProbablyReaderable`，`minScore=20`、`minContentLength` 阈值）。
- **支持说明**：`score += Math.sqrt(textContentLength - options.minContentLength)`，`score > options.minScore` 判定可读。
- **适用条件**：诊断页面可读性误判（把低质页当可读/高质页判不可读）时比对。
- **限制**：评分阈值是启发式，随页面结构变化；本卡描述算法机制。
- **关联 Skill**：crawler-validate-extraction。
- **状态**：有效。

---

## 汇总

- 证据卡总数：13 张（VE-HTML 3＋VE-JSON 3＋VE-ENC 2＋VE-SEL 3＋VE-VAL 2）。
- 来源：批次 3 固定仓库 3 个（jsoup、mozilla/readability、whatwg/url）。
- 引用契约：下游 Skill 视图通过稳定 ID 引用本文件；原始证据通过 manifest 固定 Commit 与相对路径可追溯。
