import { readFile } from "node:fs/promises";
import path from "node:path";

import { rawIntakeConfigSchema } from "../../src/lib/schemas/intake";
import { mergeRawIntake } from "../intake/merge-raw";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const configPath = path.resolve(readNamedArgument("--config"));
  const config = rawIntakeConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")) as unknown);
  const result = await mergeRawIntake({ workspaceRoot: process.cwd(), config });
  console.log(JSON.stringify({
    status: "completed",
    externalCallsMade: false,
    outputDirectory: path.relative(process.cwd(), result.outputDirectory),
    manifest: result.manifest,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
