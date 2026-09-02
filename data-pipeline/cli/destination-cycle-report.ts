import path from "node:path";

import { createDestinationCycleReport } from "../reporting/destination-cycle-report";
import { readNamedArgument } from "./arguments";

async function main(): Promise<void> {
  const result = await createDestinationCycleReport({
    workspaceRoot: process.cwd(),
    cycleId: readNamedArgument("--id"),
    youtubeReportPath: readNamedArgument("--youtube-report"),
    geminiReportPath: readNamedArgument("--gemini-report"),
  });
  console.log(JSON.stringify({ report: path.relative(process.cwd(), result.outputPath), state: result.report.outcome.state, successCriteriaMet: result.report.outcome.successCriteriaMet, nextAction: result.report.outcome.nextAction }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
