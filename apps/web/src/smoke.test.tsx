import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";

describe("web baseline", () => {
  it("根容器文档可用（jsdom）", () => {
    const el = document.createElement("div");
    expect(el.id).toBe("");
  });
  it("渲染后出现标题文本", () => {
    render(
      <StrictMode>
        <h1>政务简历采集</h1>
      </StrictMode>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("政务简历采集");
  });
});
