import { readFile } from "node:fs/promises";
import path from "node:path";

import { taxonomyDecisionSchema } from "../../src/lib/schemas/production-pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeTextAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { serializeJsonLines } from "../io/jsonl";
import type { TaxonomyCandidate } from "../review/taxonomy-workflow";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const input = validateRestrictedPath(process.cwd(), readNamedArgument("--candidates"), "data/intermediate/review/");
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const document = JSON.parse(await readFile(input, "utf8")) as { candidates?: TaxonomyCandidate[] };
  if (!Array.isArray(document.candidates)) throw new Error("Candidate taxonomy file has no candidates array.");
  const reviewedAt = readNamedArgument("--reviewed-at");
  const decisions = document.candidates.map((candidate) => taxonomyDecisionSchema.parse({ schemaVersion: "1.0.0", candidateThemeId: candidate.candidateThemeId, action: "accept", targetThemeIds: [candidate.candidateThemeId.replace(/^lexical-/u, "")], finalName: candidate.proposedName, reviewerType: "simulated", reviewerId: "simulated-taxonomy-workflow-v1", reviewedAt, rationale: "SIMULATED workflow-only acceptance; not an independent human taxonomy decision." }));
  await assertPathMissing(output);
  await writeTextAtomically(output, serializeJsonLines(decisions));
  console.log(JSON.stringify({ status: "simulated_workflow_only", releaseEligible: false, externalCallsMade: false, decisions: decisions.length, output: path.relative(process.cwd(), output) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
