import assert from "node:assert/strict";
import test from "node:test";
import { parseEnqueueCommandRequest, parseHunkDecisionRequest, parseWorkspaceSearchRequest, renderGeneratedGatewayBrowserClient } from "@nadovibe/api-contract";
import { renderServiceWorker, renderTabletWorkbenchAppJs, renderTabletWorkbenchCss, renderTabletWorkbenchHtml } from "@nadovibe/ui";

test("phase 7 implementation defines the tablet Code Workbench contract", () => {
  const css = renderTabletWorkbenchCss();
  const html = renderTabletWorkbenchHtml();

  assert.match(html, /NadoVibe Code Workbench/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /grid-template-columns: 248px minmax\(0, 1fr\) 184px/);
  assert.match(css, /background: var\(--code\)/);
});

test("tablet workbench shell includes required Phase 7 surfaces and offline guard", () => {
  const html = renderTabletWorkbenchHtml();
  const js = renderTabletWorkbenchAppJs();
  const serviceWorker = renderServiceWorker();

  for (const id of [
    "fileTreeDrawer",
    "workspaceSearch",
    "editorTabs",
    "editorMount",
    "saveFileButton",
    "revertFileButton",
    "askSelectionButton",
    "diffViewer",
    "terminalSheet",
    "agentCompactRail",
    "workbenchPalette"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /CodeMirror 6 editor/);
  assert.match(js, /codemirror-vendor\.js/);
  assert.match(js, /selection/);
  assert.match(js, /offline/);
  assert.match(js, /fileLeaseId: state\.fileLeaseId/);
  assert.doesNotMatch(js, /lease_tablet_/);
  assert.match(serviceWorker, /\/workbench/);
  assert.match(serviceWorker, /\/assets\/codemirror-vendor\.js/);
  assert.doesNotMatch(html + js, /container|password|token|waiting_for_capacity|backpressure|overload|queue position/i);
});

test("phase 7 Gateway client and parsers cover search, hunk approval, and selection commands", () => {
  const client = renderGeneratedGatewayBrowserClient("http://127.0.0.1:8080");
  assert.match(client, /\/api\/workspace\/search/);
  assert.match(client, /\/api\/diff\/hunks\/decision/);

  assert.deepEqual(parseWorkspaceSearchRequest({ workspaceId: "workspace_dev", query: "render", path: "packages" }), {
    workspaceId: "workspace_dev",
    query: "render",
    path: "packages"
  });
  assert.deepEqual(parseHunkDecisionRequest({ path: "a.ts", hunkId: "h1", decision: "approve", reason: "ok", idempotencyKey: "idem" }), {
    path: "a.ts",
    hunkId: "h1",
    decision: "approve",
    reason: "ok",
    idempotencyKey: "idem"
  });
  assert.equal(parseEnqueueCommandRequest({
    runId: "run",
    instruction: "review",
    resourceIntent: "light",
    idempotencyKey: "idem",
    selection: { path: "a.ts", fromLine: 1, toLine: 3, text: "const a = 1;" }
  }).selection?.toLine, 3);
  assert.throws(() => parseHunkDecisionRequest({ path: "a.ts", hunkId: "h1", decision: "merge", reason: "x", idempotencyKey: "idem" }), /decision/);
});
