import { DefaultResourceLoader, type ResourceLoader, type Skill } from "@earendil-works/pi-coding-agent";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { readSkillIdentity, type SkillIdentity } from "./skill-identity.js";

/** The canonical pinned Skill name for this project. */
export const OFFICIAL_BIOGRAPHY_SKILL_NAME = "official-biography-evidence";

export class SkillRuntimeError extends Error {}

/**
 * Runtime wrapper around Pi's DefaultResourceLoader.
 *
 * Discovery is driven entirely by `.pi/settings.json` (read through the Pi
 * resource loader), so the pinned Skill path always resolves repo-relative,
 * never from a hardcoded absolute path.
 */
export class SkillRuntime {
  private loader: ResourceLoader | undefined;

  constructor(private readonly config: RuntimeConfig) {}

  async reload(): Promise<void> {
    this.loader = new DefaultResourceLoader({
      cwd: this.config.projectRoot,
      agentDir: this.config.piConfigDir,
    });
    await this.loader.reload();
  }

  getSkills(): Skill[] {
    return this.loader?.getSkills().skills ?? [];
  }

  async resolveSkill(expectedName: string): Promise<SkillIdentity> {
    if (!this.loader) {
      throw new SkillRuntimeError("SkillRuntime not loaded; call reload() first");
    }
    const skills = this.getSkills();
    const skill = skills.find((s) => s.name === expectedName);
    if (!skill) {
      const found = skills.map((s) => s.name).join(", ") || "none";
      throw new SkillRuntimeError(`Skill not discovered: "${expectedName}" (found: ${found})`);
    }
    return readSkillIdentity(skill.baseDir);
  }
}
