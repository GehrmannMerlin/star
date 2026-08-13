import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type SkillIdentity = {
  /** Skill name (SKILL.md frontmatter `name`; must match skill.yaml `id`). */
  name: string;
  /** skill.yaml `id`. */
  id: string;
  /** skill.yaml `version`. */
  version: string;
  /** Absolute path to the skill root directory. */
  path: string;
  /** Absolute path to SKILL.md. */
  skmdPath: string;
  /** Absolute path to skill.yaml. */
  yamlPath: string;
};

export class SkillIdentityError extends Error {}

type SkillYaml = { id?: unknown; version?: unknown };

/**
 * Read and validate a Skill identity from a skill root directory.
 *
 * Reads skill.yaml (`id`, `version`) and SKILL.md frontmatter (`name`),
 * then enforces that the declared name matches the declared id. The runtime is
 * name-neutral: the expected skill name is whatever the pinned skill declares,
 * never a hardcoded provider or path.
 */
export async function readSkillIdentity(baseDir: string): Promise<SkillIdentity> {
  const yamlPath = path.join(baseDir, "skill.yaml");
  const skmdPath = path.join(baseDir, "SKILL.md");

  let yamlRaw: string;
  let skmdRaw: string;
  try {
    yamlRaw = await readFile(yamlPath, "utf8");
  } catch {
    throw new SkillIdentityError(`Missing skill.yaml: ${yamlPath}`);
  }
  try {
    skmdRaw = await readFile(skmdPath, "utf8");
  } catch {
    throw new SkillIdentityError(`Missing SKILL.md: ${skmdPath}`);
  }

  const doc = parseYaml(yamlRaw) as SkillYaml | null | undefined;
  const idValue = doc?.id;
  const versionValue = doc?.version;
  const id = typeof idValue === "string" ? idValue : undefined;
  const version = typeof versionValue === "string" ? versionValue : undefined;

  if (!id) {
    throw new SkillIdentityError(`skill.yaml missing string "id": ${yamlPath}`);
  }
  if (!version) {
    throw new SkillIdentityError(`skill.yaml missing string "version": ${yamlPath}`);
  }

  const { frontmatter } = parseFrontmatter(skmdRaw);
  const nameValue = frontmatter.name;
  const name = typeof nameValue === "string" ? nameValue : undefined;
  if (!name) {
    throw new SkillIdentityError(`SKILL.md missing frontmatter "name": ${skmdPath}`);
  }
  if (name !== id) {
    throw new SkillIdentityError(`Skill identity mismatch: SKILL.md name "${name}" != skill.yaml id "${id}"`);
  }

  return { name, id, version, path: baseDir, skmdPath, yamlPath };
}
