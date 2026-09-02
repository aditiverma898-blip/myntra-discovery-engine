import path from "node:path";

import { normalizedEvidenceSchema } from "../../src/lib/schemas/pipeline";
import { writeTextAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines, serializeJsonLines } from "../io/jsonl";
import { deterministicClassifyRecords } from "../stages/deterministic-classifier";
import { readNamedArgument } from "./arguments";

function restrictedIntermediatePath(candidate: string): string {
  const absolute = path.resolve(candidate);
  const root = path.resolve(process.cwd());
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (!relative.startsWith("data/intermediate/") || !relative.endsWith(".jsonl")) throw new Error("Rule-classifier input/output must be JSONL under data/intermediate/.");
  return absolute;
}

async function main(): Promise<void> {
  const inputPath = restrictedIntermediatePath(readNamedArgument("--input"));
  const outputPath = restrictedIntermediatePath(readNamedArgument("--output"));
  const records = await readJsonLines(inputPath, normalizedEvidenceSchema);
  if (records.some((record) => record.synthetic)) throw new Error("The real rule-classifier command refuses synthetic records.");
  const classifications = deterministicClassifyRecords(records);
  await assertPathMissing(outputPath);
  await writeTextAtomically(outputPath, serializeJsonLines(classifications));
  const distribution = Object.fromEntries(["direct_wishlist", "journey_adjacent", "general", "irrelevant"].map((key) => [key, classifications.filter((item) => item.relevance === key).length]));
  console.log(JSON.stringify({ status: "candidate_only", externalCallsMade: false, input: records.length, output: classifications.length, distribution, humanReviewRequired: true, outputPath: path.relative(process.cwd(), outputPath) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
