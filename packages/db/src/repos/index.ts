import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import { TaskRunRepository } from "./task-run.js";
import { TargetScopeRepository } from "./target-scope.js";
import { InstitutionSnapshotRepository } from "./institution-snapshot.js";
import { CrawlIntentRepository } from "./crawl-intent.js";
import { FetchAttemptRepository } from "./fetch-attempt.js";
import { DocumentSnapshotRepository } from "./document-snapshot.js";
import { PageFactRepository } from "./page-fact.js";
import { LeadershipRepository } from "./leadership.js";
import { SlotDecisionRepository } from "./slot-decision.js";
import { UrlCandidateRepository } from "./url-candidate.js";
import { RecoveryAttemptRepository } from "./recovery-attempt.js";
import { ReviewRepository } from "./review.js";
import { ResultRowRepository } from "./result-row.js";
import { ExportArtifactRepository } from "./export-artifact.js";
import { SiteProfileRepository } from "./site-profile.js";
import { SearchCacheRepository } from "./search-cache.js";
import { ToolEventRepository } from "./tool-event.js";
import { InvestigatorEvidenceSubmissionRepository } from "./investigator-evidence.js";

/** 各 Repository 组合，便于业务层一次取用。 */
export interface Repositories {
  taskRun: TaskRunRepository;
  targetScope: TargetScopeRepository;
  institutionSnapshot: InstitutionSnapshotRepository;
  crawlIntent: CrawlIntentRepository;
  fetchAttempt: FetchAttemptRepository;
  documentSnapshot: DocumentSnapshotRepository;
  pageFact: PageFactRepository;
  leadership: LeadershipRepository;
  slotDecision: SlotDecisionRepository;
  urlCandidate: UrlCandidateRepository;
  recoveryAttempt: RecoveryAttemptRepository;
  review: ReviewRepository;
  resultRow: ResultRowRepository;
  exportArtifact: ExportArtifactRepository;
  siteProfile: SiteProfileRepository;
  searchCache: SearchCacheRepository;
  toolEvent: ToolEventRepository;
  investigatorEvidence: InvestigatorEvidenceSubmissionRepository;
}

/** 创建全部 Repository。 */
export function createRepositories(db: Kysely<Database>): Repositories {
  return {
    taskRun: new TaskRunRepository(db),
    targetScope: new TargetScopeRepository(db),
    institutionSnapshot: new InstitutionSnapshotRepository(db),
    crawlIntent: new CrawlIntentRepository(db),
    fetchAttempt: new FetchAttemptRepository(db),
    documentSnapshot: new DocumentSnapshotRepository(db),
    pageFact: new PageFactRepository(db),
    leadership: new LeadershipRepository(db),
    slotDecision: new SlotDecisionRepository(db),
    urlCandidate: new UrlCandidateRepository(db),
    recoveryAttempt: new RecoveryAttemptRepository(db),
    review: new ReviewRepository(db),
    resultRow: new ResultRowRepository(db),
    exportArtifact: new ExportArtifactRepository(db),
    siteProfile: new SiteProfileRepository(db),
    searchCache: new SearchCacheRepository(db),
    toolEvent: new ToolEventRepository(db),
    investigatorEvidence: new InvestigatorEvidenceSubmissionRepository(db),
  };
}

export {
  TaskRunRepository,
  TargetScopeRepository,
  InstitutionSnapshotRepository,
  CrawlIntentRepository,
  FetchAttemptRepository,
  DocumentSnapshotRepository,
  PageFactRepository,
  LeadershipRepository,
  SlotDecisionRepository,
  UrlCandidateRepository,
  RecoveryAttemptRepository,
  ReviewRepository,
  ResultRowRepository,
  ExportArtifactRepository,
  SiteProfileRepository,
  SearchCacheRepository,
  ToolEventRepository,
  InvestigatorEvidenceSubmissionRepository,
};
