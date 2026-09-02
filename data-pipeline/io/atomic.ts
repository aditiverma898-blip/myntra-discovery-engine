import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeTextAtomically(destination: string, text: string): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.${process.pid}.tmp`;
  await writeFile(temporaryPath, text, "utf8");
  await rename(temporaryPath, destination);
}

export async function writeJsonAtomically(destination: string, value: unknown): Promise<void> {
  await writeTextAtomically(destination, `${JSON.stringify(value, null, 2)}\n`);
}
