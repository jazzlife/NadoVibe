export const ideShellTokens = {
  color: {
    canvas: "#f5f6f0",
    surface: "#ffffff",
    surfaceAlt: "#eef4f1",
    ink: "#1b2421",
    muted: "#63706b",
    soft: "#d8e1dc",
    teal: "#117c6f",
    indigo: "#3651a8",
    amber: "#bd6b16",
    green: "#2f855a",
    red: "#b43c3c",
    violet: "#6f4aa8",
    code: "#151b18"
  },
  radius: {
    panel: "8px",
    control: "6px"
  },
  layout: {
    railWidth: "292px",
    inspectorWidth: "430px",
    toolbarHeight: "58px"
  }
} as const;

export function renderControlRoomHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${ideShellTokens.color.teal}" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <title>NadoVibe Control Room</title>
  <style>${renderShellCss()}</style>
</head>
<body>
  <div id="app" class="control-room" data-loading="true">
    <header class="topbar" aria-label="NadoVibe top controls">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">NV</span>
        <div>
          <strong>NadoVibe</strong>
          <span>Agent Control Room</span>
        </div>
      </div>
      <div class="topbar-selectors">
        <label><span>Workspace</span><select id="workspaceSelect"></select></label>
        <label><span>Repository</span><select id="repositorySelect"></select></label>
      </div>
      <div class="topbar-actions">
        <button id="roleToggle" class="ghost-button" type="button">Operator</button>
        <span id="connectionState" class="status-pill">연결 준비</span>
      </div>
    </header>
    <main class="ide-grid">
      <aside class="rail-pane" aria-label="Lifecycle and queues">
        <section class="panel">
          <div class="panel-heading">
            <h2>Lifecycle</h2>
            <span id="runCountBadge" class="count-badge">0</span>
          </div>
          <div id="lifecycleRail" class="lifecycle-rail"></div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h2>Inbox</h2>
            <span id="inboxCountBadge" class="count-badge">0</span>
          </div>
          <div id="mobileInbox" class="compact-list"></div>
        </section>
        <section class="panel operator-panel">
          <div class="panel-heading"><h2>Service Health</h2></div>
          <div id="serviceHealth" class="health-strip"></div>
        </section>
      </aside>
      <section class="work-pane" aria-label="Agent control surface">
        <form id="runForm" class="command-bar">
          <label>
            <span>Run objective</span>
            <input id="runObjective" name="objective" autocomplete="off" placeholder="구현할 작업을 입력하십시오" />
          </label>
          <button class="primary-button" type="submit">
            <span class="button-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M3 10h11M10 5l5 5-5 5" /></svg></span>
            Run
          </button>
        </form>
        <div id="emptyState" class="empty-state" hidden>
          <h1>워크스페이스를 준비해야 합니다</h1>
          <p>현재 Gateway에 연결된 workspace projection이 없습니다. 개발용 workspace를 Core command API로 생성하면 Control Room을 바로 사용할 수 있습니다.</p>
          <button id="seedWorkspaceButton" class="primary-button" type="button">Workspace 준비</button>
        </div>
        <div class="split-board">
          <section class="panel agent-panel">
            <div class="panel-heading">
              <h2>Agent Roster</h2>
              <span id="agentCountBadge" class="count-badge">0</span>
            </div>
            <div id="agentHierarchy" class="agent-tree virtual-list" tabindex="0"></div>
          </section>
          <section class="panel decision-panel">
            <div class="panel-heading">
              <h2>Supervisor Decisions</h2>
              <span id="decisionCountBadge" class="count-badge">0</span>
            </div>
            <div id="supervisorDecisions" class="decision-log virtual-list" tabindex="0"></div>
          </section>
        </div>
        <div class="split-board">
          <section class="panel">
            <div class="panel-heading"><h2>Command Queue</h2></div>
            <form id="commandForm" class="inline-form">
              <input id="commandInstruction" autocomplete="off" placeholder="에이전트에게 보낼 명령" />
              <select id="commandIntent" aria-label="Command type">
                <option value="light">Interactive</option>
                <option value="test">Test</option>
                <option value="build">Build</option>
                <option value="long_running">Long run</option>
              </select>
              <button type="submit" class="secondary-button">Enqueue</button>
            </form>
            <div id="commandQueue" class="compact-list virtual-list" tabindex="0"></div>
          </section>
          <section class="panel">
            <div class="panel-heading"><h2>Approvals & Recovery</h2></div>
            <div id="approvalInbox" class="compact-list"></div>
            <div id="recoveryQueue" class="compact-list"></div>
          </section>
        </div>
        <section class="panel">
          <div class="panel-heading">
            <h2>Timeline</h2>
            <span id="timelineOffset" class="count-badge">0</span>
          </div>
          <div id="timeline" class="timeline virtual-list" tabindex="0"></div>
        </section>
      </section>
      <aside class="inspector-pane" aria-label="Run inspector">
        <section class="panel">
          <div class="panel-heading">
            <h2>Agent Contract</h2>
            <span id="contractCountBadge" class="count-badge">0</span>
          </div>
          <div id="contractInspector" class="contract-grid"></div>
          <div id="leaseBudget" class="budget-grid"></div>
        </section>
        <section class="panel editor-panel">
          <div class="panel-heading">
            <h2>Workspace IDE</h2>
            <button id="editorActionButton" class="secondary-button" type="button">Issue</button>
          </div>
          <div id="editorSession" class="editor-session"></div>
        </section>
        <section class="panel code-panel">
          <div class="panel-heading"><h2>Files / Diff</h2></div>
          <div class="code-split">
            <div id="fileTree" class="file-tree virtual-list" tabindex="0"></div>
            <pre id="codeInspector" class="code-view" tabindex="0"></pre>
          </div>
          <div id="diffInspector" class="diff-list"></div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>Terminal / Tests</h2></div>
          <pre id="terminalOutput" class="terminal-output" tabindex="0"></pre>
          <div id="artifactInspector" class="artifact-list"></div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>Final Review</h2></div>
          <div id="finalReviewGate" class="final-review"></div>
        </section>
      </aside>
    </main>
    <div id="commandPalette" class="command-palette" hidden>
      <div class="palette-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <input id="paletteInput" placeholder="Command palette" />
        <div id="paletteResults"></div>
      </div>
    </div>
  </div>
  <script src="/assets/gateway-client.js"></script>
  <script src="/assets/control-room.js"></script>
