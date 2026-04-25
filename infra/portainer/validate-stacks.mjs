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
  const result = validateComposeFile(file, {
    allowBindMounts: !isPortainer,
    requireExternalCoreNetwork: isPortainer && !file.includes("/core-stack/"),
    requireBindBackedNamedVolumes: isPortainer
  });
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
  if (options.requireBindBackedNamedVolumes) {
    for (const [volumeName, volume] of Object.entries(volumes)) {
      validateNamedVolume(file, volumeName, volume);
    }
  }
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

function validateNamedVolume(file, volumeName, volume) {
  assertRecord(volume, `${file} volume ${volumeName}`);
  if (volume.external === true) {
    return;
  }
  if (volume.driver !== "local") {
    throw new Error(`${file} volume ${volumeName} must use the local driver`);
  }
  assertRecord(volume.driver_opts, `${file} volume ${volumeName} driver_opts`);
  if (volume.driver_opts.type !== "none" || volume.driver_opts.o !== "bind") {
    throw new Error(`${file} volume ${volumeName} must be backed by a host bind directory`);
  }
  const device = volume.driver_opts.device;
  if (typeof device !== "string" || !device.startsWith("${NADOVIBE_DATA_ROOT:-/data/docker_data/nadovibe}/")) {
    throw new Error(`${file} volume ${volumeName} must live under \${NADOVIBE_DATA_ROOT:-/data/docker_data/nadovibe}`);
  }
}

function validateMount(file, serviceName, mount, volumeNames, allowBindMounts) {
  if (typeof mount !== "string") {
    throw new Error(`${file} service ${serviceName} uses unsupported non-string volume mount`);
  }
  const { source, target, mode } = parseMountString(mount);
  if (!source || !target) {
    throw new Error(`${file} service ${serviceName} has anonymous or target-only mount: ${mount}`);
  }
  const effectiveSource = envDefaultSource(source);
  const isBindMount = effectiveSource.startsWith(".") || effectiveSource.startsWith("/");
  if (isBindMount) {
    if (target === "/app" && mode === "ro" && source.includes("NADOVIBE_RUNTIME_CURRENT")) {
      return;
    }
    if (serviceName === "deployment-agent" && (target === "/srv/nadovibe/runtime" || target === "/data/docker_data/nadovibe/runtime") && mode === "rw" && source.includes("NADOVIBE_RUNTIME_ROOT")) {
      return;
    }
    if (serviceName === "workspace-runtime" && source === "/var/run/docker.sock" && target === "/var/run/docker.sock") {
      return;
    }
    if (serviceName === "deployment-agent" && source === "/var/run/docker.sock" && target === "/var/run/docker.sock") {
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

function parseMountString(mount) {
  const modeMatch = mount.match(/:(ro|rw)$/);
  const mode = modeMatch ? modeMatch[1] : undefined;
  const withoutMode = mode ? mount.slice(0, -(mode.length + 1)) : mount;
  const separatorIndex = withoutMode.lastIndexOf(":");
  if (separatorIndex <= 0) {
    return { source: "", target: "", mode: undefined };
  }
  return { source: withoutMode.slice(0, separatorIndex), target: withoutMode.slice(separatorIndex + 1), mode };
}

function envDefaultSource(source) {
  const match = source.match(/^\$\{[^:}]+:-([^}]+)\}$/);
  return match ? match[1] : source;
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
