import { runGeneratedPerformanceBenchmark } from "../performance/generated-benchmark";

function main(): void {
  const result = runGeneratedPerformanceBenchmark(20_000);
  console.log(JSON.stringify(result, null, 2));
  if (result.canonicalCount !== 20_000) throw new Error("Generated performance corpus unexpectedly deduplicated.");
  if (result.durationsMs.total > 30_000) throw new Error("Offline 20K benchmark exceeded the 30-second engineering budget.");
}

try { main(); }
catch (error) { console.error(error); process.exitCode = 1; }
