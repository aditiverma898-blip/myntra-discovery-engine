import { buildEvidenceFacets, filterPublicEvidence } from "@/lib/data/public-evidence";
import { readPublicEvidence } from "@/lib/data/evidence-reader";
import { activeEvidenceFilters, evidenceQueryRecord } from "@/lib/data/evidence-query";
import { decodeEvidenceCursor, encodeEvidenceCursor } from "@/lib/data/pagination";
import { loadActiveRelease } from "@/lib/data/release-loader";
import { evidenceQuerySchema, evidenceResponseSchema } from "@/lib/schemas";

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { raw: rawQuery, unknownKeys } = evidenceQueryRecord(url.searchParams);

  const query = evidenceQuerySchema.safeParse(rawQuery);
  if (!query.success || unknownKeys.length) {
    return noStoreJson(
      {
        error: "INVALID_EVIDENCE_QUERY",
        message: "One or more evidence filters are invalid.",
        issues: query.success
          ? unknownKeys.map((key) => ({ path: [key], message: "Unknown query parameter." }))
          : query.error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }

  const result = await loadActiveRelease();
  if (!result.ok) {
    return noStoreJson(
      { error: result.error.code, message: result.error.message },
      { status: 503 },
    );
  }

  const activeFilters = activeEvidenceFilters(query.data);
  if (result.mode !== "empty") {
    const allItems = await readPublicEvidence(result);
    const items = filterPublicEvidence(allItems, query.data);
    const facets = buildEvidenceFacets(allItems, query.data);
    const { cursor, limit } = query.data;
    let offset = 0;
    try { offset = cursor ? decodeEvidenceCursor(cursor, activeFilters) : 0; }
    catch {
      return noStoreJson({ error: "INVALID_EVIDENCE_CURSOR", message: "The evidence cursor is invalid or belongs to different filters." }, { status: 400 });
    }
    const page = items.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return noStoreJson(evidenceResponseSchema.parse({
      status: result.release.status,
      mode: result.mode,
      items: page,
      nextCursor: nextOffset < items.length ? encodeEvidenceCursor(nextOffset, activeFilters) : null,
      total: items.length,
      datasetVersion: result.release.datasetVersion,
      facets,
      activeFilters,
      message: result.mode === "fixtures" ? "Synthetic fixture evidence only." : result.mode === "provisional" ? "Provisional candidate evidence; labels are not human-reviewed." : "Reviewed release evidence.",
    }));
  }

  return noStoreJson(evidenceResponseSchema.parse({
    status: result.release.status,
    mode: result.mode,
    items: [],
    nextCursor: null,
    total: null,
    datasetVersion: result.release.datasetVersion,
    facets: { source: [], relevance: [], theme: [], barrier: [], journey: [], segment: [], confidence: [], rating: [] },
    activeFilters,
    message: "Evidence has not been collected.",
  }));
}
