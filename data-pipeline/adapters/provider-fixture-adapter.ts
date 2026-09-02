import { z } from "zod";

import { assertExternalCallsAllowed } from "../../src/lib/external-access";
import { rawEvidenceSchema, type RawEvidence } from "../../src/lib/schemas/pipeline";
import type { SourceId } from "../../src/lib/schemas/release";
import type { CollectorAdapter, ExternalCollectorOptions, ExternalCollectorTransport } from "./types";

export const savedProviderItemSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable().default(null),
  url: z.url(),
  title: z.string().nullable().default(null),
  text: z.string().min(1),
  publishedAt: z.iso.datetime().nullable().default(null),
  rating: z.number().min(1).max(5).nullable().default(null),
  queryId: z.string().min(1),
  language: z.string().default("en"),
}).strict();

type SavedProviderItem = z.infer<typeof savedProviderItemSchema>;

export function createProviderFixtureAdapter(options: { id: string; source: SourceId; itemType: RawEvidence["sourceItemType"]; selectionMethod: RawEvidence["selectionMethod"] }): CollectorAdapter<unknown[]> {
  const adapter: CollectorAdapter<unknown[]> = {
    id: options.id,
    version: "1.0.0",
    source: options.source,
    parseSavedFixture(payload) {
      return payload.map((value, index) => {
        const item: SavedProviderItem = savedProviderItemSchema.parse(value);
        return rawEvidenceSchema.parse({
          schemaVersion: "1.0.0", synthetic: true, scenarioId: "generic_support",
          rawId: `saved-${options.source}-${item.id}`, collectionRunId: `fixture-${options.source}-adapter-001`, source: options.source,
          sourceItemType: options.itemType, sourceItemId: item.id, parentSourceItemId: item.parentId, canonicalUrl: item.url,
          sourceScope: "myntra_specific", sourceStratum: options.source === "myntra_product_review" ? "product_decision_evidence" : "myntra_app_or_external_feedback",
          selectionMethod: options.selectionMethod, queryIds: [item.queryId], resultPosition: index + 1,
          collectedAt: "2026-08-22T00:00:00.000Z", publishedAt: item.publishedAt, rating: item.rating, title: item.title,
          text: item.text, language: item.language, region: "IN", sourceMetadata: { savedFixture: true },
        });
      });
    },
    async collectExternal(externalOptions: ExternalCollectorOptions, transport: ExternalCollectorTransport): Promise<RawEvidence[]> {
      assertExternalCallsAllowed({ source: options.source, sourceApprovalStatus: externalOptions.sourceApprovalStatus, maxItems: externalOptions.maxItems, maxCost: externalOptions.maxCost, argv: externalOptions.argv, environment: externalOptions.environment });
      void transport;
      throw new Error("Fixture adapters cannot collect live data. Use the destination collection runner and live mapper.");
    },
  };
  return adapter;
}
