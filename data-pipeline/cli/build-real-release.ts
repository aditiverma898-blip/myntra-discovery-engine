import { readFile } from "node:fs/promises";
import path from "node:path";

import { releaseBuildConfigSchema } from "../../src/lib/schemas/release-build";
import { buildRealRelease } from "../release/build-real-release";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const config = releaseBuildConfigSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const result = await buildRealRelease({ workspaceRoot: process.cwd(), config });
  console.log(JSON.stringify({ releaseDirectory: path.relative(process.cwd(), result.releaseDirectory), datasetVersion: result.manifest.datasetVersion, status: result.manifest.status, qualityStatus: result.manifest.qualityStatus, counts: result.manifest.counts }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
