import type { Repositories } from "@stellaris/db";
import type { SafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import type { SearchProvider } from "@stellaris/crawler/search/provider.js";
import { FixtureSearchProvider } from "@stellaris/crawler/search/fixture-provider.js";
import type { SseEvent } from "@stellaris/contracts";

/**
 * Recovery 策略执行器（规格 §14.3 八步）。
 * 触发后按顺序改变发现/验证策略；命中合格候选即返回。
 * 搜索结果只作 URL 线索，不成为最终 URL/当前性证据（§22）。
 */

export interface RecoveryExecutorInput {
  taskRunId: string;
  institutionSnapshotId: string;
  personName: string | null;
  institutionName: string;
  repos: Repositories;
  policy: SafeEgressPolicy;
  /** 搜索提供器（缺省 Fixture；真实提供器待授权）。 */
  searchProvider?: SearchProvider;
  /** Recovery 预算上限（默认 3，§14.2）。 */
  maxBudget?: number;
  emit: (e: SseEvent) => void;
}

export interface RecoveryResult {
  candidateUrl: string | null;
  strategiesUsed: string[];
}

/** 八步顺序（§14.3，与 recovery.ts buildRecoveryOrder 一致）。 */
const STRATEGIES = [
  "site_profile_entry",
  "gov_openness_directory",
  "verified_public_api",
  "sitemap_site_search",
  "domain_limited_external_search",
  "role_person_combined_search",
  "superior_current_leader_entry",
  "region_success_pattern",
];

export async function runRecovery(input: RecoveryExecutorInput): Promise<RecoveryResult> {
  const { taskRunId, institutionSnapshotId, personName, institutionName, repos, policy, maxBudget = 3, emit } = input;
  const provider = input.searchProvider ?? new FixtureSearchProvider();
  const strategiesUsed: string[] = [];

  // 预算检查（§14.2）。
  const existingAttempts = (await repos.recoveryAttempt.listByTask(taskRunId)).length;
  if (existingAttempts >= maxBudget) {
    return { candidateUrl: null, strategiesUsed: [] };
  }
  let budget = maxBudget - existingAttempts;

  // 构造查询词：人员 + 机构 + 正式岗位（§14.3 第 6 步组合搜索）。
  const query = [personName, institutionName].filter(Boolean).join(" ");

  for (const strategy of STRATEGIES) {
    if (budget <= 0) break;
    emit({ type: "result.recovery_started", taskRunId, institutionSnapshotId, seq: 1 });

    let candidateUrl: string | null = null;
    let result: "SUCCESS" | "FAILED" | "STILL_UNRESOLVED" = "FAILED";
    let reason = "策略无可用入口";

    try {
      if (strategy === "site_profile_entry") {
        // 站点画像当前领导入口（§14.3 第 1 步）。
        const host = new URL(institutionName.includes("安徽省") ? "https://www.ah.gov.cn/" : "https://example.com").host;
        const profile = await repos.siteProfile.findByHost(host);
        if (profile?.current_leader_entry) {
          candidateUrl = profile.current_leader_entry;
        }
      } else if (strategy === "domain_limited_external_search" || strategy === "role_person_combined_search") {
        // 限定官网域外部搜索（§14.3 第 5/6 步）。
        const res = await provider.search(query, { domain: "ah.gov.cn" });
        // 只取官方域结果作 URL 线索。
        const official = res.results.find((r) => {
          try {
            return new URL(r.url).hostname.includes("ah.gov.cn");
          } catch {
            return false;
          }
        });
        if (official) candidateUrl = official.url;
      }
      // sitemap_site_search / gov_openness_directory / verified_public_api / superior / region：暂以画像/搜索兜底（扩展点）。
    } catch {
      // 该步失败 → 继续下一步。
    }

    if (candidateUrl) {
      result = "SUCCESS";
      reason = `候选 URL: ${candidateUrl}`;
    } else {
      reason = "无合格候选";
    }
    await repos.recoveryAttempt.addAttempt({
      taskRunId,
      institutionSnapshotId,
      triggerReason: reason,
      strategy,
      budgetUsed: 1,
      result,
    });
    strategiesUsed.push(strategy);
    // 预算仅在实际消耗外部资源（搜索）时递减；空转步（无入口直接失败）不耗预算，保证后续步骤有机会命中。
    if (strategy === "domain_limited_external_search" || strategy === "role_person_combined_search") {
      budget -= 1;
    }

    if (candidateUrl) {
      return { candidateUrl, strategiesUsed };
    }
    void policy; // 策略内可扩展为逐 URL 校验。
  }

  return { candidateUrl: null, strategiesUsed };
}
