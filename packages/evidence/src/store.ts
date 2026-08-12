import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  stat,
  rm,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

/** 证据损坏错误（读取时哈希校验失败）。 */
export class EvidenceCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceCorruptError";
  }
}

export interface SavedEvidence {
  contentHash: string;
  /** 证据根下的相对安全路径，如 sha256/ab/cd/<hash>.html.bin。 */
  relativePath: string;
  sizeBytes: number;
}

export interface IntegrityReport {
  /** DB 引用但磁盘缺失的相对路径。 */
  missingReferences: string[];
  /** 磁盘存在但未被任何引用覆盖的相对路径。 */
  orphanFiles: string[];
  totalFiles: number;
}

export interface EvidenceStore {
  save(input: {
    raw: Uint8Array;
    mimeType: string;
    charset?: string;
    category: "html" | "json" | "headers" | "screenshot";
  }): Promise<SavedEvidence>;
  read(relativePath: string): Promise<Uint8Array>;
  resolvePath(relativePath: string): string;
  integrityCheck(input: { referencedPaths: string[] }): Promise<IntegrityReport>;
}

/**
 * 内容寻址证据库（规格 §17.2，根目录 E:\StellarisData\evidence）。
 * - 对未压缩原始字节流式计算 SHA-256；
 * - 写入 rootDir/tmp/<uuid>，fsync 后原子 rename 到 sha256/<前两位>/<次两位>/<hash>.<category>.<压缩格式>；
 * - 相同内容只保存一份（去重）；数据库只保存相对路径（禁止任意绝对路径/穿越）；
 * - 读取时重新校验哈希；提供完整性检查入口。
 */
export function createEvidenceStore(rootDir: string): EvidenceStore {
  const sha256 = (raw: Uint8Array): string =>
    createHash("sha256").update(raw).digest("hex");

  const safeRelPath = (relativePath: string): string => {
    // 只允许证据根下的相对路径：拒绝绝对路径、盘符、穿越、空路径。
    const norm = relativePath.replace(/\\/g, "/");
    if (norm.startsWith("/") || norm.includes("..") || /^[a-zA-Z]:/.test(norm) || norm.length === 0) {
      throw new Error(`非法证据相对路径: ${relativePath}`);
    }
    return norm;
  };

  const resolvePath = (relativePath: string): string => {
    const rel = safeRelPath(relativePath);
    const resolved = resolve(rootDir, ...rel.split("/"));
    // 双保险：解析后仍在 rootDir 内。
    if (!resolved.startsWith(resolve(rootDir) + sep)) {
      throw new Error(`证据路径越出根目录: ${relativePath}`);
    }
    return resolved;
  };

  async function save(input: {
    raw: Uint8Array;
    mimeType: string;
    charset?: string;
    category: "html" | "json" | "headers" | "screenshot";
  }): Promise<SavedEvidence> {
    const contentHash = sha256(input.raw);
    const ext = input.category === "screenshot" ? "png" : input.category === "json" ? "json" : "bin";
    const relativePath = `sha256/${contentHash.slice(0, 2)}/${contentHash.slice(2, 4)}/${contentHash}.${input.category}.${ext}`;
    const finalPath = resolvePath(relativePath);

    // 已存在（去重）则直接返回。
    try {
      await stat(finalPath);
      return { contentHash, relativePath, sizeBytes: input.raw.byteLength };
    } catch {
      // 不存在，继续写入。
    }

    // 临时写入 + 原子改名（同盘）。
    await mkdir(join(resolve(rootDir), "tmp"), { recursive: true });
    const tmpPath = join(resolve(rootDir), "tmp", `${randomUUID()}.tmp`);
    await writeFile(tmpPath, input.raw);
    await mkdir(join(resolve(rootDir), "sha256", contentHash.slice(0, 2), contentHash.slice(2, 4)), {
      recursive: true,
    });
    await rename(tmpPath, finalPath);

    return { contentHash, relativePath, sizeBytes: input.raw.byteLength };
  }

  async function read(relativePath: string): Promise<Uint8Array> {
    const p = resolvePath(relativePath);
    const raw = new Uint8Array(await readFile(p));
    const hash = sha256(raw);
    // 相对路径首段即哈希目录，核对哈希一致。
    const expectedHash = relativePath.split("/")[2] ?? "";
    if (hash !== expectedHash) {
      throw new EvidenceCorruptError(`哈希校验失败: ${relativePath} (expected ${expectedHash}, got ${hash})`);
    }
    return raw;
  }

  async function integrityCheck(input: { referencedPaths: string[] }): Promise<IntegrityReport> {
    const missingReferences: string[] = [];
    for (const rel of input.referencedPaths) {
      try {
        await stat(resolvePath(rel));
      } catch {
        missingReferences.push(rel);
      }
    }

    const orphanFiles: string[] = [];
    const referenced = new Set(input.referencedPaths.map(safeRelPath));
    const walk = async (dir: string, prefix: string): Promise<void> => {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        const rel = prefix === "" ? entry : `${prefix}/${entry}`;
        const s = await stat(full);
        if (s.isDirectory()) {
          await walk(full, rel);
        } else {
          if (!referenced.has(rel)) {
            orphanFiles.push(rel);
          }
        }
      }
    };
    await walk(join(resolve(rootDir), "sha256"), "sha256");

    const totalFiles = orphanFiles.length + referenced.size - missingReferences.length;
    return { missingReferences, orphanFiles, totalFiles: Math.max(0, totalFiles) };
  }

  return { save, read, resolvePath, integrityCheck };
}
