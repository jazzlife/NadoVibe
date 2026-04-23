import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  use: {
    baseURL: process.env.WEB_BASE_URL ?? "http://127.0.0.1:15173",
    trace: "retain-on-failure"
  }
});
