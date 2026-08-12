import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEvidenceStore, EvidenceCorruptError } from "./store.js";

describe("证据库", () => {
  let dir: string;
  let store: ReturnType<typeof createEvidenceStore>;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "stellaris-ev-"));
    store = createEvidenceStore(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("相同内容去重，不同内容不同哈希", async () => {
    const a = await store.save({ raw: new TextEncoder().encode("same"), mimeType: "text/html", category: "html" });
    const b = await store.save({ raw: new TextEncoder().encode("same"), mimeType: "text/html", category: "html" });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.relativePath).toBe(b.relativePath);
    const c = await store.save({ raw: new TextEncoder().encode("other"), mimeType: "text/html", category: "html" });
    expect(c.contentHash).not.toBe(a.contentHash);
  });

  it("相对路径拒绝绝对路径与穿越", async () => {
    expect(() => store.resolvePath("C:/Windows/evil")).toThrow();
    expect(() => store.resolvePath("../outside")).toThrow();
    expect(() => store.resolvePath("/abs/path")).toThrow();
  });

  it("读取校验哈希，损坏抛 EvidenceCorruptError", async () => {
    const saved = await store.save({ raw: new TextEncoder().encode("tamper"), mimeType: "text/html", category: "html" });
    const p = store.resolvePath(saved.relativePath);
    await writeFile(p, Buffer.from("tampered!!"));
    await expect(store.read(saved.relativePath)).rejects.toThrow(EvidenceCorruptError);
  });

  it("完整性检查报告孤立文件与缺失引用", async () => {
    const ok = await store.save({ raw: new TextEncoder().encode("integrity-ok"), mimeType: "text/html", category: "html" });
    // 注入一个孤立文件（磁盘有、引用无）。
    const orphanDir = join(dir, "sha256", "orphan");
    await mkdir(orphanDir, { recursive: true });
    const orphanPath = join(orphanDir, "orphan.html.bin");
    await writeFile(orphanPath, "orphan");
    const result = await store.integrityCheck({
      referencedPaths: [ok.relativePath, "sha256/ab/cd/does-not-exist.html.bin"],
    });
    expect(result.orphanFiles).toContain("sha256/orphan/orphan.html.bin");
    expect(result.missingReferences).toContain("sha256/ab/cd/does-not-exist.html.bin");
  });

  it("保存后 atomic 改名，无 tmp 残留", async () => {
    await store.save({ raw: new TextEncoder().encode("atomic-test"), mimeType: "application/json", category: "json" });
    // tmp 目录不应再有文件
    const { readdir } = await import("node:fs/promises");
    const tmpDir = join(dir, "tmp");
    const files = await readdir(tmpDir).catch(() => []);
    expect(files).toEqual([]);
  });
});
