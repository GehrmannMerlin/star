import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readSkillIdentity, SkillIdentityError } from "./skill-identity.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "skill-identity-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeSkill(name: string, files: Record<string, string>): Promise<string> {
  const base = path.join(dir, name);
  await mkdir(base, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(base, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return base;
}

describe("readSkillIdentity", () => {
  it("resolves a valid skill identity", async () => {
    const base = await writeSkill("ok", {
      "SKILL.md": "---\nname: official-biography-evidence\ndescription: d\n---\n\nbody",
      "skill.yaml": "id: official-biography-evidence\nversion: 3.1.0\n",
    });
    const id = await readSkillIdentity(base);
    expect(id.name).toBe("official-biography-evidence");
    expect(id.id).toBe("official-biography-evidence");
    expect(id.version).toBe("3.1.0");
  });

  it("fails when SKILL.md name does not match skill.yaml id", async () => {
    const base = await writeSkill("mismatch", {
      "SKILL.md": "---\nname: wrong-name\n---\n",
      "skill.yaml": "id: right-name\nversion: 1.0.0\n",
    });
    await expect(readSkillIdentity(base)).rejects.toThrow(SkillIdentityError);
  });

  it("fails when SKILL.md is missing", async () => {
    const base = await writeSkill("missing-skmd", { "skill.yaml": "id: x\nversion: 1.0.0\n" });
    await expect(readSkillIdentity(base)).rejects.toThrow(/Missing SKILL\.md/);
  });

  it("fails when skill.yaml is missing", async () => {
    const base = await writeSkill("missing-yaml", { "SKILL.md": "---\nname: x\n---\n" });
    await expect(readSkillIdentity(base)).rejects.toThrow(/Missing skill\.yaml/);
  });
});
