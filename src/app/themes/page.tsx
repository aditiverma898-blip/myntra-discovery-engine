import type { Metadata } from "next";
import { Layers3 } from "lucide-react";

import { ThemeCatalog, type ThemeEvidenceExcerpt, type ThemePresentation } from "@/components/themes/theme-catalog";
import { DataNotice } from "@/components/ui/data-notice";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { SectionCard } from "@/components/ui/section-card";
import { readPublicEvidence, type PublicEvidenceItem } from "@/lib/data/evidence-reader";
import { loadActiveRelease } from "@/lib/data/release-loader";
import type { DashboardRelease, DataMode, ThemeDefinition } from "@/lib/schemas";

export const metadata: Metadata = { title: "Themes" };

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function severityOf(item: PublicEvidenceItem): number | null {
  const candidate = item as PublicEvidenceItem & { severity?: unknown };
  return typeof candidate.severity === "number" ? candidate.severity : null;
}

function sourceDiverseEvidence(items: readonly PublicEvidenceItem[], limit: number): ThemeEvidenceExcerpt[] {
  const selected: PublicEvidenceItem[] = [];
  const seenSources = new Set<string>();
  for (const item of items) {
    if (seenSources.has(item.source)) continue;
    selected.push(item);
    seenSources.add(item.source);
    if (selected.length === limit) break;
  }
  for (const item of items) {
    if (selected.some((selectedItem) => selectedItem.evidenceId === item.evidenceId)) continue;
    selected.push(item);
    if (selected.length === limit) break;
  }
  return selected.map(({ evidenceId, excerpt, source }) => ({ evidenceId, excerpt, source }));
}

type ThemeStat = NonNullable<DashboardRelease["analytics"]>["themeStats"][number];

function definedCountRecord(record: Record<string, number | undefined>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, number] => entry[1] !== undefined));
}

function buildTheme(theme: ThemeDefinition, evidence: readonly PublicEvidenceItem[], evidenceById: ReadonlyMap<string, PublicEvidenceItem>, relevantDenominator: number, mode: DataMode, stat?: ThemeStat): ThemePresentation | null {
  const support = evidence.filter((item) => item.themeIds.includes(theme.themeId));
  const supportCount = stat?.supportCount ?? support.length;
  if (supportCount === 0) return null;

  const sourceDistribution: Record<string, number> = {};
  const journeyDistribution: Record<string, number> = {};
  const barrierDistribution: Record<string, number> = {};
  const severities: number[] = [];
  for (const item of support) {
    increment(sourceDistribution, item.source);
    item.journeyStages.forEach((stage) => increment(journeyDistribution, stage));
    item.barrierIds.forEach((barrier) => increment(barrierDistribution, barrier));
    const severity = severityOf(item);
    if (severity !== null) severities.push(severity);
  }

  const preferredRepresentatives = (stat?.representativeEvidenceIds ?? theme.representativeEvidenceIds).flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });
  const control = (stat?.controlEvidenceIds ?? theme.contradictoryEvidenceIds).flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });
  return {
    themeId: theme.themeId,
    name: theme.name,
    barrierOrNeed: theme.barrierOrNeed,
    supportCount,
    relevantDenominator: Math.max(relevantDenominator, 1),
    directCount: stat?.directCount ?? support.filter((item) => item.relevance === "direct_wishlist").length,
    adjacentCount: stat?.adjacentCount ?? support.filter((item) => item.relevance === "journey_adjacent").length,
    averageSeverity: stat?.averageSeverity ?? (severities.length ? severities.reduce((total, value) => total + value, 0) / severities.length : null),
    sourceDistribution: stat ? definedCountRecord(stat.sourceDistribution) : sourceDistribution,
    sourceBreadth: Object.keys(stat ? definedCountRecord(stat.sourceDistribution) : sourceDistribution).length,
    journeyDistribution: stat ? definedCountRecord(stat.journeyStageDistribution) : journeyDistribution,
    barrierDistribution,
    labelConfidence: theme.confidence,
    reviewLabel: mode === "fixtures" ? "Synthetic label" : mode === "provisional" ? "Human review pending" : theme.status === "reviewed" ? "Human reviewed" : "Candidate label",
    representativeEvidence: sourceDiverseEvidence([...preferredRepresentatives, ...support], 12),
    controlEvidence: sourceDiverseEvidence(control, 3),
  };
}

export default async function ThemesPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;

  const evidence = await readPublicEvidence(result);
  const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  const relevantDenominator = result.release.analytics?.denominators.candidateRelevant ?? result.release.relevanceDistribution.filter((entry) => entry.key === "direct_wishlist" || entry.key === "journey_adjacent").reduce((total, entry) => total + entry.count, 0);
  const themeStats = new Map(result.release.analytics?.themeStats.map((stat) => [stat.themeId, stat]) ?? []);
  const themes = result.release.themes.map((theme) => buildTheme(theme, evidence, evidenceById, relevantDenominator, result.mode, themeStats.get(theme.themeId))).filter((theme): theme is ThemePresentation => theme !== null).sort((a, b) => b.supportCount - a.supportCount);
  const supportedIds = new Set(themes.map((theme) => theme.themeId));
  const hypotheses = result.release.themes.filter((theme) => !supportedIds.has(theme.themeId)).map((theme) => ({ themeId: theme.themeId, name: theme.name, description: theme.barrierOrNeed }));

  return (
    <>
      <PageHeader eyebrow="Pattern intelligence" title="Themes" description="Explore non-zero candidate patterns, their source breadth, decision context, and traceable supporting evidence." />
      <DataNotice mode={result.mode} />
      {themes.length ? <ThemeCatalog themes={themes} hypotheses={hypotheses} /> : <SectionCard><EmptyPanel icon={Layers3} title="No evidence-supported themes" description="Candidate themes appear only when release evidence has non-zero support. Investigation lenses remain hypotheses until records are classified." detail="No zero-count theme is presented as a finding." /></SectionCard>}
    </>
  );
}
