import { describe, it, expect } from "vitest";
import { buildApp } from "./server.js";

describe("backend baseline", () => {
  it("/health 返回 ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });
});
