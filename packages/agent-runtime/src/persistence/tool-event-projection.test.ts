import { describe, expect, it } from "vitest";
import { projectToolEventData, toolEventDataFromProjection } from "./tool-event-projection.js";

describe("tool event data minimization projection", () => {
  it("fetch_page keeps URL proof metadata and strips raw HTML", () => {
    const projection = projectToolEventData("fetch_page", {
      requestedUrl: "https://a.example/1",
      finalUrl: "https://a.example/final/1",
      statusCode: 200,
      contentType: "text/html",
      content: "<html><body>secret</body></html>",
      bytes: 99999,
      Authorization: "Bearer topsecret",
    });
    expect(projection.url).toEqual({
      requestedUrl: "https://a.example/1",
      finalUrl: "https://a.example/final/1",
      statusCode: 200,
      bytes: 99999,
    });
    expect(projection.search).toBeNull();
    expect(projection.submission).toBeNull();
    // 关键：绝不保留原始内容 / secret-like 字段。
    expect(JSON.stringify(projection)).not.toContain("<html");
    expect(JSON.stringify(projection)).not.toContain("secret");
    expect(JSON.stringify(projection)).not.toContain("Authorization");
    expect(JSON.stringify(projection)).not.toContain("Bearer");
    expect(JSON.stringify(projection)).not.toContain("text/html");
  });

  it("render_page projects the same URL group", () => {
    const projection = projectToolEventData("render_page", {
      requestedUrl: "https://a.example/1",
      finalUrl: "https://a.example/1",
      statusCode: 200,
      dom: "<html>...</html>",
    });
    expect(projection.url?.finalUrl).toBe("https://a.example/1");
    expect(JSON.stringify(projection)).not.toContain("<html>");
  });

  it("inspect_page keeps only url, not the observation payload", () => {
    const projection = projectToolEventData("inspect_page", {
      url: "https://a.example/1",
      title: "区长 王安伟",
      links: ["/1.html", "/2.html"],
      personLikeMembers: ["王安伟", "董涵"],
      date: "2026-08-01",
    });
    expect(projection.url).toEqual({ url: "https://a.example/1" });
    expect(JSON.stringify(projection)).not.toContain("王安伟");
    expect(JSON.stringify(projection)).not.toContain("links");
  });

  it("search_web keeps provider + resultCount, drops snippets/results", () => {
    const projection = projectToolEventData("search_web", {
      provider: "bocha",
      results: [
        { url: "https://a.example/1", snippet: "snippet-1" },
        { url: "https://a.example/2", snippet: "snippet-2" },
      ],
    });
    expect(projection.search).toEqual({ provider: "bocha", resultCount: 2 });
    expect(JSON.stringify(projection)).not.toContain("snippet");
    expect(JSON.stringify(projection)).not.toContain("https://a.example");
  });

  it("submit_investigator_evidence keeps payloadHash + candidateCount, drops the payload", () => {
    const projection = projectToolEventData("submit_investigator_evidence", {
      payloadHash: "hash-1",
      candidateCount: 2,
      primary1TargetId: "glq-target-primary1",
      candidates: [{ url: "https://a.example/1" }],
    });
    expect(projection.submission).toEqual({ payloadHash: "hash-1", candidateCount: 2 });
    expect(JSON.stringify(projection)).not.toContain("glq-target-primary1");
    expect(JSON.stringify(projection)).not.toContain("a.example");
  });

  it("unknown tools and missing data project to an empty view", () => {
    expect(projectToolEventData("get_region_context", { regionCode: "320106" })).toEqual({
      url: null,
      search: null,
      submission: null,
    });
    expect(projectToolEventData("fetch_page", undefined)).toEqual({
      url: null,
      search: null,
      submission: null,
    });
  });

  it("toolEventDataFromProjection reconstructs gate-usable data", () => {
    expect(
      toolEventDataFromProjection(
        projectToolEventData("fetch_page", {
          requestedUrl: "https://a.example/1",
          finalUrl: "https://a.example/1",
          statusCode: 200,
          content: "secret",
        }),
      ),
    ).toEqual({ requestedUrl: "https://a.example/1", finalUrl: "https://a.example/1", statusCode: 200 });
  });
});
