import { readFile } from "node:fs/promises";
import path from "node:path";

import { aiProviderApprovalSchema, classificationJobSchema, embeddingJobSchema } from "../../src/lib/schemas/ai-run";
import { runExternalAiJob } from "../providers/external-ai-runner";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const rawJob = JSON.parse(await readFile(path.resolve(readNamedArgument("--config")), "utf8")) as { kind?: unknown };
  const job = rawJob.kind === "classification" ? classificationJobSchema.parse(rawJob) : embeddingJobSchema.parse(rawJob);
  const approval = aiProviderApprovalSchema.parse(JSON.parse(await readFile(path.resolve(readNamedArgument("--approval")), "utf8")) as unknown);
  const operationFactory = async (apiKey: string) => {
    const provider = await import("../providers/gemini");
    return job.kind === "classification" ? (record: Parameters<typeof provider.classifyWithGemini>[0]) => provider.classifyWithGemini(record, job, apiKey) : (record: Parameters<typeof provider.embedWithGemini>[0]) => provider.embedWithGemini(record, job, apiKey);
  };
  const result = await runExternalAiJob({ workspaceRoot: process.cwd(), job, approval, argv: process.argv.slice(2), operationFactory });
  console.log(JSON.stringify({ status: result.manifest.status, jobId: result.manifest.jobId, succeeded: result.outputs.length, failed: result.failures.length, requests: result.manifest.requestCount, estimatedCostUsd: result.manifest.estimatedCostUsd }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
