import { lstat } from "node:fs/promises";

export async function assertPathMissing(candidate: string): Promise<void> {
  try {
    await lstat(candidate);
    throw new Error(`Output already exists and is immutable: ${candidate}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
