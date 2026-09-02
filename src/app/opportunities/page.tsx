import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import {
  OpportunityExplorer,
  type OpportunityPresentation,
} from "@/components/opportunities/opportunity-explorer";
import { DataNotice } from "@/components/ui/data-notice";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { SectionCard } from "@/components/ui/section-card";
import { loadActiveRelease } from "@/lib/data/release-loader";
import { readPublicEvidence, type PublicEvidenceItem } from "@/lib/data/evidence-reader";
import type { DashboardRelease, Opportunity, ThemeDefinition } from "@/lib/schemas";

export const metadata: Metadata = { title: "Opportunities" };

const validationDesigns: Record<string, { experiment: string; metric: string }> = {
  "product-evidence-clarity": {
    experiment: "Prototype an evidence summary that reconciles material, visual and review cues on a saved product, then compare task completion with the current detail page in moderated sessions.",
    metric: "Higher decision confidence and fewer evidence-rechecking steps before a bag-or-defer choice.",
  },
  "fit-decision-support": {
    experiment: "Add a saved fit rationale with measurements, prior size evidence and the shopper’s unresolved question, then test whether participants can resume the decision without reopening multiple reviews.",
    metric: "Faster size selection with fewer review revisits and no increase in stated return concern.",
  },
  "reversibility-clarity": {
    experiment: "Place concise, item-specific return and refund expectations beside the decision action for a saved item and test comprehension before bag progression.",
    metric: "Improved policy comprehension and fewer reversibility questions during the decision task.",
  },
  "shortlist-memory": {
    experiment: "Test a lightweight comparison note that preserves why an item was saved and how it differs from two alternatives; begin with interviews because corpus support is sparse.",
    metric: "Participants accurately reconstruct their shortlist rationale with fewer product-page reopenings.",
  },
  "preferred-variant-availability": {
    experiment: "Prototype a saved-item availability tracker that preserves the shopper’s preferred size or variant and clearly communicates whether monitoring is active. Test whether participants can resume their decision without repeatedly reopening the product page.",
    metric: "Fewer manual availability checks and faster resumption of the saved-item decision, without increasing unwanted notification intent.",
  },
};

function sourceDiverseExcerpts(opportunity: Opportunity, evidenceById: ReadonlyMap<string, PublicEvidenceItem>) {
  const seenSources = new Set<string>();
  const candidates = opportunity.evidenceIds.flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });
  const diverse: PublicEvidenceItem[] = [];
  for (const item of candidates) {
    if (!seenSources.has(item.source)) {
      diverse.push(item);
      seenSources.add(item.source);
    }
  }
  const rest = candidates.filter((item) => !diverse.some((d) => d.evidenceId === item.evidenceId));
  const ordered = [...diverse, ...rest];
  return ordered.map(({ evidenceId, excerpt, source }) => ({ evidenceId, excerpt, source }));
}

function sourceDiverseItems(items: readonly PublicEvidenceItem[], limit: number) {
  const selected: PublicEvidenceItem[] = [];
  const sources = new Set<string>();
  for (const item of items) {
    if (sources.has(item.source)) continue;
    selected.push(item);
    sources.add(item.source);
    if (selected.length === limit) break;
  }
  return selected.map(({ evidenceId, excerpt, source }) => ({ evidenceId, excerpt, source }));
}

type OpportunityStat = NonNullable<DashboardRelease["analytics"]>["opportunityStats"][number];

export function candidateSupportLabel(evidenceCount: number, directCount: number, sourceBreadth: number): "Limited candidate support" | "Broad candidate support" {
  return evidenceCount < 50 || directCount === 0 || sourceBreadth < 3 ? "Limited candidate support" : "Broad candidate support";
}

function toPresentation(opportunity: Opportunity, themesById: ReadonlyMap<string, ThemeDefinition>, evidenceById: ReadonlyMap<string, PublicEvidenceItem>, reviewLabel: string, stat?: OpportunityStat): OpportunityPresentation {
  const evidenceCount = stat?.evidenceCount ?? opportunity.evidenceIds.length;
  const directCount = stat?.directCount ?? opportunity.directEvidenceCount;
  const adjacentCount = stat?.adjacentCount ?? opportunity.adjacentEvidenceCount;
  const sourceBreadth = stat?.sourceBreadth ?? Object.values(opportunity.sourceDistribution).filter((count) => count > 0).length;
  const supportLabel = candidateSupportLabel(evidenceCount, directCount, sourceBreadth);
  const weak = opportunity.opportunityId === "shortlist-memory" || supportLabel === "Limited candidate support";
  const validation = validationDesigns[opportunity.opportunityId] ?? {
    experiment: "Prototype the smallest intervention implied by this candidate and test the decision task with target participants before implementation.",
    metric: "Improved task completion and decision confidence without adding avoidable steps.",
  };
  const journeyStages = [...new Set(opportunity.themeIds.flatMap((id) => themesById.get(id)?.journeyStages ?? []))];
  const controlCandidates = opportunity.themeIds.flatMap((id) => themesById.get(id)?.contradictoryEvidenceIds ?? []).flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });

  return {
    opportunityId: opportunity.opportunityId,
    name: opportunity.name,
    description: opportunity.description,
    adjustedScore: stat?.adjustedScore ?? opportunity.adjustedScore,
    baseScore: opportunity.baseScore,
    evidenceCount,
    directEvidenceCount: directCount,
    adjacentEvidenceCount: adjacentCount,
    sourceDistribution: opportunity.sourceDistribution,
    sourceBreadth,
    supportLabel,
    themeIds: opportunity.themeIds,
    journeyStages,
    affectedProductOutcomes: opportunity.affectedProductOutcomes,
    workarounds: opportunity.workaroundSummary,
    limitations: opportunity.limitations,
    interviewQuestions: opportunity.interviewQuestions,
    excerpts: sourceDiverseExcerpts(opportunity, evidenceById),
    controlEvidence: sourceDiverseItems(controlCandidates, 3),
    experiment: validation.experiment,
    successMetric: validation.metric,
    solvability: stat?.nonMonetarySolvability ?? opportunity.scoreInputs.nonMonetarySolvability,
    reviewLabel: stat?.reviewState === "reviewed" ? "Human reviewed" : reviewLabel,
    weak,
  };
}

export default async function OpportunitiesPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;

  const evidence = await readPublicEvidence(result);
  const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  const themesById = new Map(result.release.themes.map((theme) => [theme.themeId, theme]));
  const opportunityStats = new Map(result.release.analytics?.opportunityStats.map((stat) => [stat.opportunityId, stat]) ?? []);
  const reviewLabel = result.mode === "fixtures" ? "Demo data" : result.mode === "provisional" ? "Evidence-derived" : "Human-reviewed";
  const opportunities = result.release.opportunities.map((opportunity) => toPresentation(opportunity, themesById, evidenceById, reviewLabel, opportunityStats.get(opportunity.opportunityId))).sort((a, b) => b.adjustedScore - a.adjustedScore);

  return (
    <>
      <PageHeader eyebrow="Discovery Engine" title="Opportunities" description="Compare evidence-backed product opportunities, inspect their support, and turn the strongest candidates into focused interviews and experiments." />
      <DataNotice mode={result.mode} />
      {opportunities.length ? <OpportunityExplorer opportunities={opportunities} /> : <SectionCard><EmptyPanel icon={Sparkles} title="No opportunity candidates yet" description="Opportunity comparison appears after relevant evidence is linked to candidate themes and scored with visible inputs." detail="No fallback or invented ranking is shown." /></SectionCard>}
    </>
  );
}
