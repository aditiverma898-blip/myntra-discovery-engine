import { readFile, rename, writeFile } from "node:fs/promises";
import type { ZodType } from "zod";

export function serializeJsonLines(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : "");
}

export async function writeJsonLinesAtomically(path: string, values: readonly unknown[]): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, serializeJsonLines(values), "utf8");
  await rename(temporaryPath, path);
}

export async function readJsonLines<T>(path: string, schema: ZodType<T>): Promise<T[]> {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => schema.parse(JSON.parse(line) as unknown));
}
