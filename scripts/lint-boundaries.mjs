#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const forbiddenPaths = ["services/bridge", "apps/desktop", "packages/legacy-bridge"];
for (const forbidden of forbiddenPaths) {
  if (existsSync(resolve(forbidden))) {
    throw new Error(`Forbidden legacy boundary exists: ${forbidden}`);
  }
}

const sourceFiles = [
  "apps/gateway/src/server.ts",
  "apps/web/src/server.ts",
  "services/app-server-adapter/src/server.ts",
  "services/orchestrator/src/server.ts",
  "services/workspace-runtime/src/server.ts",
  "services/projection-worker/src/server.ts",
  "services/core-control-plane/src/server.ts"
];

for (const file of sourceFiles) {
  const text = readFileSync(resolve(file), "utf8");
  if (/legacy desktop|desktop bridge|services\/bridge/i.test(text)) {
    throw new Error(`Forbidden legacy wording found in ${file}`);
  }
}

const adapter = readFileSync(resolve("services/app-server-adapter/src/server.ts"), "utf8");
if (!adapter.includes("classifyAppServerMethod") || !adapter.includes("AppServerSchemaRegistry")) {
  throw new Error("app-server-adapter must use Core protocol policy and schema registry");
}

const gateway = readFileSync(resolve("apps/gateway/src/server.ts"), "utf8");
if (!gateway.includes("core.seedIdentity") || !gateway.includes("core.createRun")) {
  throw new Error("gateway mutations must pass through Core command API");
}

process.stdout.write(JSON.stringify({ ok: true, lint: "boundary checks passed" }) + "\n");
