import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import YAML from "yaml";
import { CoreControlPlane, type CoreCommandContext } from "@nadovibe/core-kernel";
import { parseCreateRunRequest, parseDevIdentitySeedRequest } from "@nadovibe/api-contract";

const context: CoreCommandContext = {
  tenantId: "tenant_dev",
  userId: "user_dev",
  requestId: "req_phase_01",
  correlationId: "corr_phase_01",
  sourceService: "gateway",
  actor: { type: "user", id: "user_dev" }
};

test("Gateway seed flow is a Core command and replays from durable events", () => {
  const core = new CoreControlPlane();
  const seed = core.seedIdentity(
    {
      idempotencyKey: "seed:test",
      tenantId: "tenant_dev",
      userId: "user_dev",
      workspaceId: "workspace_dev",
      repositoryId: "repo_dev",
      membershipRole: "owner"
    },
    context
  );
  assert.equal(seed.createdThrough, "core-command-api");
  const restored = new CoreControlPlane();
  restored.replay(core.events.readAll());
  assert.equal(restored.getIdentitySeed("tenant_dev", "user_dev", "workspace_dev")?.repositoryId, "repo_dev");
});

test("API contract rejects malformed public mutation payloads", () => {
  assert.deepEqual(parseDevIdentitySeedRequest({ tenantId: "t", userId: "u", workspaceId: "w", repositoryId: "r" }), {
    tenantId: "t",
    userId: "u",
    workspaceId: "w",
    repositoryId: "r"
  });
  assert.throws(() => parseCreateRunRequest({ runId: "r", workspaceId: "w" }), /idempotencyKey/);
});

test("monorepo includes phase 1 app, service, package, infra, and docs boundaries", () => {
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { workspaces: string[] };
  assert.equal(packageJson.workspaces.includes("apps/*"), true);
  for (const path of [
    "apps/gateway/src/server.ts",
    "apps/web/src/server.ts",
    "services/app-server-adapter/src/server.ts",
    "services/orchestrator/src/server.ts",
    "services/workspace-runtime/src/server.ts",
    "services/projection-worker/src/server.ts",
    "packages/domain/src/index.ts",
    "packages/api-contract/src/index.ts",
    "packages/ui/src/index.ts",
    "infra/local/docker-compose.yml",
    "docs/architecture.md",
    "docs/local-development.md"
  ]) {
    assert.equal(existsSync(resolve(path)), true, `${path} should exist`);
  }
  assert.equal(existsSync(resolve("services/bridge")), false);
});

test("Portainer stacks use explicit services, healthchecks, named volumes, and named networks", () => {
  const stacks = [
    "infra/portainer/core-stack/docker-compose.yml",
    "infra/portainer/app-server-adapter-stack/docker-compose.yml",
    "infra/portainer/workspace-runtime-stack/docker-compose.yml",
    "infra/portainer/gateway-projection-stack/docker-compose.yml",
    "infra/portainer/clients-stack/docker-compose.yml",
    "infra/portainer/ops-observability-stack/docker-compose.yml"
  ];
  for (const stack of stacks) {
    const doc = YAML.parse(readFileSync(resolve(stack), "utf8")) as {
      services: Record<string, { healthcheck?: unknown; volumes?: string[]; networks?: string[] }>;
      volumes?: Record<string, unknown>;
      networks: Record<string, unknown>;
    };
    assert.ok(doc.services);
    assert.ok(doc.networks);
    const volumes = new Set(Object.keys(doc.volumes ?? {}));
    for (const [serviceName, service] of Object.entries(doc.services)) {
      assert.ok(service.healthcheck, `${stack}:${serviceName} must define healthcheck`);
      assert.ok(service.networks && service.networks.length > 0, `${stack}:${serviceName} must define network`);
      for (const mount of service.volumes ?? []) {
        const [source, target] = mount.split(":");
        assert.ok(source);
        if (serviceName === "workspace-runtime" && source === "/var/run/docker.sock" && target === "/var/run/docker.sock") {
          continue;
        }
        assert.equal(source.startsWith(".") || source.startsWith("/"), false, `${stack}:${serviceName} must not use Portainer bind mount`);
        assert.equal(volumes.has(source), true, `${stack}:${serviceName} volume ${source} must be declared`);
      }
    }
  }
});
