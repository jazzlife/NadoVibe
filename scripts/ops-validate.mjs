#!/usr/bin/env node
import {
  checkAppServerCompatibility,
  createHostCapacitySampleFromOs,
  evaluateDockerHostPreflight,
  getQuotaProfile,
  validateComposeEnvironment,
  validatePortainerStackOrder,
  validateQuotaProfile
} from "../packages/core-operations/src/index.ts";

const profile = process.env.NADOVIBE_ENV_PROFILE === "production" || process.env.NADOVIBE_ENV_PROFILE === "staging"
  ? process.env.NADOVIBE_ENV_PROFILE
  : "local";

const stackOrder = validatePortainerStackOrder();
const quota = validateQuotaProfile(getQuotaProfile(profile));
const compose = validateComposeEnvironment(profile, process.env);
const preflight = evaluateDockerHostPreflight(createHostCapacitySampleFromOs(), profile);
const appServer = checkAppServerCompatibility({
  protocolVersion: process.env.APP_SERVER_PROTOCOL_VERSION ?? "official-docs-2026-04-23",
  platformVersion: process.env.NADOVIBE_BUILD_VERSION ?? "0.1.0"
});

const issues = [
  ...stackOrder.issues,
  ...quota.issues,
  ...compose.issues,
  ...preflight.checks.filter((check) => !check.ok).map((check) => ({
    severity: "error",
    code: `host_${check.name}`,
    message: check.message
  })),
  ...appServer.blockingReasons.map((message) => ({ severity: "error", code: "app_server_compatibility", message }))
];

const ok = issues.every((issue) => issue.severity !== "error");
const payload = {
  ok,
  profile,
  stackOrder,
  quota,
  compose,
  preflight,
  appServer,
  issues
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
if (!ok) {
  process.exitCode = 1;
}
