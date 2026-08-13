import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_NAME = "official-biography-evidence";
const EXPECTED_VERSION = "3.1.0";
const EXPECTED_COMMIT = "40993e24109d26cb576b532223956053fcc4672f";
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const submoduleRelativePath = "third-party/china-official-url-evidence-suite";
const submodulePath = path.join(projectRoot, submoduleRelativePath);
const skillPath = path.join(submodulePath, "skills", EXPECTED_NAME);

function requirePath(relativePath, kind) {
  const absolutePath = path.join(skillPath, relativePath);
  const stats = statSync(absolutePath);
  if (kind === "file" ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(`Expected ${kind}: ${absolutePath}`);
  }
  return absolutePath;
}

function readYamlScalar(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escapedKey}:\\s*["']?([^"'#\\r\\n]+?)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function git(args, cwd = projectRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

try {
  const skillFile = requirePath("SKILL.md", "file");
  const skillYamlFile = requirePath("skill.yaml", "file");
  for (const directory of ["references", "schemas", "scripts", "assets"]) {
    requirePath(directory, "directory");
  }

  const frontmatter = readFileSync(skillFile, "utf8").match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const skillName = frontmatter ? readYamlScalar(frontmatter[1], "name") : "";
  const version = readYamlScalar(readFileSync(skillYamlFile, "utf8"), "version");
  if (skillName !== EXPECTED_NAME) throw new Error(`Unexpected Skill name: ${skillName || "<missing>"}`);
  if (version !== EXPECTED_VERSION) throw new Error(`Unexpected Skill version: ${version || "<missing>"}`);

  const gitlink = git(["ls-files", "--stage", "--", submoduleRelativePath]);
  const gitlinkCommit = gitlink.match(/^160000 ([0-9a-f]{40,64}) 0\t/)?.[1];
  if (gitlinkCommit !== EXPECTED_COMMIT) throw new Error(`Unexpected pinned commit: ${gitlinkCommit || "<missing>"}`);
  if (git(["rev-parse", "HEAD"], submodulePath) !== EXPECTED_COMMIT) throw new Error("Submodule checkout does not match audited commit");
  if (git(["status", "--porcelain"], submodulePath)) throw new Error("Skill submodule has local changes");

  console.log("OFFICIAL_BIOGRAPHY_SKILL_OK");
  console.log(`skill name: ${skillName}`);
  console.log(`version: ${version}`);
  console.log(`submodule commit: ${EXPECTED_COMMIT}`);
} catch (error) {
  console.error(`OFFICIAL_BIOGRAPHY_SKILL_ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
