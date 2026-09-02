import path from "node:path";

import { reviewDecisionSchema, reviewSampleItemSchema } from "../../src/lib/schemas/production-pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeJsonAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines } from "../io/jsonl";
import { evaluateReview } from "../review/evaluation-workflow";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const sample = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--sample"), "data/intermediate/review/"), reviewSampleItemSchema);
  const decisions = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--decisions"), "data/intermediate/review/"), reviewDecisionSchema);
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const report = evaluateReview({ evaluationId: readNamedArgument("--evaluation-id"), datasetVersion: readNamedArgument("--dataset-version"), generatedAt: readNamedArgument("--generated-at"), sample, rawDecisions: decisions });
  await assertPathMissing(output);
  await writeJsonAtomically(output, report);
  console.log(JSON.stringify({ status: "evaluated", externalCallsMade: false, output: path.relative(process.cwd(), output), reviewKind: report.reviewKind, releaseEligible: report.releaseEligible, thresholdPass: report.thresholdPass, metrics: report.metrics }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
