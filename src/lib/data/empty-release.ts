import {
  dashboardReleaseSchema,
  releaseManifestSchema,
  type DashboardRelease,
  type ReleaseManifest,
} from "@/lib/schemas";

export const EMPTY_RELEASE_MANIFEST: ReleaseManifest =
  releaseManifestSchema.parse({
    schemaVersion: "1.0.0",
    datasetVersion: "empty-001",
    status: "empty",
    generatedAt: null,
    scope: {
      product: "myntra",
      targetRawRecords: 20_000,
      acceptableRawMinimum: 18_000,
      acceptableRawMaximum: 22_000,
      otherShoppingPlatformsIncluded: false,
    },
    codeCommit: null,
    taxonomyVersion: null,
    promptVersion: null,
    classifier: null,
    embedding: null,
    coverage: [],
    counts: {
      raw: null,
      normalized: null,
      canonical: null,
      direct: null,
      adjacent: null,
      general: null,
      irrelevant: null,
      reviewed: null,
    },
    files: [],
    qualityStatus: "not_evaluated",
    limitations: [
      "No collection, classification, embedding, or evidence analysis has been performed.",
    ],
  });

export const EMPTY_DASHBOARD_RELEASE: DashboardRelease =
  dashboardReleaseSchema.parse({
    status: "empty",
    datasetVersion: "empty-001",
    generatedAt: null,
    productScope: "myntra",
    sources: {
      configured: [],
      collected: [],
    },
    totals: {
      evidence: null,
      themes: null,
      segments: null,
      opportunities: null,
    },
    relevanceDistribution: [],
    sourceStats: [],
    themes: [],
    segments: [],
    opportunities: [],
    hypotheses: {
      themes: [
        {
          id: "fit-size-silhouette",
          name: "Fit, size, and silhouette confidence",
          status: "hypothesis",
          description:
            "Investigate whether still-interested wishlist revisitors can confidently choose a variant.",
        },
        {
          id: "product-confidence",
          name: "Material, quality, and visual confidence",
          status: "hypothesis",
          description:
            "Investigate whether current product evidence is trusted and personally diagnostic.",
        },
        {
          id: "decision-resume-effort",
          name: "Comparison and decision-resume effort",
          status: "hypothesis",
          description:
            "Investigate whether revisiting saved products requires shoppers to reconstruct comparisons and prior reasoning.",
        },
        {
          id: "return-risk",
          name: "Return and post-purchase risk",
          status: "hypothesis",
          description:
            "Investigate whether uncertainty about returns, refunds, or product mismatch delays otherwise active decisions.",
        },
      ],
      segments: [
        {
          id: "still-interested-revisitor",
          name: "Still-interested wishlist revisitor",
          status: "hypothesis",
          description:
            "A behavior-based candidate group for later evidence review and interviews.",
        },
        {
          id: "comparison-led-revisitor",
          name: "Comparison-led revisitor",
          status: "hypothesis",
          description:
            "A candidate group that may keep several saved options active while reconstructing comparisons.",
        },
        {
          id: "fit-confidence-seeker",
          name: "Fit-confidence seeker",
          status: "hypothesis",
          description:
            "A candidate group that may remain interested but lack enough evidence to select size or silhouette.",
        },
        {
          id: "risk-sensitive-decider",
          name: "Risk-sensitive decider",
          status: "hypothesis",
          description:
            "A candidate group that may delay when product mismatch or return effort feels difficult to reverse.",
        },
      ],
    },
    quality: {
      status: "not_evaluated",
      warnings: ["No evidence has been collected."],
    },
  });

export const EMPTY_METHODOLOGY = {
  schemaVersion: "1.0.0",
  datasetVersion: "empty-001",
  productScope: "myntra",
  dataStatus: "not_collected",
  externalCallsMade: false,
  sourceTarget: 20_000,
  sourceTargetRange: [18_000, 22_000],
  note: "Methodology is documented, but no source run has occurred.",
} as const;

export const EMPTY_TAXONOMY = {
  schemaVersion: "1.0.0",
  datasetVersion: "empty-001",
  taxonomyVersion: null,
  status: "not_created",
  themes: [],
} as const;

export const EMPTY_QUALITY_REPORT = {
  schemaVersion: "1.0.0",
  datasetVersion: "empty-001",
  status: "not_evaluated",
  checks: [],
  warnings: ["Quality cannot be evaluated before data collection."],
} as const;
