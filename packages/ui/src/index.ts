export const ideShellTokens = {
  color: {
    canvas: "#EEF2EC",
    chrome: "#111827",
    chromeRaised: "#172033",
    surface: "#FBFCF8",
    surfaceAlt: "#EAF3EC",
    ink: "#17201B",
    inverse: "#F8FAFC",
    muted: "#66736F",
    soft: "#D5DED8",
    accent: "#22A06B",
    teal: "#22A06B",
    indigo: "#3867D6",
    amber: "#D97706",
    green: "#22C55E",
    run: "#22C55E",
    red: "#B43C3C",
    violet: "#7256C8",
    code: "#0F172A"
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
  <a class="skip-link" href="#mainControlSurface">Skip to control surface</a>
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
    <main id="mainControlSurface" class="ide-grid">
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

export function renderTabletWorkbenchHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${ideShellTokens.color.chrome}" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <title>NadoVibe Code Workbench</title>
  <style>${renderShellCss()}${renderTabletWorkbenchCss()}</style>
</head>
<body>
  <a class="skip-link" href="#workbenchMain">Skip to workbench</a>
  <div id="workbenchApp" class="workbench-shell" data-connection="connected">
    <header class="workbench-topbar" aria-label="NadoVibe tablet workbench controls">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">NV</span>
        <div>
          <strong>Code Workbench</strong>
          <span id="workbenchBranch" title="workspace">Workspace</span>
        </div>
      </div>
      <label class="workbench-search">
        <span>Workspace search</span>
        <input id="workspaceSearch" autocomplete="off" placeholder="Search files, symbols, commands" />
      </label>
      <nav class="workbench-actions" aria-label="Workbench actions">
        <button id="paletteButton" class="ghost-button touch-button" type="button">Command K</button>
        <button id="saveFileButton" class="primary-button touch-button" type="button" disabled>Save</button>
        <button id="revertFileButton" class="ghost-button touch-button" type="button" disabled>Revert</button>
      </nav>
    </header>
    <section id="guardBanner" class="guard-banner" role="status">연결 상태를 확인하고 있습니다.</section>
    <main id="workbenchMain" class="workbench-grid">
      <aside id="fileTreeDrawer" class="workbench-drawer" aria-label="File tree drawer">
        <div class="workbench-panel-heading">
          <h2>Files</h2>
          <button id="seedWorkbenchButton" class="ghost-button touch-icon" type="button">Seed</button>
        </div>
        <label class="drawer-search">
          <span>File search</span>
          <input id="fileSearch" autocomplete="off" placeholder="Find in workspace" />
        </label>
        <div id="searchResults" class="search-results" aria-live="polite"></div>
        <div id="workbenchFileTree" class="workbench-file-tree" tabindex="0"></div>
      </aside>
      <section class="workbench-editor-pane" aria-label="Code editor and diff work surface">
        <div id="editorTabs" class="editor-tabs"></div>
        <div class="editor-toolbar" aria-label="Coding accessory bar">
          <button id="askSelectionButton" class="primary-button touch-button" type="button" disabled>Ask Agent</button>
          <button id="testSelectionButton" class="secondary-button touch-button" type="button" disabled>Run Test</button>
          <button id="openIdeButton" class="ghost-button touch-button" type="button">Full IDE</button>
        </div>
        <section class="editor-frame" aria-label="CodeMirror 6 editor">
          <div id="editorMeta" class="editor-meta">파일을 선택하십시오</div>
          <div id="editorMount" class="codemirror-host"></div>
        </section>
        <section class="diff-panel" aria-label="Diff viewer">
          <div class="workbench-panel-heading">
            <h2>Diff Review</h2>
            <span id="dirtyIndicator" class="state-badge">clean</span>
          </div>
          <div id="diffViewer" class="diff-viewer"></div>
        </section>
      </section>
      <aside id="agentCompactRail" class="agent-compact-rail" aria-label="Agent status compact rail"></aside>
    </main>
    <section id="terminalSheet" class="terminal-sheet" aria-label="Terminal and test output bottom sheet">
      <div class="terminal-sheet-heading">
        <h2>Terminal / Tests</h2>
        <button id="terminalToggle" class="ghost-button touch-icon" type="button">Hide</button>
      </div>
      <pre id="workbenchTerminalOutput" tabindex="0"></pre>
      <div id="workbenchArtifacts" class="artifact-list"></div>
    </section>
    <div id="workbenchPalette" class="command-palette" hidden>
      <div class="palette-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <input id="workbenchPaletteInput" placeholder="Save, run tests, ask selected code" />
        <div id="workbenchPaletteResults"></div>
      </div>
    </div>
  </div>
  <script src="/assets/gateway-client.js"></script>
  <script type="module" src="/assets/workbench.js"></script>
</body>
</html>`;
}

export function renderMobileCommandReviewHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#3182f6" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <title>NadoVibe Mobile Chat IDE</title>
  <style>${renderShellCss()}${renderMobileCommandReviewCss()}</style>
</head>
<body>
  <a class="skip-link" href="#mobileMain">Skip to mobile chat IDE</a>
  <div id="mobileApp" class="mobile-shell mobile-chat-ide-complete-storyboard" data-storyboard="mobile-chat-ide-complete-storyboard" data-device="galaxy-s24-ultra" data-connection="connected">
    <header class="mobile-topbar" aria-label="Mobile command header">
      <button class="mobile-icon-button mobile-menu-button" type="button" aria-label="채팅 목록">
        <span aria-hidden="true">‹</span>
      </button>
      <div class="mobile-room-title">
        <strong>NadoVibe</strong>
        <span id="mobileWorkspaceLabel">채팅 IDE</span>
      </div>
      <button id="registerPushButton" class="mobile-icon-button" type="button" aria-label="알림 설정">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" /></svg>
      </button>
    </header>
    <section id="mobileServiceStatus" class="mobile-status-strip" role="status">실서버 연결 상태를 확인하고 있습니다.</section>
    <main id="mobileMain" class="mobile-main" aria-label="mobile-chat-ide-complete-storyboard">
      <section id="chat-list" class="mobile-section mobile-chat-list-screen" aria-label="채팅 리스트 화면">
        <span id="inbox" class="mobile-anchor" aria-hidden="true"></span>
        <div class="mobile-section-heading">
          <div>
            <span class="mobile-kicker">Chats</span>
            <h2>작업 대화</h2>
          </div>
          <span id="mobileInboxCount" class="count-badge">0</span>
        </div>
        <div class="mobile-search-row" aria-label="채팅 검색">
          <span aria-hidden="true">⌕</span>
          <strong>워크스페이스, run, 승인 검색</strong>
        </div>
        <div id="mobileInboxList" class="mobile-list mobile-room-list"></div>
      </section>

      <section id="chat-room" class="mobile-section mobile-chat-room-screen" aria-label="채팅 화면">
        <div class="mobile-section-heading mobile-chat-heading">
          <div>
            <span class="mobile-kicker">Singleview</span>
            <h2>에이전트 채팅 IDE</h2>
          </div>
          <span class="state-badge live">live</span>
        </div>
        <nav class="mobile-segmented" aria-label="Mobile chat filters">
          <a href="#inbox" data-mobile-tab="inbox">대화</a>
          <a href="#run-detail" data-mobile-tab="run">Run</a>
          <a href="#review" data-mobile-tab="review">검토</a>
          <a href="#notification-settings" data-mobile-tab="notify">설정</a>
        </nav>
        <div id="mobileNextAction" class="mobile-hero-panel mobile-message-thread" aria-label="다음 액션 메시지"></div>
        <section id="run-detail" class="mobile-chat-panel">
          <div class="mobile-panel-label">실행 상태</div>
          <div id="mobileRunDetail" class="mobile-list mobile-run-feed"></div>
          <div id="mobileAgentRoster" class="mobile-list mobile-agent-strip"></div>
        </section>
        <section id="review" class="mobile-chat-panel">
          <div class="mobile-panel-label">리뷰 큐</div>
          <div id="mobileApprovalReview" class="mobile-list mobile-review-feed"></div>
          <div id="mobileConflictReview" class="mobile-list mobile-review-feed"></div>
          <div id="mobileRecoveryDecision" class="mobile-list mobile-review-feed"></div>
          <details id="mobileDiffSummary" class="mobile-details" open>
            <summary>변경 diff 요약</summary>
            <div id="mobileDiffBody"></div>
          </details>
          <div id="mobileFinalReview" class="mobile-list mobile-review-feed"></div>
        </section>
        <section id="command" class="mobile-chat-composer" aria-label="채팅 명령 입력">
          <form id="mobileQuickCommandForm" class="mobile-command-form">
            <label><span>템플릿</span><select id="mobileCommandTemplate">
              <option value="검증 결과를 요약해 보고하십시오">검증 요약</option>
              <option value="현재 blocker를 정리하고 다음 action을 제안하십시오">Blocker 정리</option>
              <option value="승인 전 위험 변경을 다시 확인하십시오">위험 변경 확인</option>
            </select></label>
            <label><span>Run</span><select id="mobileCommandRun"></select></label>
            <label><span>메시지</span><textarea id="mobileCommandText" rows="3" placeholder="에이전트에게 보낼 지시를 입력하세요"></textarea></label>
            <button id="mobileCommandSubmit" class="mobile-primary" type="submit">전송</button>
          </form>
          <div id="mobileCommandLog" class="mobile-list mobile-command-log"></div>
        </section>
      </section>

      <section id="notification-settings" class="mobile-section mobile-settings-screen" aria-label="설정 다이얼로그 화면">
        <div class="mobile-settings-dialog">
          <div class="mobile-section-heading">
            <div>
              <span class="mobile-kicker">Dialog</span>
              <h2>채팅 IDE 설정</h2>
            </div>
            <span id="mobileNotificationState" class="state-badge">ready</span>
          </div>
          <form id="mobileNotificationSettings" class="mobile-settings-form">
            <label><input id="notifyEnabled" type="checkbox" /> 모바일 채팅 알림</label>
            <label><input id="notifyApprovals" type="checkbox" /> 승인 요청</label>
            <label><input id="notifyRecovery" type="checkbox" /> 복구 결정</label>
            <label><input id="notifyFinal" type="checkbox" /> 최종 리뷰</label>
            <label><input id="notifyQuiet" type="checkbox" /> 무거운 작업 조용히 처리</label>
            <button class="mobile-secondary" type="submit">설정 저장</button>
          </form>
        </div>
      </section>
    </main>
    <nav class="mobile-bottom-nav" aria-label="Thumb navigation">
      <a href="#chat-list">채팅</a>
      <a href="#chat-room">IDE</a>
      <a href="#review">검토</a>
      <a href="#notification-settings">설정</a>
    </nav>
    <div id="mobileConfirmSheet" class="mobile-confirm-backdrop" hidden>
      <section class="mobile-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="mobileConfirmTitle">
        <h2 id="mobileConfirmTitle">확인이 필요합니다</h2>
        <p id="mobileConfirmBody">이 action을 실행하시겠습니까?</p>
        <div class="mobile-confirm-actions">
          <button id="mobileConfirmCancel" class="mobile-secondary" type="button">취소</button>
          <button id="mobileConfirmApply" class="mobile-danger" type="button">확인</button>
        </div>
      </section>
    </div>
    <section id="mobileSplitView" class="mobile-split-view" aria-label="Mobile tablet split layout">
      <section class="mobile-split-slot mobile-split-conversation" data-split-slot="conversation" aria-label="Conversation split slot">
        <div>
          <strong>대화</strong>
          <span>tablet splitview 전환 지점</span>
        </div>
      </section>
      <section class="mobile-split-slot mobile-split-workspace" data-split-slot="workspace" aria-label="Workspace split slot">
        <div>
          <strong>IDE</strong>
          <span>cursor형 splitview는 다음 단계에서 새 디자인 적용</span>
        </div>
      </section>
    </section>
  </div>
  <script src="/assets/gateway-client.js"></script>
  <script src="/assets/mobile-command-review.js"></script>
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
const SHELL_ASSETS = ['/', '/workbench', '/mobile', '/assets/gateway-client.js', '/assets/control-room.js', '/assets/workbench.js', '/assets/mobile-command-review.js', '/assets/codemirror-vendor.js', '/manifest.webmanifest'];
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
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {};
  }
  const title = payload.title || 'NadoVibe';
  const body = payload.body || '모바일 inbox에서 검토가 필요합니다.';
  const route = payload.route || '/mobile#inbox';
  event.waitUntil(self.registration.showNotification(title, { body, data: { route } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route ? event.notification.data.route : '/mobile#inbox';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) {
        client.navigate(route);
        return client.focus();
      }
    }
    return clients.openWindow(route);
  }));
});
`;
}

export function renderShellCss(): string {
  return `
    :root {
      --canvas: ${ideShellTokens.color.canvas};
      --chrome: ${ideShellTokens.color.chrome};
      --chrome-raised: ${ideShellTokens.color.chromeRaised};
      --surface: ${ideShellTokens.color.surface};
      --surface-alt: ${ideShellTokens.color.surfaceAlt};
      --ink: ${ideShellTokens.color.ink};
      --inverse: ${ideShellTokens.color.inverse};
      --muted: ${ideShellTokens.color.muted};
      --soft: ${ideShellTokens.color.soft};
      --accent: ${ideShellTokens.color.accent};
      --teal: ${ideShellTokens.color.teal};
      --indigo: ${ideShellTokens.color.indigo};
      --amber: ${ideShellTokens.color.amber};
      --green: ${ideShellTokens.color.green};
      --run: ${ideShellTokens.color.run};
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
      font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--canvas);
      letter-spacing: 0;
    }
    button, input, select, textarea { font: inherit; letter-spacing: 0; }
    button, select { cursor: pointer; }
    button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent) 68%, white);
      outline-offset: 2px;
    }
    .skip-link {
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 100;
      transform: translateY(-140%);
      border-radius: 6px;
      background: var(--inverse);
      color: var(--ink);
      padding: 8px 10px;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.18);
      transition: transform 160ms ease;
    }
    .skip-link:focus-visible { transform: translateY(0); }
    .control-room {
      min-height: 100vh;
      display: grid;
      grid-template-rows: var(--toolbar-height) minmax(0, 1fr);
      gap: 10px;
      padding: 10px;
    }
    .topbar {
      display: grid;
      grid-template-columns: minmax(240px, 320px) minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      min-width: 0;
      padding: 0 18px;
      border: 1px solid #263349;
      border-radius: 8px;
      background: var(--chrome);
      color: var(--inverse);
      position: relative;
      top: auto;
      z-index: 50;
    }
    .brand-lockup { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .brand-lockup strong { display: block; font-size: 15px; }
    .brand-lockup span:last-child { display: block; color: #b9c6c0; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: var(--inverse);
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
      background: var(--inverse);
      color: var(--ink);
      padding: 0 10px;
      min-width: 0;
    }
    .topbar label span { color: #b9c6c0; }
    .topbar select {
      border-color: #263349;
      background: var(--chrome-raised);
      color: var(--inverse);
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
      background: var(--inverse);
      white-space: nowrap;
      font-size: 12px;
    }
    .status-pill[data-state="connected"], .state-badge.ready, .state-badge.completed, .state-badge.done { color: var(--green); border-color: color-mix(in srgb, var(--green) 35%, white); }
    .status-pill[data-state="reconnecting"], .state-badge.preparing, .state-badge.recovering { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 35%, white); }
    .state-badge.failed, .state-badge.cancelled, .status-pill[data-state="offline"] { color: var(--red); border-color: color-mix(in srgb, var(--red) 35%, white); }
    .topbar .status-pill {
      background: #193125;
      border-color: #2d6b4a;
      color: var(--run);
      font-weight: 600;
    }
    .ide-grid {
      display: grid;
      grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--inspector-width);
      gap: 10px;
      min-height: 0;
      padding: 0;
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
      background: var(--surface-alt);
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
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease, filter 180ms ease;
    }
    .primary-button { background: var(--accent); color: var(--inverse); }
    .secondary-button { background: var(--surface-alt); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 28%, white); }
    .ghost-button { background: var(--inverse); color: var(--ink); border-color: var(--soft); }
    .primary-button:hover, .secondary-button:hover, .ghost-button:hover { filter: brightness(0.97); }
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
      background: var(--inverse);
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
    .lifecycle-step.active .step-dot { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent); }
    .agent-node { border-left: 3px solid var(--accent); }
    .agent-node[data-role="TaskSupervisorAgent"] { border-left-color: var(--indigo); margin-left: 12px; }
    .agent-node[data-role="RoleAgent"] { border-left-color: var(--violet); margin-left: 24px; }
    .inline-form { display: grid; grid-template-columns: minmax(0, 1fr) 120px 104px; gap: 8px; padding: 10px; border-bottom: 1px solid var(--soft); }
    .health-strip { padding: 10px; display: grid; gap: 7px; }
    .health-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; border-bottom: 1px solid var(--surface-alt); }
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
      border: 1px dashed color-mix(in srgb, var(--accent) 42%, white);
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
      background: rgba(17, 24, 39, 0.28);
    }
    .palette-dialog {
      width: min(640px, calc(100vw - 32px));
      border-radius: 8px;
      border: 1px solid var(--soft);
      background: var(--surface);
      box-shadow: 0 24px 70px rgba(17, 24, 39, 0.22);
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

export function renderTabletWorkbenchCss(): string {
  return `
    .workbench-shell {
      height: 100vh;
      min-height: 100vh;
      padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
      display: grid;
      grid-template-rows: 64px 44px minmax(0, 1fr) 150px;
      gap: 10px;
      background: var(--canvas);
      overflow: hidden;
    }
    .workbench-topbar {
      display: grid;
      grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      min-width: 0;
      padding: 0 14px;
      border-radius: 8px;
      background: var(--chrome);
      color: var(--inverse);
    }
    .workbench-search span, .drawer-search span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .workbench-search input {
      height: 44px;
      border-color: #263349;
      background: var(--chrome-raised);
      color: var(--inverse);
    }
    .workbench-search input::placeholder { color: #b9c6c0; }
    .workbench-actions { display: flex; gap: 8px; align-items: center; min-width: 0; }
    .touch-button, .touch-icon {
      min-width: 44px;
      min-height: 44px;
    }
    .touch-icon { padding: 0 10px; }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
      filter: grayscale(0.2);
    }
    .guard-banner {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      background: #fff7ed;
      color: var(--amber);
      font-size: 12px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .workbench-shell[data-connection="connected"] .guard-banner {
      border-color: color-mix(in srgb, var(--run) 28%, white);
      background: #f0fdf4;
      color: #15803d;
    }
    .workbench-shell[data-connection="offline"] .guard-banner {
      border-color: color-mix(in srgb, var(--red) 32%, white);
      background: #fef2f2;
      color: var(--red);
    }
    .workbench-grid {
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr) 184px;
      gap: 10px;
      min-height: 0;
      overflow: hidden;
    }
    .workbench-drawer, .agent-compact-rail, .diff-panel {
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--soft);
      border-radius: 8px;
      background: var(--surface);
      overflow: hidden;
    }
    .workbench-drawer {
      display: grid;
      grid-template-rows: 52px 60px minmax(0, 118px) minmax(0, 1fr);
    }
    .workbench-panel-heading, .terminal-sheet-heading {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px;
      border-bottom: 1px solid var(--soft);
      background: var(--surface-alt);
    }
    .drawer-search { padding: 8px; }
    .drawer-search input { height: 44px; }
    .search-results, .workbench-file-tree, .diff-viewer, .agent-compact-rail {
      display: grid;
      gap: 7px;
      padding: 8px;
      align-content: start;
      overflow: auto;
      min-height: 0;
    }
    .search-results:empty { display: none; }
    .file-row, .search-row, .tab-row, .hunk-row, .agent-row {
      min-height: 44px;
      border: 1px solid var(--soft);
      border-radius: 6px;
      background: var(--inverse);
      color: var(--ink);
      padding: 8px 10px;
      display: grid;
      gap: 4px;
      text-align: left;
      overflow: hidden;
    }
    .file-row { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
    .file-row strong, .search-row strong, .tab-row strong, .hunk-row strong, .agent-row strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-row[data-selected="true"], .tab-row[data-active="true"] {
      background: var(--surface-alt);
      border-color: color-mix(in srgb, var(--accent) 42%, white);
    }
    .dirty-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--amber);
    }
    .workbench-editor-pane {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: 52px 52px minmax(260px, 1fr) 146px;
      gap: 10px;
    }
    .editor-tabs, .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      overflow: auto;
    }
    .tab-row {
      width: 188px;
      flex: 0 0 auto;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .editor-toolbar { justify-content: flex-end; }
    .editor-frame {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: 34px minmax(0, 1fr);
      border-radius: 8px;
      overflow: hidden;
      background: var(--code);
    }
    .editor-meta {
      min-height: 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: #111827;
      color: #d1fae5;
      font-size: 12px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .codemirror-host {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .codemirror-host .cm-editor {
      height: 100%;
      min-height: 100%;
      background: var(--code);
      color: #e5e7eb;
      font-size: 13px;
    }
    .codemirror-host .cm-scroller { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .diff-panel {
      display: grid;
      grid-template-rows: 52px minmax(0, 1fr);
    }
    .hunk-row {
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
    }
    .hunk-row .secondary-button, .hunk-row .ghost-button { min-height: 44px; }
    .agent-compact-rail { align-content: start; }
    .terminal-sheet {
      min-height: 0;
      display: grid;
      grid-template-rows: 44px minmax(0, 1fr) auto;
      border-radius: 8px;
      overflow: hidden;
      background: var(--code);
      color: #e5e7eb;
    }
    .terminal-sheet-heading {
      min-height: 44px;
      border-bottom-color: #1f2937;
      background: #111827;
      color: var(--inverse);
    }
    #workbenchTerminalOutput {
      margin: 0;
      min-height: 0;
      overflow: auto;
      padding: 12px;
      font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .workbench-shell .command-palette { place-items: start center; padding-top: 16vh; }
    @media (max-width: 900px) {
      .workbench-shell { grid-template-rows: auto 44px minmax(0, 1fr) 150px; }
      .workbench-topbar { grid-template-columns: 1fr; padding: 10px; }
      .workbench-actions { justify-content: flex-start; flex-wrap: wrap; }
      .workbench-grid { grid-template-columns: 248px minmax(0, 1fr); }
      .agent-compact-rail { display: none; }
      .workbench-editor-pane { grid-template-rows: 52px 52px minmax(360px, 1fr) 176px; }
    }
    @media (max-width: 680px) {
      .workbench-shell { grid-template-rows: auto auto minmax(0, 1fr) 210px; }
      .workbench-grid { grid-template-columns: 1fr; overflow: auto; }
      .workbench-drawer { max-height: 240px; }
      .workbench-editor-pane { grid-template-rows: auto auto minmax(300px, 1fr) auto; }
      .editor-toolbar { justify-content: flex-start; flex-wrap: wrap; }
      .terminal-sheet { min-height: 210px; }
      .hunk-row { grid-template-columns: 1fr; }
    }
  `;
}

export function renderMobileCommandReviewCss(): string {
  return `
    :root {
      --mobile-blue: #3182f6;
      --mobile-blue-press: #2272eb;
      --mobile-blue-soft: #e8f3ff;
      --mobile-bg: #f9fafb;
      --mobile-surface: #ffffff;
      --mobile-surface-2: #f2f4f6;
      --mobile-line: #e5e8eb;
      --mobile-text: #191f28;
      --mobile-text-2: #4e5968;
      --mobile-muted: #8b95a1;
      --mobile-green: #03b26c;
      --mobile-red: #f04452;
      --mobile-orange: #fe9800;
    }
    .mobile-shell {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) 72px;
      gap: 8px;
      padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
      background: var(--mobile-bg);
      max-width: 430px;
      margin: 0 auto;
      color: var(--mobile-text);
      font-family: "Toss Product Sans", "Tossface", "SF Pro KR", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Roboto, "Noto Sans KR", sans-serif;
    }
    .mobile-topbar {
      min-height: 56px;
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--mobile-line);
      background: rgba(255,255,255,0.92);
      color: var(--mobile-text);
      backdrop-filter: blur(14px);
      position: sticky;
      top: 0;
      z-index: 8;
    }
    .mobile-room-title {
      min-width: 0;
      display: grid;
      justify-items: center;
      gap: 1px;
      text-align: center;
    }
    .mobile-room-title strong {
      font-size: 16px;
      line-height: 22px;
      font-weight: 700;
    }
    .mobile-room-title span {
      max-width: 100%;
      color: var(--mobile-muted);
      font-size: 11px;
      line-height: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-icon-button {
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--mobile-surface-2);
      color: var(--mobile-text);
      font-size: 26px;
      font-weight: 600;
    }
    .mobile-icon-button svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .mobile-status-strip {
      min-height: 34px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      background: var(--mobile-blue-soft);
      color: var(--mobile-blue);
      font-size: 11px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .mobile-shell[data-connection="offline"] .mobile-status-strip {
      border-color: color-mix(in srgb, var(--mobile-red) 32%, white);
      background: #fef2f2;
      color: var(--mobile-red);
    }
    .mobile-shell[data-connection="reconnecting"] .mobile-status-strip {
      border-color: color-mix(in srgb, var(--mobile-orange) 32%, white);
      background: #fff7ed;
      color: var(--mobile-orange);
    }
    .mobile-main {
      min-height: 0;
      overflow: auto;
      display: grid;
      gap: 8px;
      scroll-behavior: smooth;
      padding-bottom: 6px;
    }
    .mobile-hero-panel, .mobile-section, .mobile-details {
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      background: var(--mobile-surface);
      color: var(--mobile-text);
      min-width: 0;
      overflow: hidden;
    }
    .mobile-chat-list-screen, .mobile-chat-room-screen, .mobile-settings-screen {
      scroll-margin-top: 72px;
    }
    .mobile-anchor {
      position: relative;
      top: -72px;
      display: block;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    .mobile-hero-panel {
      display: grid;
      gap: 8px;
      padding: 10px;
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
    }
    .mobile-hero-panel h1 {
      max-width: 86%;
      width: fit-content;
      padding: 10px 12px;
      border-radius: 16px 16px 16px 4px;
      background: var(--mobile-surface-2);
      font-size: 15px;
      line-height: 21px;
      font-weight: 700;
    }
    .mobile-hero-panel p {
      max-width: 92%;
      width: fit-content;
      padding: 10px 12px;
      border-radius: 16px 16px 16px 4px;
      background: var(--mobile-surface-2);
      color: var(--mobile-text-2);
      line-height: 1.45;
      font-size: 13px;
    }
    .mobile-next-actions, .mobile-card-actions, .mobile-confirm-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .mobile-segmented {
      min-height: 42px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 6px 8px 0;
    }
    .mobile-segmented a, .mobile-bottom-nav a {
      min-height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--mobile-line);
      background: var(--mobile-surface);
      color: var(--mobile-text-2);
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-segmented a[data-active="true"] {
      background: var(--mobile-blue-soft);
      color: var(--mobile-blue);
      border-color: #c9e2ff;
    }
    .mobile-section-heading {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 12px;
      border-bottom: 1px solid var(--mobile-line);
      background: var(--mobile-surface);
    }
    .mobile-section-heading h2 { font-size: 16px; line-height: 22px; }
    .mobile-kicker, .mobile-panel-label {
      color: var(--mobile-muted);
      font-size: 11px;
      line-height: 14px;
      font-weight: 600;
    }
    .mobile-panel-label {
      padding: 10px 10px 0;
    }
    .mobile-search-row {
      min-height: 42px;
      margin: 8px 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border-radius: 12px;
      background: var(--mobile-surface-2);
      color: var(--mobile-muted);
      font-size: 13px;
      font-weight: 600;
    }
    .mobile-list {
      display: grid;
      gap: 6px;
      padding: 8px;
    }
    .mobile-card {
      min-height: 48px;
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      background: var(--mobile-surface);
      min-width: 0;
    }
    .mobile-room-list .mobile-card {
      grid-template-columns: minmax(0, 1fr);
      border-color: transparent;
      border-bottom-color: var(--mobile-line);
      border-radius: 0;
      padding: 10px 4px;
    }
    .mobile-room-list .mobile-card::before {
      content: "";
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--mobile-blue), #18a5a5);
      grid-row: 1 / span 2;
      align-self: center;
      display: block;
      float: left;
    }
    .mobile-chat-panel {
      border-top: 1px solid var(--mobile-line);
      background: #fbfcfd;
    }
    .mobile-chat-composer {
      position: sticky;
      bottom: 0;
      z-index: 5;
      border-top: 1px solid var(--mobile-line);
      background: rgba(255,255,255,0.96);
      backdrop-filter: blur(14px);
    }
    .mobile-card strong, .mobile-card p, .mobile-card span { min-width: 0; overflow-wrap: anywhere; }
    .mobile-card-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .mobile-primary, .mobile-secondary, .mobile-danger {
      min-height: 44px;
      border-radius: 8px;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mobile-primary { background: var(--mobile-blue); color: #ffffff; }
    .mobile-primary:active { background: var(--mobile-blue-press); }
    .mobile-secondary { background: var(--mobile-blue-soft); color: var(--mobile-blue); border-color: #c9e2ff; }
    .mobile-danger { background: var(--mobile-red); color: #ffffff; }
    .mobile-primary:disabled, .mobile-secondary:disabled, .mobile-danger:disabled {
      cursor: not-allowed;
      opacity: 0.56;
    }
    .mobile-details {
      padding: 0;
    }
    .mobile-details summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      cursor: pointer;
      font-weight: 600;
      background: var(--mobile-surface);
      border-top: 1px solid var(--mobile-line);
      border-bottom: 1px solid var(--mobile-line);
    }
    #mobileDiffBody {
      display: grid;
      gap: 8px;
      padding: 10px;
    }
    .mobile-command-form, .mobile-settings-form {
      display: grid;
      gap: 8px;
      padding: 8px;
    }
    .mobile-command-form label {
      display: grid;
      gap: 4px;
      color: var(--mobile-muted);
      font-size: 11px;
      font-weight: 600;
    }
    .mobile-command-form select {
      min-height: 38px;
      width: 100%;
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--mobile-surface-2);
      color: var(--mobile-text);
    }
    .mobile-command-form textarea {
      width: 100%;
      min-height: 76px;
      resize: vertical;
      border: 1px solid var(--mobile-line);
      border-radius: 10px;
      padding: 10px;
      color: var(--mobile-text);
      background: var(--mobile-surface-2);
    }
    .mobile-settings-form label {
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      background: var(--mobile-surface);
      padding: 0 10px;
      color: var(--mobile-text);
      font-weight: 600;
    }
    .mobile-settings-form input[type="checkbox"] {
      width: 22px;
      height: 22px;
      min-height: 22px;
    }
    .mobile-bottom-nav {
      min-height: 72px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 6px 8px max(6px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--mobile-line);
      background: rgba(255,255,255,0.96);
      backdrop-filter: blur(14px);
    }
    .mobile-bottom-nav a {
      border-color: transparent;
      background: transparent;
      color: var(--mobile-muted);
      border-radius: 8px;
      min-height: 44px;
    }
    .mobile-bottom-nav a:focus, .mobile-bottom-nav a:hover {
      color: var(--mobile-blue);
      background: var(--mobile-blue-soft);
    }
    .mobile-confirm-backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      align-items: end;
      padding: 12px;
      background: rgba(2, 9, 19, 0.5);
    }
    .mobile-confirm-sheet {
      width: min(430px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 12px;
      border-radius: 16px 16px 8px 8px;
      background: var(--mobile-surface);
      color: var(--mobile-text);
      padding: 16px;
      border: 1px solid var(--mobile-line);
      box-shadow: 0 8px 24px rgba(0,0,0,0.16);
    }
    .mobile-settings-dialog {
      margin: 8px;
      overflow: hidden;
      border: 1px solid var(--mobile-line);
      border-radius: 16px;
      background: var(--mobile-surface);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .state-badge, .count-badge {
      min-height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--mobile-surface-2);
      color: var(--mobile-text-2);
      font-size: 11px;
      line-height: 16px;
      font-weight: 600;
      white-space: nowrap;
    }
    .state-badge.live, .state-badge.done, .state-badge.approved, .state-badge.clear, .state-badge.connected {
      background: #e6f8f0;
      color: var(--mobile-green);
    }
    .state-badge.requested, .state-badge.new, .count-badge {
      background: var(--mobile-blue-soft);
      color: var(--mobile-blue);
    }
    .state-badge.cancelled, .state-badge.rejected, .state-badge.failed {
      background: #fff0f1;
      color: var(--mobile-red);
    }
    .muted {
      color: var(--mobile-muted);
      font-size: 12px;
      line-height: 18px;
    }
    .mobile-split-view {
      display: none;
    }
    .mobile-split-slot {
      min-width: 0;
      min-height: 0;
      display: grid;
      place-content: center;
      gap: 6px;
      border: 1px solid var(--mobile-line);
      border-radius: 8px;
      background: var(--mobile-surface);
      color: var(--mobile-text);
      text-align: center;
    }
    .mobile-split-slot strong {
      font-size: 15px;
      line-height: 20px;
    }
    .mobile-split-slot span {
      color: var(--mobile-muted);
      font-size: 12px;
      line-height: 18px;
    }
    @media (min-width: 481px) {
      body { background: #f2f4f6; }
      .mobile-shell { border-left: 1px solid var(--mobile-line); border-right: 1px solid var(--mobile-line); }
    }
    @media (min-width: 700px) {
      body { background: #f2f4f6; }
      .mobile-shell {
        width: 100vw;
        max-width: none;
        height: 100vh;
        min-height: 100vh;
        grid-template-rows: minmax(0, 1fr);
        padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
        border: 0;
        background: #f2f4f6;
        overflow: hidden;
      }
      .mobile-topbar, .mobile-status-strip, .mobile-main, .mobile-bottom-nav {
        display: none;
      }
      .mobile-split-view {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
        gap: 10px;
        overflow: hidden;
      }
      .mobile-confirm-backdrop {
        align-items: center;
      }
    }
    @media (min-width: 700px) and (max-width: 980px) {
      .mobile-split-view {
        grid-template-columns: minmax(236px, 0.9fr) minmax(0, 1.1fr);
        gap: 8px;
      }
    }
  `;
}

export function renderMobileCommandReviewAppJs(): string {
  return `
(() => {
  const client = window.NadoVibeGatewayClient.createGatewayClient();
  const state = {
    projection: null,
    selectedRunId: undefined,
    online: navigator.onLine,
    connection: 'connected',
    stream: undefined,
    pendingConfirm: undefined
  };
  const $ = (id) => document.getElementById(id);
  const idempotency = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  async function load() {
    state.projection = await client.getMobileReview();
    state.selectedRunId = state.selectedRunId || state.projection.runs[0]?.runId;
    render();
    connectStream();
    routeFromHash();
  }

  function render() {
    const p = state.projection;
    if (!p) return;
    $('mobileApp').dataset.connection = connectionState();
    $('mobileWorkspaceLabel').textContent = p.runs[0]?.objective || '승인, 복구, 최종 검토';
    renderStatus(p);
    renderNextAction(p);
    renderInbox(p);
    renderRunDetail(p);
    renderReview(p);
    renderCommand(p);
    renderNotificationSettings(p);
    renderTabs();
    setActionDisabled();
  }

  function connectionState() {
    if (!state.online) return 'offline';
    if (state.connection === 'reconnecting') return 'reconnecting';
    return 'connected';
  }

  function canExecute() {
    return connectionState() === 'connected';
  }

  function renderStatus(p) {
    const label = connectionState() === 'offline' ? '오프라인입니다. 결정과 명령 전송은 재연결 후 가능합니다.' :
      connectionState() === 'reconnecting' ? '재연결 중입니다. inbox 읽기는 유지되고 실행 action은 잠겨 있습니다.' :
      p.serviceStatus.message + ' Workspace: ' + p.serviceStatus.workspaceMessage;
    $('mobileServiceStatus').textContent = label;
  }

  function renderNextAction(p) {
    const action = p.nextActions[0];
    $('mobileNextAction').innerHTML = action ? (
      '<span class="state-badge ' + escapeAttr(action.priority) + '">' + escapeHtml(action.kind.replace('_', ' ')) + '</span>' +
      '<h1>' + escapeHtml(action.title) + '</h1>' +
      '<p>' + escapeHtml(action.body) + '</p>' +
      '<div class="mobile-next-actions">' +
      '<a class="mobile-primary" href="' + escapeAttr(action.route) + '">Review</a>' +
      '<button class="mobile-secondary" type="button" data-mobile-mark-route="' + escapeAttr(action.route) + '">Later</button>' +
      '</div>'
    ) : (
      '<span class="state-badge done">clear</span><h1>처리할 결정 없음</h1><p>새 작업이나 검토 요청이 들어오면 이 영역에 먼저 표시됩니다.</p>'
    );
  }

  function renderInbox(p) {
    $('mobileInboxCount').textContent = String(p.inbox.filter((item) => item.unread).length);
    const inboxItems = p.inbox.slice(-8).reverse();
    $('mobileInboxList').innerHTML = inboxItems.length ? inboxItems.map((item) =>
      '<article id="notification-' + escapeAttr(item.notificationId) + '" class="mobile-card">' +
      '<div class="mobile-card-row"><strong>' + escapeHtml(item.title) + '</strong>' + badge(item.unread ? 'new' : 'read') + '</div>' +
      '<p class="muted">' + escapeHtml(item.body) + '</p>' +
      '<div class="mobile-card-actions"><a class="mobile-secondary" href="' + escapeAttr(item.route) + '">Open</a>' +
      '<button class="mobile-secondary" type="button" data-mobile-read="' + escapeAttr(item.notificationId) + '">Done</button></div>' +
      '</article>'
    ).join('') : '<article class="mobile-card"><strong>Inbox clear</strong><p class="muted">사용자 결정이 필요한 항목만 표시됩니다.</p></article>';
  }

  function renderRunDetail(p) {
    $('mobileCommandRun').innerHTML = p.runs.map((run) => '<option value="' + escapeAttr(run.runId) + '">' + escapeHtml(run.objective) + '</option>').join('');
    if (state.selectedRunId) $('mobileCommandRun').value = state.selectedRunId;
    const visibleRuns = p.runs.slice(-5).reverse();
    $('mobileRunDetail').innerHTML = visibleRuns.length ? visibleRuns.map((run) =>
      '<article class="mobile-card" data-mobile-run="' + escapeAttr(run.runId) + '">' +
      '<div class="mobile-card-row"><strong>' + escapeHtml(run.objective) + '</strong>' + badge(run.userStatus) + '</div>' +
      '<p class="muted">Step ' + escapeHtml(run.currentStep) + ' / ' + run.progressPercent + '%</p>' +
      '<div class="mobile-card-actions">' +
      '<button class="mobile-secondary" type="button" data-mobile-run-action="retry" data-run-id="' + escapeAttr(run.runId) + '">Retry</button>' +
      '<button class="mobile-danger" type="button" data-mobile-run-action="cancel" data-run-id="' + escapeAttr(run.runId) + '">Cancel Run</button>' +
      '</div></article>'
    ).join('') : '<article class="mobile-card"><strong>Run 없음</strong><p class="muted">Quick Command를 보내면 필요한 run을 먼저 만들 수 있습니다.</p></article>';
    const visibleAgents = p.agents.filter((agent) => !state.selectedRunId || agent.runId === state.selectedRunId).slice(-6);
    $('mobileAgentRoster').innerHTML = '<article class="mobile-card"><strong>Agent Roster</strong>' + visibleAgents.map((agent) =>
      '<div class="mobile-card-row"><span>' + escapeHtml(agent.label) + '</span>' + badge(agent.state) + '</div>'
    ).join('') + '</article>';
  }

  function renderReview(p) {
    const approvals = p.approvals.slice(-8).reverse();
    $('mobileApprovalReview').innerHTML = approvals.length ? approvals.map((approval) =>
      '<article id="approval-' + escapeAttr(approval.approvalId) + '" class="mobile-card">' +
      '<div class="mobile-card-row"><strong>Approval Review</strong>' + badge(approval.state) + '</div>' +
      '<p class="muted">' + escapeHtml(approval.reason) + '</p>' +
      '<div class="mobile-card-actions">' +
      '<button class="mobile-primary" type="button" data-mobile-approval-decision="approve" data-approval-id="' + escapeAttr(approval.approvalId) + '" data-destructive="' + String(approval.destructive) + '"' + (approval.state === 'requested' ? '' : ' disabled') + '>Approve</button>' +
      '<button class="mobile-secondary" type="button" data-mobile-approval-decision="reject" data-approval-id="' + escapeAttr(approval.approvalId) + '"' + (approval.state === 'requested' ? '' : ' disabled') + '>Reject</button>' +
      '</div></article>'
    ).join('') : '<article class="mobile-card"><strong>승인 요청 없음</strong><p class="muted">필요한 승인만 표시됩니다.</p></article>';
    const conflicts = p.conflicts.slice(-5).reverse();
    $('mobileConflictReview').innerHTML = conflicts.length ? conflicts.map((conflict) =>
      '<article id="conflict-' + escapeAttr(conflict.conflictId) + '" class="mobile-card">' +
      '<div class="mobile-card-row"><strong>Conflict Review</strong>' + badge(conflict.state) + '</div>' +
      '<p class="muted">' + escapeHtml(conflict.summary) + '</p>' +
      '<p class="muted">' + escapeHtml(conflict.files.join(', ')) + '</p>' +
      '<button class="mobile-secondary" type="button" data-mobile-conflict-action="escalate" data-conflict-id="' + escapeAttr(conflict.conflictId) + '"' + (conflict.state === 'detected' ? '' : ' disabled') + '>Escalate</button>' +
      '</article>'
    ).join('') : '';
    const recovery = p.recovery.slice(-5).reverse();
    $('mobileRecoveryDecision').innerHTML = recovery.length ? recovery.map((item) =>
      '<article id="recovery-' + escapeAttr(item.recoveryId) + '" class="mobile-card">' +
      '<div class="mobile-card-row"><strong>' + escapeHtml(item.title) + '</strong>' + badge(item.state) + '</div>' +
      '<p class="muted">' + escapeHtml(item.nextAction) + '</p>' +
      '<button class="mobile-secondary" type="button" data-mobile-recovery-action="retry" data-run-id="' + escapeAttr(item.runId) + '"' + (item.state === 'resolved' ? ' disabled' : '') + '>Retry Recovery</button>' +
      '</article>'
    ).join('') : '';
    renderDiffSummary(p);
    const final = p.finalReview;
    $('mobileFinalReview').innerHTML = '<article id="final-review" class="mobile-card">' +
      '<div class="mobile-card-row"><strong>Final Review</strong>' + badge(final.state) + '</div>' +
      final.checklist.map((item) => '<div class="mobile-card-row"><span>' + escapeHtml(item.label) + '</span>' + badge(item.done ? 'done' : 'open') + '</div>').join('') +
      '<div class="mobile-card-actions">' +
      '<button class="mobile-primary" type="button" data-mobile-final-review="approve">Approve Final</button>' +
      '<button class="mobile-secondary" type="button" data-mobile-final-review="request_changes">Request Changes</button>' +
      '</div></article>';
  }

  function renderDiffSummary(p) {
    const summary = p.diffSummary;
    $('mobileDiffBody').innerHTML =
      '<article class="mobile-card">' +
      '<div class="mobile-card-row"><strong>' + summary.fileCount + ' files</strong><span class="muted">+' + summary.additions + ' / -' + summary.deletions + '</span></div>' +
      '<p class="muted">Risky files: ' + escapeHtml(summary.riskyFiles.join(', ') || 'none') + '</p>' +
      '<p class="muted">Test status: ' + escapeHtml(summary.testStatus) + '</p>' +
      summary.hunks.slice(0, 8).map((hunk) => '<div class="mobile-card-row"><span>' + escapeHtml(hunk.title) + '</span>' + badge(hunk.state) + '</div>').join('') +
      '</article>';
  }

  function renderCommand(p) {
    $('mobileCommandLog').innerHTML = p.runs.length && p.nextActions.length ? p.nextActions.slice(0, 3).map((item) =>
      '<article class="mobile-card"><strong>' + escapeHtml(item.title) + '</strong><p class="muted">' + escapeHtml(item.body) + '</p></article>'
    ).join('') : '<article class="mobile-card"><strong>명령 대기</strong><p class="muted">템플릿과 자유 입력으로 agent에게 짧은 명령을 보낼 수 있습니다.</p></article>';
  }

  function renderNotificationSettings(p) {
    const settings = p.notificationSettings;
    $('notifyEnabled').checked = settings.enabled;
    $('notifyApprovals').checked = settings.approvals;
    $('notifyRecovery').checked = settings.recovery;
    $('notifyFinal').checked = settings.finalReview;
    $('notifyQuiet').checked = settings.quietHeavyWork;
    $('mobileNotificationState').textContent = p.pushRegistration.registered ? p.pushRegistration.permission : (p.pushRegistration.permission === 'default' ? 'not registered' : p.pushRegistration.permission);
  }

  function renderTabs() {
    const hash = location.hash || '#inbox';
    for (const tab of document.querySelectorAll('[data-mobile-tab]')) {
      tab.dataset.active = String(tab.getAttribute('href') === hash || (hash.startsWith('#approval') && tab.dataset.mobileTab === 'review'));
    }
  }

  function badge(value) {
    return '<span class="state-badge ' + escapeAttr(String(value).replace(/[^a-z0-9_-]/gi, '_')) + '">' + escapeHtml(value) + '</span>';
  }

  async function ensureRun() {
    if (state.selectedRunId) return state.selectedRunId;
    await client.seedIdentity({ tenantId: 'tenant_dev', userId: 'user_dev', workspaceId: 'workspace_dev', repositoryId: 'repo_nadovibe' });
    const result = await client.createRun({
      runId: 'run_mobile_' + Date.now(),
      workspaceId: 'workspace_dev',
      repositoryId: 'repo_nadovibe',
      objective: 'Mobile Chat IDE 작업',
      idempotencyKey: idempotency('mobile_run')
    });
    state.selectedRunId = result.runId;
    await load();
    return state.selectedRunId;
  }

  async function submitQuickCommand(event) {
    event.preventDefault();
    if (!canExecute()) return;
    const runId = $('mobileCommandRun').value || await ensureRun();
    const instruction = [$('mobileCommandTemplate').value, $('mobileCommandText').value.trim()].filter(Boolean).join(' / ');
    state.projection = await client.enqueueCommand({
      runId,
      instruction,
      resourceIntent: 'light',
      idempotencyKey: idempotency('mobile_cmd')
    });
    $('mobileCommandText').value = '';
    await load();
    $('mobileCommandLog').innerHTML = '<article class="mobile-card"><strong>Command sent</strong><p class="muted">' + escapeHtml(instruction) + '</p></article>' + $('mobileCommandLog').innerHTML;
  }

  async function decideApproval(target) {
    const approvalId = target.dataset.approvalId;
    const decision = target.dataset.mobileApprovalDecision;
    const execute = async () => {
      state.projection = await client.decideApproval({ approvalId, decision, reason: 'Mobile review decision', idempotencyKey: idempotency('mobile_approval') });
      await load();
    };
    if (target.dataset.destructive === 'true') {
      openConfirm('확인 후 승인', '이 승인은 되돌리기 어려운 변경을 허용할 수 있습니다.', execute);
      return;
    }
    await execute();
  }

  async function escalateConflict(target) {
    state.projection = await client.escalateConflict({
      conflictId: target.dataset.conflictId,
      reason: 'Mobile conflict escalation',
      idempotencyKey: idempotency('mobile_conflict')
    });
    await load();
  }

  async function runAction(target) {
    const action = target.dataset.mobileRunAction;
    const runId = target.dataset.runId;
    const execute = async () => {
      state.projection = await client.controlSupervisor({ runId, action, reason: 'Mobile run action', idempotencyKey: idempotency('mobile_run_action') });
      await load();
    };
    if (action === 'cancel') {
      openConfirm('Run 중단 확인', '진행 중인 작업을 중단합니다. 현재까지의 기록은 보존됩니다.', execute);
      return;
    }
    await execute();
  }

  async function retryRecovery(target) {
    state.projection = await client.controlSupervisor({
      runId: target.dataset.runId,
      action: 'retry',
      reason: 'Mobile recovery retry',
      idempotencyKey: idempotency('mobile_recovery')
    });
    await load();
  }

  async function decideFinalReview(target) {
    const runId = state.projection.finalReview.runId || state.selectedRunId || await ensureRun();
    state.projection = await client.decideFinalReview({
      runId,
      decision: target.dataset.mobileFinalReview,
      reason: 'Mobile final review',
      idempotencyKey: idempotency('mobile_final')
    });
    await load();
  }

  async function saveNotificationSettings(event) {
    event.preventDefault();
    const workspaceId = state.projection.notificationSettings.workspaceId || 'workspace_dev';
    state.projection = await client.updateNotificationSettings({
      workspaceId,
      enabled: $('notifyEnabled').checked,
      approvals: $('notifyApprovals').checked,
      recovery: $('notifyRecovery').checked,
      finalReview: $('notifyFinal').checked,
      quietHeavyWork: $('notifyQuiet').checked,
      idempotencyKey: idempotency('mobile_settings')
    });
    $('mobileNotificationState').textContent = 'saved';
    await load();
  }

  async function registerPush() {
    const workspaceId = state.projection?.notificationSettings.workspaceId || 'workspace_dev';
    let permission = 'unsupported';
    if ('Notification' in window) {
      permission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch (_error) {
          permission = Notification.permission || 'default';
        }
      }
    }
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/service-worker.js');
    }
    state.projection = await client.registerMobilePush({
      workspaceId,
      permission,
      endpoint: location.origin + '/mobile#inbox',
      routeOnClick: '/mobile#inbox',
      idempotencyKey: idempotency('mobile_push')
    });
    $('mobileNotificationState').textContent = permission;
    await load();
  }

  async function markNotificationRead(notificationId) {
    state.projection = await client.markNotificationRead({ notificationId, idempotencyKey: idempotency('mobile_read') });
    await load();
  }

  function openConfirm(title, body, action) {
    state.pendingConfirm = action;
    $('mobileConfirmTitle').textContent = title;
    $('mobileConfirmBody').textContent = body;
    $('mobileConfirmSheet').hidden = false;
    $('mobileConfirmApply').focus();
  }

  function closeConfirm() {
    state.pendingConfirm = undefined;
    $('mobileConfirmSheet').hidden = true;
  }

  function setActionDisabled() {
    const disabled = !canExecute();
    for (const selector of ['[data-mobile-approval-decision]', '[data-mobile-conflict-action]', '[data-mobile-recovery-action]', '[data-mobile-run-action]', '[data-mobile-final-review]', '#mobileCommandSubmit']) {
      for (const item of document.querySelectorAll(selector)) {
        item.disabled = disabled;
      }
    }
  }

  function connectStream() {
    if (!state.projection || state.stream) return;
    const stream = client.openStream(state.projection.lastOffset);
    state.stream = stream;
    stream.addEventListener('core_event', () => {
      state.connection = 'connected';
      load().catch(reportError);
    });
    stream.onerror = () => {
      state.connection = 'reconnecting';
      render();
      stream.close();
      state.stream = undefined;
      window.setTimeout(() => load().catch(reportError), 1200);
    };
  }

  function routeFromHash() {
    renderTabs();
    if (!location.hash) return;
    window.setTimeout(() => {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView({ block: 'start' });
    }, 40);
  }

  async function handleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    if (!canExecute() && !['registerPushButton', 'mobileConfirmCancel'].includes(target.id)) return;
    if (target.id === 'registerPushButton') await registerPush();
    if (target.dataset.mobileRead) await markNotificationRead(target.dataset.mobileRead);
    if (target.dataset.mobileApprovalDecision) await decideApproval(target);
    if (target.dataset.mobileConflictAction) await escalateConflict(target);
    if (target.dataset.mobileRecoveryAction) await retryRecovery(target);
    if (target.dataset.mobileRunAction) await runAction(target);
    if (target.dataset.mobileFinalReview) await decideFinalReview(target);
    if (target.dataset.mobileMarkRoute) location.hash = target.dataset.mobileMarkRoute.replace(/^.*#/, '#');
    if (target.id === 'mobileConfirmCancel') closeConfirm();
    if (target.id === 'mobileConfirmApply' && state.pendingConfirm) {
      const action = state.pendingConfirm;
      closeConfirm();
      await action();
    }
  }

  function reportError(error) {
    state.connection = 'offline';
    $('mobileApp').dataset.connection = 'offline';
    $('mobileServiceStatus').textContent = error instanceof Error ? error.message : '오류가 발생했습니다.';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function escapeAttr(value) {
    return escapeHtml(value).replace(/\\s+/g, ' ');
  }

  document.addEventListener('click', (event) => handleClick(event).catch(reportError));
  window.addEventListener('hashchange', routeFromHash);
  window.addEventListener('offline', () => {
    state.online = false;
    render();
  });
  window.addEventListener('online', () => {
    state.online = true;
    load().catch(reportError);
  });
  $('mobileQuickCommandForm').addEventListener('submit', (event) => submitQuickCommand(event).catch(reportError));
  $('mobileNotificationSettings').addEventListener('submit', (event) => saveNotificationSettings(event).catch(reportError));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  load().catch(reportError);
})();
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

export function renderTabletWorkbenchAppJs(): string {
  return `
const client = window.NadoVibeGatewayClient.createGatewayClient();
const state = {
  projection: null,
  workspaceId: undefined,
  runId: undefined,
  filePath: undefined,
  fileLeaseId: undefined,
  fileLeaseExpiresAt: 0,
  originalContent: '',
  dirty: false,
  online: navigator.onLine,
  connection: 'connected',
  editor: undefined,
  cm: undefined,
  stream: undefined
};
const $ = (id) => document.getElementById(id);
const idempotency = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

async function boot() {
  state.cm = await import('/assets/codemirror-vendor.js');
  mountEditor('');
  await load();
  bindEvents();
  renderPalette();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
}

async function load() {
  state.projection = await client.getControlRoom('user');
  state.workspaceId = state.workspaceId || state.projection.workspaces[0]?.workspaceId;
  state.runId = state.runId || state.projection.runs[0]?.runId;
  render();
  connectStream();
  if (!state.filePath) {
    const preferred = state.projection.fileTree.find((item) => item.type === 'file' && item.path === 'packages/ui/src/index.ts') ||
      state.projection.fileTree.find((item) => item.type === 'file' && /\\.(ts|tsx|js|json|md)$/.test(item.path));
    if (preferred) await openFile(preferred.path);
  }
}

function mountEditor(content) {
  const cm = state.cm;
  if (state.editor) state.editor.destroy();
  $('editorMount').innerHTML = '';
  state.editor = new cm.EditorView({
    state: cm.EditorState.create({
      doc: content,
      extensions: [
        cm.basicSetup,
        cm.javascript(),
        cm.EditorView.lineWrapping,
        cm.EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          state.dirty = state.editor.state.doc.toString() !== state.originalContent;
          renderDirtyState();
        })
      ]
    }),
    parent: $('editorMount')
  });
}

function render() {
  const p = state.projection;
  if (!p) return;
  $('workbenchApp').dataset.connection = connectionState();
  $('workbenchBranch').textContent = branchLabel(p);
  $('workbenchBranch').title = branchLabel(p);
  renderGuard();
  renderFiles(p);
  renderTabs();
  renderDiff(p);
  renderAgents(p);
  renderTerminal(p);
  renderEditorSession(p);
  renderDirtyState();
}

function branchLabel(p) {
  const repo = p.repositories[0];
  const workspace = p.workspaces[0];
  return (workspace?.name || 'Workspace') + ' / ' + (repo ? repo.name + ' / ' + repo.branch : 'Repository');
}

function connectionState() {
  if (!state.online) return 'offline';
  if (state.connection === 'reconnecting') return 'reconnecting';
  return 'connected';
}

function canExecute() {
  return connectionState() === 'connected';
}

function renderGuard() {
  const current = connectionState();
  if (current === 'offline') {
    $('guardBanner').textContent = '오프라인 상태입니다. 편집 내용은 화면에 유지되지만 저장, 테스트, 에이전트 명령은 재연결 후 실행하십시오.';
  } else if (current === 'reconnecting') {
    $('guardBanner').textContent = '재연결 중입니다. 파일 검토는 계속할 수 있고 실행 명령은 잠겨 있습니다.';
  } else {
    $('guardBanner').textContent = '실시간 연결이 활성화되어 있습니다. 저장, diff 검토, 선택 범위 명령을 실행할 수 있습니다.';
  }
  for (const id of ['saveFileButton', 'askSelectionButton', 'testSelectionButton']) {
    const button = $(id);
    if (button && id === 'saveFileButton') button.disabled = !canExecute() || !state.filePath || !state.fileLeaseId || Date.now() >= state.fileLeaseExpiresAt;
    if (button && id !== 'saveFileButton') button.disabled = !canExecute() || (id !== 'testSelectionButton' && !state.filePath);
  }
  $('revertFileButton').disabled = !state.filePath || !state.dirty;
}

function renderFiles(p) {
  const query = $('fileSearch').value.trim().toLowerCase();
  const files = p.fileTree.filter((item) => item.type === 'file' && (!query || item.path.toLowerCase().includes(query))).slice(0, 320);
  $('workbenchFileTree').innerHTML = files.map((item) =>
    '<button class="file-row" type="button" data-open-file="' + escapeAttr(item.path) + '" data-selected="' + String(item.path === state.filePath) + '" title="' + escapeAttr(item.path) + '">' +
    '<strong>' + escapeHtml(item.name) + '</strong><span class="muted">' + escapeHtml(item.path.replace('/' + item.name, '')) + '</span>' +
    (item.path === state.filePath && state.dirty ? '<span class="dirty-dot" aria-label="dirty"></span>' : '') +
    '</button>'
  ).join('');
}

function renderTabs() {
  const label = state.filePath ? state.filePath.split('/').pop() : 'No file';
  $('editorTabs').innerHTML =
    '<button class="tab-row" type="button" data-active="true" title="' + escapeAttr(state.filePath || '') + '">' +
    '<strong>' + escapeHtml(label) + '</strong>' + (state.dirty ? '<span class="dirty-dot"></span>' : '<span class="muted">clean</span>') + '</button>';
  $('editorMeta').textContent = state.filePath ? state.filePath + (state.dirty ? '  •  dirty' : '  •  saved') + '  •  CodeMirror 6' : '파일을 선택하십시오';
}

function renderDirtyState() {
  $('dirtyIndicator').textContent = state.dirty ? 'dirty' : 'clean';
  $('dirtyIndicator').className = 'state-badge ' + (state.dirty ? 'preparing' : 'done');
  renderGuard();
  renderTabs();
}

function renderDiff(p) {
  $('diffViewer').innerHTML = p.diff.length ? p.diff.map((file) =>
    file.hunks.map((hunk) =>
      '<div class="hunk-row" data-hunk-id="' + escapeAttr(hunk.hunkId) + '">' +
      '<div><strong>' + escapeHtml(hunk.title) + '</strong><p class="muted">' + escapeHtml(file.path) + ' +' + hunk.additions + ' / -' + hunk.deletions + '</p></div>' +
      '<button class="secondary-button" type="button" data-hunk-decision="approve" data-hunk-path="' + escapeAttr(file.path) + '" data-hunk-id="' + escapeAttr(hunk.hunkId) + '">Approve</button>' +
      '<button class="ghost-button" type="button" data-hunk-decision="request_changes" data-hunk-path="' + escapeAttr(file.path) + '" data-hunk-id="' + escapeAttr(hunk.hunkId) + '">' + escapeHtml(hunk.state) + '</button>' +
      '</div>'
    ).join('')
  ).join('') : '<div class="list-item"><strong>Diff 없음</strong><p class="muted">저장 후 diff hunk가 여기에 표시됩니다.</p></div>';
}

function renderAgents(p) {
  const agents = p.agentHierarchy.slice(0, 5).map((agent) =>
    '<div class="agent-row"><strong>' + escapeHtml(agent.label) + '</strong><span class="muted">' + escapeHtml(agent.state) + '</span></div>'
  ).join('');
  const editor = p.editorSession;
  $('agentCompactRail').innerHTML =
    '<div class="workbench-panel-heading"><h2>Agents</h2><span class="count-badge">' + p.agentHierarchy.length + '</span></div>' +
    agents +
    '<div class="agent-row"><strong>Full IDE</strong><span class="muted">' + escapeHtml(editor.message) + '</span>' +
    (editor.publicRoute ? '<span class="muted">Gateway route ' + escapeHtml(editor.publicRoute) + '</span>' : '') + '</div>';
}

function renderEditorSession(p) {
  const editor = p.editorSession;
  $('openIdeButton').textContent = editor.state === 'ready' ? 'Revoke IDE' : 'Full IDE';
}

function renderTerminal(p) {
  $('workbenchTerminalOutput').textContent = p.terminal.length ? p.terminal.slice(-20).map((line) => '[' + line.stream + '] ' + line.text).join('\\n') : '아직 실행 출력이 없습니다.';
  $('workbenchArtifacts').innerHTML = p.artifacts.slice(-3).map((item) =>
    '<div class="list-item"><div class="item-row"><strong>' + escapeHtml(item.label) + '</strong><span class="muted">' + escapeHtml(item.sizeLabel) + '</span></div></div>'
  ).join('');
}

function renderPalette() {
  $('workbenchPaletteResults').innerHTML = [
    ['save', 'Save file'],
    ['ask', 'Ask selected code'],
    ['test', 'Run tests'],
    ['ide', 'Issue full IDE session']
  ].map(([action, label]) => '<button class="file-button" type="button" data-palette-action="' + action + '">' + label + '</button>').join('');
}

async function seedWorkspace() {
  await client.seedIdentity({ tenantId: 'tenant_dev', userId: 'user_dev', workspaceId: 'workspace_dev', repositoryId: 'repo_nadovibe' });
  await load();
}

async function ensureRun() {
  if (state.runId) return state.runId;
  if (!state.workspaceId) await seedWorkspace();
  const repositoryId = state.projection.repositories[0]?.repositoryId || 'repo_nadovibe';
  const result = await client.createRun({
    runId: 'run_' + Date.now(),
    workspaceId: state.workspaceId || 'workspace_dev',
    repositoryId,
    objective: 'Tablet Code Workbench 작업',
    idempotencyKey: idempotency('tablet_run')
  });
  state.projection = result.projection || await client.getControlRoom('user');
  state.runId = result.runId;
  render();
  return state.runId;
}

async function openFile(path) {
  if (state.dirty && !confirm('저장하지 않은 변경을 버리고 다른 파일을 여시겠습니까?')) return;
  const result = await client.readFile({ workspaceId: state.workspaceId || 'workspace_dev', path });
  state.filePath = result.path;
  state.fileLeaseId = result.fileLeaseId;
  state.fileLeaseExpiresAt = result.leaseExpiresAt;
  state.originalContent = result.content;
  state.dirty = false;
  mountEditor(result.content);
  render();
}

async function saveFile() {
  if (!canExecute() || !state.filePath) return;
  if (!state.fileLeaseId || Date.now() >= state.fileLeaseExpiresAt) {
    throw new Error('파일 편집 권한이 만료되었습니다. 파일을 다시 여십시오.');
  }
  const content = state.editor.state.doc.toString();
  state.projection = await client.writeFile({
    workspaceId: state.workspaceId || 'workspace_dev',
    path: state.filePath,
    content,
    fileLeaseId: state.fileLeaseId,
    idempotencyKey: idempotency('file_write')
  });
  state.originalContent = content;
  state.dirty = false;
  render();
}

async function revertFile() {
  if (!state.filePath) return;
  mountEditor(state.originalContent);
  state.dirty = false;
  renderDirtyState();
}

async function runSelection(resourceIntent) {
  if (!canExecute()) return;
  const runId = await ensureRun();
  const selection = selectedRange();
  state.projection = await client.enqueueCommand({
    runId,
    instruction: resourceIntent === 'test' ? '선택한 코드의 테스트 영향을 확인하십시오' : '선택한 코드 범위를 검토하고 수정안을 제안하십시오',
    resourceIntent,
    selection,
    idempotencyKey: idempotency('selection_cmd')
  });
  render();
}

function selectedRange() {
  const doc = state.editor.state.doc;
  const range = state.editor.state.selection.main;
  const fromLine = doc.lineAt(range.from);
  const toLine = doc.lineAt(range.to || range.from);
  const selected = doc.sliceString(range.from, range.to);
  const fallback = fromLine.text;
  return {
    path: state.filePath || 'unknown',
    fromLine: fromLine.number,
    toLine: toLine.number,
    text: selected.trim().length ? selected : fallback
  };
}

async function searchWorkspace() {
  const query = $('workspaceSearch').value.trim();
  if (query.length < 2 || !state.workspaceId) {
    $('searchResults').innerHTML = '';
    return;
  }
  const result = await client.searchWorkspace({ workspaceId: state.workspaceId, query });
  $('searchResults').innerHTML = result.results.map((item) =>
    '<button class="search-row" type="button" data-open-file="' + escapeAttr(item.path) + '" title="' + escapeAttr(item.path) + '">' +
    '<strong>' + escapeHtml(item.path) + '</strong><span class="muted">Line ' + item.line + '  ' + escapeHtml(item.preview) + '</span></button>'
  ).join('');
}

async function decideHunk(target) {
  if (!canExecute()) return;
  state.projection = await client.decideHunk({
    path: target.dataset.hunkPath,
    hunkId: target.dataset.hunkId,
    decision: target.dataset.hunkDecision,
    reason: 'Tablet Workbench hunk review',
    idempotencyKey: idempotency('hunk')
  });
  render();
}

async function toggleIde() {
  const editor = state.projection.editorSession;
  state.projection = await client.changeEditorSession({
    workspaceId: state.workspaceId || editor.workspaceId,
    action: editor.state === 'ready' ? 'revoke' : 'issue',
    idempotencyKey: idempotency('ide')
  });
  render();
}

function connectStream() {
  if (!state.projection || state.stream) return;
  const stream = client.openStream(state.projection.lastOffset);
  state.stream = stream;
  stream.addEventListener('core_event', () => {
    state.connection = 'connected';
    load().catch(reportError);
  });
  stream.onerror = () => {
    state.connection = 'reconnecting';
    renderGuard();
    stream.close();
    state.stream = undefined;
    window.setTimeout(() => load().catch(reportError), 1200);
  };
}

function bindEvents() {
  document.addEventListener('click', (event) => handleClick(event).catch(reportError));
  $('fileSearch').addEventListener('input', () => renderFiles(state.projection));
  $('workspaceSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchWorkspace().catch(reportError);
    }
  });
  $('workbenchPaletteInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchWorkspace().catch(reportError);
      $('workbenchPalette').hidden = true;
    }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveFile().catch(reportError);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSelection('test').catch(reportError);
    }
    if (event.key === 'Escape') $('workbenchPalette').hidden = true;
  });
  window.addEventListener('offline', () => {
    state.online = false;
    renderGuard();
  });
  window.addEventListener('online', () => {
    state.online = true;
    load().catch(reportError);
  });
}

async function handleClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.id === 'seedWorkbenchButton') await seedWorkspace();
  if (target.dataset.openFile) await openFile(target.dataset.openFile);
  if (target.id === 'saveFileButton') await saveFile();
  if (target.id === 'revertFileButton') await revertFile();
  if (target.id === 'askSelectionButton') await runSelection('light');
  if (target.id === 'testSelectionButton') await runSelection('test');
  if (target.id === 'paletteButton') openPalette();
  if (target.id === 'openIdeButton') await toggleIde();
  if (target.id === 'terminalToggle') $('terminalSheet').classList.toggle('is-collapsed');
  if (target.dataset.hunkDecision) await decideHunk(target);
  if (target.dataset.paletteAction) {
    $('workbenchPalette').hidden = true;
    if (target.dataset.paletteAction === 'save') await saveFile();
    if (target.dataset.paletteAction === 'ask') await runSelection('light');
    if (target.dataset.paletteAction === 'test') await runSelection('test');
    if (target.dataset.paletteAction === 'ide') await toggleIde();
  }
}

function openPalette() {
  $('workbenchPalette').hidden = false;
  $('workbenchPaletteInput').focus();
}

function reportError(error) {
  $('guardBanner').textContent = error instanceof Error ? error.message : '오류가 발생했습니다.';
  $('workbenchApp').dataset.connection = 'offline';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function escapeAttr(value) {
  return escapeHtml(value).replace(/\\s+/g, ' ');
}

boot().catch(reportError);
`;
}
