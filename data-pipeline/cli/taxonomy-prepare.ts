import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateRestrictedPath } from "../collection/validation";
import { writeJsonAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { createTaxonomyCandidates } from "../review/taxonomy-workflow";
import type { LexicalThemeCluster } from "../stages/theme-discovery";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const input = validateRestrictedPath(process.cwd(), readNamedArgument("--clusters"), "data/intermediate/runs/");
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/review/");
  const clusters = JSON.parse(await readFile(input, "utf8")) as LexicalThemeCluster[];
  const candidates = createTaxonomyCandidates(clusters);
  await assertPathMissing(output);
  await writeJsonAtomically(output, { schemaVersion: "1.0.0", taxonomyId: readNamedArgument("--taxonomy-id"), status: "candidate", humanReviewed: false, externalCallsMade: false, candidates });
  console.log(JSON.stringify({ status: "candidate", externalCallsMade: false, candidates: candidates.length, output: path.relative(process.cwd(), output) }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
