import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

export type RegisteredSchema = {
  /** Logical name: the schema `title`, or the filename stem when absent. */
  name: string;
  title: string | undefined;
  $id: string | undefined;
  filePath: string;
  schema: unknown;
};

export class SchemaRegistryError extends Error {}

/**
 * Read-only registry over the pinned Skill's `schemas/*.json`.
 *
 * This phase only loads and indexes the upstream schemas; it never rewrites
 * them and never redefines them. Duplicate logical names and invalid JSON are
 * reported as errors.
 */
export class SkillSchemaRegistry {
  private schemas = new Map<string, RegisteredSchema>();

  private constructor() {}

  static async load(schemasDir: string): Promise<SkillSchemaRegistry> {
    const registry = new SkillSchemaRegistry();
    await registry.reload(schemasDir);
    return registry;
  }

  async reload(schemasDir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(schemasDir);
    } catch {
      throw new SchemaRegistryError(`Schema directory not found: ${schemasDir}`);
    }

    const files = entries.filter((f) => f.endsWith(".json")).sort();
    const next = new Map<string, RegisteredSchema>();

    for (const file of files) {
      const filePath = path.join(schemasDir, file);
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(filePath, "utf8"));
      } catch {
        throw new SchemaRegistryError(`Invalid JSON in schema: ${filePath}`);
      }

      const obj = (parsed ?? {}) as Record<string, unknown>;
      const titleRaw = typeof obj.title === "string" ? obj.title : "";
      const title = titleRaw.length > 0 ? titleRaw : undefined;
      const $id = typeof obj["$id"] === "string" ? obj["$id"] : undefined;
      const stem = file.replace(/\.schema\.json$/, "").replace(/\.json$/, "");
      const name = title ?? stem;

      if (next.has(name)) {
        throw new SchemaRegistryError(`Duplicate logical schema name: ${name}`);
      }
      next.set(name, { name, title, $id, filePath, schema: parsed });
    }

    this.schemas = next;
  }

  list(): string[] {
    return [...this.schemas.keys()].sort();
  }

  get(name: string): RegisteredSchema | undefined {
    return this.schemas.get(name);
  }

  count(): number {
    return this.schemas.size;
  }
}
