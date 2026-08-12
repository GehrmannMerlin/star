import { describe, it, expect } from "vitest";
import { createSafeEgressPolicy, assertAllowedUrl, assertRedirectChain } from "./safe-egress.js";

const productionPolicy = createSafeEgressPolicy({ mode: "production" });

describe("safe-egress 安全出口", () => {
  it("拒绝 file:/ftp:/ws:/data: 协议", () => {
    for (const u of ["file:///etc/passwd", "ftp://x/", "ws://x/", "data:text/plain,x"]) {
      expect(() => assertAllowedUrl(u, productionPolicy)).toThrow();
    }
  });

  it("生产模式拒绝 127.0.0.1/10.0.0.0/169.254.169.254/::1", () => {
    for (const u of [
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
    ]) {
      expect(() => assertAllowedUrl(u, productionPolicy)).toThrow();
    }
  });

  it("生产模式拒绝 URL 用户名/密码", () => {
    expect(() => assertAllowedUrl("http://user:pass@example.com/", productionPolicy)).toThrow();
  });

  it("offline-fixture 模式对登记测试端口放行", () => {
    const policy = createSafeEgressPolicy({ mode: "offline-fixture", allowedTestPorts: new Set([8899]) });
    expect(() => assertAllowedUrl("http://127.0.0.1:8899/golden/collection.html", policy)).not.toThrow();
  });

  it("重定向逐跳复核：中间跳落到私网被拒", () => {
    expect(() => assertRedirectChain(["http://ok/", "http://10.0.0.1/"], productionPolicy)).toThrow();
  });

  it("默认端口 80/443 放行，非默认端口拒绝", () => {
    expect(() => assertAllowedUrl("http://example.com/", productionPolicy)).not.toThrow();
    expect(() => assertAllowedUrl("https://example.com/", productionPolicy)).not.toThrow();
    expect(() => assertAllowedUrl("http://example.com:8080/", productionPolicy)).toThrow();
  });
});
