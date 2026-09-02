import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  EMPTY_DASHBOARD_RELEASE,
  EMPTY_METHODOLOGY,
  EMPTY_QUALITY_REPORT,
  EMPTY_RELEASE_MANIFEST,
  EMPTY_TAXONOMY,
} from "../../src/lib/data/empty-release";
import {
  dashboardReleaseSchema,
  releaseManifestSchema,
} from "../../src/lib/schemas/release";

export const EMPTY_RELEASE_DIRECTORY = path.join(
  process.cwd(),
  "data",
  "releases",
  "empty",
);

const artifacts = {
  "manifest.json": EMPTY_RELEASE_MANIFEST,
  "aggregates.json": EMPTY_DASHBOARD_RELEASE,
  "methodology.json": EMPTY_METHODOLOGY,
  "taxonomy.json": EMPTY_TAXONOMY,
  "quality-report.json": EMPTY_QUALITY_REPORT,
} as const;

async function writeJsonAtomically(
  destination: string,
  value: unknown,
): Promise<void> {
  const temporaryPath = `${destination}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, destination);
}

export async function writeEmptyRelease(): Promise<void> {
  await mkdir(EMPTY_RELEASE_DIRECTORY, { recursive: true });
  await Promise.all(
    Object.entries(artifacts).map(([filename, value]) =>
      writeJsonAtomically(path.join(EMPTY_RELEASE_DIRECTORY, filename), value),
    ),
  );
}

export async function validateEmptyRelease(): Promise<void> {
  const [manifestText, aggregatesText] = await Promise.all([
    readFile(path.join(EMPTY_RELEASE_DIRECTORY, "manifest.json"), "utf8"),
    readFile(path.join(EMPTY_RELEASE_DIRECTORY, "aggregates.json"), "utf8"),
  ]);

  releaseManifestSchema.parse(JSON.parse(manifestText));
  dashboardReleaseSchema.parse(JSON.parse(aggregatesText));
}

export async function writeActiveReleasePointer(): Promise<void> {
  const destination = path.join(process.cwd(), "data", "releases", "active.json");
  await writeJsonAtomically(destination, {
    schemaVersion: "1.0.0",
    datasetVersion: EMPTY_RELEASE_MANIFEST.datasetVersion,
    releasePath: "empty",
  });
}
