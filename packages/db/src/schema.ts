import type { Generated, Selectable } from "kysely";
import type {
  TaskRunStatus,
  CurrentnessStatus,
  InstitutionType,
  PageType,
  TaskMode,
  ExpandLevel,
  FetchMode,
  FrontierPriority,
  Slot,
  ReviewDecision,
  InstitutionOutcome,
} from "@stellaris/contracts";

/**
 * 数据模型层（规格 §16 范围层/抓取层/事实层/业务层/控制层/复用层/输出层）。
 *
 * 命名约定：
 * - 表名 snake_case；
 * - 所有表均有 id (uuid, PK)；
 * - 时间列统一 *_at（created_at / started_at / ...）；
 * - 枚举列使用 varchar，值来自 @stellaris/contracts 的枚举常量；
 * - jsonb 列用于官网结构差异较大的可变事实（规格 §17）。
 */

/** 通用 ID 与时间基字段。 */
export interface BaseTable {
  id: Generated<string>;
  created_at: Generated<string>;
}

// ─────────────────────────── 范围层（§16.1） ───────────────────────────

export interface TaskRunTable extends BaseTable {
  owner_user_id: string;
  /** 客户端请求幂等键（规格 §18.3，重复点击只建一个任务）。 */
  idempotency_key: string;
  mode: TaskMode;
  /** 展开层级：COUNTY / TOWN_STREET（规格 §3）。 */
  expand_level: ExpandLevel;
  status: TaskRunStatus;
  /** 冻结的规则版本（规格 §7.2）。 */
  rule_version: string;
  total_institutions: Generated<number>;
  processed_institutions: Generated<number>;
  reviewed_slots: Generated<number>;
  recovery_count: Generated<number>;
  blocked_count: Generated<number>;
  requested_at: Generated<string>;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface TargetScopeTable extends BaseTable {
  task_run_id: string;
  /** 行政区划代码，按文本保存保留前导零（规格 §8.1）。 */
  region_code: string;
  region_name: string;
  /** 父级行政区划代码（省→地市→区县→乡镇/街道）。 */
  parent_region_code: string | null;
  /** 行政区层级：province / city / county / town。 */
  region_level: string;
  /** 是否包含在该任务范围中。 */
  included: Generated<boolean>;
}

export interface InstitutionSnapshotTable extends BaseTable {
  task_run_id: string;
  region_code: string;
  /** 机构正式名称。 */
  official_name: string;
  /** 常用简称。 */
  common_name: string | null;
  institution_type: InstitutionType;
  /** 官方入口 URL。 */
  official_entry_url: string | null;
  /** 发现来源（规格 §8.2 五类来源）。 */
  discovery_source: string;
  /** 是否应选择两名主要自然人。 */
  select_two_primary: Generated<boolean>;
  /** 库存冻结时间。 */
  frozen_at: string;
  status: Generated<"ACTIVE" | "BLOCKED" | "FAILED">;
  /** 终态记录的中文原因（为空或失败时填写，规格 §8.2）。 */
  terminal_reason: string | null;
}

// ─────────────────────────── 抓取层（§16.2） ───────────────────────────

export interface CrawlIntentTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string | null;
  original_url: string;
  canonical_key: string;
  priority: FrontierPriority;
  /** 抓取阶段：discovery / primary / recovery / reviewer。 */
  phase: string;
  /** 抓取用途（规格 §18.3 幂等键组成部分）。 */
  purpose: string;
  status: Generated<"PENDING" | "FETCHED" | "FAILED">;
}

export interface FetchAttemptTable extends BaseTable {
  task_run_id: string;
  crawl_intent_id: string | null;
  fetch_mode: FetchMode;
  url: string;
  canonical_key: string;
  http_status: number | null;
  status: "SUCCESS" | "REDIRECTED" | "ERROR" | "TIMEOUT" | "BLOCKED";
  /** 重试次数。 */
  retries: number;
  /** 最终 DNS 解析 IP。 */
  resolved_ip: string | null;
  duration_ms: number;
  redirected_url: string | null;
  document_snapshot_id: string | null;
  error_message: string | null;
}

