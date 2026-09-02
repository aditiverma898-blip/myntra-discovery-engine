import {
  copilotResponseSchema,
  evidenceResponseSchema,
  type CopilotResponse,
  type DashboardRelease,
  type EvidenceResponse,
} from "@/lib/schemas";

export function buildEmptyEvidenceResponse(
  release: Pick<DashboardRelease, "status" | "datasetVersion">,
): EvidenceResponse {
  return evidenceResponseSchema.parse({
    status: release.status,
    mode: "empty",
    items: [],
    nextCursor: null,
    total: null,
    datasetVersion: release.datasetVersion,
    facets: { source: [], relevance: [], theme: [], barrier: [], journey: [], segment: [], confidence: [], rating: [] },
    activeFilters: { source: [], relevance: [], theme: [], barrier: [], journey: [], segment: [], rating: [], id: [], sort: "newest" },
    message: "Evidence has not been collected.",
  });
}

export function buildEmptyCopilotResponse(
  release: Pick<DashboardRelease, "status" | "datasetVersion">,
): CopilotResponse {
  return copilotResponseSchema.parse({
    status: release.status,
    relevant: false,
    mode: "unavailable",
    usedLLM: false,
    answer:
      "No reviewed evidence is available yet. Complete and publish a validated data release before asking evidence-based questions.",
    findings: [],
    metricLinks: [],
    limitations: [
      "Collection, relevance review, and evidence analysis have not been performed.",
      "No model or external provider was used for this response.",
    ],
    datasetVersion: release.datasetVersion,
  });
}
