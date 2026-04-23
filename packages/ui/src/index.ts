export const ideShellTokens = {
  color: {
    canvas: "#f7f8fa",
    panel: "#ffffff",
    text: "#17202a",
    muted: "#5f6b7a",
    accent: "#0f766e",
    warning: "#b45309",
    danger: "#b91c1c",
    border: "#d7dde5"
  },
  radius: {
    panel: "6px",
    control: "6px"
  },
  layout: {
    railWidth: "280px",
    inspectorWidth: "420px",
    toolbarHeight: "56px"
  }
} as const;

export function renderShellCss(): string {
  return `
    :root {
      --canvas: ${ideShellTokens.color.canvas};
      --panel: ${ideShellTokens.color.panel};
      --text: ${ideShellTokens.color.text};
      --muted: ${ideShellTokens.color.muted};
      --accent: ${ideShellTokens.color.accent};
      --border: ${ideShellTokens.color.border};
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--text); background: var(--canvas); }
    .shell { min-height: 100vh; display: grid; grid-template-columns: ${ideShellTokens.layout.railWidth} minmax(0, 1fr) ${ideShellTokens.layout.inspectorWidth}; }
    .pane { border-right: 1px solid var(--border); background: var(--panel); min-width: 0; }
    .toolbar { height: ${ideShellTokens.layout.toolbarHeight}; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid var(--border); }
    .content { padding: 16px; display: grid; gap: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
    .badge { border: 1px solid var(--border); border-radius: ${ideShellTokens.radius.control}; padding: 4px 8px; color: var(--muted); }
    button { min-height: 36px; border-radius: ${ideShellTokens.radius.control}; border: 1px solid var(--accent); background: var(--accent); color: white; padding: 0 12px; }
    @media (max-width: 1024px) { .shell { grid-template-columns: 72px minmax(0, 1fr); } .inspector { display: none; } }
    @media (max-width: 768px) { .shell { grid-template-columns: 1fr; } .rail { display: none; } }
  `;
}
