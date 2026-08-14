import type {
  Database,
  TaskRunTable,
  TargetScopeTable,
  InstitutionSnapshotTable,
  CrawlIntentTable,
  FetchAttemptTable,
  DocumentSnapshotTable,
  LinkEdgeTable,
  PageFactTable,
  EntityAssertionTable,
  CurrentnessAssertionTable,
  LeadershipSnapshotTable,
  RoleAssignmentTable,
  SlotDecisionTable,
  UrlCandidateTable,
  RecoveryAttemptTable,
  ReviewJobTable,
  ReviewDecisionTable,
  ResultRowTable,
  ExportArtifactTable,
  SiteProfileTable,
  PathFamilyProfileTable,
  PublicApiProfileTable,
  SearchResultCacheTable,
  RobotsCacheTable,
  RuleVersionTable,
  ToolEventTable,
  InvestigatorEvidenceSubmissionTable,
} from "./schema.js";
import type { Selectable } from "kysely";

export type {
  Database,
  TaskRunTable,
  TargetScopeTable,
  InstitutionSnapshotTable,
  CrawlIntentTable,
  FetchAttemptTable,
  DocumentSnapshotTable,
  LinkEdgeTable,
  PageFactTable,
  EntityAssertionTable,
  CurrentnessAssertionTable,
  LeadershipSnapshotTable,
  RoleAssignmentTable,
  SlotDecisionTable,
  UrlCandidateTable,
  RecoveryAttemptTable,
  ReviewJobTable,
  ReviewDecisionTable,
  ResultRowTable,
  ExportArtifactTable,
  SiteProfileTable,
  PathFamilyProfileTable,
  PublicApiProfileTable,
  SearchResultCacheTable,
  RobotsCacheTable,
  RuleVersionTable,
  ToolEventTable,
  InvestigatorEvidenceSubmissionTable,
} from "./schema.js";

export { TABLE_NAMES } from "./schema.js";

/** 单行插入结果的便捷类型。 */
export type InsertResult = { id: string };

/** 各表读取行类型：Generated/默认列在读取时为实际值，使用 Selectable<> 派生（与 schema 中 Row 别名同构）。 */
export type CrawlIntentRow = Selectable<CrawlIntentTable>;
export type FetchAttemptRow = Selectable<FetchAttemptTable>;
export type DocumentSnapshotRow = Selectable<DocumentSnapshotTable>;
export type LinkEdgeRow = Selectable<LinkEdgeTable>;
export type PageFactRow = Selectable<PageFactTable>;
export type EntityAssertionRow = Selectable<EntityAssertionTable>;
export type CurrentnessAssertionRow = Selectable<CurrentnessAssertionTable>;
export type LeadershipSnapshotRow = Selectable<LeadershipSnapshotTable>;
export type RoleAssignmentRow = Selectable<RoleAssignmentTable>;
export type SlotDecisionRow = Selectable<SlotDecisionTable>;
export type UrlCandidateRow = Selectable<UrlCandidateTable>;
export type RecoveryAttemptRow = Selectable<RecoveryAttemptTable>;
export type ReviewJobRow = Selectable<ReviewJobTable>;
export type ReviewDecisionRow = Selectable<ReviewDecisionTable>;
export type ResultRowRow = Selectable<ResultRowTable>;
export type ExportArtifactRow = Selectable<ExportArtifactTable>;
export type SiteProfileRow = Selectable<SiteProfileTable>;
export type PathFamilyProfileRow = Selectable<PathFamilyProfileTable>;
export type PublicApiProfileRow = Selectable<PublicApiProfileTable>;
export type SearchResultCacheRow = Selectable<SearchResultCacheTable>;
export type RobotsCacheRow = Selectable<RobotsCacheTable>;
export type RuleVersionRow = Selectable<RuleVersionTable>;
export type ToolEventRow = Selectable<ToolEventTable>;
export type InvestigatorEvidenceSubmissionRow = Selectable<InvestigatorEvidenceSubmissionTable>;
