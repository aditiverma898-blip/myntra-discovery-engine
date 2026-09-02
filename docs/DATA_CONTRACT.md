# Data Contract

## Contract principles

- All persistent artifacts are versioned and runtime-validated.
- JSONL is used for record-level stages; JSON is used for manifests and aggregates.
- IDs are stable inside and across releases when the canonical source item is unchanged.
- Unknown is represented by `null` or an explicit `unknown` enum, never invented.
- Raw, normalized, classified, and published data remain separate.
- Public/client-safe fields are explicitly selected; raw artifacts are never copied wholesale.
- Every material label records its method/version/confidence.
- Dates use ISO 8601 UTC strings unless explicitly nullable.

The TypeScript definitions below specify the intended implementation. Zod schemas must be the runtime source of truth and inferred TypeScript types must match them.

## Shared types

```ts
type ReleaseStatus = "empty" | "partial" | "ready" | "error";
type DataMode = "empty" | "fixtures" | "ready";

type SourceId =
  | "google_play"
  | "app_store"
  | "youtube"
  | "reddit"
  | "myntra_product_review"
  | "community"
  | "manual_import";

type SelectionMethod =
  | "organic_feed"
  | "keyword_query"
  | "video_query"
  | "thread_query"
  | "manual_sample"
  | "provided_dataset";

type Relevance =
  | "direct_wishlist"
  | "journey_adjacent"
  | "general"
  | "irrelevant";

type ConfidenceBand = "low" | "medium" | "high";
```

## Collection run

```ts
interface CollectionRunManifest {
  schemaVersion: string;
  runId: string;
  source: SourceId;
  adapterId: string;
  adapterVersion: string;
  codeCommit: string | null;
  approvalRecordId: string | null;
  approvalStatus: "disabled" | "approved" | "rejected";
  mode: "dry_run" | "fixture" | "external";
  queryIds: string[];
  sanitizedParameters: Record<string, unknown>;
  limits: {
    maxItems: number;
    maxRequests: number | null;
    maxCost: number | null;
    currency: string | null;
  };
  startedAt: string | null;
  completedAt: string | null;
  status: "planned" | "running" | "succeeded" | "partial" | "failed";
  counts: {
    requests: number | null;
    received: number | null;
    valid: number | null;
    invalid: number | null;
    duplicates: number | null;
  };
  outputPath: string | null;
  outputChecksum: string | null;
  retentionDeadline: string | null;
  warnings: string[];
  errors: Array<{ code: string; message: string; itemRef: string | null }>;
}
```

Dry-run manifests use `startedAt`, counts, output, and cost as `null`; they do not pretend a run occurred.

## Raw evidence

```ts
interface RawEvidence {
  schemaVersion: string;
  rawId: string;
  collectionRunId: string;
  source: SourceId;
  sourceItemType: "review" | "post" | "comment" | "video" | "observation";
  sourceItemId: string | null;
  parentSourceItemId: string | null;
  canonicalUrl: string;
  sourceScope: "myntra_specific";
  sourceStratum: string;
  selectionMethod: SelectionMethod;
  queryIds: string[];
  resultPosition: number | null;
  collectedAt: string;
  publishedAt: string | null;
  editedOrDeletedStatus: "active" | "edited" | "deleted" | "unknown";
  rating: number | null;
  title: string | null;
  text: string;
  language: string | null;
  region: string | null;
  sourceMetadata: Record<string, string | number | boolean | null>;
}
```

Raw evidence must not contain usernames/profile URLs unless a source adapter cannot avoid receiving them. Such fields are removed before the normalized stage and never included in published releases.

## Normalized evidence

```ts
interface NormalizedEvidence {
  schemaVersion: string;
  evidenceId: string;
  rawId: string;
  collectionRunId: string;
  source: SourceId;
  sourceItemType: RawEvidence["sourceItemType"];
  sourceItemId: string | null;
  parentThreadId: string | null;
  canonicalUrl: string;
  sourceStratum: string;
  selectionMethod: SelectionMethod;
  queryIds: string[];
  collectedAt: string;
  publishedAt: string | null;
  title: string | null;
  originalText: string;
  normalizedText: string;
  language: string;
  translation: {
    translated: boolean;
    targetLanguage: string | null;
    method: "none" | "human" | "model" | "other";
    version: string | null;
  };
  contentHash: string;
  duplicateGroupId: string | null;
  isCanonicalDuplicate: boolean;
  piiReview: "not_required" | "redacted" | "needs_review";
  validationWarnings: string[];
}
```

