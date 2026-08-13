import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeConfig } from "../config/runtime-config.js";
import { OFFICIAL_BIOGRAPHY_SKILL_NAME, SkillRuntime, SkillRuntimeError } from "./skill-runtime.js";

describe("SkillRuntime", () => {
  it("discovers the pinned official-biography-evidence skill via .pi/settings.json", async () => {
    const runtime = new SkillRuntime(createRuntimeConfig());
    await runtime.reload();
    const identity = await runtime.resolveSkill(OFFICIAL_BIOGRAPHY_SKILL_NAME);
    expect(identity.name).toBe("official-biography-evidence");
    expect(identity.version).toBe("3.1.0");
  });

  it("reports an unexpected skill name as not discovered", async () => {
    const runtime = new SkillRuntime(createRuntimeConfig());
    await runtime.reload();
    await expect(runtime.resolveSkill("does-not-exist")).rejects.toThrow(SkillRuntimeError);
  });

  it("resolves a fixture skill through a repo-relative .pi/settings.json", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "skill-runtime-root-"));
    try {
      await mkdir(path.join(root, ".pi"), { recursive: true });
      await writeFile(
        path.join(root, ".pi", "settings.json"),
        JSON.stringify({ skills: ["../skill-fixture"], enableSkillCommands: true }),
        "utf8",
      );
      const skillDir = path.join(root, "skill-fixture");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: fixture-skill\ndescription: d\n---\nbody", "utf8");
      await writeFile(path.join(skillDir, "skill.yaml"), "id: fixture-skill\nversion: 0.1.0\n", "utf8");

      const runtime = new SkillRuntime(createRuntimeConfig({ projectRoot: root }));
      await runtime.reload();
      const identity = await runtime.resolveSkill("fixture-skill");
      expect(identity.name).toBe("fixture-skill");
      expect(identity.version).toBe("0.1.0");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
