import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { writeJsonAtomically } from "../io/atomic";
import { createDestinationCollectionPlan } from "../collection/plan";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const configPath = path.resolve(readNamedArgument("--config"));
  const approvalPath = path.resolve(readNamedArgument("--approval"));
  const batch = collectionBatchSchema.parse(JSON.parse(await readFile(configPath, "utf8")) as unknown);
  const approval = sourceApprovalSchema.parse(JSON.parse(await readFile(approvalPath, "utf8")) as unknown);
  const plan = createDestinationCollectionPlan({ batch, approval });
  const destination = path.resolve("data/intermediate/plans", `${batch.batchId}.json`);
  await writeJsonAtomically(destination, plan);
  console.log(JSON.stringify(plan, null, 2));
  console.log(`Sanitized plan written to ${path.relative(process.cwd(), destination)}; no external execution performed.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
