import { describe, expect, it } from "vitest";
import { apiUrl } from "./api-url.js";

describe("apiUrl", () => {
  it("keeps the root deployment API path", () => {
    expect(apiUrl("tasks", "/")).toBe("/api/tasks");
  });

  it("prefixes API paths for the Homer subpath build", () => {
    expect(apiUrl("tasks/t1/results", "/zhengwujianli/")).toBe(
      "/zhengwujianli/api/tasks/t1/results",
    );
  });

  it("preserves query strings and removes a leading slash", () => {
    expect(apiUrl("/regions/children?parent=340000", "/zhengwujianli")).toBe(
      "/zhengwujianli/api/regions/children?parent=340000",
    );
  });
});
