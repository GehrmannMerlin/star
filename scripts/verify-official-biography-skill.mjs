import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const submodulePath = path.join(
  projectRoot,
  "third-party",
  "china-official-url-evidence-suite",
);
const skillPath = path.join(
  submodulePath,
  "skills",
  "official-biography-evidence",
);
const submoduleRelativePath = "third-party/china-official-url-evidence-suite";

function requireFile(relativePath) {
  const absolutePath = path.join(skillPath, relativePath);
  if (!statSync(absolutePath).isFile()) {
    throw new Error(`Expected file: ${absolutePath}`);
  }
  return absolutePath;
}

function requireDirectory(relativePath) {
  const absolutePath = path.join(skillPath, relativePath);
  if (!statSync(absolutePath).isDirectory()) {
    throw new Error(`Expected directory: ${absolutePath}`);
  }
}

function readYamlScalar(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escapedKey}:\\s*["']?([^"'#\\r\\n]+?)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function git(args, cwd = projectRoot) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

try {
  const skillFile = requireFile("SKILL.md");
  const skillYamlFile = requireFile("skill.yaml");
  for (const directory of ["references", "schemas", "scripts", "assets"]) {
    requireDirectory(directory);
  }

  const skillText = readFileSync(skillFile, "utf8");
  const frontmatter = skillText.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) {
    throw new Error("SKILL.md is missing YAML frontmatter");
  }

  const skillName = readYamlScalar(frontmatter[1], "name");
  if (skillName !== "official-biography-evidence") {
    throw new Error(`Unexpected Skill name: ${skillName || "<missing>"}`);
  }

  const skillYaml = readFileSync(skillYamlFile, "utf8");
  const version = readYamlScalar(skillYaml, "version");
  if (!version) {
    throw new Error("skill.yaml is missing a readable version");
  }

  const gitlink = git(["ls-files", "--stage", "--", submoduleRelativePath]);
  const gitlinkMatch = gitlink.match(/^160000 ([0-9a-f]{40,64}) 0\t/);
  if (!gitlinkMatch) {
    throw new Error(`${submoduleRelativePath} is not a registered Git submodule`);
  }

  const submoduleStatus = git(["submodule", "status", "--", submoduleRelativePath]);
  const statusMarker = submoduleStatus[0];
  if (statusMarker !== " ") {
    throw new Error(`Submodule is not initialized at its pinned commit: ${submoduleStatus}`);
  }

  const submoduleCommit = git(["rev-parse", "HEAD"], submodulePath);
  if (submoduleCommit !== gitlinkMatch[1]) {
    throw new Error(
      `Submodule commit ${submoduleCommit} does not match Gitlink ${gitlinkMatch[1]}`,
    );
  }

  const submoduleChanges = git(["status", "--porcelain"], submodulePath);
  if (submoduleChanges) {
    throw new Error(`Upstream Skill submodule has local changes:\n${submoduleChanges}`);
  }

  console.log("OFFICIAL_BIOGRAPHY_SKILL_OK");
  console.log(`skill name: ${skillName}`);
  console.log(`version: ${version}`);
  console.log(`path: ${skillPath}`);
  console.log(`submodule commit: ${submoduleCommit}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OFFICIAL_BIOGRAPHY_SKILL_ERROR: ${message}`);
  process.exitCode = 1;
}
