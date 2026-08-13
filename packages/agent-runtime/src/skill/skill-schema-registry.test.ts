import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SchemaRegistryError, SkillSchemaRegistry } from "./skill-schema-registry.js";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "schema-registry-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("SkillSchemaRegistry", () => {
  it("loads schemas and supports list/get", async () => {
    const d = path.join(dir, "ok");
    await mkdir(d, { recursive: true });
    await writeFile(path.join(d, "alpha.schema.json"), JSON.stringify({ title: "Alpha", type: "object" }), "utf8");
    await writeFile(path.join(d, "beta.schema.json"), JSON.stringify({ type: "object" }), "utf8");
    const r = await SkillSchemaRegistry.load(d);
    expect(r.count()).toBe(2);
    expect(r.list()).toEqual(["Alpha", "beta"]);
    expect(r.get("Alpha")?.schema).toEqual({ title: "Alpha", type: "object" });
    expect(r.get("beta")?.title).toBeUndefined();
  });

  it("fails on invalid JSON", async () => {
    const d = path.join(dir, "invalid");
    await mkdir(d, { recursive: true });
    await writeFile(path.join(d, "bad.schema.json"), "{ not json", "utf8");
    await expect(SkillSchemaRegistry.load(d)).rejects.toThrow(SchemaRegistryError);
  });

  it("fails on duplicate logical schema names", async () => {
    const d = path.join(dir, "dup");
    await mkdir(d, { recursive: true });
    await writeFile(path.join(d, "one.schema.json"), JSON.stringify({ title: "Same" }), "utf8");
    await writeFile(path.join(d, "two.schema.json"), JSON.stringify({ title: "Same" }), "utf8");
    await expect(SkillSchemaRegistry.load(d)).rejects.toThrow(/Duplicate logical schema name/);
  });
});
