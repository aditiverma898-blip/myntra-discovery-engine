import path from "node:path";

import { evidenceClassificationSchema, normalizedEvidenceSchema } from "../../src/lib/schemas/pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeTextAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { createReviewSample } from "../review/evaluation-workflow";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const records = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--canonical"), "data/intermediate/runs/"), normalizedEvidenceSchema);
  const classifications = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--classifications"), "data/intermediate/"), evidenceClassificationSchema);
  const reviewId = readNamedArgument("--review-id");
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const sampleSize = Number.parseInt(readNamedArgument("--sample-size"), 10);
  if (!Number.isInteger(sampleSize) || sampleSize <= 0) throw new Error("--sample-size must be a positive integer.");
  const sample = createReviewSample({ reviewId, records, classifications, sampleSize });
  await assertPathMissing(output);
  await writeTextAtomically(output, serializeJsonLines(sample));
  console.log(JSON.stringify({ status: "candidate_review_sample", externalCallsMade: false, reviewId, requested: sampleSize, sampled: sample.length, output: path.relative(process.cwd(), output), distribution: Object.fromEntries(["direct_wishlist", "journey_adjacent", "general", "irrelevant"].map((key) => [key, sample.filter((item) => item.predictedRelevance === key).length])) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
