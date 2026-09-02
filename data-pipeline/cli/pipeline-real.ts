import path from "node:path";

import { evidenceClassificationSchema, rawEvidenceSchema } from "../../src/lib/schemas/pipeline";
import { readJsonLines } from "../io/jsonl";
import { runOfflinePipeline } from "../orchestration/offline-pipeline";
import { readNamedArgument } from "./arguments";

function optionalNamedArgument(name: string, argv = process.argv.slice(2)): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const rawPath = path.resolve(readNamedArgument("--input"));
  const rawRecords = await readJsonLines(rawPath, rawEvidenceSchema);
  if (rawRecords.some((record) => record.synthetic)) throw new Error("The real pipeline refuses synthetic raw records.");
  const classificationPath = optionalNamedArgument("--classifications");
  const classifications = classificationPath ? await readJsonLines(path.resolve(classificationPath), evidenceClassificationSchema) : undefined;
  const prepareOnly = process.argv.includes("--prepare-only");
  if (!prepareOnly && !classifications) throw new Error("Completion requires --classifications; use --prepare-only to generate canonical evidence first.");
  const result = await runOfflinePipeline({
    runId: readNamedArgument("--run-id"),
    datasetVersion: readNamedArgument("--dataset-version"),
    workspaceRoot: path.resolve("data/intermediate/runs"),
    rawRecords,
    mode: "real",
    classifications,
    allowUnreviewedForPartial: process.argv.includes("--allow-unreviewed-partial"),
    stopAfterStage: prepareOnly ? "deduplicate" : undefined,
    retention: {
      rawRetentionDeadline: readNamedArgument("--raw-retention-deadline"),
      restrictedRetentionDeadline: readNamedArgument("--restricted-retention-deadline"),
      policyId: readNamedArgument("--retention-policy"),
    },
  });
  const counts = Object.fromEntries(result.state.checkpoints.map((checkpoint) => [checkpoint.stage, checkpoint.counts]));
  console.log(JSON.stringify({ runDirectory: result.runDirectory, mode: result.state.mode, resumedStages: result.resumedStages, counts }, null, 2));
}

main().catch(async (error) => {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") console.error(`Input file was not found: ${(error as NodeJS.ErrnoException).path ?? "unknown"}`);
  else console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
