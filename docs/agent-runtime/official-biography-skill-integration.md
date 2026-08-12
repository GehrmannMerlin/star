# Official Biography Skill Integration

## Dependency identity

- Skill name: `official-biography-evidence`
- Skill version: `3.1.0`
- Upstream repository: `https://github.com/GehrmannMerlin/china-official-url-evidence-suite.git`
- Pinned submodule commit: `40993e24109d26cb576b532223956053fcc4672f`
- Project submodule path: `third-party/china-official-url-evidence-suite`
- Runtime Skill path: `third-party/china-official-url-evidence-suite/skills/official-biography-evidence`
- Local reference Skill path: `D:\Develop\CodexSkills\china-official-url-evidence-suite\skills\official-biography-evidence`
- Pi settings path: `.pi/settings.json`

## Ownership boundary

The upstream repository owns the Skill's domain workflow, instructions, schemas, scripts, references, and assets. The Web repository consumes that Skill through a pinned Git submodule and treats all files below `third-party/china-official-url-evidence-suite` as upstream read-only.

Do not copy the Skill into `.pi/skills` or edit the submodule to support Web application work. Skill changes must be committed and reviewed in the upstream repository first, after which this repository may deliberately update its pinned submodule commit.

## Initialize the dependency

After cloning this project, initialize the pinned dependency without changing its commit:

```powershell
git submodule update --init --recursive third-party/china-official-url-evidence-suite
pnpm verify:official-skill
```

## Update the dependency

First compare the candidate upstream Skill against the approved local reference using the same SHA-256 contract set: `SKILL.md`, `skill.yaml`, `references/**`, `schemas/**`, `scripts/**`, and `assets/asset-manifest.json`. Do not proceed when a core contract file differs unexpectedly.

Once an upstream commit is explicitly approved, update only the Gitlink:

```powershell
git -C third-party/china-official-url-evidence-suite fetch origin main
git -C third-party/china-official-url-evidence-suite checkout --detach <approved-commit>
git add third-party/china-official-url-evidence-suite
pnpm verify:official-skill
```

Commit the superproject pointer update separately. Never make or commit edits inside the submodule from this repository.

## Verify the dependency

Run the deterministic, offline project check:

```powershell
pnpm verify:official-skill
```

The check verifies the required Skill structure, frontmatter name, declared version, registered Gitlink, initialized pinned commit, and clean submodule worktree. Success prints `OFFICIAL_BIOGRAPHY_SKILL_OK` together with the Skill name, version, runtime path, and submodule commit.