</body>
</html>`;
}

export function renderManifest(): string {
  return JSON.stringify(
    {
      name: "NadoVibe Control Room",
      short_name: "NadoVibe",
      start_url: "/",
      display: "standalone",
      background_color: ideShellTokens.color.canvas,
      theme_color: ideShellTokens.color.teal,
      icons: []
    },
    null,
    2
  );
}

export function renderServiceWorker(): string {
  return `
const CACHE_NAME = 'nadovibe-control-room-v1';
const SHELL_ASSETS = ['/', '/assets/gateway-client.js', '/assets/control-room.js', '/manifest.webmanifest'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;
}

export function renderShellCss(): string {
  return `
    :root {
      --canvas: ${ideShellTokens.color.canvas};
      --surface: ${ideShellTokens.color.surface};
      --surface-alt: ${ideShellTokens.color.surfaceAlt};
      --ink: ${ideShellTokens.color.ink};
      --muted: ${ideShellTokens.color.muted};
      --soft: ${ideShellTokens.color.soft};
      --teal: ${ideShellTokens.color.teal};
      --indigo: ${ideShellTokens.color.indigo};
      --amber: ${ideShellTokens.color.amber};
      --green: ${ideShellTokens.color.green};
      --red: ${ideShellTokens.color.red};
      --violet: ${ideShellTokens.color.violet};
      --code: ${ideShellTokens.color.code};
      --rail-width: ${ideShellTokens.layout.railWidth};
      --inspector-width: ${ideShellTokens.layout.inspectorWidth};
      --toolbar-height: ${ideShellTokens.layout.toolbarHeight};
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; }
    body {
      margin: 0;
      min-height: 100%;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--canvas);
      letter-spacing: 0;
    }
    button, input, select, textarea { font: inherit; letter-spacing: 0; }
    button, select { cursor: pointer; }
    button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--teal) 68%, white);
      outline-offset: 2px;
    }
    .control-room { min-height: 100vh; display: grid; grid-template-rows: var(--toolbar-height) minmax(0, 1fr); }
    .topbar {
      display: grid;
      grid-template-columns: minmax(240px, 320px) minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      min-width: 0;
      padding: 0 18px;
      border-bottom: 1px solid var(--soft);
      background: rgba(255, 255, 255, 0.94);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand-lockup { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .brand-lockup strong { display: block; font-size: 15px; }
    .brand-lockup span:last-child { display: block; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--teal);
      color: white;
      font-weight: 700;
      font-size: 13px;
      flex: 0 0 auto;
    }
    .topbar-selectors { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr); gap: 10px; min-width: 0; }
    label span { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; }
    select, input {
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--soft);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      padding: 0 10px;
      min-width: 0;
    }
    .topbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
    .status-pill, .count-badge, .state-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 26px;
      border: 1px solid var(--soft);
      border-radius: 999px;
      padding: 0 9px;
      color: var(--muted);
      background: #fff;
      white-space: nowrap;
      font-size: 12px;
    }
    .status-pill[data-state="connected"], .state-badge.ready, .state-badge.completed, .state-badge.done { color: var(--green); border-color: color-mix(in srgb, var(--green) 35%, white); }
    .status-pill[data-state="reconnecting"], .state-badge.preparing, .state-badge.recovering { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 35%, white); }
    .state-badge.failed, .state-badge.cancelled, .status-pill[data-state="offline"] { color: var(--red); border-color: color-mix(in srgb, var(--red) 35%, white); }
    .ide-grid {
      display: grid;
      grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--inspector-width);
      gap: 10px;
      min-height: 0;
      padding: 10px;
    }
    .rail-pane, .work-pane, .inspector-pane {
      min-width: 0;
      min-height: 0;
      display: grid;
      align-content: start;
      gap: 10px;
    }
    .work-pane, .inspector-pane { overflow: auto; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--soft);
      border-radius: 8px;
      min-width: 0;
      overflow: hidden;
    }
    .panel-heading {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      border-bottom: 1px solid var(--soft);
      background: linear-gradient(180deg, #fff, #fbfcfa);
    }
    h1, h2, h3, p { margin: 0; }
    h2 { font-size: 13px; font-weight: 700; }
    .command-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 104px;
      gap: 10px;
      background: var(--surface);
      border: 1px solid var(--soft);
      border-radius: 8px;
      padding: 12px;
    }
    .primary-button, .secondary-button, .ghost-button {
      min-height: 38px;
      max-width: 100%;
      border-radius: 6px;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 0 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease;
    }
    .primary-button { background: var(--teal); color: #fff; }
    .secondary-button { background: var(--surface-alt); color: var(--teal); border-color: color-mix(in srgb, var(--teal) 28%, white); }
    .ghost-button { background: #fff; color: var(--ink); border-color: var(--soft); }
    .primary-button:hover, .secondary-button:hover, .ghost-button:hover { transform: translateY(-1px); }
    .button-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .split-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; min-width: 0; }
    .virtual-list { max-height: 360px; overflow: auto; contain: content; }
    .compact-list, .agent-tree, .decision-log, .timeline, .contract-grid, .budget-grid, .diff-list, .artifact-list, .final-review, .editor-session {
      padding: 10px;
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .list-item {
      min-height: 44px;
      border: 1px solid var(--soft);
      border-radius: 8px;
      padding: 9px;
      display: grid;
      gap: 6px;
      background: #fff;
      min-width: 0;
    }
    .list-item strong, .list-item span, .list-item p { min-width: 0; overflow-wrap: anywhere; }
    .item-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
    .item-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .muted { color: var(--muted); font-size: 12px; }
    .lifecycle-rail { padding: 12px; display: grid; gap: 8px; }
    .lifecycle-step { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: center; min-height: 36px; color: var(--muted); }
    .step-dot { width: 12px; height: 12px; border-radius: 999px; border: 2px solid var(--soft); }
    .lifecycle-step.done .step-dot { background: var(--green); border-color: var(--green); }
    .lifecycle-step.active .step-dot { background: var(--teal); border-color: var(--teal); box-shadow: 0 0 0 4px color-mix(in srgb, var(--teal) 16%, transparent); }
    .agent-node { border-left: 3px solid var(--teal); }
    .agent-node[data-role="TaskSupervisorAgent"] { border-left-color: var(--indigo); margin-left: 12px; }
    .agent-node[data-role="RoleAgent"] { border-left-color: var(--violet); margin-left: 24px; }
    .inline-form { display: grid; grid-template-columns: minmax(0, 1fr) 120px 104px; gap: 8px; padding: 10px; border-bottom: 1px solid var(--soft); }
    .health-strip { padding: 10px; display: grid; gap: 7px; }
    .health-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; border-bottom: 1px solid #eef2ef; }
    .health-item:last-child { border-bottom: 0; }
    .code-split { display: grid; grid-template-columns: 170px minmax(0, 1fr); min-height: 240px; border-bottom: 1px solid var(--soft); }
    .file-tree { border-right: 1px solid var(--soft); max-height: 260px; padding: 8px; }
    .file-button {
      width: 100%;
      min-height: 30px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 0 6px;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-button:hover { background: var(--surface-alt); }
    .code-view, .terminal-output {
      margin: 0;
      min-height: 220px;
      max-height: 320px;
      overflow: auto;
      background: var(--code);
      color: #e6f1ec;
      padding: 12px;
      font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .terminal-output { min-height: 160px; max-height: 240px; }
    .empty-state {
      border: 1px dashed color-mix(in srgb, var(--teal) 42%, white);
      border-radius: 8px;
      padding: 24px;
      background: var(--surface);
      display: grid;
      gap: 12px;
      justify-items: start;
    }
    .empty-state h1 { font-size: 24px; }
    .empty-state p { color: var(--muted); max-width: 720px; line-height: 1.6; }
    .command-palette {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: start center;
      padding-top: 11vh;
      background: rgba(27, 36, 33, 0.24);
    }
    .palette-dialog {
      width: min(640px, calc(100vw - 32px));
      border-radius: 8px;
      border: 1px solid var(--soft);
      background: var(--surface);
      box-shadow: 0 24px 70px rgba(27, 36, 33, 0.22);
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .palette-dialog input { min-height: 44px; }
    [hidden] { display: none !important; }
    @media (prefers-reduced-motion: reduce) {
      * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
    }
    @media (max-width: 1180px) {
      .ide-grid { grid-template-columns: 76px minmax(0, 1fr) minmax(340px, 38vw); }
      .rail-pane .panel h2, .rail-pane .compact-list, .rail-pane .operator-panel { display: none; }
      .rail-pane .panel { border-radius: 8px; }
      .lifecycle-step { grid-template-columns: 1fr; justify-items: center; }
      .lifecycle-step span:last-child { display: none; }
    }
    @media (max-width: 900px) {
      .control-room { grid-template-rows: auto minmax(0, 1fr); }
      .topbar { grid-template-columns: 1fr; padding: 10px; position: relative; }
      .topbar-selectors { grid-template-columns: 1fr 1fr; }
      .topbar-actions { justify-content: flex-start; }
      .ide-grid { grid-template-columns: minmax(0, 1fr) minmax(320px, 44vw); }
      .rail-pane { display: none; }
      .split-board { grid-template-columns: 1fr; }
      .inline-form { grid-template-columns: 1fr; }
      .primary-button, .secondary-button, .ghost-button, input, select { min-height: 44px; }
      .code-split { grid-template-columns: 1fr; }
      .file-tree { border-right: 0; border-bottom: 1px solid var(--soft); }
    }
    @media (max-width: 680px) {
      .ide-grid { grid-template-columns: 1fr; padding: 8px; }
      .inspector-pane { order: -1; }
      .command-bar { grid-template-columns: 1fr; }
      .topbar-selectors { grid-template-columns: 1fr; }
      .agent-panel, .decision-panel, .code-panel { display: none; }
      .virtual-list { max-height: 290px; }
      .panel-heading { min-height: 48px; }
      .empty-state { padding: 18px; }
      .empty-state h1 { font-size: 20px; }
    }
  `;
}

