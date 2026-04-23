#!/usr/bin/env node
import { accessSync, constants, mkdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const checkOnly = process.argv.includes("--check-only");
const root = resolve(process.env.NADOVIBE_VOLUME_ROOT ?? "/tmp/nadovibe-preflight");
const required = [
  "event-journal",
  "postgres",
  "objects",
  "repositories",
  "workspaces",
  "app-server-state",
  "audit",
  "backups"
];

const results = [];
for (const name of required) {
  const dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  accessSync(dir, constants.R_OK | constants.W_OK);
  const stat = statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`${dir} is not a directory`);
  }
  const marker = resolve(dir, ".nadovibe-preflight");
  writeFileSync(marker, `${new Date().toISOString()}\n`);
  accessSync(marker, constants.R_OK | constants.W_OK);
  if (checkOnly) {
    rmSync(marker, { force: true });
  }
  results.push({ name, dir, writable: true });
}

process.stdout.write(JSON.stringify({ ok: true, root, volumes: results }, null, 2) + "\n");
