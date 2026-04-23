import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const artifactDir = "reports/artifacts";

test.beforeAll(() => {
  mkdirSync(artifactDir, { recursive: true });
});

test("phase 6 Control Room supports workspace seed, run creation, command enqueue, approval, supervisor, and editor actions", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/");
  await expect(page.getByText("Agent Control Room")).toBeVisible();

  const seedButton = page.getByRole("button", { name: "Workspace 준비" });
  if (await seedButton.isVisible()) {
    await expect(page.getByText("워크스페이스를 준비해야 합니다")).toBeVisible();
    await seedButton.click();
  }
  await expect(page.locator("#workspaceSelect")).toContainText("NadoVibe Platform");

  await page.locator("#runObjective").fill("phase 06 web control room e2e 검증");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator("#agentHierarchy")).toContainText("SupervisorAgent");
  await expect(page.locator("#supervisorDecisions")).toContainText("assign scoped contracts");
  await expect(page.locator("#approvalInbox")).toContainText("작업 범위 확장");

  await page.locator("#commandInstruction").fill("테스트 실행 결과를 수집해 보고하십시오");
  await page.locator("#commandIntent").selectOption("test");
  await page.getByRole("button", { name: "Enqueue" }).click();
  await expect(page.locator("#commandQueue")).toContainText("테스트 실행 결과");
  await expect(page.locator("#terminalOutput")).toContainText("명령이 접수되었습니다.");

  await page.locator("[data-approval]").first().click();
  await expect(page.locator("#approvalInbox")).toContainText("approved");

  await page.locator('[data-supervisor-action="pause"]').first().click();
  await expect(page.locator("#supervisorDecisions")).toContainText("pause");

  if ((await page.locator("#editorActionButton").innerText()) !== "Revoke") {
    await page.locator("#editorActionButton").click();
  }
  await expect(page.locator("#editorSession")).toContainText("ready");
  await expect(page.locator("#editorSession")).not.toContainText("token");

  await page.locator("#fileTree [data-file-path]").first().click();
  await expect(page.locator("#codeInspector")).not.toContainText("password");

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/quota|capacity|waiting_for_capacity|backpressure|overload|queue position|password|token|container/i);
  expect(consoleErrors).toEqual([]);

  await page.screenshot({ path: `${artifactDir}/phase-06-control-room-1440.png`, fullPage: true });
});

test("phase 6 responsive layouts render at 1024 and 768 without text overlap indicators", async ({ page }) => {
  await page.goto("/");
  const seedButton = page.getByRole("button", { name: "Workspace 준비" });
  if (await seedButton.isVisible()) {
    await seedButton.click();
  }
  await page.locator("#runObjective").fill("responsive verification");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator("#agentHierarchy")).toContainText("SupervisorAgent");

  await page.setViewportSize({ width: 1024, height: 820 });
  await expect(page.locator(".ide-grid")).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/phase-06-control-room-1024.png`, fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator("#commandForm")).toBeVisible();
  await expect(page.locator("#finalReviewGate")).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/phase-06-control-room-768.png`, fullPage: true });

  const overflowCount = await page.evaluate(() => {
    const elements = [...document.querySelectorAll("button, .list-item, .panel-heading, input, select")];
    return elements.filter((element) => element.scrollWidth > element.clientWidth + 1).length;
  });
  expect(overflowCount).toBeLessThanOrEqual(3);
});
