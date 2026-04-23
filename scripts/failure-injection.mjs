#!/usr/bin/env node
const scenarios = [
  { id: "app-server-adapter-restart", command: "docker compose restart app-server-adapter", expected: "app_server.reattached and run remains active" },
  { id: "orchestrator-restart", command: "docker compose restart orchestrator", expected: "leases and command journal replay" },
  { id: "workspace-runtime-restart", command: "docker compose restart workspace-runtime", expected: "runtime recovering event, not run failed" },
  { id: "code-server-kill", command: "docker kill <sandbox-code-server-container>", expected: "editor session recovering or revoked/reissued" },
  { id: "projection-rebuild", command: "docker compose restart projection-worker", expected: "projection lag returns to zero after replay" },
  { id: "gateway-restart", command: "docker compose restart gateway", expected: "PWA reconnect restores last offset and next action" },
  { id: "database-interruption", command: "docker compose pause postgres && docker compose unpause postgres", expected: "Core replay has data loss 0" }
];

process.stdout.write(JSON.stringify({ ok: true, mode: "dry-run", scenarios }, null, 2) + "\n");
