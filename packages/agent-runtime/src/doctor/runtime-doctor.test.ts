import { describe, expect, it } from "vitest";
import { formatDoctorResult, runDoctor } from "./runtime-doctor.js";

describe("RuntimeDoctor", () => {
  it("reports the pinned skill and its schemas as OK", async () => {
    const result = await runDoctor();
    expect(result.pi_sdk).toBe("OK");
    expect(result.pi_version).toBe("0.84.1");
    expect(result.skill.status).toBe("OK");
    expect(result.skill.name).toBe("official-biography-evidence");
    expect(result.skill.version).toBe("3.1.0");
    expect(result.schema_registry.status).toBe("OK");
    expect(result.schema_registry.count).toBe(34);
  });

  it("accepts MODEL_NOT_CONFIGURED while staying FOUNDATION_READY", async () => {
    const result = await runDoctor();
    expect(result.model.status).toBe("NOT_CONFIGURED");
    expect(result.runtime).toBe("FOUNDATION_READY");
  });

  it("keeps production coding tools disabled", async () => {
    const result = await runDoctor();
    expect(result.production_coding_tools.enabled).toBe("NO");
    expect(result.production_coding_tools.tools).toEqual([]);
  });

  it("reports the generic tool gateway with all four custom tools", async () => {
    const result = await runDoctor();
    expect(result.tool_gateway.status).toBe("OK");
    expect(result.tool_gateway.registered_tools).toBe(4);
    expect(result.tool_gateway.tools).toEqual([
      "fetch_page",
      "get_region_context",
      "render_page",
      "search_web",
    ]);
    expect(result.runtime).toBe("FOUNDATION_READY");
  });

  it("reports the http fetch tool as READY and search as NOT_CONFIGURED", async () => {
    const result = await runDoctor();
    expect(result.http.status).toBe("READY");
    expect(result.search.provider).toBe("NOT_CONFIGURED");
    expect(result.search.status).toBe("NOT_CONFIGURED");
    expect(result.runtime).toBe("FOUNDATION_READY");
  });

  it("reports browser readiness without ever failing the foundation doctor", async () => {
    const result = await runDoctor();
    expect(["READY", "NOT_READY"]).toContain(result.browser.status);
    if (result.browser.status === "READY") {
      expect(result.browser.executable_path).toBeTruthy();
    }
    expect(result.runtime).toBe("FOUNDATION_READY");
  });

  it("formats output with the doctor banner and no secrets", async () => {
    const text = formatDoctorResult(await runDoctor());
    expect(text).toContain("PI_RUNTIME_DOCTOR");
    expect(text).toContain("browser:");
    for (const secret of ["secret", "api key", "password", "token"]) {
      expect(text.toLowerCase()).not.toContain(secret);
    }
  });
});
