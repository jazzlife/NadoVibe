import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const artifactDir = "reports/artifacts";
const scratchPath = "test-results/phase07-workbench-e2e.ts";

test.beforeAll(() => {
  mkdirSync(artifactDir, { recursive: true });
});

test("phase 7 tablet Workbench opens, edits, saves, approves hunks, and commands selected code", async ({ page, request, context, baseURL }) => {
  const gatewayBase = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:18080";
  const setupResponse = await request.post(`${gatewayBase}/api/workspace/files/write`, {
    data: {
      workspaceId: "workspace_dev",
      path: scratchPath,
      content: "export const phaseSeven = 'ready';",
      fileLeaseId: "lease_phase07_setup",
      idempotencyKey: `phase07_setup_${Date.now()}`
    }
  });
  expect(setupResponse.ok()).toBe(true);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${baseURL}/workbench`);
  await expect(page.getByText("Code Workbench")).toBeVisible();
  await expect(page.locator(".cm-editor")).toBeVisible();

  await page.locator(`[data-open-file="${scratchPath}"]`).click();
  await expect(page.locator("#editorMeta")).toContainText(scratchPath);
  await page.locator(".cm-content").click();
  await page.keyboard.press("End");
  await page.keyboard.type("\nexport const savedFromTablet = true;");
  await expect(page.locator("#dirtyIndicator")).toContainText("dirty");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#dirtyIndicator")).toContainText("clean");
  await expect(page.locator("#diffViewer")).toContainText("Tablet Workbench saved changes");

  await page.locator('[data-hunk-decision="approve"]').first().click();
  await expect(page.locator("#diffViewer")).toContainText("approved");

  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.getByRole("button", { name: "Ask Agent" }).click();
  await expect(page.locator("#workbenchTerminalOutput")).toContainText(`${scratchPath}:1-2`);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.locator("#workbenchPalette")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#workbenchPalette")).toBeHidden();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("#guardBanner")).toContainText("오프라인");
  await expect(page.locator("#saveFileButton")).toBeDisabled();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  const touchIssues = await page.evaluate(() => {
    const targets = [...document.querySelectorAll(".touch-button, .touch-icon")];
    return targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;
  });
  expect(touchIssues).toBe(0);
  const viewportFit = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  expect(viewportFit.scrollHeight).toBe(viewportFit.clientHeight);
  await page.screenshot({ path: `${artifactDir}/phase-07-workbench-1024.png`, fullPage: true });
});

test("phase 7 tablet Workbench portrait layout keeps controls reachable without horizontal overflow", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseURL}/workbench`);
  await expect(page.locator("#fileTreeDrawer")).toBeVisible();
  await expect(page.locator("#editorMount")).toBeVisible();
  await expect(page.locator("#terminalSheet")).toBeVisible();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    overflowCount: [...document.querySelectorAll("button, input, .file-row, .hunk-row, .tab-row")].filter((element) => element.scrollWidth > element.clientWidth + 1).length
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.scrollHeight).toBe(metrics.clientHeight);
  expect(metrics.overflowCount).toBeLessThanOrEqual(2);
  await page.screenshot({ path: `${artifactDir}/phase-07-workbench-768.png`, fullPage: true });
});
