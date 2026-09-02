import { AlertTriangle, ArrowRight, BookmarkCheck, MessageSquareQuote, SearchCheck, Star } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { HorizontalBarChart, RatingBars, SegmentedBar, SOURCE_COLORS, formatNumber, titleCase } from "@/components/charts/analytics-charts";
import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { SectionCard } from "@/components/ui/section-card";
import { readPublicEvidence } from "@/lib/data/evidence-reader";
import { loadActiveRelease } from "@/lib/data/release-loader";
import type { SourceId } from "@/lib/schemas";

const SOURCE_ORDER: SourceId[] = ["google_play", "app_store", "youtube", "reddit"];
const SOURCE_LABELS: Partial<Record<SourceId, string>> = { google_play: "Google Play", app_store: "App Store", youtube: "YouTube", reddit: "Reddit" };

function percent(value: number): string { return `${(value * 100).toFixed(value < 0.1 ? 2 : 1)}%`; }
function evidenceHref(key: string, value: string): string { return `/evidence?${new URLSearchParams([[key, value]]).toString()}`; }

export default async function HomePage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;
  const { release, mode } = result;
  const analytics = release.analytics;
  const evidence = analytics ? await readPublicEvidence(result) : [];
  const excerpts = SOURCE_ORDER.flatMap((source) => {
    const sourceItems = evidence.filter((item) => item.source === source);
    const item = sourceItems.find((candidate) => candidate.relevance === "direct_wishlist" || candidate.relevance === "journey_adjacent") ?? sourceItems[0];
    return item ? [item] : [];
  });
  const relevant = analytics?.denominators.candidateRelevant ?? 0;
  const averageStoreRating = analytics && analytics.denominators.ratedStoreEvidence > 0
    ? analytics.sourceMetrics.reduce((total, source) => total + (source.averageRating ?? 0) * source.ratingCount, 0) / analytics.denominators.ratedStoreEvidence
    : null;
  const directWishlist = analytics?.sourceMetrics.reduce((total, source) => total + source.directWishlistCount, 0) ?? 0;
  const ratingGroups = SOURCE_ORDER.flatMap((source) => {
    const ratings = analytics?.ratingDistribution.filter((item) => item.source === source).map((item) => ({ rating: item.rating, count: item.count, href: `/evidence?source=${source}&rating=${item.rating}` })) ?? [];
    return ratings.length ? [{ source, ratings }] : [];
  });
  const opportunityStats = (analytics?.opportunityStats ?? [])
    .map((stat) => ({ ...stat, opportunity: release.opportunities.find((item) => item.opportunityId === stat.opportunityId) }))
    .filter((item) => item.opportunity)
    .sort((a, b) => b.adjustedScore - a.adjustedScore).slice(0, 3);

  return (
    <>
      <PageHeader eyebrow="Myntra Discovery Engine · Overview" title="Where shopping confidence breaks" description="A source-grounded view of the uncertainty, risk, and decision effort that can keep still-interested Myntra shoppers from progressing a saved product." />
      <DataNotice mode={mode} />

      {!analytics ? (
        <SectionCard title={mode === "empty" ? "No evidence release yet" : "Analytics unavailable"} description={mode === "empty" ? "Activate a populated release to see source coverage, candidate barriers, ratings, and opportunities." : "This release predates the analytics contract. Rebuild it to populate this presentation."}>
          <div className="empty-panel min-h-56"><SearchCheck className="size-8 text-slate-400" aria-hidden="true" /><p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">The interface keeps unknown values unknown—no demonstration number is substituted for missing research evidence.</p></div>
        </SectionCard>
      ) : (
        <>
          <div className="mb-2 flex items-end justify-between"><div><p className="eyebrow">Evidence coverage</p><h2 className="mt-1 text-lg font-black text-slate-950">Sources analyzed</h2></div><p className="hidden text-xs text-slate-500 sm:block">Select a source to inspect its evidence</p></div>
          <section className="source-strip" aria-label="Sources analyzed">
            {SOURCE_ORDER.map((source) => {
              const metric = analytics.sourceMetrics.find((item) => item.source === source);
              if (!metric) return null;
              return <Link key={source} href={evidenceHref("source", source)} className="source-card" style={{ "--source-color": SOURCE_COLORS[source] } as CSSProperties}><span className="source-dot" aria-hidden="true" /><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{SOURCE_LABELS[source] ?? titleCase(source)}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-950">{formatNumber(metric.canonicalCount)}</p></div><p className="ml-auto text-right text-xs font-semibold text-slate-500">{metric.averageRating !== null ? <><strong className="text-slate-800">{metric.averageRating.toFixed(2)}★</strong><br />average rating</> : <><strong className="text-slate-800">{percent(metric.relevanceRate)}</strong><br />candidate-relevant</>}</p></Link>;
            })}
          </section>

          <section aria-label="Corpus highlights" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Evidence units", value: formatNumber(analytics.denominators.corpus), helper: "Canonical public evidence", icon: MessageSquareQuote },
              { label: "Candidate signals", value: formatNumber(relevant), helper: "Direct + journey-adjacent", icon: SearchCheck },
              { label: "Candidate relevance", value: percent(analytics.denominators.corpus ? relevant / analytics.denominators.corpus : 0), helper: `of ${formatNumber(analytics.denominators.corpus)} units`, icon: BookmarkCheck },
              { label: "Store rating", value: averageStoreRating === null ? "—" : `${averageStoreRating.toFixed(2)}★`, helper: `${formatNumber(analytics.denominators.ratedStoreEvidence)} rated reviews`, icon: Star },
              { label: "Direct wishlist", value: formatNumber(directWishlist), helper: "Explicit wishlist signals", icon: BookmarkCheck },
            ].map(({ label, value, helper, icon: Icon }) => <article key={label} className="insight-metric"><Icon aria-hidden="true" className="size-4 text-pink-600" /><p className="mt-5 text-2xl font-black tabular-nums text-slate-950">{value}</p><h2 className="mt-1 text-xs font-bold text-slate-700">{label}</h2><p className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</p></article>)}
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
            <SectionCard title="What creates decision friction" description={`Candidate barriers ranked within ${formatNumber(relevant)} decision-related signals.`} action={<Link href="/analytics" className="text-xs font-bold text-pink-700">Explore analytics →</Link>}><HorizontalBarChart data={analytics.barrierStats.slice(0, 5).map((item) => ({ key: item.barrier, label: titleCase(item.barrier), value: item.count, helper: `${percent(item.relevantShare)} of candidate-relevant evidence · ${item.sourceCount} sources`, href: evidenceHref("barrier", item.barrier) }))} /></SectionCard>
            <SectionCard title="Corpus composition" description="The release-wide denominator is shown for every candidate label."><SegmentedBar denominator={analytics.denominators.corpus} data={release.relevanceDistribution.map((item) => ({ key: item.key, label: titleCase(item.key), value: item.count, href: evidenceHref("relevance", item.key) }))} /></SectionCard>
          </div>

          {ratingGroups.length ? <SectionCard title="Store rating distribution" description={`Only Google Play and App Store ratings are combined; unrated sources are excluded. Rated denominator: ${formatNumber(analytics.denominators.ratedStoreEvidence)}.`} className="mt-5"><RatingBars distributions={ratingGroups} /></SectionCard> : null}

          <SectionCard title="Highest-priority candidate opportunities" description="A comparison of evidence support, source breadth, and the existing offline opportunity score." className="mt-5" action={<Link href="/opportunities" className="text-xs font-bold text-pink-700">Compare all opportunities →</Link>}>
            <div className="grid gap-3 lg:grid-cols-3">{opportunityStats.map((item, index) => <Link key={item.opportunityId} href={`/opportunities?opportunity=${encodeURIComponent(item.opportunityId)}`} className="opportunity-preview"><div className="flex items-center justify-between"><span className="rank-badge">#{index + 1}</span><span className="text-lg font-black tabular-nums text-pink-700">{item.adjustedScore.toFixed(1)}</span></div><h3 className="mt-5 text-base font-black text-slate-950">{item.opportunity?.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.opportunity?.description}</p><dl className="mt-5 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-400">Evidence</dt><dd className="mt-1 font-black text-slate-800">{formatNumber(item.evidenceCount)}</dd></div><div><dt className="text-slate-400">Source breadth</dt><dd className="mt-1 font-black text-slate-800">{item.sourceBreadth} of 4</dd></div></dl><span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-pink-700">Interview priority <ArrowRight className="size-3.5" aria-hidden="true" /></span></Link>)}</div>
          </SectionCard>

          {excerpts.length ? <SectionCard title="Evidence from every source" description="Source-balanced excerpts keep the aggregate story traceable to individual public signals." className="mt-5" action={<Link href="/evidence" className="text-xs font-bold text-pink-700">Open Evidence Explorer →</Link>}><div className="grid gap-3 lg:grid-cols-2">{excerpts.map((item) => <Link key={item.evidenceId} href={`/evidence?id=${encodeURIComponent(item.evidenceId)}`} className="evidence-quote"><div className="flex items-center justify-between gap-2"><span className="source-chip"><span className="size-1.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[item.source] }} />{SOURCE_LABELS[item.source] ?? titleCase(item.source)}</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{titleCase(item.relevance)}</span></div><blockquote className="mt-4 line-clamp-4 text-sm leading-6 text-slate-700">“{item.excerpt}”</blockquote><p className="mt-4 text-xs font-bold text-pink-700">View evidence →</p></Link>)}</div></SectionCard> : null}

          <aside className="limitation-card" aria-label="How to read this data"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" /><div><h2 className="font-black text-slate-900">How to read these insights</h2><p className="mt-1 text-sm leading-6 text-slate-600">These signals are derived from {formatNumber(analytics.denominators.corpus)} public evidence units across 4 sources. They highlight where shoppers experience friction — not population-wide conversion metrics. Use them to prioritize investigation areas and interview targets.</p><Link href="/methodology" className="mt-3 inline-flex text-xs font-bold text-pink-700">See full methodology →</Link></div></aside>
        </>
      )}
    </>
  );
}
