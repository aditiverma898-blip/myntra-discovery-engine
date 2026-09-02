import { buildFilteredAnalytics } from "@/lib/data/evidence-analytics";
import { activeEvidenceFilters, evidenceQueryRecord } from "@/lib/data/evidence-query";
import { readPublicEvidence } from "@/lib/data/evidence-reader";
import { buildEvidenceFacets, filterPublicEvidence } from "@/lib/data/public-evidence";
import { loadActiveRelease } from "@/lib/data/release-loader";
import { evidenceQuerySchema } from "@/lib/schemas";

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { raw, unknownKeys } = evidenceQueryRecord(url.searchParams);
  if ("cursor" in raw || "limit" in raw) {
    return noStoreJson({ error: "INVALID_ANALYTICS_QUERY", message: "Analytics does not support pagination parameters." }, { status: 400 });
  }

  const query = evidenceQuerySchema.safeParse(raw);
  if (!query.success || unknownKeys.length) {
    return noStoreJson({
      error: "INVALID_ANALYTICS_QUERY",
      message: "One or more analytics filters are invalid.",
      issues: query.success
        ? unknownKeys.map((key) => ({ path: [key], message: "Unknown query parameter." }))
        : query.error.issues.map(({ path, message }) => ({ path, message })),
    }, { status: 400 });
  }

  const result = await loadActiveRelease();
  if (!result.ok) return noStoreJson({ error: result.error.code, message: result.error.message }, { status: 503 });

  const allItems = result.mode === "empty" ? [] : await readPublicEvidence(result);
  const items = filterPublicEvidence(allItems, query.data);
  const facets = buildEvidenceFacets(allItems, query.data);
  return noStoreJson(buildFilteredAnalytics({
    items,
    releaseCorpus: result.release.totals.evidence ?? 0,
    status: result.release.status,
    mode: result.mode,
    datasetVersion: result.release.datasetVersion,
    facets,
    activeFilters: activeEvidenceFilters(query.data),
  }));
}
