import path from "node:path";

import { promoteValidatedRelease } from "../release/validate-release";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const releasePath = readNamedArgument("--release-path");
  const pointer = await promoteValidatedRelease({ releasesRoot: path.resolve("data/releases"), releasePath });
  console.log(JSON.stringify({ status: "promoted", externalCallsMade: false, pointer }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
