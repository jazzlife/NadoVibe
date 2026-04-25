import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CapacityAdmissionController,
  WorkspacePolicyError,
  assertNoAnonymousSandboxVolumes,
  blockDirectAppServerWorkspaceMethod,
  createArtifactMetadata,
  createCodeServerProcess,
  createSandboxContainerSpec,
  planRuntimeCommand,
  type WorkScope
} from "@nadovibe/core-kernel";

const scope: WorkScope = {
  tenantId: "tenant_runtime",
  userId: "user_runtime",
  workspaceId: "workspace_runtime",
  rootPath: "/workspace",
  writablePaths: ["/workspace/repository", "/workspace/src"]
};

test("sandbox provision requires matching active capacity reservation and creates isolated code-server metadata", () => {
  const capacity = new CapacityAdmissionController();
  const reservation = capacity.reserve({
    tenantId: "tenant_runtime",
    userId: "user_runtime",
    workspaceId: "workspace_runtime",
    runId: "run_runtime",
    commandId: "provision_workspace",
    resourceClass: "interactive",
    now: 1_000,
    ttlMs: 60_000
  }).reservation;
  const spec = createSandboxContainerSpec({
    tenantId: "tenant_runtime",
    userId: "user_runtime",
    workspaceId: "workspace_runtime",
    runId: "run_runtime",
    image: {
      image: "nadovibe/sandbox",
      version: "0.1.0",
      codeServerVersion: "4.96.4",
      extensionAllowlist: ["ms-python.python"],
      healthcheckCommand: ["curl", "-fsS", "http://127.0.0.1:8080/healthz"]
    },
    reservation,
    limits: { cpus: 2, memoryMb: 4096, pidsLimit: 512, diskMb: 20480, logMaxSize: "25m" }
  });
  assertNoAnonymousSandboxVolumes(spec);
  assert.equal(spec.codeServer.bindHost, "127.0.0.1");
  assert.equal(spec.labels["com.nadovibe.workspace"], "workspace_runtime");
  const process = createCodeServerProcess(spec);
  assert.equal(process.containerId, spec.name);
  assert.equal(process.state, "starting");
});

test("sandbox provision is blocked when reservation is missing", () => {
  assert.throws(
    () =>
      createSandboxContainerSpec({
        tenantId: "tenant_runtime",
        userId: "user_runtime",
        workspaceId: "workspace_runtime",
        runId: "run_runtime",
        image: {
          image: "nadovibe/sandbox",
          version: "0.1.0",
          codeServerVersion: "4.96.4",
          extensionAllowlist: [],
          healthcheckCommand: ["true"]
        },
        limits: { cpus: 1, memoryMb: 1024, pidsLimit: 128, diskMb: 1024, logMaxSize: "10m" }
      }),
    /CapacityReservation/
  );
});

test("heavy runtime command requires matching command-level CapacityReservation while light commands stay available", () => {
  const capacity = new CapacityAdmissionController();
  assert.throws(
    () =>
      planRuntimeCommand(
        {
          commandId: "cmd_test",
          tenantId: "tenant_runtime",
          userId: "user_runtime",
          workspaceId: "workspace_runtime",
          cwd: "/workspace/src",
          command: ["npm", "test"],
          env: {},
          resourceClass: "test",
          maxRuntimeMs: 60_000,
          outputLimitBytes: 1_000_000,
          workScope: scope
        },
        1_000
      ),
    /CapacityReservation/
  );
  const reservation = capacity.reserve({
    tenantId: "tenant_runtime",
    userId: "user_runtime",
    workspaceId: "workspace_runtime",
    runId: "run_runtime",
    commandId: "cmd_test",
    resourceClass: "test",
    now: 1_000,
    ttlMs: 60_000
  }).reservation;
  const plan = planRuntimeCommand(
    {
      commandId: "cmd_test",
      tenantId: "tenant_runtime",
      userId: "user_runtime",
      workspaceId: "workspace_runtime",
      cwd: "/workspace/src",
      command: ["npm", "test"],
      env: { NPM_TOKEN: "secret" },
      resourceClass: "test",
      maxRuntimeMs: 60_000,
      outputLimitBytes: 1_000_000,
      workScope: scope,
      capacityReservation: reservation
    },
    1_000
  );
  assert.equal(plan.redactedEnv.NPM_TOKEN, "[REDACTED]");
  const lightPlan = planRuntimeCommand(
    {
      commandId: "cmd_ls",
      tenantId: "tenant_runtime",
      userId: "user_runtime",
      workspaceId: "workspace_runtime",
      cwd: "/workspace/src",
      command: ["ls"],
      env: {},
      resourceClass: "light",
      maxRuntimeMs: 5_000,
      outputLimitBytes: 100_000,
      workScope: scope
    },
    1_000
  );
  assert.equal(lightPlan.resourceClass, "light");
});

test("app-server direct workspace side-effect methods are blocked at runtime boundary", () => {
  assert.throws(() => blockDirectAppServerWorkspaceMethod("thread/shellCommand"), WorkspacePolicyError);
  assert.throws(() => blockDirectAppServerWorkspaceMethod("command/exec"), WorkspacePolicyError);
  assert.throws(() => blockDirectAppServerWorkspaceMethod("fs/writeFile"), WorkspacePolicyError);
});

test("artifact metadata and sandbox Dockerfile are present without secret-bearing routes", () => {
  const artifact = createArtifactMetadata({
    tenantId: "tenant_runtime",
    workspaceId: "workspace_runtime",
    commandId: "cmd_test",
    contentType: "text/plain",
    sizeBytes: 10
  });
  assert.equal(artifact.uri.includes("token"), false);
  assert.equal(existsSync(resolve("infra/docker/sandbox.Dockerfile")), true);
});

test("workspace-runtime service exposes Docker sandbox lifecycle without raw browser routes", () => {
  const source = readFileSync(resolve("services/workspace-runtime/src/server.ts"), "utf8");
  const compose = readFileSync(resolve("infra/portainer/workspace-runtime-stack/docker-compose.yml"), "utf8");
  assert.match(source, /\/v1\/workspace\/provision/);
  assert.match(source, /\/v1\/workspace\/files\/read/);
  assert.match(source, /\/v1\/workspace\/files\/write/);
  assert.match(source, /issueFileLease/);
  assert.match(source, /WORKSPACE_RUNTIME_SINGLE_WORKSPACE_ROOT|WORKSPACE_RUNTIME_WORKSPACE_BASE_DIR/);
  assert.match(source, /ensureWorkspaceRoot/);
  assert.match(source, /existsSync\(base\)/);
  assert.match(source, /dockerRequest/);
  assert.match(source, /NanoCpus/);
  assert.match(source, /PidsLimit/);
  assert.match(compose, /WORKSPACE_RUNTIME_DOCKER_ENABLED/);
  assert.match(compose, /\/var\/run\/docker\.sock/);
  assert.doesNotMatch(source, /password|token/i);
});
