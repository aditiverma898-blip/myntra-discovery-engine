import type { SourceId } from "@/lib/schemas";

export interface PlannedSource {
  source: SourceId;
  name: string;
  target: number;
  share: string;
  status: "planned_disabled" | "approval_required";
  role: string;
}

export const PLANNED_SOURCES: readonly PlannedSource[] = [
  {
    source: "google_play",
    name: "Google Play · Myntra app",
    target: 8_000,
    share: "40%",
    status: "planned_disabled",
    role: "App vocabulary and progression context",
  },
  {
    source: "app_store",
    name: "Apple App Store · Myntra app",
    target: 3_000,
    share: "15%",
    status: "planned_disabled",
    role: "Independent app-review stratum",
  },
  {
    source: "youtube",
    name: "Myntra-focused YouTube comments",
    target: 5_000,
    share: "25%",
    status: "planned_disabled",
    role: "Fit, try-on, quality, trust and decision language",
  },
  {
    source: "reddit",
    name: "Approved Reddit discussions",
    target: 2_000,
    share: "10%",
    status: "approval_required",
    role: "Decision journeys, workarounds and contradictions",
  },
  {
    source: "myntra_product_review",
    name: "Approved Myntra product reviews",
    target: 2_000,
    share: "10%",
    status: "approval_required",
    role: "Product-specific fit, material and visual evidence",
  },
] as const;

export const PIPELINE_STAGES = [
  { name: "Collect / import", state: "Not started", detail: "Owner-operated later" },
  { name: "Normalize & minimize", state: "Waiting", detail: "Requires approved input" },
  { name: "Relevance gate", state: "Waiting", detail: "No records available" },
  { name: "Discover & classify", state: "Waiting", detail: "No model initialized" },
  { name: "Aggregate & review", state: "Waiting", detail: "No evidence-derived output" },
  { name: "Publish release", state: "Active", detail: "empty-001 only" },
] as const;

export const OPPORTUNITY_DIMENSIONS = [
  ["Evidence frequency", "How often a barrier appears within the reviewed corpus."],
  ["Severity", "How strongly it blocks or delays a decision."],
  ["Conversion proximity", "How close the evidence is to a bag or purchase decision."],
  ["Non-monetary solvability", "Whether product experience can address it without discounts."],
  ["Segment value", "How well the opportunity fits the selected behavioural cohort."],
  ["Evidence confidence", "Review quality, directness and source diversity."],
] as const;
