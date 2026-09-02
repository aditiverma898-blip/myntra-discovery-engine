import { readFile } from "node:fs/promises";
import path from "node:path";

import { collectionBatchSchema, sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { runExternalCollection } from "../collection/runner";
import { collectApifyPage } from "../transports/apify-actor";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const batch = collectionBatchSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const approval = sourceApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const queryId = readNamedArgument("--query-id");
  const result = await runExternalCollection({
    workspaceRoot: process.cwd(),
    batch,
    approval,
    argv: process.argv.slice(2),
    transportFactory: async () => collectApifyPage,
    recoveryOnlyQueryId: queryId,
  });
  console.log(JSON.stringify({
    status: result.manifest.status,
    batchId: result.manifest.batchId,
    recoveredQueryId: queryId,
    valid: result.records.length,
    failures: result.failures.length,
    requests: result.manifest.requestCount,
    costUsd: result.manifest.costUsd,
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
