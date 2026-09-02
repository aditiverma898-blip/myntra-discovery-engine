import { readFile } from "node:fs/promises";
import path from "node:path";

import { taxonomyDecisionSchema } from "../../src/lib/schemas/production-pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeJsonAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines } from "../io/jsonl";
import { applyTaxonomyDecisions, type TaxonomyCandidate } from "../review/taxonomy-workflow";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const candidatePath = validateRestrictedPath(process.cwd(), readNamedArgument("--candidates"), "data/intermediate/review/");
  const decisionPath = validateRestrictedPath(process.cwd(), readNamedArgument("--decisions"), "data/intermediate/review/");
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const document = JSON.parse(await readFile(candidatePath, "utf8")) as { candidates?: TaxonomyCandidate[] };
  if (!Array.isArray(document.candidates)) throw new Error("Candidate taxonomy file has no candidates array.");
  const decisions = await readJsonLines(decisionPath, taxonomyDecisionSchema);
  if (decisions.some((decision) => decision.reviewerType !== "human")) throw new Error("Production taxonomy application refuses simulated decisions.");
  const candidateIds = new Set(document.candidates.map((candidate) => candidate.candidateThemeId));
  const decisionIds = new Set(decisions.map((decision) => decision.candidateThemeId));
  if (decisionIds.size !== decisions.length || decisionIds.size !== candidateIds.size || [...decisionIds].some((id) => !candidateIds.has(id))) throw new Error("Reviewed taxonomy requires exactly one human decision for every known candidate and no unknown IDs.");
  const reviewed = applyTaxonomyDecisions(document.candidates, decisions);
  await assertPathMissing(output);
  await writeJsonAtomically(output, { schemaVersion: "1.0.0", taxonomyId: readNamedArgument("--taxonomy-id"), status: "reviewed", humanReviewed: true, externalCallsMade: false, themes: reviewed });
  console.log(JSON.stringify({ status: "reviewed", externalCallsMade: false, themes: reviewed.length, output: path.relative(process.cwd(), output) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
