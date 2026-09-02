import type { Metadata } from "next";
import { RotateCcw, Ruler, ScanSearch, ShieldCheck, Tag, Target, UsersRound } from "lucide-react";
import Link from "next/link";

import { formatNumber } from "@/components/charts/analytics-charts";
import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { SectionCard } from "@/components/ui/section-card";
import { loadActiveRelease } from "@/lib/data/release-loader";

export const metadata: Metadata = { title: "Segments" };

const RANK_COLORS = ["#e11d48", "#f97316", "#f59e0b", "#8b5cf6", "#64748b"];

const SEGMENT_DEFINITIONS = [
  {
    id: "reversibility-anxious",
    name: "Reversibility-Anxious Decider",
    icon: RotateCcw,
    barriers: ["return_refund_risk"],
    description: "Revisits a saved item but stalls on \"what if it's wrong and returning it is a nightmare?\"",
    interviewTarget: "Shoppers who saved ≥1 item, revisited 2×+, didn't purchase — hesitated about returns/refunds.",
  },
  {
    id: "product-evidence-seeker",
    name: "Product-Evidence Seeker",
    icon: ScanSearch,
    barriers: ["material_quality_uncertainty", "color_image_mismatch", "review_trust_gap"],
    description: "Wants to know the real material, colour, and quality before committing; distrusts catalog imagery.",
    interviewTarget: "Shoppers who delayed purchase because they couldn't verify product quality from the listing.",
  },
  {
    id: "fit-confidence-seeker",
    name: "Fit-Confidence Seeker",
    icon: Ruler,
    barriers: ["fit_size_uncertainty", "stock_size_unavailability"],
    description: "Interested but unsure the size/silhouette will fit; won't gamble on an exchange.",
    interviewTarget: "Shoppers who hesitated on size — especially across brands with inconsistent sizing.",
  },
  {
    id: "authenticity-trust-sensitive",
    name: "Authenticity / Trust-Sensitive Shopper",
    icon: ShieldCheck,
    barriers: ["authenticity_trust_gap"],
    description: "Doubts genuineness of product or platform; fears receiving a fake or wrong item.",
    interviewTarget: "Shoppers who sought external validation before trusting a product/seller.",
  },
  {
    id: "deal-waiter",
    name: "Deal-Waiter (Price-Sensitive Postponer)",
    icon: Tag,
    barriers: ["price_waiting"],
    description: "Likes the item, waits for a price drop or sale event. Deprioritised — monetary barrier.",
    interviewTarget: "Shoppers who postponed solely for price reasons (lower research priority).",
  },
] as const;

