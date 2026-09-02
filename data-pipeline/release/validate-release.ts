import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dashboardReleaseSchema, publicEvidenceItemSchema, releaseManifestSchema, type ActiveReleasePointer } from "../../src/lib/schemas";

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export async function validateCandidateRelease(releaseDirectory: string): Promise<{ manifest: ReturnType<typeof releaseManifestSchema.parse>; evidenceIds: Set<string> }> {
  const manifest = releaseManifestSchema.parse(JSON.parse(await readFile(path.join(releaseDirectory, "manifest.json"), "utf8")) as unknown);
  const dashboard = dashboardReleaseSchema.parse(JSON.parse(await readFile(path.join(releaseDirectory, "aggregates.json"), "utf8")) as unknown);
  if (manifest.datasetVersion !== dashboard.datasetVersion || manifest.status !== dashboard.status) throw new Error("Candidate release identity mismatch.");
  for (const file of manifest.files) {
    const text = await readFile(path.join(releaseDirectory, file.path), "utf8");
    if (sha256(text) !== file.sha256) throw new Error(`Checksum mismatch for ${file.path}.`);
  }
  const evidenceFile = manifest.files.find((file) => file.role === "public_safe_evidence");
  const evidenceIds = new Set<string>();
  if (evidenceFile) {
    const text = await readFile(path.join(releaseDirectory, evidenceFile.path), "utf8");
    for (const line of text.split(/\r?\n/u).filter(Boolean)) evidenceIds.add(publicEvidenceItemSchema.parse(JSON.parse(line) as unknown).evidenceId);
  }
  const references = [...dashboard.themes.flatMap((theme) => [...theme.representativeEvidenceIds, ...theme.contradictoryEvidenceIds]), ...dashboard.segments.flatMap((segment) => segment.evidenceIds), ...dashboard.opportunities.flatMap((opportunity) => opportunity.evidenceIds)];
  if (references.some((evidenceId) => !evidenceIds.has(evidenceId))) throw new Error("Published aggregates contain a broken evidence reference.");
  return { manifest, evidenceIds };
}

export async function promoteValidatedRelease(options: { releasesRoot: string; releasePath: string; pointerFilename?: string }): Promise<ActiveReleasePointer> {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(options.releasePath)) throw new Error("Unsafe release path.");
  const releaseDirectory = path.resolve(options.releasesRoot, options.releasePath);
  const resolvedRoot = path.resolve(options.releasesRoot);
  if (!releaseDirectory.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Release path escapes root.");
  const { manifest } = await validateCandidateRelease(releaseDirectory);
  if (manifest.status !== "ready" || manifest.qualityStatus === "failed") throw new Error("Only a quality-passing ready release can be promoted.");
  const pointer = { schemaVersion: "1.0.0", datasetVersion: manifest.datasetVersion, releasePath: options.releasePath } as const;
  const destination = path.join(options.releasesRoot, options.pointerFilename ?? "active.json");
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
  return pointer;
}
