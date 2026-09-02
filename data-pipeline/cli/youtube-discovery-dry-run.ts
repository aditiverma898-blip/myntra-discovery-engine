import { readFile } from "node:fs/promises";
import path from "node:path";

import { sourceApprovalSchema } from "../../src/lib/schemas/collection";
import { youtubeDiscoveryConfigSchema } from "../../src/lib/schemas/youtube-discovery";
import { writeJsonAtomically } from "../io/atomic";
import { createYouTubeDiscoveryPlan } from "../planning/youtube-discovery-plan";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const config = youtubeDiscoveryConfigSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const approval = sourceApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const plan = createYouTubeDiscoveryPlan({ config, approval });
  const destination = path.resolve("data/intermediate/plans", `${config.batchId}.json`);
  await writeJsonAtomically(destination, plan);
  console.log(JSON.stringify(plan, null, 2));
  console.log(`YouTube v1.1 plan written to ${path.relative(process.cwd(), destination)}; no external execution performed.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
