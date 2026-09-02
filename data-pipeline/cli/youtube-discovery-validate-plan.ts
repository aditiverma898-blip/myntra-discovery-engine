import { readFile } from "node:fs/promises";
import path from "node:path";

import { youtubeDiscoveryConfigSchema } from "../../src/lib/schemas/youtube-discovery";
import { validateYouTubeDiscoveryDryRun, type YouTubeDiscoveryPlan } from "../planning/youtube-discovery-plan";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const plan = JSON.parse(await readFile(path.resolve(readNamedArgument("--plan")), "utf8")) as YouTubeDiscoveryPlan;
  const config = youtubeDiscoveryConfigSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  validateYouTubeDiscoveryDryRun(plan, config);
  console.log(JSON.stringify({ status: "passed", batchId: config.batchId, externalExecutionPerformed: false }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