export function renderControlRoomAppJs(): string {
  return `
(() => {
  const client = window.NadoVibeGatewayClient.createGatewayClient();
  const state = {
    projection: null,
    role: 'user',
    selectedRunId: undefined,
    selectedWorkspaceId: undefined,
    selectedFilePath: undefined,
    stream: undefined,
    reconnectTimer: undefined
  };
  const $ = (id) => document.getElementById(id);
  const idempotency = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const text = (value, empty = '비어 있음') => value === undefined || value === null || value === '' ? empty : String(value);
  const badge = (value) => '<span class="state-badge ' + escapeAttr(String(value).replace(/[^a-z0-9_-]/gi, '_')) + '">' + escapeHtml(String(value)) + '</span>';

  async function load(role = state.role) {
    state.projection = await client.getControlRoom(role);
    state.role = state.projection.role;
    state.selectedWorkspaceId = state.selectedWorkspaceId || state.projection.workspaces[0]?.workspaceId;
    state.selectedRunId = state.selectedRunId || state.projection.runs[0]?.runId;
    render();
    connectStream();
  }

  function render() {
    const p = state.projection;
    if (!p) return;
    $('app').dataset.loading = 'false';
    $('connectionState').textContent = p.reconnect.message;
    $('connectionState').dataset.state = p.reconnect.state;
    $('roleToggle').textContent = state.role === 'operator' ? 'User view' : 'Operator';
    renderSelects(p);
    $('emptyState').hidden = p.workspaces.length > 0;
    $('runCountBadge').textContent = String(p.runs.length);
    $('inboxCountBadge').textContent = String(p.notifications.filter((item) => item.unread).length + p.approvalInbox.filter((item) => item.state === 'requested').length);
    $('agentCountBadge').textContent = String(p.agentHierarchy.length);
    $('decisionCountBadge').textContent = String(p.supervisorDecisions.length);
    $('contractCountBadge').textContent = String(p.agentContracts.length);
    $('timelineOffset').textContent = String(p.lastOffset);
    renderLifecycle(p);
    renderServiceHealth(p);
    renderInbox(p);
    renderAgents(p);
    renderDecisions(p);
    renderCommands(p);
    renderApprovals(p);
    renderContracts(p);
    renderEditor(p);
    renderFiles(p);
    renderDiff(p);
    renderTerminal(p);
    renderFinalReview(p);
    renderPalette();
  }

  function renderSelects(p) {
    $('workspaceSelect').innerHTML = p.workspaces.map((workspace) => '<option value="' + escapeAttr(workspace.workspaceId) + '">' + escapeHtml(workspace.name) + '</option>').join('');
    $('repositorySelect').innerHTML = p.repositories.map((repo) => '<option value="' + escapeAttr(repo.repositoryId) + '">' + escapeHtml(repo.name + ' / ' + repo.branch) + '</option>').join('');
    if (state.selectedWorkspaceId) $('workspaceSelect').value = state.selectedWorkspaceId;
  }

  function renderLifecycle(p) {
    $('lifecycleRail').innerHTML = p.lifecycle.map((step) => '<div class="lifecycle-step ' + step.state + '"><span class="step-dot"></span><span>' + escapeHtml(step.label) + '</span></div>').join('');
  }

  function renderServiceHealth(p) {
    $('serviceHealth').innerHTML = p.serviceHealth.map((item) => '<div class="health-item"><strong>' + escapeHtml(item.service) + '</strong>' + badge(item.state) + '<span class="muted">' + escapeHtml(item.detail) + '</span></div>').join('');
  }

  function renderInbox(p) {
    const approvals = p.approvalInbox.filter((item) => item.state === 'requested').map((item) => ({ title: '승인 필요', body: item.reason, route: '#approval-' + item.approvalId, unread: true }));
    const notifications = p.notifications.map((item) => ({ title: item.title, body: item.body, route: item.route, unread: item.unread }));
    const rows = [...approvals, ...notifications].slice(0, 8);
    $('mobileInbox').innerHTML = rows.length ? rows.map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.title) + '</strong>' + badge(item.unread ? 'new' : 'read') + '</div><p class="muted">' + escapeHtml(item.body) + '</p></div>').join('') : '<div class="list-item"><strong>처리할 항목 없음</strong><p class="muted">새 run을 만들거나 명령을 접수할 수 있습니다.</p></div>';
  }

  function renderAgents(p) {
    $('agentHierarchy').innerHTML = p.agentHierarchy.map((agent) => '<div class="list-item agent-node" data-role="' + agent.role + '"><div class="item-row"><strong>' + escapeHtml(agent.label) + '</strong>' + badge(agent.state) + '</div><p class="muted">' + escapeHtml(agent.role + ' / ' + agent.agentId) + '</p><div class="item-actions">' + supervisorButtons(agent) + '</div></div>').join('');
  }

  function supervisorButtons(agent) {
    const actions = ['pause', 'resume', 'reassign', 'extend_lease', 'revoke_lease'];
    return actions.map((action) => '<button class="ghost-button" data-supervisor-action="' + action + '" data-agent-id="' + escapeAttr(agent.agentId) + '" type="button">' + action.replace('_', ' ') + '</button>').join('');
  }

  function renderDecisions(p) {
    $('supervisorDecisions').innerHTML = p.supervisorDecisions.length ? p.supervisorDecisions.slice(0, 12).map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.selectedAction) + '</strong><span class="muted">' + escapeHtml(item.runId) + '</span></div><p>' + escapeHtml(item.policyReason) + '</p><p class="muted">' + escapeHtml(item.expectedVerification.join(', ')) + '</p></div>').join('') : '<div class="list-item"><strong>Supervisor 판단 대기</strong><p class="muted">Run이 시작되면 durable decision log가 여기에 기록됩니다.</p></div>';
  }

  function renderCommands(p) {
    $('commandQueue').innerHTML = p.commandQueue.length ? p.commandQueue.map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.instruction) + '</strong>' + badge(item.state) + '</div><p class="muted">' + escapeHtml(item.resourceIntent) + '</p></div>').join('') : '<div class="list-item"><strong>명령 없음</strong><p class="muted">위 command bar에서 에이전트 명령을 접수할 수 있습니다.</p></div>';
  }

  function renderApprovals(p) {
    const approvals = p.approvalInbox.map((item) => '<div id="approval-' + escapeAttr(item.approvalId) + '" class="list-item"><div class="item-row"><strong>' + escapeHtml(item.reason) + '</strong>' + badge(item.state) + '</div><div class="item-actions"><button class="secondary-button" data-approval="' + escapeAttr(item.approvalId) + '" data-decision="approve" type="button">Approve</button><button class="ghost-button" data-approval="' + escapeAttr(item.approvalId) + '" data-decision="reject" type="button">Reject</button></div></div>').join('');
    const recovery = p.recoveryQueue.map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.title) + '</strong>' + badge(item.state) + '</div><p class="muted">' + escapeHtml(item.nextAction) + '</p></div>').join('');
    $('approvalInbox').innerHTML = approvals || '<div class="list-item"><strong>승인 요청 없음</strong><p class="muted">필요한 결정만 inbox에 표시됩니다.</p></div>';
    $('recoveryQueue').innerHTML = recovery;
  }

  function renderContracts(p) {
    $('contractInspector').innerHTML = p.agentContracts.slice(0, 3).map((item) => '<div class="list-item"><strong>' + escapeHtml(item.objective) + '</strong><p class="muted">Scope ' + escapeHtml(item.workScope) + '</p><p class="muted">Owned ' + escapeHtml(item.ownedFiles.join(', ')) + '</p><p class="muted">Forbidden ' + escapeHtml(item.forbiddenFiles.join(', ')) + '</p><p class="muted">Verify ' + escapeHtml(item.verification.join(', ')) + '</p></div>').join('');
    $('leaseBudget').innerHTML = p.leaseBudget.slice(0, 4).map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.agentId) + '</strong>' + badge(item.heartbeat) + '</div><p class="muted">Timeout ' + escapeHtml(item.timeoutLabel) + ' / Retry ' + escapeHtml(item.retryBudget) + ' / Command ' + escapeHtml(item.commandBudget) + '</p></div>').join('');
  }

  function renderEditor(p) {
    const editor = p.editorSession;
    $('editorSession').innerHTML = '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(editor.workspaceId) + '</strong>' + badge(editor.state) + '</div><p>' + escapeHtml(editor.message) + '</p>' + (editor.publicRoute ? '<p class="muted">Gateway route ' + escapeHtml(editor.publicRoute) + '</p>' : '') + '</div>';
    $('editorActionButton').textContent = editor.state === 'ready' ? 'Revoke' : 'Issue';
  }

  function renderFiles(p) {
    const items = p.fileTree.slice(0, 120);
    $('fileTree').innerHTML = items.map((item) => '<button class="file-button" type="button" data-file-path="' + escapeAttr(item.path) + '" style="padding-left:' + (6 + item.depth * 10) + 'px">' + escapeHtml((item.type === 'directory' ? '/ ' : '') + item.name) + '</button>').join('');
    if (!$('codeInspector').textContent) {
      $('codeInspector').textContent = '파일을 선택하면 Gateway file API를 통해 내용을 읽습니다.';
    }
  }

  function renderDiff(p) {
    $('diffInspector').innerHTML = p.diff.length ? p.diff.map((file) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(file.path) + '</strong><span class="muted">+' + file.additions + ' / -' + file.deletions + '</span></div>' + file.hunks.map((hunk) => '<div class="item-row"><span>' + escapeHtml(hunk.title) + '</span>' + badge(hunk.state) + '</div>').join('') + '</div>').join('') : '<div class="list-item"><strong>Diff 없음</strong><p class="muted">변경이 생기면 file/hunk 단위로 표시됩니다.</p></div>';
  }

  function renderTerminal(p) {
    $('terminalOutput').textContent = p.terminal.length ? p.terminal.map((line) => '[' + line.stream + '] ' + line.text).join('\\n') : '아직 실행 출력이 없습니다.';
    $('artifactInspector').innerHTML = p.artifacts.map((item) => '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.label) + '</strong><span class="muted">' + escapeHtml(item.sizeLabel) + '</span></div><p class="muted">' + escapeHtml(item.contentType) + '</p></div>').join('');
  }

  function renderFinalReview(p) {
    const gate = p.finalReview;
    $('finalReviewGate').innerHTML = '<div class="list-item"><div class="item-row"><strong>Final verifier gate</strong>' + badge(gate.state) + '</div>' + gate.checklist.map((item) => '<div class="item-row"><span>' + escapeHtml(item.label) + '</span>' + badge(item.done ? 'done' : 'open') + '</div>').join('') + '<div class="item-actions"><button class="secondary-button" data-final-review="approve" type="button">Approve final</button><button class="ghost-button" data-final-review="request_changes" type="button">Request changes</button></div></div>';
  }

  function renderPalette() {
    $('paletteResults').innerHTML = ['New run', 'Enqueue command', 'Issue IDE session', 'Approve final review'].map((label) => '<button class="file-button" type="button" data-palette-action="' + escapeAttr(label) + '">' + escapeHtml(label) + '</button>').join('');
  }

  function connectStream() {
    const p = state.projection;
    if (!p || state.stream) return;
    const stream = client.openStream(p.lastOffset);
    state.stream = stream;
    stream.addEventListener('core_event', () => {
      window.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = window.setTimeout(() => load(state.role).catch(reportError), 80);
    });
    stream.onerror = () => {
      $('connectionState').textContent = '재연결 중';
      $('connectionState').dataset.state = 'reconnecting';
      stream.close();
      state.stream = undefined;
      window.setTimeout(() => load(state.role).catch(reportError), 1200);
    };
  }

  async function seedWorkspace() {
    await client.seedIdentity({ tenantId: 'tenant_dev', userId: 'user_dev', workspaceId: 'workspace_dev', repositoryId: 'repo_nadovibe' });
    await load();
  }

  async function createRun(event) {
    event.preventDefault();
    if (!state.projection?.workspaces.length) {
      await seedWorkspace();
    }
    const objective = $('runObjective').value.trim() || 'NadoVibe phase 06 Control Room 구현';
    const workspaceId = state.selectedWorkspaceId || state.projection.workspaces[0].workspaceId;
    const repositoryId = state.projection.repositories[0]?.repositoryId || 'repo_nadovibe';
    const result = await client.createRun({ runId: 'run_' + Date.now(), workspaceId, repositoryId, objective, idempotencyKey: idempotency('run') });
    state.projection = result.projection || await client.getControlRoom(state.role);
    state.selectedRunId = result.runId;
    $('runObjective').value = '';
    render();
  }

  async function enqueueCommand(event) {
    event.preventDefault();
    const instruction = $('commandInstruction').value.trim();
    if (!instruction || !state.selectedRunId) return;
    state.projection = await client.enqueueCommand({ runId: state.selectedRunId, instruction, resourceIntent: $('commandIntent').value, idempotencyKey: idempotency('cmd') });
    $('commandInstruction').value = '';
    render();
  }

  async function handleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.id === 'seedWorkspaceButton') await seedWorkspace();
    if (target.id === 'roleToggle') {
      state.role = state.role === 'operator' ? 'user' : 'operator';
      await load(state.role);
    }
    if (target.id === 'editorActionButton') {
      const editor = state.projection.editorSession;
      state.projection = await client.changeEditorSession({ workspaceId: state.selectedWorkspaceId || editor.workspaceId, action: editor.state === 'ready' ? 'revoke' : 'issue', idempotencyKey: idempotency('editor') });
      render();
    }
    if (target.dataset.approval) {
      state.projection = await client.decideApproval({ approvalId: target.dataset.approval, decision: target.dataset.decision, reason: '사용자 결정', idempotencyKey: idempotency('approval') });
      render();
    }
    if (target.dataset.supervisorAction) {
      state.projection = await client.controlSupervisor({ runId: state.selectedRunId, action: target.dataset.supervisorAction, targetAgentId: target.dataset.agentId, reason: 'Control Room action', idempotencyKey: idempotency('supervisor') });
      render();
    }
    if (target.dataset.finalReview) {
      if (!state.selectedRunId) return;
      state.projection = await client.decideFinalReview({ runId: state.selectedRunId, decision: target.dataset.finalReview, reason: 'Final review from Control Room', idempotencyKey: idempotency('final') });
      render();
    }
    if (target.dataset.filePath && !target.textContent.startsWith('/ ')) {
      const result = await client.readFile({ workspaceId: state.selectedWorkspaceId || 'workspace_dev', path: target.dataset.filePath });
      state.selectedFilePath = result.path;
      $('codeInspector').textContent = result.content;
    }
    if (target.dataset.paletteAction) {
      $('commandPalette').hidden = true;
      if (target.dataset.paletteAction === 'New run') $('runObjective').focus();
      if (target.dataset.paletteAction === 'Enqueue command') $('commandInstruction').focus();
      if (target.dataset.paletteAction === 'Issue IDE session') $('editorActionButton').click();
    }
  }

  function handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('commandPalette').hidden = false;
      $('paletteInput').focus();
    }
    if (event.key === 'Escape') {
      $('commandPalette').hidden = true;
    }
    if (event.key === '/' && document.activeElement === document.body) {
      event.preventDefault();
      $('commandInstruction').focus();
    }
  }

  function reportError(error) {
    $('connectionState').textContent = error instanceof Error ? error.message : '오류';
    $('connectionState').dataset.state = 'offline';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function escapeAttr(value) {
    return escapeHtml(value).replace(/\\s+/g, ' ');
  }

  $('runForm').addEventListener('submit', (event) => createRun(event).catch(reportError));
  $('commandForm').addEventListener('submit', (event) => enqueueCommand(event).catch(reportError));
  $('workspaceSelect').addEventListener('change', (event) => { state.selectedWorkspaceId = event.target.value; render(); });
  document.addEventListener('click', (event) => handleClick(event).catch(reportError));
  document.addEventListener('keydown', handleKeydown);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  load().catch(reportError);
})();
`;
}
