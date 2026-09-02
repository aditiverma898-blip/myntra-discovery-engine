"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CoverageChart, Heatmap, HorizontalBarChart, RatingBars, SegmentedBar, StackedSourceBars, formatNumber, titleCase } from "@/components/charts/analytics-charts";
import { SectionCard } from "@/components/ui/section-card";
import type { AnalyticsResponse } from "@/lib/schemas";

const REPEATABLE = ["source", "relevance", "barrier", "journey", "rating"] as const;
type RepeatableKey = (typeof REPEATABLE)[number];

function percentage(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function evidenceHref(entries: readonly [string, string | number][]): string { const params = new URLSearchParams(entries.map(([key, value]) => [key, String(value)])); return `/evidence?${params}`; }
function monthBounds(month: string): { from: string; to: string } { const [yearText = "1970", monthText = "01"] = month.split("-"); const last = new Date(Date.UTC(Number(yearText), Number(monthText), 0)).getUTCDate(); return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` }; }

function FacetPicker({ label, name, options, selected, onToggle }: { label: string; name: RepeatableKey; options: readonly { value: string; count: number }[]; selected: readonly string[]; onToggle: (name: RepeatableKey, value: string) => void }) {
  return <details className="facet-picker"><summary>{label}<span className="facet-count">{selected.length || "All"}</span></summary><div className="facet-menu">{options.length ? options.map((option) => <label key={option.value} className="facet-option"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(name, option.value)} /><span>{titleCase(option.value)}</span><span className="ml-auto tabular-nums text-slate-400">{formatNumber(option.count)}</span></label>) : <p className="px-3 py-2 text-xs text-slate-400">No values available</p>}</div></details>;
}

function Skeleton() { return <div className="grid gap-5"><div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" /><div className="grid gap-5 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" /></div></div>; }

function SearchField({ initialValue, params }: { initialValue: string; params: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (value.trim() === initialValue) return;
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim()); else next.delete("q");
      router.replace(`/analytics${next.size ? `?${next}` : ""}`, { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [initialValue, params, router, value]);
  return <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><label className="sr-only" htmlFor="analytics-search">Search evidence</label><input id="analytics-search" className="text-field pl-9" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search evidence…" /></div>;
}

export function AnalyticsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [responseState, setResponseState] = useState<{ query: string; data: AnalyticsResponse | null; error: string | null }>({ query: "", data: null, error: null });
  const [sourceChartMode, setSourceChartMode] = useState<"count" | "percentage">("count");
  const urlQuery = searchParams.toString();
  const data = responseState.data;
  const error = responseState.query === urlQuery ? responseState.error : null;
  const loading = responseState.query !== urlQuery;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/analytics${urlQuery ? `?${urlQuery}` : ""}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json() as { message?: string }).message ?? "Analytics could not be loaded."); return response.json() as Promise<AnalyticsResponse>; })
      .then((response) => setResponseState({ query: urlQuery, data: response, error: null }))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setResponseState({ query: urlQuery, data: null, error: reason instanceof Error ? reason.message : "Analytics could not be loaded." }); });
    return () => controller.abort();
  }, [urlQuery]);

  const selected = useMemo(() => Object.fromEntries(REPEATABLE.map((key) => [key, searchParams.getAll(key)])) as Record<RepeatableKey, string[]>, [searchParams]);
  function toggleFilter(name: RepeatableKey, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const values = next.getAll(name); next.delete(name);
    const updated = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    updated.forEach((item) => next.append(name, item));
    router.replace(`/analytics${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function setDate(name: "from" | "to", value: string) { const next = new URLSearchParams(searchParams.toString()); if (value) next.set(name, value); else next.delete(name); router.replace(`/analytics${next.size ? `?${next}` : ""}`, { scroll: false }); }

  const monthly = useMemo(() => {
    if (!data) return [];
    const periods = new Map<string, Record<string, number>>();
    for (const item of data.monthlyCoverage) periods.set(item.month, { ...periods.get(item.month), [item.source]: item.count });
    return [...periods].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ period, values }));
  }, [data]);
  const ratingGroups = useMemo(() => data ? [...new Set(data.ratingDistribution.map((item) => item.source))].map((source) => ({ source, ratings: data.ratingDistribution.filter((item) => item.source === source).map(({ rating, count }) => ({ rating, count, href: evidenceHref([["source", source], ["rating", rating]]) })) })) : [], [data]);

  return <>
    <section className="analytics-filterbar" aria-label="Analytics filters">
      <SearchField key={searchParams.get("q") ?? ""} initialValue={searchParams.get("q") ?? ""} params={urlQuery} />
      {data ? <>{REPEATABLE.map((name) => <FacetPicker key={name} name={name} label={name === "source" ? "Sources" : name === "relevance" ? "Relevance" : titleCase(name)} options={data.facets[name]} selected={selected[name]} onToggle={toggleFilter} />)}<label className="date-filter"><span>From</span><input type="date" value={searchParams.get("from") ?? ""} onChange={(event) => setDate("from", event.target.value)} /></label><label className="date-filter"><span>To</span><input type="date" value={searchParams.get("to") ?? ""} onChange={(event) => setDate("to", event.target.value)} /></label></> : null}
      {urlQuery ? <button type="button" className="secondary-button shrink-0" onClick={() => router.replace("/analytics", { scroll: false })}><RotateCcw className="size-3.5" aria-hidden="true" />Reset</button> : null}
    </section>

    {loading ? <Skeleton /> : error ? <div className="release-error mt-5"><SlidersHorizontal className="size-6" aria-hidden="true" /><h2 className="mt-3 font-black">Analytics unavailable</h2><p className="mt-1 text-sm text-slate-600">{error}</p></div> : data?.kpis.evidence === null ? <SectionCard title="No evidence analytics yet" description="Activate a populated release to explore source coverage, candidate barriers, ratings, and journey-stage signals."><div className="empty-panel min-h-56"><p className="max-w-lg text-sm leading-6 text-slate-500">Unknown evidence values remain unavailable; this view does not convert them to zero.</p></div></SectionCard> : data ? <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Filtered analytics highlights">
        {[{ label: "Matching evidence", value: formatNumber(data.kpis.evidence ?? 0), helper: `of ${formatNumber(data.denominators.releaseCorpus ?? 0)} release units` }, { label: "Candidate signals", value: formatNumber(data.kpis.candidateRelevant ?? 0), helper: "Direct + journey-adjacent" }, { label: "Candidate relevance", value: percentage(data.kpis.candidateRelevantRate ?? 0), helper: "Within matching evidence" }, { label: "Store rating", value: data.kpis.averageStoreRating === null ? "—" : `${data.kpis.averageStoreRating.toFixed(2)}★`, helper: `${formatNumber(data.denominators.ratedStoreEvidence ?? 0)} rated matches` }, { label: "Direct wishlist", value: formatNumber(data.kpis.directWishlist ?? 0), helper: "Explicit candidate signals" }].map((item) => <article key={item.label} className="insight-metric"><p className="text-2xl font-black tabular-nums text-slate-950">{item.value}</p><h2 className="mt-2 text-xs font-bold text-slate-700">{item.label}</h2><p className="mt-1 text-[11px] text-slate-500">{item.helper}</p></article>)}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="Source × relevance" description="Candidate composition within each source; labels update with every filter." action={<div className="chart-toggle" aria-label="Chart scale"><button type="button" aria-pressed={sourceChartMode === "count"} onClick={() => setSourceChartMode("count")}>Count</button><button type="button" aria-pressed={sourceChartMode === "percentage"} onClick={() => setSourceChartMode("percentage")}>%</button></div>}><StackedSourceBars percentage={sourceChartMode === "percentage"} rows={data.sourceByRelevance.map((row) => ({ source: row.source, total: row.counts.reduce((sum, item) => sum + item.count, 0), values: row.counts.map((item) => ({ key: item.relevance, value: item.count, href: evidenceHref([["source", row.source], ["relevance", item.relevance]]) })) }))} /></SectionCard>
        <SectionCard title="Collection coverage over time" description="Monthly evidence availability by source—not a measure of customer-behaviour change."><CoverageChart points={monthly} hrefForPoint={(month, source) => { const bounds = monthBounds(month); return evidenceHref([["source", source], ["from", bounds.from], ["to", bounds.to]]); }} /></SectionCard>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <SectionCard title="Candidate barriers" description={`Ranked within ${formatNumber(data.denominators.candidateRelevant ?? 0)} matching candidate-relevant signals.`}><HorizontalBarChart data={data.barrierStats.slice(0, 10).map((item) => ({ key: item.barrier, label: titleCase(item.barrier), value: item.count, helper: `${percentage(item.relevantShare)} · severity ${item.averageSeverity.toFixed(1)}/3 · ${item.sourceCount} sources`, href: evidenceHref([["barrier", item.barrier]]) }))} /></SectionCard>
        <div className="grid gap-5">
          <SectionCard title="Relevance composition" description="Mutually exclusive candidate classification."><SegmentedBar denominator={data.kpis.evidence ?? 0} data={data.relevanceDistribution.map((item) => ({ key: item.key, label: titleCase(item.key), value: item.count, href: evidenceHref([["relevance", item.key]]) }))} /></SectionCard>
          <SectionCard title="Journey stage signals" description="Non-exclusive: one evidence unit may support several stages."><HorizontalBarChart data={data.journeyStageStats.items.slice(0, 8).map((item) => ({ key: item.journeyStage, label: titleCase(item.journeyStage), value: item.count, helper: `${percentage(item.relevantShare)} of candidate signals`, href: evidenceHref([["journey", item.journeyStage]]) }))} /></SectionCard>
        </div>
      </div>
      {ratingGroups.length ? <SectionCard title="Store rating distribution" description="Google Play and App Store only; other sources have no comparable 1–5★ field." className="mt-5"><RatingBars distributions={ratingGroups} /></SectionCard> : null}
      <SectionCard title="Journey stage × barrier" description="True intersections among candidate-relevant evidence; one evidence unit may appear in more than one journey stage." className="mt-5"><Heatmap rows={data.journeyStageStats.items.slice(0, 6).map((item) => item.journeyStage)} columns={data.barrierStats.slice(0, 5).map((item) => item.barrier)} values={Object.fromEntries(data.journeyBarrierMatrix.map((item) => [`${item.journeyStage}:${item.barrier}`, item.count]))} hrefForCell={(journey, barrier) => evidenceHref([["journey", journey], ["barrier", barrier]])} /></SectionCard>
      <SectionCard title="Source coverage" description="Counts, candidate relevance, rating availability, and collection date bounds." className="mt-5"><div className="overflow-x-auto"><table className="analytics-table"><caption className="sr-only">Filtered source coverage</caption><thead><tr><th>Source</th><th>Evidence</th><th>Candidate relevant</th><th>Rating</th><th>Coverage</th></tr></thead><tbody>{data.sourceMetrics.map((item) => <tr key={item.source}><th><Link href={evidenceHref([["source", item.source]])} className="text-pink-700 hover:underline">{titleCase(item.source)}</Link></th><td><Link href={evidenceHref([["source", item.source]])} className="hover:text-pink-700">{formatNumber(item.canonicalCount)}</Link></td><td><Link href={evidenceHref([["source", item.source], ["relevance", "direct_wishlist"], ["relevance", "journey_adjacent"]])} className="hover:text-pink-700">{formatNumber(item.relevantCount)} <span>· {percentage(item.relevanceRate)}</span></Link></td><td>{item.averageRating === null ? "Not applicable" : `${item.averageRating.toFixed(2)}★ across ${formatNumber(item.ratingCount)}`}</td><td>{item.coverageFrom ? new Date(item.coverageFrom).toLocaleDateString("en-IN") : "Unknown"} – {item.coverageTo ? new Date(item.coverageTo).toLocaleDateString("en-IN") : "Unknown"}</td></tr>)}</tbody></table></div></SectionCard>
      <SectionCard title="Candidate behavioural cohort" description="Only cohorts with supporting evidence appear as findings." className="mt-5">{(data.facets.segment.find((item) => item.value === "active-confidence-seeker")?.count ?? 0) > 0 ? <div className="cohort-card"><div><p className="eyebrow">Evidence-supported candidate</p><h3 className="mt-2 text-lg font-black text-slate-950">Active Confidence Seeker</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A candidate behaviour pattern in which shoppers continue researching product, fit, authenticity, or return risk before progressing a decision.</p></div><div className="cohort-number"><strong>{formatNumber(data.facets.segment.find((item) => item.value === "active-confidence-seeker")?.count ?? 0)}</strong><span>candidate units in this filtered view</span></div></div> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No supported behavioural cohort matches the active filters.</p>}<details className="hypothesis-disclosure"><summary>Research hypotheses without current support</summary><p>Still-interested wishlist revisitor and risk-sensitive decider remain interview-recruitment hypotheses until independently reviewed evidence supports them.</p></details></SectionCard>
    </> : null}
  </>;
}
