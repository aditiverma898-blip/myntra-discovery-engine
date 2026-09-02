import path from "node:path";

import { destinationOperationKindSchema } from "../../src/lib/schemas/destination-report";
import { createDestinationOperationReport } from "../reporting/destination-report";
import { readNamedArgument } from "./arguments";

function optionalNamedArgument(name: string, argv = process.argv.slice(2)): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const exitCode = Number(readNamedArgument("--exit-code"));
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) throw new Error("--exit-code must be an integer from 0 to 255.");
  const result = await createDestinationOperationReport({
    workspaceRoot: process.cwd(),
    kind: destinationOperationKindSchema.parse(readNamedArgument("--kind")),
    operationId: readNamedArgument("--id"),
    reportedExitCode: exitCode,
    manifestPath: optionalNamedArgument("--manifest"),
    failurePath: optionalNamedArgument("--failures"),
    planPath: optionalNamedArgument("--plan"),
    reportedError: optionalNamedArgument("--reported-error"),
    outputPath: optionalNamedArgument("--output"),
  });
  console.log(JSON.stringify({ report: path.relative(process.cwd(), result.outputPath), state: result.report.outcome.state, successCriteriaMet: result.report.outcome.successCriteriaMet, nextAction: result.report.outcome.nextAction }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
