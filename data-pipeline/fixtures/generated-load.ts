import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import { SYNTHETIC_RAW_RECORDS } from "./synthetic-raw";

const bases = SYNTHETIC_RAW_RECORDS.map((value) => rawEvidenceSchema.safeParse(value)).filter((result) => result.success).map((result) => result.data);

export function generateSyntheticLoad(count: number): RawEvidence[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) throw new Error("Generated load count must be between 1 and 100,000.");
  return Array.from({ length: count }, (_, index) => {
    const base = bases[index % bases.length];
    if (!base) throw new Error("Synthetic base fixtures are unavailable.");
    if (!base.scenarioId) throw new Error("Synthetic base fixture is missing its scenario ID.");
    const suffix = String(index + 1).padStart(6, "0");
    return rawEvidenceSchema.parse({
      ...base,
      scenarioId: base.scenarioId.startsWith("fit_wait_") ? "fit_wait" : base.scenarioId,
      rawId: `generated-raw-${suffix}`,
      sourceItemId: `generated-item-${suffix}`,
      canonicalUrl: `https://fixture.invalid/generated/${suffix}`,
      queryIds: [`generated-${base.scenarioId}`],
      text: `${base.text} Generated caseid${suffix} variant${suffix} garment${suffix} context${suffix} choice${suffix}.`,
      sourceMetadata: {},
    });
  });
}
