import assert from "node:assert/strict";
import test from "node:test";
import {
  DURABILITY_SCENARIOS,
  THREE_HOUR_SYNTHETIC_DURATION_MS,
  generateMultiTenantHeavyWorkload,
  generateSyntheticMultiAgentRun,
  renderDurabilityReportMarkdown,
  runDurabilitySuite,
  validateCoreSafetyPolicies,
  validateReplayConsistency
} from "@nadovibe/core-durability";

test("phase 10 synthetic 3 hour multi-agent run replays with zero data loss", () => {
  const synthetic = generateSyntheticMultiAgentRun();
  assert.equal(synthetic.simulatedDurationMs, THREE_HOUR_SYNTHETIC_DURATION_MS);
  assert.equal(synthetic.metrics.dataLossCount, 0);
  assert.ok(synthetic.events.length > 20);
  const replayTargets = validateReplayConsistency(synthetic.events);
  assert.equal(replayTargets.every((target) => target.passed), true);
  assert.ok(synthetic.expectedEventSequence.includes("SupervisorDecisionRecorded"));
  assert.ok(synthetic.expectedEventSequence.includes("RunStateChanged:completed"));
});

test("phase 10 multi-tenant heavy workload preserves fair scheduling and capacity semantics", () => {
  const workload = generateMultiTenantHeavyWorkload();
  assert.equal(workload.waitingForCapacityCount, 1);
  assert.equal(workload.failedMisclassifiedCount, 0);
  assert.equal(workload.fairQueueStarvationCount, 0);
  assert.equal(workload.heavyDispatchWithoutReservationCount, 0);
  assert.deepEqual(workload.dequeuedTenantOrder.slice(0, 3).sort(), ["tenant_a", "tenant_b", "tenant_c"]);
});

test("phase 10 core safety policies block unsafe completion, app-server bypass, and shared code-server sessions", () => {
  const targets = validateCoreSafetyPolicies();
  assert.equal(targets.every((target) => target.passed), true);
  assert.ok(targets.some((target) => target.name.includes("final verifier gate")));
  assert.ok(targets.some((target) => target.name.includes("thread/shellCommand")));
  assert.ok(targets.some((target) => target.name.includes("code-server")));
});

test("phase 10 durability suite covers the required scenario matrix and report sections", () => {
  const report = runDurabilitySuite({ generatedAt: new Date("2026-04-23T00:00:00.000Z") });
  assert.equal(report.scenarioMatrix.length, DURABILITY_SCENARIOS.length);
  assert.equal(report.scenarioMatrix.every((scenario) => scenario.status === "passed"), true);
  assert.equal(report.verificationTargets.every((target) => target.passed), true);
  assert.equal(report.metrics.dataLossCount, 0);
  const markdown = renderDurabilityReportMarkdown(report);
  for (const section of [
    "## Test Environment",
    "## Scenario Matrix",
    "## Injected Failures",
    "## Observed Event Sequence",
    "## Metrics Summary",
    "## UI Validation Artifacts",
    "## Failures Found And Fixed",
    "## Remaining Risks"
  ]) {
    assert.match(markdown, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
