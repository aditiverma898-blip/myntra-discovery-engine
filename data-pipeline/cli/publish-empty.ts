import {
  validateEmptyRelease,
  writeActiveReleasePointer,
} from "./empty-release-io";

async function main(): Promise<void> {
  await validateEmptyRelease();
  await writeActiveReleasePointer();

  console.log("Published active release pointer for empty-001");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
