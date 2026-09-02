import path from "node:path";

import { evidenceClassificationSchema, normalizedEvidenceSchema, rawEvidenceSchema } from "../../src/lib/schemas/pipeline";
import { validateRestrictedPath } from "../collection/validation";
import { writeJsonAtomically } from "../io/atomic";
import { assertPathMissing } from "../io/immutable";
import { readJsonLines } from "../io/jsonl";
import { buildCorpusAudit } from "../quality/corpus-audit";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const raw = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--raw"), "data/raw/combined/"), rawEvidenceSchema);
  const canonical = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--canonical"), "data/intermediate/runs/"), normalizedEvidenceSchema);
  const classifications = await readJsonLines(validateRestrictedPath(process.cwd(), readNamedArgument("--classifications"), "data/intermediate/runs/"), evidenceClassificationSchema);
  const output = validateRestrictedPath(process.cwd(), readNamedArgument("--output"), "data/intermediate/audits/");
  const audit = buildCorpusAudit({ datasetVersion: readNamedArgument("--dataset-version"), generatedAt: readNamedArgument("--generated-at"), raw, canonical, classifications });
  await assertPathMissing(output);
  await writeJsonAtomically(output, audit);
  console.log(JSON.stringify({ status: "completed", externalCallsMade: false, output: path.relative(process.cwd(), output), totals: audit.totals, warnings: audit.warnings }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
