"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  MessageSquareQuote,
  Target,
} from "lucide-react";

import { cn } from "@/lib/cn";

export interface OpportunityEvidenceExcerpt {
  evidenceId: string;
  excerpt: string;
  source: string;
}

export interface OpportunityPresentation {
  opportunityId: string;
  name: string;
  description: string;
  adjustedScore: number;
  baseScore: number;
  evidenceCount: number;
  directEvidenceCount: number;
  adjacentEvidenceCount: number;
  sourceDistribution: Record<string, number>;
  sourceBreadth: number;
  supportLabel: "Broad candidate support" | "Limited candidate support";
  themeIds: string[];
  journeyStages: string[];
  affectedProductOutcomes: string[];
  workarounds: string[];
  limitations: string[];
  interviewQuestions: string[];
  excerpts: OpportunityEvidenceExcerpt[];
  controlEvidence: OpportunityEvidenceExcerpt[];
  experiment: string;
  successMetric: string;
  solvability: number;
  reviewLabel: string;
  weak: boolean;
}

const sourceLabels: Record<string, string> = {
  google_play: "Google Play",
  app_store: "App Store",
  youtube: "YouTube",
  reddit: "Reddit",
};

const sourceColors: Record<string, string> = {
  google_play: "bg-emerald-500",
  app_store: "bg-sky-500",
  youtube: "bg-red-500",
  reddit: "bg-orange-500",
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function SourceMix({ opportunity }: { opportunity: OpportunityPresentation }) {
  const sources = Object.entries(opportunity.sourceDistribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
        aria-label={`${opportunity.sourceBreadth} supporting sources`}
      >
        {sources.map(([source, count]) => (
          <span
            key={source}
            className={cn("h-full", sourceColors[source] ?? "bg-slate-400")}
            style={{ width: `${(count / opportunity.evidenceCount) * 100}%` }}
            title={`${sourceLabels[source] ?? humanize(source)}: ${count.toLocaleString()}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {sources.map(([source, count]) => (
          <Link
            key={source}
            href={`/evidence?source=${encodeURIComponent(source)}&theme=${encodeURIComponent(opportunity.themeIds[0] ?? "")}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-pink-700"
          >
            <span className={cn("size-2 rounded-full", sourceColors[source] ?? "bg-slate-400")} />
            {sourceLabels[source] ?? humanize(source)} {count.toLocaleString()}
          </Link>
        ))}
      </div>
    </div>
  );
}

const EXCERPTS_PER_PAGE = 6;

export function OpportunityExplorer({ opportunities }: { opportunities: OpportunityPresentation[] }) {
  const [selectedId, setSelectedId] = useState(opportunities[0]?.opportunityId ?? "");
  const [evidencePage, setEvidencePage] = useState(0);
  const selected = opportunities.find((item) => item.opportunityId === selectedId) ?? opportunities[0];

  function selectOpportunity(id: string) {
    setSelectedId(id);
    setEvidencePage(0);
  }

  if (!selected) return null;
  const selectedRank = opportunities.findIndex((item) => item.opportunityId === selected.opportunityId) + 1;

  return (
    <div className="space-y-5">
      <section className="surface-card" aria-labelledby="opportunity-ranking-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Candidate comparison</p>
            <h2 id="opportunity-ranking-title" className="section-title mt-1">Ranked opportunities</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Compare evidence support, source breadth and solvability. Scores prioritize what to validate next; they are not impact forecasts.
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Select a row to inspect the evidence</p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Rank / opportunity</th>
                <th className="px-3 py-3 text-right">Score</th>
                <th className="px-3 py-3 text-right">Evidence</th>
                <th className="px-3 py-3 text-right">Direct / adjacent</th>
                <th className="px-3 py-3 text-right">Sources</th>
                <th className="px-3 py-3 text-right">Solvability</th>
                <th className="px-4 py-3">Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {opportunities.map((opportunity, index) => {
                const active = opportunity.opportunityId === selected.opportunityId;
                return (
                  <tr key={opportunity.opportunityId} className={cn(active ? "bg-pink-50/70" : "bg-white hover:bg-slate-50")}>
                    <td className="p-0">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectOpportunity(opportunity.opportunityId)}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pink-600"
                      >
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-black", active ? "bg-pink-600 text-white" : "bg-slate-100 text-slate-600")}>{index + 1}</span>
                        <span className="font-bold text-slate-900">{opportunity.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-4 text-right font-black tabular-nums text-slate-950">{opportunity.adjustedScore.toFixed(1)}</td>
                    <td className="px-3 py-4 text-right font-bold tabular-nums text-slate-700">{opportunity.evidenceCount.toLocaleString()}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-600">{opportunity.directEvidenceCount} / {opportunity.adjacentEvidenceCount.toLocaleString()}</td>
                    <td className="px-3 py-4 text-right font-semibold text-slate-700">{opportunity.sourceBreadth}</td>
                    <td className="px-3 py-4 text-right font-semibold text-slate-700">{opportunity.solvability}/100</td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-black", opportunity.weak ? "bg-amber-100 text-amber-900" : "bg-violet-100 text-violet-900")}>{opportunity.supportLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card overflow-hidden" aria-live="polite">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">Score {selected.adjustedScore.toFixed(1)}</span>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-black text-pink-900">Interview priority {selectedRank}</span>
              <span className={cn("rounded-full px-3 py-1 text-xs font-black", selected.weak ? "bg-amber-100 text-amber-900" : "bg-violet-100 text-violet-900")}>{selected.supportLabel}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{selected.reviewLabel}</span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{selected.name}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{selected.description}</p>

            {selected.weak ? (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <p><strong>Weak signal:</strong> only {selected.evidenceCount} adjacent records and no direct wishlist evidence support this candidate. Validate the problem before considering a solution.</p>
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Source coverage</p>
              <div className="mt-3"><SourceMix opportunity={selected} /></div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Candidate evidence</p><p className="mt-1 text-xl font-black text-slate-950">{selected.evidenceCount.toLocaleString()}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Direct / adjacent</p><p className="mt-1 text-xl font-black text-slate-950">{selected.directEvidenceCount} / {selected.adjacentEvidenceCount.toLocaleString()}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Source breadth</p><p className="mt-1 text-xl font-black text-slate-950">{selected.sourceBreadth} of 4</p></div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Candidate themes</h3>
                <div className="mt-2 flex flex-wrap gap-2">{selected.themeIds.map((theme) => <Link key={theme} href={`/themes#${theme}`} className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-800 hover:bg-pink-100">{humanize(theme)}</Link>)}</div>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Journey stages</h3>
                <div className="mt-2 flex flex-wrap gap-2">{selected.journeyStages.map((stage) => <Link key={stage} href={`/evidence?journey=${encodeURIComponent(stage)}`} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800 hover:bg-violet-100">{humanize(stage)}</Link>)}</div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-black text-slate-900">Outcome hypothesis</h3>
              <p className="mt-1 text-xs text-slate-500">Directional product outcomes to test—not measured conversion claims.</p>
              <div className="mt-2 flex flex-wrap gap-2">{selected.affectedProductOutcomes.map((outcome) => <span key={outcome} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{humanize(outcome)}</span>)}</div>
            </div>

            <div className="mt-7">
              <div className="flex items-end justify-between gap-3">
                <div><h3 className="text-sm font-black text-slate-900">Representative evidence</h3><p className="mt-1 text-xs text-slate-500">Source-diverse excerpts from the support set · {selected.excerpts.length} total</p></div>
                <Link href={`/evidence?theme=${encodeURIComponent(selected.themeIds[0] ?? "")}`} className="inline-flex items-center gap-1 text-xs font-black text-pink-700 hover:text-pink-900">Explore all <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
              </div>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(selected.excerpts.length / EXCERPTS_PER_PAGE));
                const page = Math.min(evidencePage, totalPages - 1);
                const start = page * EXCERPTS_PER_PAGE;
                const pageItems = selected.excerpts.slice(start, start + EXCERPTS_PER_PAGE);
                return (
                  <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {pageItems.map((item) => (
                        <Link key={item.evidenceId} href={`/evidence?id=${encodeURIComponent(item.evidenceId)}`} className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-pink-300 hover:shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-wider text-pink-700">{sourceLabels[item.source] ?? humanize(item.source)}</p>
                          <blockquote className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">&ldquo;{item.excerpt}&rdquo;</blockquote>
                          <p className="mt-3 text-[11px] font-bold text-slate-400 group-hover:text-pink-700">Open evidence {item.evidenceId}</p>
                        </Link>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between">
                        <button type="button" disabled={page === 0} onClick={() => setEvidencePage((p) => Math.max(0, p - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          <ChevronLeft aria-hidden="true" className="size-3.5" /> Previous
                        </button>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">Page {page + 1} of {totalPages}</span>
                        <button type="button" disabled={page >= totalPages - 1} onClick={() => setEvidencePage((p) => Math.min(totalPages - 1, p + 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                          Next <ChevronRight aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-pink-300"><FlaskConical aria-hidden="true" className="size-4" />Suggested validation experiment</div>
              <p className="mt-3 text-sm leading-6 text-slate-200">{selected.experiment}</p>
              <div className="mt-4 rounded-xl bg-white/10 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Success signal</p><p className="mt-1 text-sm font-bold text-white">{selected.successMetric}</p></div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2"><MessageSquareQuote aria-hidden="true" className="size-4 text-pink-600" /><h3 className="text-sm font-black text-slate-900">Interview questions</h3></div>
              <ol className="mt-3 space-y-3">{selected.interviewQuestions.map((question, index) => <li key={question} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="font-black text-pink-600">{index + 1}</span><span>{question}</span></li>)}</ol>
            </div>

            {selected.workarounds.length ? <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-2"><Target aria-hidden="true" className="size-4 text-violet-600" /><h3 className="text-sm font-black text-slate-900">Observed workaround</h3></div><ul className="mt-3 space-y-2">{selected.workarounds.map((item) => <li key={item} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-500" />{item}</li>)}</ul></div> : null}

            {selected.controlEvidence.length ? <div className="rounded-2xl border border-slate-200 p-5"><h3 className="text-sm font-black text-slate-900">Positive or contrasting controls</h3><p className="mt-1 text-xs leading-5 text-slate-500">Possible counter-signals from related themes; human review must distinguish positive outcomes from contradictions.</p><div className="mt-3 space-y-2">{selected.controlEvidence.map((item) => <Link key={item.evidenceId} href={`/evidence?id=${encodeURIComponent(item.evidenceId)}`} className="block rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 hover:bg-pink-50"><strong className="text-slate-800">{sourceLabels[item.source] ?? humanize(item.source)}:</strong> {item.excerpt}</Link>)}</div></div> : null}

            <details className="rounded-2xl border border-amber-200 bg-amber-50 p-5" open>
              <summary className="cursor-pointer text-sm font-black text-amber-950">Limitations and claim boundary</summary>
              <ul className="mt-3 space-y-2">{selected.limitations.map((item) => <li key={item} className="text-xs leading-5 text-amber-900">• {item}</li>)}</ul>
            </details>
          </aside>
        </div>
      </section>
    </div>
  );
}
