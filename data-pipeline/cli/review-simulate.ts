import path from "node:path";

import { reviewSampleItemSchema } from "../../src/lib/schemas/production-pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeTextAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { createSimulatedReviewDecisions } from "../review/evaluation-workflow";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const sample = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--sample"), "data/intermediate/review/"), reviewSampleItemSchema);
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const decisions = createSimulatedReviewDecisions(sample, readNamedArgument("--reviewed-at"));
  await assertPathMissing(output);
  await writeTextAtomically(output, serializeJsonLines(decisions));
  console.log(JSON.stringify({ status: "simulated_workflow_only", releaseEligible: false, externalCallsMade: false, decisions: decisions.length, output: path.relative(process.cwd(), output), warning: "These decisions copy candidate labels and are not independent human validation." }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