`originalText` at this stage means the minimized evidence text after identity removal, not an unredacted provider payload.

## Classification

```ts
type WishlistPurpose =
  | "near_term_purchase"
  | "comparison_shortlist"
  | "occasion_planning"
  | "inspiration_bookmark"
  | "price_tracking"
  | "gift_planning"
  | "mixed"
  | "unknown";

type JourneyStage =
  | "wishlist_add"
  | "active_intent"
  | "revisit"
  | "research"
  | "comparison"
  | "decision"
  | "bag"
  | "checkout"
  | "post_purchase"
  | "unknown";

type BarrierId =
  | "fit_size_uncertainty"
  | "material_quality_uncertainty"
  | "color_image_mismatch"
  | "review_trust_gap"
  | "authenticity_trust_gap"
  | "comparison_overload"
  | "choice_overload"
  | "styling_occasion_uncertainty"
  | "social_validation_gap"
  | "price_waiting"
  | "budget_timing"
  | "stock_size_unavailability"
  | "delivery_timing_uncertainty"
  | "return_refund_risk"
  | "wishlist_clutter_forgetting"
  | "low_purchase_intent_bookmarking"
  | "checkout_or_payment_friction"
  | "actual_product_or_fulfillment_failure"
  | "other";

interface EvidenceClassification {
  schemaVersion: string;
  evidenceId: string;
  relevance: Relevance;
  relevanceReason: string;
  wishlistExplicit: boolean;
  myntraSpecific: true;
  temporalRelation: "pre_purchase" | "post_purchase" | "unclear";
  wishlistPurpose: WishlistPurpose;
  journeyStages: JourneyStage[];
  barriers: BarrierId[];
  primaryBarrier: BarrierId | null;
  barrierSubtypes: string[];
  uncertainties: string[];
  workarounds: string[];
  alternativeProductsOrBrandsMentioned: string[];
  desiredOutcomes: string[];
  behavioralSegmentCues: Array<{
    segmentId: string;
    evidenceSpan: string;
  }>;
  explicitAction:
    | "wait"
    | "research"
    | "ask"
    | "compare"
    | "bag"
    | "buy"
    | "buy_elsewhere"
    | "remove"
    | "abandon"
    | "return"
    | "unknown";
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  severity: 0 | 1 | 2 | 3;
  purchaseDelaySignal: boolean;
  abandonmentSignal: boolean;
  stillIntendsToBuy: boolean | null;
  monetaryDependency: 0 | 1 | 2;
  nonMonetarySolvability: 0 | 1 | 2 | 3;
  affectedProductOutcomes: string[];
  evidenceNature: "first_person" | "hearsay" | "hypothetical" | "advice" | "unclear";
  contradictoryOrPositive: boolean;
  method: "rule" | "model" | "human" | "hybrid";
  modelId: string;
  promptVersion: string;
  taxonomyVersion: string;
  confidence: number;
  confidenceReason: string;
  classifiedAt: string;
  humanReviewStatus: "unreviewed" | "accepted" | "corrected" | "rejected";
  adjudicationNotes: string | null;
}
```

`confidence` is constrained to 0–1. Evidence spans must be short and grounded in the normalized text; they cannot introduce claims.

## Taxonomy and theme

```ts
interface ThemeDefinition {
  themeId: string;
  taxonomyVersion: string;
  name: string;
  status: "hypothesis" | "discovered" | "reviewed" | "retired";
  userGoal: string;
  barrierOrNeed: string;
  journeyStages: JourneyStage[];
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  relatedBarrierIds: BarrierId[];
  typicalWorkarounds: string[];
  representativeEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  confidence: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
```

Provisional research lenses are published with `status: "hypothesis"` and no evidence counts in an empty release.

## Behavioral segment

```ts
interface BehavioralSegment {
  segmentId: string;
  name: string;
  status: "hypothesis" | "evidence_supported" | "interview_validated";
  definition: string;
  qualifyingBehaviors: string[];
  exclusionRules: string[];
  evidenceIds: string[];
  topBarrierIds: BarrierId[];
  unknowns: string[];
  interviewRecruitmentRule: string;
  confidence: number | null;
}
```

## Opportunity

