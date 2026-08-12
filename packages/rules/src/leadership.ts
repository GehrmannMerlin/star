import type { CurrentnessStatus } from "@stellaris/contracts";
import type { PageFacts } from "@stellaris/crawler/page-facts.js";

/**
 * 完整领导结构组装（规格 §13.3）。
 * 选人前必须形成：全部当前可见领导、每人全部机构内岗位、官方顺序、当前性状态。
 */

export interface LeadershipMember {
  personName: string;
  roles: string[];
  sortOrder: number;
  currentnessStatus: CurrentnessStatus;
}

export interface LeadershipStructure {
  institutionSnapshotId: string;
  members: LeadershipMember[];
}

/**
 * 从多页事实组装完整领导结构。
 * 同一个人合并岗位（规格 §13.3：每人全部机构内岗位），以首现顺序为官方顺序。
 */
export function assembleLeadership(
  institutionSnapshotId: string,
  factsList: PageFacts[],
  currentness: Map<string, CurrentnessStatus>,
): LeadershipStructure {
  const byName = new Map<string, { roles: string[]; sortOrder: number; hrefs: string[] }>();
  let order = 0;

  for (const facts of factsList) {
    for (const member of facts.leadershipMembers) {
      const existing = byName.get(member.name);
      if (!existing) {
        order += 1;
        byName.set(member.name, {
          roles: [...member.roles],
          sortOrder: order,
          hrefs: member.href ? [member.href] : [],
        });
      } else {
        for (const role of member.roles) {
          if (!existing.roles.includes(role)) {
            existing.roles.push(role);
          }
        }
        if (member.href) {
          existing.hrefs.push(member.href);
        }
      }
    }
  }

  const members: LeadershipMember[] = [];
  for (const [name, data] of byName) {
    members.push({
      personName: name,
      roles: data.roles,
      sortOrder: data.sortOrder,
      currentnessStatus: currentness.get(name) ?? "CURRENTNESS_UNRESOLVED",
    });
  }
  members.sort((a, b) => a.sortOrder - b.sortOrder);

  return { institutionSnapshotId, members };
}
