import {
  EMPTY_RELEASE_DIRECTORY,
  validateEmptyRelease,
  writeEmptyRelease,
} from "./empty-release-io";

async function main(): Promise<void> {
  await writeEmptyRelease();
  await validateEmptyRelease();

  console.log(`Validated empty release at ${EMPTY_RELEASE_DIRECTORY}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
