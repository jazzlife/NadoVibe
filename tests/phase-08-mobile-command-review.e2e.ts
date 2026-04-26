import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const artifactDir = "reports/artifacts";

test.beforeAll(() => {
  mkdirSync(artifactDir, { recursive: true });
});

test("phase 8 mobile Command Review handles approval, conflict, recovery, commands, final review, notifications, and confirmation", async ({ page, request, context, baseURL }) => {
  const gatewayBase = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:18080";
  const runId = `run_phase08_${Date.now()}`;
  const approvalId = `approval_${runId}_scope`;
  const conflictId = `conflict_${runId}_initial`;
  const recoveryId = `recovery_${runId}_editor`;

  const seed = await request.post(`${gatewayBase}/api/dev/seed`, {
    data: { tenantId: "tenant_dev", userId: "user_dev", workspaceId: "workspace_dev", repositoryId: "repo_nadovibe" }
  });
  expect(seed.ok()).toBe(true);
  const run = await request.post(`${gatewayBase}/api/runs`, {
    data: {
      runId,
      workspaceId: "workspace_dev",
      repositoryId: "repo_nadovibe",
      objective: "phase 08 mobile command review e2e",
      idempotencyKey: `phase08_run_${Date.now()}`
    }
  });
  expect(run.ok()).toBe(true);

  await context.grantPermissions(["notifications"], { origin: new URL(baseURL ?? "http://127.0.0.1:15173").origin });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/mobile#approval-${approvalId}`);
  await expect(page.locator(".mobile-topbar").getByText("Mobile Command", { exact: true })).toBeVisible();
  await expect(page.locator("#mobileNextAction")).toContainText("승인");
  await expect(page.locator(`#approval-${approvalId}`)).toBeVisible();

  await page.locator(`[data-approval-id="${approvalId}"][data-mobile-approval-decision="approve"]`).click();
  await expect(page.locator(`#approval-${approvalId}`)).toContainText("approved");

  await page.locator(`[data-conflict-id="${conflictId}"]`).click();
  await expect(page.locator(`#conflict-${conflictId}`)).toContainText("escalated");

  await page.locator(`#recovery-${recoveryId} [data-mobile-recovery-action="retry"]`).click();
  await expect(page.locator(`#recovery-${recoveryId}`)).toContainText("resolved");

  await page.locator("#mobileCommandRun").selectOption(runId);
  await page.locator("#mobileCommandText").fill("모바일에서 검증 요약을 요청합니다");
  await page.locator("#mobileQuickCommandForm").getByRole("button", { name: "Send Command" }).click();
  await expect(page.locator("#mobileCommandLog")).toContainText("모바일에서 검증 요약");

  await page.locator("#mobileFinalReview [data-mobile-final-review=\"approve\"]").click();
  await expect(page.locator("#mobileFinalReview")).toContainText("approved");

  await page.locator("#notifyEnabled").setChecked(true);
  await page.locator("#notifyApprovals").setChecked(true);
  await page.locator("#mobileNotificationSettings").getByRole("button", { name: "Save Settings" }).click();
  await expect(page.locator("#mobileNotificationState")).toContainText(/saved|not registered|granted|denied|unsupported/);

  await page.locator("#registerPushButton").click();
  await expect(page.locator("#mobileNotificationState")).toContainText(/granted|denied|unsupported|not registered/);

  await page.locator(`[data-run-id="${runId}"][data-mobile-run-action="cancel"]`).click();
  await expect(page.locator("#mobileConfirmSheet")).toBeVisible();
  await page.locator("#mobileConfirmApply").click();
  await expect(page.locator(`[data-mobile-run="${runId}"]`)).toContainText("cancelled");

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("#mobileCommandSubmit")).toBeDisabled();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    touchIssues: [...document.querySelectorAll("button, a, input, select, textarea")].filter((element) => {
      if (element.classList.contains("skip-link")) return false;
      const target = element.matches('input[type="checkbox"]') ? element.closest("label") ?? element : element;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return rect.width < 44 || rect.height < 44;
    }).length
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.touchIssues).toBe(0);
  await page.screenshot({ path: `${artifactDir}/phase-08-mobile-command-390.png`, fullPage: true });
});

for (const width of [390, 430, 480]) {
  test(`phase 8 mobile layout remains reachable at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${baseURL}/mobile#inbox`);
    await expect(page.locator("#mobileNextAction")).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowCount: [...document.querySelectorAll("button, a, input, select, textarea, .mobile-card")].filter((element) => element.scrollWidth > element.clientWidth + 1).length
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.overflowCount).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${artifactDir}/phase-08-mobile-command-${width}.png`, fullPage: true });
  });
}

test("phase 8 mobile tablet breakpoint switches from singleview to splitview shell", async ({ page, request, baseURL }) => {
  const gatewayBase = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:18080";
  const seed = await request.post(`${gatewayBase}/api/dev/seed`, {
    data: { tenantId: "tenant_dev", userId: "user_dev", workspaceId: "workspace_dev", repositoryId: "repo_nadovibe" }
  });
  expect(seed.ok()).toBe(true);

  await page.setViewportSize({ width: 900, height: 844 });
  await page.goto(`${baseURL}/mobile`);
  await expect(page.locator("#mobileSplitView")).toBeVisible();
  await expect(page.locator(".mobile-topbar")).toBeHidden();
  await expect(page.locator(".mobile-main")).toBeHidden();
  await expect(page.locator('[data-split-slot="conversation"]')).toBeVisible();
  await expect(page.locator('[data-split-slot="workspace"]')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    splitColumns: getComputedStyle(document.querySelector("#mobileSplitView") as Element).gridTemplateColumns.split(" ").length
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.splitColumns).toBe(2);
  await page.screenshot({ path: `${artifactDir}/phase-08-mobile-splitview-900.png`, fullPage: true });
});
