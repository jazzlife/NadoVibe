#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderDurabilityReportMarkdown, runDurabilitySuite } from "../packages/core-durability/src/index.ts";

const report = runDurabilitySuite({
  simulatedDurationMs: 3 * 60 * 60 * 1000,
  environment: process.env.NADOVIBE_ENV_PROFILE ?? "local deterministic suite"
});
const artifactDir = resolve("reports/artifacts");
mkdirSync(artifactDir, { recursive: true });
writeFileSync(resolve(artifactDir, "durability-suite.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(resolve("reports/durability-report.md"), renderDurabilityReportMarkdown(report));

const failedTargets = report.verificationTargets.filter((target) => !target.passed);
process.stdout.write(JSON.stringify({
  ok: failedTargets.length === 0,
  generatedAt: report.generatedAt,
  scenarios: report.scenarioMatrix.length,
  verificationTargets: report.verificationTargets.length,
  failedTargets
}, null, 2) + "\n");

if (failedTargets.length > 0) {
  process.exitCode = 1;
}