export interface DocumentSnapshotTable extends BaseTable {
  /** 内容 SHA-256（规格 §17.2）。 */
  content_hash: string;
  mime_type: string;
  charset: string | null;
  size_bytes: number;
  /** 证据库相对安全路径（禁止任意绝对路径，规格 §17）。 */
  relative_path: string;
}

export interface LinkEdgeTable extends BaseTable {
  task_run_id: string;
  /** 来源文档。 */
  source_document_snapshot_id: string;
  /** 目标 URL。 */
  target_url: string;
  /** 锚文本。 */
  anchor_text: string | null;
  /** DOM 位置。 */
  dom_position: string | null;
  /** 关系类型（nav / leadership / profile / external / other）。 */
  relation_type: string;
}

// ─────────────────────────── 事实层（§16.3） ───────────────────────────

export interface PageFactTable extends BaseTable {
  document_snapshot_id: string;
  title: string | null;
  /** 页面正文文本（辅助，不替代 DOM 事实，规格 §12.2）。 */
  body_text: string | null;
  published_at: string | null;
  /** DOM 结构化事实（表格/列表/卡片/姓名链接等，jsonb，规格 §17）。 */
  dom_facts: string | null;
  /** 页面信号。 */
  signals: string | null;
}

export interface EntityAssertionTable extends BaseTable {
  task_run_id: string;
  /** 自然人。 */
  person_name: string;
  institution_id: string | null;
  official_role: string | null;
  /** 证据支持信息。 */
  supporting_evidence: string | null;
  /** 断言类型：person / institution / role / currentness。 */
  assertion_type: string;
}

export interface CurrentnessAssertionTable extends BaseTable {
  task_run_id: string;
  person_name: string;
  institution_id: string | null;
  currentness_status: CurrentnessStatus;
  /** 支持证据 / 冲突证据。 */
  supporting_evidence: string | null;
  conflict_evidence: string | null;
}

// ─────────────────────────── 业务层（§16.4） ───────────────────────────

export interface LeadershipSnapshotTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string;
  /** 完整领导结构（jsonb，规格 §13.3）。 */
  leadership_json: string;
}

export interface RoleAssignmentTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string;
  person_name: string;
  official_role: string;
  /** 官方顺序（仅作 tie-breaker，规格 §13.4）。 */
  sort_order: number | null;
  /** 属性：full_time / acting / presiding / none。 */
  attribute: string;
}

export interface SlotDecisionTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string;
  slot: Slot;
  person_name: string | null;
  status: "FILLED" | "VACANT" | "UNCONFIRMED";
}

export interface UrlCandidateTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string | null;
  url: string;
  /** 发现分数（仅决定抓取优先级，非准入，规格 §13.1）。 */
  discovery_score: number;
  /** 硬门槛结果（九项，规格 §4.3）。 */
  hard_gate: string | null;
}

export interface RecoveryAttemptTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string | null;
  /** 触发原因。 */
  trigger_reason: string;
  strategy: string;
  /** 追加页面预算。 */
  budget_used: number;
  result: "SUCCESS" | "FAILED" | "STILL_UNRESOLVED";
}

export interface ReviewJobTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string | null;
  url: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  /** 独立复抓的请求唯一键（区别于 Collector，规格 §15.2）。 */
  unique_request_key: string;
}

export interface ReviewDecisionTable extends BaseTable {
  task_run_id: string;
  review_job_id: string;
  url: string;
  /** 六方面一致性结果（人员/机构/岗位/页面类型/当前性/最终URL）。 */
  dimensions_match: string;
  decision: ReviewDecision;
  /** 分歧原因（Recovery 后仍不一致则 URL 留空，规格 §15.3）。 */
  conflict_reason: string | null;
}

