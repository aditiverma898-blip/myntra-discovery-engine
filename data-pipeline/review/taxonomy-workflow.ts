import type { LexicalThemeCluster } from "../stages/theme-discovery";
import { taxonomyDecisionSchema } from "../../src/lib/schemas/production-pipeline";

export interface TaxonomyCandidate {
  candidateThemeId: string;
  proposedName: string;
  evidenceIds: string[];
  topTerms: string[];
  status: "candidate_new_theme";
}

export function createTaxonomyCandidates(clusters: readonly LexicalThemeCluster[]): TaxonomyCandidate[] {
  return clusters.map((cluster) => ({ candidateThemeId: cluster.clusterId, proposedName: cluster.label, evidenceIds: [...cluster.evidenceIds], topTerms: [...cluster.topTerms], status: "candidate_new_theme" }));
}

export function applyTaxonomyDecisions(candidates: readonly TaxonomyCandidate[], rawDecisions: readonly unknown[]): Array<TaxonomyCandidate & { finalThemeIds: string[]; finalName: string }> {
  const decisions = rawDecisions.map((value) => taxonomyDecisionSchema.parse(value));
  const byId = new Map(decisions.map((decision) => [decision.candidateThemeId, decision]));
  return candidates.flatMap((candidate) => {
    const decision = byId.get(candidate.candidateThemeId);
    if (!decision || decision.action === "reject") return [];
    return [{ ...candidate, finalThemeIds: decision.targetThemeIds.length ? decision.targetThemeIds : [candidate.candidateThemeId.replace(/^lexical-/u, "")], finalName: decision.finalName ?? candidate.proposedName }];
  });
}
