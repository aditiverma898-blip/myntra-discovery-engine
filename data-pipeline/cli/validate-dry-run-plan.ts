import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectionBatchSchema } from "../../src/lib/schemas/collection";
import { validateDestinationDryRunPlan } from "../planning/validate-dry-run-plan";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const plan = JSON.parse(await readFile(path.resolve(readNamedArgument("--plan")), "utf8")) as Record<string, unknown>;
  const batch = collectionBatchSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  validateDestinationDryRunPlan(plan, batch);
  console.log(JSON.stringify({ status: "passed", batchId: batch.batchId, externalExecutionPerformed: false, expectedBlocker: "External calls are disabled." }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
