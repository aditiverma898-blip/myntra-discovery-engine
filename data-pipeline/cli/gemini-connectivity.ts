import { readFile } from "node:fs/promises";
import path from "node:path";

import { aiProviderApprovalSchema, geminiConnectivityJobSchema } from "../../src/lib/schemas/ai-run";
import { runGeminiConnectivityProbe } from "../providers/gemini-connectivity";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const job = geminiConnectivityJobSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as unknown);
  const approval = aiProviderApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const result = await runGeminiConnectivityProbe({ workspaceRoot: process.cwd(), job, approval, argv: process.argv.slice(2) });
  console.log(JSON.stringify({ status: result.manifest.status, jobId: result.manifest.jobId, syntheticPromptOnly: true, sourceDataSubmitted: false, requests: result.manifest.requestCount, estimatedCostUsd: 0 }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
