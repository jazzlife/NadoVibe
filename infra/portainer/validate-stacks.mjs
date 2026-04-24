#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

const portainerRoot = resolve("infra/portainer");
const localCompose = resolve("infra/local/docker-compose.yml");
const requireDockerCompose = process.argv.includes("--require-docker-compose");

const stackFiles = readdirSync(portainerRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith("-stack"))
  .map((entry) => resolve(portainerRoot, entry.name, "docker-compose.yml"))
  .sort();

const requiredStacks = new Set([
  "app-server-adapter-stack",
  "clients-stack",
  "core-stack",
  "gateway-projection-stack",
  "ops-observability-stack",
  "workspace-runtime-stack"
]);
for (const stackName of requiredStacks) {
  if (!stackFiles.some((file) => file.includes(`/${stackName}/`))) {
    throw new Error(`Missing Portainer stack: ${stackName}`);
  }
}

const results = [];
for (const file of [...stackFiles, localCompose]) {
  const isPortainer = file.includes("/infra/portainer/");
  const result = validateComposeFile(file, { allowBindMounts: !isPortainer, requireExternalCoreNetwork: isPortainer && !file.includes("/core-stack/") });
  results.push(result);
}

const compose = findDockerCompose();
let dockerComposeConfig = "not_available";
if (compose) {
  for (const file of [stackFiles.find((entry) => entry.includes("/core-stack/")) ?? stackFiles[0], localCompose]) {
    if (!file) continue;
    const result = spawnSync(compose.command, [...compose.args, "-f", file, "config"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `docker compose config failed for ${file}`);
    }
  }
  writeFileSync("/tmp/nadovibe-compose-validation.json", JSON.stringify(results, null, 2));
  dockerComposeConfig = "validated";
} else if (requireDockerCompose) {
  throw new Error("Docker Compose CLI is required but neither `docker compose` nor `docker-compose` is available");
}

process.stdout.write(JSON.stringify({ ok: true, dockerComposeConfig, stacks: results }, null, 2) + "\n");

function validateComposeFile(file, options) {
  const doc = YAML.parse(readFileSync(file, "utf8"));
  assertRecord(doc, `${file} document`);
  assertRecord(doc.services, `${file} services`);
  assertRecord(doc.networks, `${file} networks`);
  const volumes = doc.volumes === undefined ? {} : doc.volumes;
  assertRecord(volumes, `${file} volumes`);
  const volumeNames = new Set(Object.keys(volumes));
  const networkNames = new Set(Object.keys(doc.networks));
  for (const [serviceName, service] of Object.entries(doc.services)) {
    assertRecord(service, `${file} service ${serviceName}`);
    if (!service.healthcheck) {
      throw new Error(`${file} service ${serviceName} must declare healthcheck`);
    }
    for (const networkName of asList(service.networks)) {
      if (!networkNames.has(networkName)) {
        throw new Error(`${file} service ${serviceName} references undefined network ${networkName}`);
      }
    }
    for (const mount of asList(service.volumes)) {
      validateMount(file, serviceName, mount, volumeNames, options.allowBindMounts);
    }
  }
  if (options.requireExternalCoreNetwork) {
    const coreNet = doc.networks.nadovibe_core_net;
    assertRecord(coreNet, `${file} nadovibe_core_net`);
    if (coreNet.external !== true) {
      throw new Error(`${file} must attach to external nadovibe_core_net`);
    }
  }
  return {
    file,
    services: Object.keys(doc.services),
    volumes: Object.keys(volumes),
    networks: Object.keys(doc.networks)
  };
}

function validateMount(file, serviceName, mount, volumeNames, allowBindMounts) {
  if (typeof mount !== "string") {
    throw new Error(`${file} service ${serviceName} uses unsupported non-string volume mount`);
  }
  const [source, target, mode] = mount.split(":");
  if (!source || !target) {
    throw new Error(`${file} service ${serviceName} has anonymous or target-only mount: ${mount}`);
  }
  const isBindMount = source.startsWith(".") || source.startsWith("/");
  if (isBindMount) {
    if (serviceName === "workspace-runtime" && source === "/var/run/docker.sock" && target === "/var/run/docker.sock") {
      return;
    }
    if (serviceName === "workspace-runtime" && file.includes("/infra/local/") && target === "/workspace" && mode === "rw") {
      return;
    }
    if (!allowBindMounts) {
      throw new Error(`${file} service ${serviceName} uses bind mount in Portainer stack: ${mount}`);
    }
    if (mode !== "ro") {
      throw new Error(`${file} service ${serviceName} bind mount must be read-only: ${mount}`);
    }
    return;
  }
  if (!volumeNames.has(source)) {
    throw new Error(`${file} service ${serviceName} references undefined named volume ${source}`);
  }
}

function findDockerCompose() {
  const dockerCompose = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
  if (dockerCompose.status === 0) {
    return { command: "docker", args: ["compose"] };
  }
  const legacy = spawnSync("docker-compose", ["version"], { encoding: "utf8" });
  if (legacy.status === 0) {
    return { command: "docker-compose", args: [] };
  }
  return undefined;
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function asList(value) {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value);
  }
  return [value];
}