```ts
interface OpportunityScoreInputs {
  corpusFrequency: number;
  severity: number;
  conversionProximity: number;
  nonMonetarySolvability: number;
  targetSegmentValue: number;
  evidenceConfidence: number;
  monetaryDependency: number;
}

interface Opportunity {
  opportunityId: string;
  name: string;
  description: string;
  status: "hypothesis" | "engine_candidate" | "selected_for_interviews" | "retired";
  affectedProductOutcomes: string[];
  themeIds: string[];
  segmentIds: string[];
  evidenceIds: string[];
  directEvidenceCount: number;
  adjacentEvidenceCount: number;
  sourceDistribution: Record<string, number>;
  workaroundSummary: string[];
  scoreInputs: OpportunityScoreInputs;
  baseScore: number;
  adjustedScore: number;
  confidenceBand: ConfidenceBand;
  limitations: string[];
  interviewQuestions: string[];
}
```

All score inputs and scores are constrained to 0–100 except `monetaryDependency`, which is 0–1. Counts require a release denominator and never become population prevalence.

## Release manifest

```ts
interface ReleaseManifest {
  schemaVersion: string;
  datasetVersion: string;
  status: ReleaseStatus;
  generatedAt: string | null;
  scope: {
    product: "myntra";
    targetRawRecords: 20000;
    acceptableRawMinimum: 18000;
    acceptableRawMaximum: 22000;
    otherShoppingPlatformsIncluded: false;
  };
  codeCommit: string | null;
  taxonomyVersion: string | null;
  promptVersion: string | null;
  classifier: { provider: string; model: string } | null;
  embedding: { provider: string; model: string; dimensions: number } | null;
  coverage: Array<{
    source: SourceId;
    runIds: string[];
    from: string | null;
    to: string | null;
    queries: string[];
  }>;
  counts: {
    raw: number | null;
    normalized: number | null;
    canonical: number | null;
    direct: number | null;
    adjacent: number | null;
    general: number | null;
    irrelevant: number | null;
    reviewed: number | null;
  };
  files: Array<{
    role: string;
    path: string;
    sha256: string;
    recordCount: number | null;
    visibility: "client" | "server" | "restricted";
  }>;
  qualityStatus: "not_evaluated" | "passed" | "passed_with_warnings" | "failed";
  limitations: string[];
}
```

## Aggregate dashboard contract

```ts
interface DashboardRelease {
  status: ReleaseStatus;
  datasetVersion: string;
  generatedAt: string | null;
  productScope: "myntra";
  sources: {
    configured: SourceId[];
    collected: SourceId[];
  };
  totals: {
    evidence: number | null;
    themes: number | null;
    segments: number | null;
    opportunities: number | null;
  };
  relevanceDistribution: Array<{ key: Relevance; count: number; denominator: number }>;
  sourceStats: Array<{
    source: SourceId;
    count: number;
    directCount: number;
    coverageFrom: string | null;
    coverageTo: string | null;
    warnings: string[];
  }>;
  analytics: ReleaseAnalytics | null;
  themes: ThemeDefinition[];
  segments: BehavioralSegment[];
  opportunities: Opportunity[];
  quality: {
    status: ReleaseManifest["qualityStatus"];
    warnings: string[];
  };
}
```

For `empty`, all totals are `null`, distributions/source stats/opportunities are empty, and provisional theme/segment cards are loaded separately as research hypotheses so they cannot be confused with collected findings.

`ReleaseAnalytics` is the immutable presentation contract derived from the public-safe evidence release. It contains explicit corpus, candidate-relevant, rated-store, and human-reviewed denominators; source metrics; store-only rating distributions; source × relevance counts; barrier and non-exclusive journey statistics; true journey × barrier intersections; monthly collection coverage; theme support; and opportunity comparisons. Empty releases use `analytics: null`. Filtered non-empty queries may legitimately return zero matches.

## Evidence API

Request:

```ts
interface EvidenceQuery {
  q?: string;
  source?: SourceId[];
  relevance?: Relevance[];
  theme?: string[];
  barrier?: BarrierId[];
  journey?: JourneyStage[];
  segment?: string[];
  confidence?: ConfidenceBand;
  rating?: Array<1 | 2 | 3 | 4 | 5>;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  sort?: "newest" | "oldest" | "confidence_desc" | "rating_asc" | "rating_desc";
  id?: string[];
  cursor?: string;
  limit?: number; // default 25, maximum 100
}
```

Response:

