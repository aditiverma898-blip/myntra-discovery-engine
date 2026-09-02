import type { PublicEvidenceItem } from "@/lib/data/public-evidence";
import type { CopilotRequest, CopilotResponse, DataMode, ReleaseStatus } from "@/lib/schemas";
import { retrieveEvidence } from "./retrieval";

interface CopilotReleaseContext {
  mode: DataMode;
  status: ReleaseStatus;
  totalEvidence: number;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function buildExtractiveCopilotResponse(
  request: CopilotRequest,
  items: readonly PublicEvidenceItem[],
  datasetVersion: string,
  context: CopilotReleaseContext = { mode: "fixtures", status: "ready", totalEvidence: items.length },
): CopilotResponse {
  const ranked = retrieveEvidence(request, items, 8).items;
  const status: ReleaseStatus = context.mode === "provisional" ? "partial" : context.status;
  const releaseLabel = context.mode === "provisional" ? "provisional candidate release" : context.mode === "fixtures" ? "fixture release" : "active release";

  if (!ranked.length) {
    return {
      status,
      relevant: false,
      mode: "extractive",
      usedLLM: false,
      answer: `The ${releaseLabel} does not contain enough matching evidence to answer this question. Try asking about save intent, fit, quality, price, trust, comparison, returns, journey stage, or next actions.`,
      findings: [],
      metricLinks: [],
      limitations: [
        `Denominator: ${context.totalEvidence.toLocaleString("en-IN")} public-safe evidence units in the ${releaseLabel}.`,
        context.mode === "provisional" ? "Candidate labels have not been human-reviewed and must be validated in interviews." : "This answer is limited to the active release.",
        "Retrieval is deterministic lexical matching; no LLM, embedding, collector, or external API was used.",
      ],
      datasetVersion,
    };
  }

  const sources = [...new Set(ranked.map((item) => item.source))];
  const barriers = [...new Set(ranked.flatMap((item) => item.barrierIds))];
  const journeys = [...new Set(ranked.flatMap((item) => item.journeyStages).filter((stage) => stage !== "unknown"))];
  const directCount = ranked.filter((item) => item.relevance === "direct_wishlist").length;
  const barrierSummary = barriers.length ? barriers.slice(0, 3).map(humanize).join(", ") : "decision uncertainty";
  const journeySummary = journeys.length ? journeys.slice(0, 3).map(humanize).join(", ") : "an unresolved journey stage";

  return {
    status,
    relevant: true,
    mode: "extractive",
    usedLLM: false,
    answer: `${ranked.length} source-diversified matches point to ${barrierSummary}, most visibly around ${journeySummary}. Use this as a candidate explanation to test in interviews, not as a causal claim.`,
    findings: [{
      finding: `${barrierSummary} appears across ${sources.length} source${sources.length === 1 ? "" : "s"}; ${directCount} retrieved match${directCount === 1 ? " is" : "es are"} explicit wishlist evidence.`,
      evidenceCount: ranked.length,
      evidenceIds: ranked.map((item) => item.evidenceId),
      sources,
      barrierIds: barriers,
      journeyStages: journeys,
      confidence: sources.length >= 3 && ranked.length >= 5 ? "high" : sources.length >= 2 || ranked.length >= 3 ? "medium" : "low",
    }],
    metricLinks: [{
      productOutcome: "Reduce unresolved purchase uncertainty before checkout",
      reason: `Interview the cited users about ${barrierSummary}, then validate whether resolving it changes their next action.`,
    }],
    limitations: [
      `Denominator: ${context.totalEvidence.toLocaleString("en-IN")} public-safe evidence units; this answer retrieved ${ranked.length}.`,
      context.mode === "provisional" ? "The release is provisional, all candidate labels are unreviewed, and sparse direct-wishlist support limits claim strength." : "The answer is bounded by the active release and retrieval vocabulary.",
      "No LLM, embedding, collector, or external API was used.",
    ],
    datasetVersion,
  };
}
