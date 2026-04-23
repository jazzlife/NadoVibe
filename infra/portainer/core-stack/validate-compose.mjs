#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

const composePath = resolve("infra/portainer/core-stack/docker-compose.yml");
const requireDockerCompose = process.argv.includes("--require-docker-compose");
const raw = readFileSync(composePath, "utf8");
const doc = YAML.parse(raw);

assertRecord(doc, "compose document");
assertRecord(doc.services, "services");
assertRecord(doc.volumes, "volumes");
assertRecord(doc.networks, "networks");

const requiredServices = ["postgres", "core-control-plane"];
for (const serviceName of requiredServices) {
  if (!(serviceName in doc.services)) {
    throw new Error(`Missing required service: ${serviceName}`);
  }
}

const volumeNames = new Set(Object.keys(doc.volumes));
const networkNames = new Set(Object.keys(doc.networks));
for (const [serviceName, service] of Object.entries(doc.services)) {
  assertRecord(service, `service ${serviceName}`);
  if (!service.networks) {
    throw new Error(`Service ${serviceName} must declare explicit networks`);
  }
  for (const networkName of asList(service.networks)) {
    if (!networkNames.has(networkName)) {
      throw new Error(`Service ${serviceName} references undefined network ${networkName}`);
    }
  }
  if (serviceName !== "nats" && !service.healthcheck) {
    throw new Error(`Service ${serviceName} must declare a healthcheck`);
  }
  for (const mount of asList(service.volumes)) {
    validateMount(serviceName, mount, volumeNames);
  }
}

const compose = findDockerCompose();
let dockerComposeConfig = "not_available";
if (compose) {
  const result = spawnSync(compose.command, [...compose.args, "-f", composePath, "config"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "docker compose config failed");
  }
  writeFileSync("/tmp/nadovibe-core-stack.config.yml", result.stdout);
  dockerComposeConfig = "validated";
} else if (requireDockerCompose) {
  throw new Error("Docker Compose CLI is required but neither `docker compose` nor `docker-compose` is available");
}

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      composePath,
      staticValidation: "passed",
      dockerComposeConfig,
      services: Object.keys(doc.services),
      volumes: Object.keys(doc.volumes),
      networks: Object.keys(doc.networks)
    },
    null,
    2
  ) + "\n"
);

function validateMount(serviceName, mount, volumeNames) {
  if (typeof mount !== "string") {
    throw new Error(`Service ${serviceName} uses unsupported non-string volume mount`);
  }
  const [source, target, mode] = mount.split(":");
  if (!source || !target) {
    throw new Error(`Service ${serviceName} has anonymous or target-only volume mount: ${mount}`);
  }
  const isBindMount = source.startsWith(".") || source.startsWith("/");
  if (isBindMount) {
    if (target !== "/app" || mode !== "ro") {
      throw new Error(`Service ${serviceName} bind mounts are only allowed for read-only app code: ${mount}`);
    }
    return;
  }
  if (!volumeNames.has(source)) {
    throw new Error(`Service ${serviceName} references undefined named volume ${source}`);
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