// ─────────────────────────── 输出层（§16.4） ───────────────────────────

export interface ResultRowTable extends BaseTable {
  task_run_id: string;
  institution_snapshot_id: string;
  slot: Slot;
  region_code: string;
  province: string | null;
  city: string | null;
  county: string | null;
  town: string | null;
  institution_name: string;
  /** 完整岗位显示值（机构+岗位，规格 §21.2）。 */
  position_display: string;
  person_name: string | null;
  /** 当前状态（正式在任/代理中/主持工作/暂未确认/空缺）。 */
  current_status_zh: string;
  /** 岗位信息 URL（仅有通过的 Reviewer 决策才非空，规格 §16.6）。 */
  position_url: string | null;
  /** 页面类型中文。 */
  page_type_zh: string | null;
  /** 采集结果中文。 */
  result_zh: string;
  /** 采集时间。 */
  collected_at: string;
}

export interface ExportArtifactTable extends BaseTable {
  task_run_id: string;
  /** 导出文件名。 */
  filename: string;
  /** 行数。 */
  row_count: number;
  /** 文件内容 SHA-256。 */
  content_hash: string;
  generated_at: string;
}

// ─────────────────────────── 复用层（§16.5） ───────────────────────────

export interface SiteProfileTable extends BaseTable {
  host: string;
  /** 推荐抓取方式。 */
  fetch_mode: FetchMode;
  /** DOM 结构指纹。 */
  dom_fingerprint: string | null;
  /** 等待条件。 */
  wait_condition: string | null;
  /** 当前领导入口。 */
  current_leader_entry: string | null;
  avg_duration_ms: number | null;
  success_rate: number | null;
  last_verified_at: string | null;
  /** 失败与改版信号（jsonb，解析为对象）。 */
  failure_signals: Record<string, unknown> | null;
}

export interface PathFamilyProfileTable extends BaseTable {
  site_profile_id: string;
  host: string;
  path_family: string;
  fetch_mode: FetchMode;
  page_family: string;
  avg_duration_ms: number | null;
  success_rate: number | null;
  last_verified_at: string | null;
}

export interface PublicApiProfileTable extends BaseTable {
  site_profile_id: string;
  host: string;
  /** URL 模式。 */
  url_pattern: string;
  method: string;
  response_type: string;
  /** 结构指纹。 */
  structure_fingerprint: string | null;
  /** 页面关系。 */
  page_relation: string | null;
  /** 字段位置。 */
  field_locations: string | null;
  last_verified_at: string | null;
}

export interface SearchResultCacheTable extends BaseTable {
  query: string;
  provider: string;
  /** 排序/分页令牌。 */
  pagination_token: string | null;
  /** 搜索结果（jsonb，解析为任意 JSON）。 */
  results: unknown | null;
  cached_at: string;
}

export interface RobotsCacheTable extends BaseTable {
  host: string;
  /** robots.txt 内容。 */
  content: string | null;
  fetched_at: string;
  expires_at: string;
}

export interface RuleVersionTable extends BaseTable {
  /** 版本标识。 */
  version: string;
  /** 规则包描述。 */
  description: string | null;
  published_at: string;
  /** 规则内容（jsonb）。 */
  rule_payload: string | null;
}

// ─────────────────────────── Agent 持久层（STEP 11） ───────────────────────────

/**
 * Tool Event 持久化日志。
 * 只保存数据最小化后的投影元数据（URL 证明 / search 概要 / submit 概要），
 * 绝不保存原始 HTML、检索 snippets 或任何 secret-like 载荷。
 */
