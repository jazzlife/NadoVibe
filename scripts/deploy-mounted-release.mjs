#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(String(args.source ?? "."));
const runtimeRoot = resolve(String(args["runtime-root"] ?? "/data/docker_data/nadovibe/runtime"));
const currentDir = resolve(String(args["current-dir"] ?? join(runtimeRoot, "current")));
const profile = String(args.profile ?? "production");
const deploymentAgentUrl = String(args["deployment-agent-url"] ?? "http://127.0.0.1:8098");
const serviceHost = String(args["service-host"] ?? "127.0.0.1");
const gitSha = String(args["git-sha"] ?? run("git", ["rev-parse", "--short=12", "HEAD"], sourceRoot).trim());
const changedPaths = args["changed-path"]
  ? values(args["changed-path"])
  : changedPathsSinceCurrentRelease(sourceRoot, runtimeRoot, gitSha);
const currentDeployment = await readCurrentDeployment(deploymentAgentUrl);
if (currentDeployment?.manifest?.gitSha === gitSha && currentDeployment.versionValidation?.ok === true && args.force !== true) {
  process.stdout.write(JSON.stringify({ ok: true, skipped: true, reason: "release already active", gitSha }, null, 2) + "\n");
  process.exit(0);
}

run("npm", ["run", "build"], sourceRoot, "inherit");

const prepareOutput = run(
  "node",
  [
    "scripts/prepare-mounted-release.mjs",
    "--source",
    sourceRoot,
    "--runtime-root",
    runtimeRoot,
    "--profile",
    profile,
    "--git-sha",
    gitSha,
    "--install-runtime-deps"
  ],
  sourceRoot
);
const prepared = JSON.parse(prepareOutput);
const releaseId = String(prepared.releaseId);

let plannedChangedPaths = changedPaths;
let planResponse = await postJson(`${deploymentAgentUrl}/v1/deployments/plan`, { releaseId, changedPaths: plannedChangedPaths });
if (planHasOnlyNoImpactedServices(planResponse.plan)) {
  plannedChangedPaths = [];
  planResponse = await postJson(`${deploymentAgentUrl}/v1/deployments/plan`, { releaseId, changedPaths: plannedChangedPaths });
}
if (!planResponse.plan?.allowed) {
  throw new Error(`deployment plan blocked: ${JSON.stringify(planResponse.plan?.issues ?? [])}`);
}

const manifest = JSON.parse(readFileSync(join(String(prepared.releaseDir), "nadovibe.release.json"), "utf8"));
syncReleaseToCurrent(String(prepared.releaseDir), currentDir);
const restarted = await restartPlannedServices(planResponse.plan, manifest);

if (planResponse.plan.restartGroups?.some((group) => group.services?.includes("deployment-agent"))) {
  await waitForHttp(`${deploymentAgentUrl}/healthz`);
}

const current = await getJson(`${deploymentAgentUrl}/v1/deployments/current`);
if (current.manifest?.gitSha !== gitSha) {
  throw new Error(`deployed gitSha mismatch: expected ${gitSha}, got ${current.manifest?.gitSha}`);
}
if (current.versionValidation?.ok !== true) {
  throw new Error(`version validation failed: ${JSON.stringify(current.versionValidation?.issues ?? [])}`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  releaseId,
  gitSha,
  changedPaths: plannedChangedPaths,
  restarted,
  versionValidation: current.versionValidation
}, null, 2) + "\n");

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = rawArgs[index + 1];
    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    if (parsed[key] === undefined) {
      parsed[key] = next;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(next);
    } else {
      parsed[key] = [parsed[key], next];
    }
    index += 1;
  }
  return parsed;
}

function values(value) {
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function changedPathsSinceCurrentRelease(cwd, releaseRoot, headSha) {
  const manifestPath = join(releaseRoot, "current", "nadovibe.release.json");
  if (!existsSync(manifestPath)) {
    return [];
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const currentSha = String(manifest.gitSha ?? "");
  if (!currentSha || currentSha === headSha) return [];
  return run("git", ["diff", "--name-only", currentSha, headSha], cwd).trim().split("\n").filter(Boolean);
}

function planHasOnlyNoImpactedServices(plan) {
  return plan?.allowed !== true &&
    Array.isArray(plan?.issues) &&
    plan.issues.length === 1 &&
    plan.issues[0]?.code === "no_impacted_services";
}

async function readCurrentDeployment(baseUrl) {
  try {
    return await getJson(`${baseUrl}/v1/deployments/current`);
  } catch {
    return undefined;
  }
}

function syncReleaseToCurrent(releaseDir, targetDir) {
  run("mkdir", ["-p", targetDir], sourceRoot);
  run("rsync", ["-a", "--delete", `${releaseDir}/`, `${targetDir}/`], sourceRoot, "inherit");
}

async function restartPlannedServices(plan, manifest) {
  const restarted = [];
  for (const group of plan.restartGroups ?? []) {
    for (const service of group.services ?? []) {
      restartComposeService(service);
      restarted.push(service);
    }
    for (const service of group.services ?? []) {
      const spec = manifest.services.find((candidate) => candidate.service === service);
      if (spec) {
        await waitForHttp(`http://${serviceHost}:${spec.port}${spec.healthPath}`);
      }
    }
  }
  return restarted;
}

function restartComposeService(service) {
  const containers = run("docker", ["ps", "-q", "--filter", `label=com.docker.compose.service=${service}`], sourceRoot).trim().split("\n").filter(Boolean);
  if (containers.length === 0) {
    throw new Error(`${service} container was not found`);
  }
  run("docker", ["restart", ...containers], sourceRoot, "inherit");
}

async function waitForHttp(url) {
  const deadline = Date.now() + 60_000;
  let lastError = "not_checked";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request_failed";
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
  throw new Error(`${url} did not become healthy: ${lastError}`);
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${url} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${url} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function run(command, commandArgs, cwd, stdio = "pipe") {
  return execFileSync(command, commandArgs, { cwd, encoding: "utf8", stdio });
}