```ts
interface PublicEvidenceItem {
  evidenceId: string;
  source: SourceId;
  sourceItemType: string;
  parentThreadId: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  excerpt: string;
  relevance: Relevance;
  themeIds: string[];
  segmentIds: string[];
  barrierIds: BarrierId[];
  journeyStages: JourneyStage[];
  confidence: number;
  rating: number | null;
  severity: 0 | 1 | 2 | 3;
  primaryBarrier: BarrierId | null;
  explicitAction: "wait" | "research" | "ask" | "compare" | "bag" | "buy" | "buy_elsewhere" | "remove" | "abandon" | "return" | "unknown";
  contradictoryOrPositive: boolean;
  labelMethod: "heuristic" | "model" | "human";
  humanReviewStatus: string;
}

interface EvidenceResponse {
  status: ReleaseStatus;
  mode: "empty" | "fixtures" | "provisional" | "ready";
  items: PublicEvidenceItem[];
  nextCursor: string | null;
  total: number | null;
  datasetVersion: string;
  facets: EvidenceFacets;
  activeFilters: Omit<EvidenceQuery, "cursor" | "limit">;
  message?: string;
}
```

Repeated filters use OR within a facet and AND across facets. Facet counts apply every active filter except the facet's own selection. Cursor fingerprints include every filter and sort value so a cursor cannot be reused with different criteria. `/api/analytics` accepts the same filter contract without `cursor` or `limit` and returns nullable unknowns only for an empty release; non-empty no-match filters return genuine zero counts.

## Copilot API

Request:

```ts
interface CopilotRequest {
  question: string; // trimmed, 1-1000 characters
  filters?: Pick<EvidenceQuery, "source" | "relevance" | "theme" | "barrier" | "journey" | "segment" | "rating" | "from" | "to">;
}
```

Response:

```ts
interface CopilotResponse {
  status: ReleaseStatus;
  relevant: boolean;
  mode: "unavailable" | "extractive" | "generated";
  usedLLM: boolean;
  answer: string;
  findings: Array<{
    finding: string;
    evidenceCount: number;
    evidenceIds: string[];
    sources: SourceId[];
    barrierIds: BarrierId[];
    journeyStages: JourneyStage[];
    confidence: ConfidenceBand;
  }>;
  metricLinks: Array<{ productOutcome: string; reason: string }>;
  limitations: string[];
  datasetVersion: string;
}
```

Empty mode always returns `mode: "unavailable"`, `usedLLM: false`, no findings/evidence IDs, and an explanation that collection has not been performed.

In provisional mode Copilot returns release `status: "partial"`, searches the complete cached public-safe corpus, diversifies citations by source/thread, and never describes the evidence as synthetic or reviewed. Evidence citations resolve through `/evidence?id=<evidence-id>`.

## Referential integrity

Before promotion:

- every classification references an existing canonical evidence ID;
- every theme/segment/opportunity evidence ID exists and is review-eligible;
- every embedding references an existing server evidence item;
- embedding model/dimensions match the manifest;
- aggregate counts reproduce from the classified corpus;
- no server/restricted artifact is marked client-visible;
- file record counts and checksums match;
- empty releases contain no evidence-derived counts or examples.

Any failure marks the candidate release `error`/quality `failed` and preserves the prior active release.

## Destination operation report

Every destination dry-run or external operation returns a separate restricted `DESTINATION_EXECUTION_REPORT.json`. Its runtime schema is `destinationOperationReportSchema`. It contains only operational metadata:

- operation kind/ID and the reported process exit code;
- outcome state (`success`, `partial`, `failed`, `blocked`, or `unsafe_incomplete`), success criterion, and next action;
- whether an external request was recorded;
- received/succeeded/failed/quarantined, request, and cost metrics;
- restored external/runtime safety flags;
- existence, byte size, and SHA-256 of sanitized plan/manifest/failure artifacts;
- failure totals/categories and at most ten sanitized examples.

It must not contain raw evidence, prompts, model outputs, credential values, `.env` contents, cookies, or provider response bodies. It summarizes an operation but does not replace its manifest or failure ledger.

## Versioning rules

- Breaking field or semantic changes increment `schemaVersion`.
- Label definition changes increment `taxonomyVersion`.
- Prompt/model changes increment the classification configuration version.
- Embedding provider/model/dimension changes require a complete new vector artifact.
- Dataset content or method changes create a new immutable `datasetVersion`.
- UI-only changes do not rewrite an existing data release.
