import path from "node:path";

import { evidenceClassificationSchema } from "../../src/lib/schemas/pipeline";
import { reviewDecisionSchema } from "../../src/lib/schemas/production-pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeTextAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { applyReviewDecisions } from "../review/adjudication";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const classifications = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--classifications"), "data/intermediate/"), evidenceClassificationSchema);
  const decisions = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--decisions"), "data/intermediate/review/"), reviewDecisionSchema);
  if (decisions.some((decision) => decision.reviewerType !== "human")) throw new Error("Production adjudication refuses simulated decisions.");
  const known = new Set(classifications.map((item) => item.evidenceId));
  const unknown = decisions.filter((decision) => !known.has(decision.evidenceId));
  if (unknown.length) throw new Error(`Review decisions contain ${unknown.length} unknown evidence IDs.`);
  const requireComplete = process.argv.includes("--require-complete");
  if (requireComplete && new Set(decisions.map((item) => item.evidenceId)).size !== classifications.length) throw new Error("Complete adjudication requires exactly one human decision for every classification.");
  const reviewed = applyReviewDecisions(classifications, decisions);
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  await assertPathMissing(output);
  await writeTextAtomically(output, serializeJsonLines(reviewed));
  console.log(JSON.stringify({ status: "human_adjudicated", externalCallsMade: false, input: classifications.length, decisions: decisions.length, reviewed: reviewed.filter((item) => item.humanReviewStatus !== "unreviewed").length, unreviewed: reviewed.filter((item) => item.humanReviewStatus === "unreviewed").length, output: path.relative(process.cwd(), output) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
