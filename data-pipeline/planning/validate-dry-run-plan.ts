import type { CollectionBatch } from "../../src/lib/schemas/collection";

interface CandidatePlan {
  batchId?: unknown;
  approvalId?: unknown;
  approvalStatus?: unknown;
  credentialsPresent?: unknown;
  blockedReasons?: unknown;
  externalExecutionPerformed?: unknown;
  limits?: unknown;
}

export function validateDestinationDryRunPlan(plan: CandidatePlan, batch: CollectionBatch): void {
  const errors: string[] = [];
  if (plan.batchId !== batch.batchId) errors.push("batchId does not match the execution pack");
  if (plan.approvalId !== batch.approvalId) errors.push("approvalId does not match the execution pack");
  if (plan.approvalStatus !== "approved") errors.push("source approval is not active");
  if (plan.credentialsPresent !== true) errors.push("the destination YouTube credential was not detected");
  if (plan.externalExecutionPerformed !== false) errors.push("the dry-run unexpectedly reports external execution");
  if (JSON.stringify(plan.limits) !== JSON.stringify(batch.limits)) errors.push("limits do not exactly match the reviewed batch");
  if (JSON.stringify(plan.blockedReasons) !== JSON.stringify(["External calls are disabled."])) errors.push("blockedReasons must contain only the expected external-call guard");
  if (errors.length) throw new Error(`Dry-run gate failed: ${errors.join("; ")}.`);
}
