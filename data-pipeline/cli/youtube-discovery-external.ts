import { readFile } from "node:fs/promises";
import path from "node:path";

import { sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { youtubeDiscoveryConfigSchema } from "../../src/lib/schemas/youtube-discovery";
import { runYouTubeDiscoveryCollection } from "../collection/youtube-discovery-runner";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const config = youtubeDiscoveryConfigSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const approval = sourceApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const result = await runYouTubeDiscoveryCollection({ workspaceRoot: process.cwd(), config, approval, argv: process.argv.slice(2) });
  console.log(JSON.stringify({ status: result.manifest.status, stage: result.manifest.stage, records: result.records.length, candidates: result.candidates.length, requests: result.manifest.requestCount, quotaUsage: result.manifest.quotaUsage, rawRetentionDeadline: result.manifest.rawRetentionDeadline }, null, 2));
  if (result.manifest.status !== "completed") process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
