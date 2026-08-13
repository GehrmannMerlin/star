import path from "node:path";
import { existsSync } from "node:fs";

/** Pi's project config directory name (matches Pi's `piConfig.configDir`). */
export const PI_CONFIG_DIR_NAME = ".pi";

export type RuntimeConfig = {
  /** Repository root. All skill paths resolve relative to this directory. */
  projectRoot: string;
  /** Pi's project config directory (contains settings.json). */
  piConfigDir: string;
};

/**
 * Walk upward from `startDir` to find the repository root, identified by the
 * presence of `.pi/settings.json`. Falls back to `startDir` when not found.
 * This keeps every skill path repo-relative (no hardcoded absolute paths).
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, PI_CONFIG_DIR_NAME, "settings.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(startDir);
    }
    dir = parent;
  }
}

export function createRuntimeConfig(overrides?: { projectRoot?: string }): RuntimeConfig {
  const projectRoot = overrides?.projectRoot ?? findProjectRoot();
  return {
    projectRoot,
    piConfigDir: path.join(projectRoot, PI_CONFIG_DIR_NAME),
  };
}
