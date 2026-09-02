import { buildAndWriteFixtureRelease, validateFixtureRelease, writeFixtureReleasePointer } from "./fixture-release-io";

async function main(): Promise<void> {
  await buildAndWriteFixtureRelease();
  await validateFixtureRelease();
  await writeFixtureReleasePointer();
  console.log("Synthetic fixture release fixture-001 generated and validated without external calls.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
