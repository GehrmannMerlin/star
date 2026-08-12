import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

export interface FixtureRoot {
  pathPrefix: string;
  dir: string;
}

export interface FixtureServer {
  url: string;
  basePort: number;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

/**
 * 离线固定金标 HTTP 服务器（本地端口 0 自动分配）。
 * - 静态文件：<pathPrefix>/<file> 映射到 <dir>/<file>；
 * - 特殊路由（用于测试重定向/超限/循环）：
 *   - <pathPrefix>/redirect  -> 302 -> <pathPrefix>/collection.html
 *   - <pathPrefix>/loop      -> 302 -> <pathPrefix>/loop（无限循环，触发重定向上限）
 *   - <pathPrefix>/big.txt   -> 约 2 MB 超大正文（触发 maxBytes）
 */
export async function createFixtureServer(roots: FixtureRoot[]): Promise<FixtureServer> {
  const specialRoutes = new Map<string, (res: import("node:http").ServerResponse) => void>();
  for (const root of roots) {
    specialRoutes.set(`${root.pathPrefix}/redirect`, (res) => {
      res.writeHead(302, { Location: `${root.pathPrefix}/collection.html` });
      res.end();
    });
    specialRoutes.set(`${root.pathPrefix}/loop`, (res) => {
      res.writeHead(302, { Location: `${root.pathPrefix}/loop` });
      res.end();
    });
    specialRoutes.set(`${root.pathPrefix}/big.txt`, (res) => {
      const big = Buffer.alloc(2 * 1024 * 1024, "x");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(big);
    });
  }

  const server: Server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    // 特路由优先。
    if (specialRoutes.has(url)) {
      specialRoutes.get(url)!(res);
      return;
    }
    // 静态文件：匹配任一 root 的 pathPrefix；对 /ldr/ 等官网相对链接别名映射到首个 root 目录。
    for (const root of roots) {
      if (url.startsWith(root.pathPrefix)) {
        const rel = url.slice(root.pathPrefix.length).replace(/^\/+/, "");
        const served = await serveFile(root.dir, rel, res);
        if (!served) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("not found");
        }
        return;
      }
    }
    // 相对链接别名：如 /ldr/zhang-san.html -> <首个root.dir>/zhang-san.html
    const primaryRoot = roots[0];
    if (primaryRoot) {
      const aliased = url.replace(/^\/[^/]+\//, "");
      if (aliased !== url) {
        const didServe = await serveFile(primaryRoot.dir, aliased, res);
        if (didServe) return;
      }
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  async function serveFile(dir: string, rel: string, res: import("node:http").ServerResponse): Promise<boolean> {
    const filePath = join(dir, rel);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
      res.end(data);
      return true;
    } catch {
      return false;
    }
  }

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") {
    throw new Error("fixture server 地址无效");
  }
  const basePort = addr.port;

  return {
    url: `http://127.0.0.1:${basePort}`,
    basePort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
