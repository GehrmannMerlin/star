import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vite 开发服务器（生产由 Fastify 托管 apps/web 构建产物，见规格 §6.2.5）。
// 内联 Vitest 配置：jsdom 环境供 @testing-library/react 使用。
export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