export default async function SegmentsPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;
  const { release, mode } = result;
  const populated = mode !== "empty";
  const barrierStats = release.analytics?.barrierStats ?? [];
  const totalBarrierTagged = barrierStats.reduce((sum, b) => sum + b.count, 0);

  const segments = SEGMENT_DEFINITIONS.map((def, index) => {
    const matchingBarriers = barrierStats.filter((b) => (def.barriers as readonly string[]).includes(b.barrier));
    const count = matchingBarriers.reduce((sum, b) => sum + b.count, 0);
    const share = totalBarrierTagged > 0 ? count / totalBarrierTagged : 0;
    const avgSeverity = matchingBarriers.length > 0
      ? matchingBarriers.reduce((sum, b) => sum + b.averageSeverity * b.count, 0) / count
      : 0;
    return { ...def, count, share, avgSeverity, rank: index + 1, color: RANK_COLORS[index] };
  });

  return (
    <>
      <PageHeader eyebrow="Behavioural cohorts" title="Segments" description="Evidence-derived behavioural segments ranked by barrier prevalence and severity. Shares represent proportion of barrier-tagged evidence, not population-wide statistics." />
      <DataNotice mode={mode} />

      {!populated ? (
        <SectionCard>
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <UsersRound className="size-8 text-slate-400" aria-hidden="true" />
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">Activate a data release to see behavioural segments derived from barrier evidence.</p>
          </div>
        </SectionCard>
      ) : (
        <>
          <section className="surface-card" aria-labelledby="segment-ranking-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Ranked by evidence share</p>
                <h2 id="segment-ranking-title" className="section-title mt-1">Behavioural segments</h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">Based on {formatNumber(totalBarrierTagged)} barrier-tagged evidence units across {barrierStats.length} barriers.</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">% = share of barrier-tagged evidence</p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)_4rem] items-center gap-3 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>#</span>
                <span>Segment</span>
                <span className="text-right">Share</span>
                <span>Distribution</span>
                <span className="text-right">Severity</span>
              </div>
              {segments.map((seg) => {
                const Icon = seg.icon;
                return (
                  <div key={seg.id} className="grid grid-cols-[2rem_minmax(0,1fr)_4.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <span className="grid size-7 place-items-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: seg.color }}>{seg.rank}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon aria-hidden="true" className="size-4 shrink-0" style={{ color: seg.color }} />
                      <span className="truncate text-sm font-bold text-slate-900">{seg.name}</span>
                    </div>
                    <span className="text-right text-sm font-black tabular-nums" style={{ color: seg.color }}>{(seg.share * 100).toFixed(1)}%</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${seg.share * 100}%`, backgroundColor: seg.color }} />
                    </div>
                    <span className="text-right text-sm font-bold tabular-nums text-slate-700">{seg.avgSeverity.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-5 rounded-2xl border-2 border-pink-200 bg-pink-50 p-5">
            <div className="flex items-start gap-4">
              <Target aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pink-700" />
              <div>
                <h2 className="text-sm font-black text-pink-950">Recommended interview target</h2>
                <p className="mt-2 text-sm leading-6 text-pink-900"><strong>{segments[0]!.name}</strong> — largest segment ({(segments[0]!.share * 100).toFixed(1)}%), highest severity ({segments[0]!.avgSeverity.toFixed(2)}), and fully addressable without discounts (return-clarity, confidence messaging, transparency).</p>
                <p className="mt-2 text-xs text-pink-800">Strong alternative: <strong>{segments[1]!.name}</strong> — highest composite opportunity score with clean non-monetary levers.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((seg) => {
              const Icon = seg.icon;
              return (
                <article key={seg.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl" style={{ backgroundColor: `${seg.color}1a` }}>
                      <Icon aria-hidden="true" className="size-5" style={{ color: seg.color }} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: seg.color }}>#{seg.rank}</span>
                        <span className="text-sm font-black text-slate-950 truncate">{seg.name}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{seg.description}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-400">Evidence</dt>
                      <dd className="mt-1 font-black text-slate-900">{formatNumber(seg.count)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Share</dt>
                      <dd className="mt-1 font-black" style={{ color: seg.color }}>{(seg.share * 100).toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Severity</dt>
                      <dd className="mt-1 font-black text-slate-900">{seg.avgSeverity.toFixed(2)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {seg.barriers.map((b) => (
                      <Link key={b} href={`/evidence?barrier=${encodeURIComponent(b)}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-pink-100 hover:text-pink-800">
                        {b.replaceAll("_", " ")}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Interview target</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{seg.interviewTarget}</p>
                  </div>
                </article>
              );
            })}
          </div>

          {release.segments.length > 0 && (
            <SectionCard title="Evidence-supported segments" description="Segments auto-populated by the classification pipeline with linked evidence." className="mt-5">
              <div className="grid gap-3 lg:grid-cols-3">
                {release.segments.map((segment) => (
                  <article key={segment.segmentId} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-950">{segment.name}</h3>
                      <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-black text-pink-800">{segment.evidenceIds.length} units</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{segment.definition}</p>
                    <p className="mt-4 text-xs font-bold text-slate-500">Confidence {segment.confidence === null ? "Not evaluated" : `${Math.round(segment.confidence * 100)}%`}</p>
                  </article>
                ))}
              </div>
            </SectionCard>
          )}

          <aside className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <UsersRound aria-hidden="true" className="size-4 text-violet-600" />
            <p>Segments are behavioural — derived from barrier patterns in public evidence. They are not demographic claims. Use them to recruit interviewees and prioritize research.</p>
          </aside>
        </>
      )}
    </>
  );
}