export interface ToolEventTable extends BaseTable {
  /** 追加序（int4），读取时的确定性顺序键。 */
  seq: Generated<number>;
  call_id: string;
  tool_name: string;
  /** STARTED | SUCCESS | FAILED | CANCELLED。 */
  status: string;
  agent_session_id: string;
  /** 逻辑 packet 身份（不建 FK，Packet Store 仍 Deferred）。 */
  packet_id: string | null;
  agent_role: string;
  task_run_id: string;
  started_at: string;
  finished_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  failure_retryable: boolean | null;
  /** URL 证明元数据（requestedUrl/finalUrl/url/statusCode/bytes，jsonb）。 */
  url_metadata: unknown | null;
  /** search_web 证明元数据（provider/resultCount，jsonb）。 */
  search_metadata: unknown | null;
  /** submit_investigator_evidence 证明元数据（payloadHash/candidateCount，jsonb）。 */
  submission_metadata: unknown | null;
}

/** Investigator Evidence Submission 冻结存储。唯一(packet_id) 保证每包只冻结一次。 */
export interface InvestigatorEvidenceSubmissionTable extends BaseTable {
  packet_id: string;
  agent_session_id: string;
  agent_role: string;
  skill_name: string;
  skill_version: string;
  /** canonical schema 身份（如 url-candidate-pool.schema.json）。 */
  canonical_schema: string;
  /** 规范 Evidence payload（url-candidate-pool / target-claim，jsonb）。 */
  payload: unknown;
  /** 内容寻址哈希（sha256 over JSON）。 */
  payload_hash: string;
  /** 冻结时间。 */
  frozen_at: string;
}

/** 完整 Database 接口（Kysely）。 */
export interface Database {
  task_run: TaskRunTable;
  target_scope: TargetScopeTable;
  institution_snapshot: InstitutionSnapshotTable;
  crawl_intent: CrawlIntentTable;
  fetch_attempt: FetchAttemptTable;
  document_snapshot: DocumentSnapshotTable;
  link_edge: LinkEdgeTable;
  page_fact: PageFactTable;
  entity_assertion: EntityAssertionTable;
  currentness_assertion: CurrentnessAssertionTable;
  leadership_snapshot: LeadershipSnapshotTable;
  role_assignment: RoleAssignmentTable;
  slot_decision: SlotDecisionTable;
  url_candidate: UrlCandidateTable;
  recovery_attempt: RecoveryAttemptTable;
  review_job: ReviewJobTable;
  review_decision: ReviewDecisionTable;
  result_row: ResultRowTable;
  export_artifact: ExportArtifactTable;
  site_profile: SiteProfileTable;
  path_family_profile: PathFamilyProfileTable;
  public_api_profile: PublicApiProfileTable;
  search_result_cache: SearchResultCacheTable;
  robots_cache: RobotsCacheTable;
  rule_version: RuleVersionTable;
  tool_event: ToolEventTable;
  investigator_evidence_submission: InvestigatorEvidenceSubmissionTable;
}

/**
 * 表行"读取结果"类型：Generated/默认列在读取时均为实际值。
 * Repository 对 returningAll()/selectAll() 的结果使用 Selectable<>，避免与写入类型冲突。
 */
export type TaskRunRow = Selectable<TaskRunTable>;
export type TargetScopeRow = Selectable<TargetScopeTable>;
export type InstitutionSnapshotRow = Selectable<InstitutionSnapshotTable>;

/** 27 张表的有序清单（迁移与完整性扫描共用）。 */
export const TABLE_NAMES = [
  "task_run",
  "target_scope",
  "institution_snapshot",
  "crawl_intent",
  "fetch_attempt",
  "document_snapshot",
  "link_edge",
  "page_fact",
  "entity_assertion",
  "currentness_assertion",
  "leadership_snapshot",
  "role_assignment",
  "slot_decision",
  "url_candidate",
  "recovery_attempt",
  "review_job",
  "review_decision",
  "result_row",
  "export_artifact",
  "site_profile",
  "path_family_profile",
  "public_api_profile",
  "search_result_cache",
  "robots_cache",
  "rule_version",
  "tool_event",
  "investigator_evidence_submission",
] as const;
