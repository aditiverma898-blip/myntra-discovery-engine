import { readFile } from "node:fs/promises";
import path from "node:path";

import { estimateYouTubeCapacity } from "../planning/youtube-capacity";
import { collectionBatchSchema } from "../../src/lib/schemas/collection";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const batch = collectionBatchSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const estimate = estimateYouTubeCapacity(batch);
  if (!estimate) throw new Error("Capacity planning is available only for a YouTube Data API batch.");
  console.log(JSON.stringify(estimate, null, 2));
  if (estimate.warnings.length > 0) process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
