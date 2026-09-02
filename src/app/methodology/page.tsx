import type { Metadata } from "next";
import {
  BadgeCheck,
  Ban,
  BookOpenCheck,
  Clock3,
  Fingerprint,
  FlaskConical,
} from "lucide-react";

import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { SectionCard } from "@/components/ui/section-card";
import { loadActiveRelease } from "@/lib/data/release-loader";

export const metadata: Metadata = { title: "Methodology" };

const stages = [
  ["Collect / import", "Use only approved Myntra-specific routes with recorded limits, provenance, selection method, and retention."],
  ["Normalize / minimize", "Standardize text and dates, remove unnecessary identity fields, validate URLs, and preserve discovery routes."],
  ["Deduplicate", "Create stable content hashes and canonical groups so cross-query hits do not inflate analytical counts."],
  ["Gate relevance", "Separate direct wishlist, journey-adjacent, general, and irrelevant records before theme analysis."],
  ["Discover themes", "Use a source-balanced sample for open-ended discovery, then review, merge, split, and define taxonomy rules."],
  ["Classify and review", "Apply versioned multi-label classification, retain confidence and method, and route sensitive cases to humans."],
  ["Aggregate and publish", "Reproduce metrics from evidence, expose denominators and limitations, validate references, then promote atomically."],
] as const;

export default async function MethodologyPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;
  const provisional = result.mode === "provisional";

  return (
    <>
      <PageHeader eyebrow="How the engine works" title="Methodology" description="A reproducible, evidence-first system for narrowing a product problem—not a claim that public comments represent all Myntra shoppers." />
      <DataNotice mode={result.mode} />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="surface-card lg:col-span-2">
          <p className="eyebrow">Research contract</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">From public signal to reviewable product evidence</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">The engine investigates barriers for still-interested wishlist revisitors. It does not infer causality, population prevalence, conversion impact, or a final MVP from public data alone.</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-pink-50 p-4"><dt className="text-[10px] font-bold uppercase tracking-wider text-pink-700">Business metric</dt><dd className="mt-2 text-sm font-bold leading-6 text-pink-950">Purchase within 30 days of wishlist add</dd></div>
            <div className="rounded-xl bg-violet-50 p-4"><dt className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Product scope</dt><dd className="mt-2 text-sm font-bold leading-6 text-violet-950">Myntra only</dd></div>
            <div className="rounded-xl bg-orange-50 p-4"><dt className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Primary constraint</dt><dd className="mt-2 text-sm font-bold leading-6 text-orange-950">Non-monetary solvability</dd></div>
          </dl>
        </section>
        <section className="rounded-2xl bg-slate-950 p-6 text-white">
          <Fingerprint aria-hidden="true" className="size-6 text-pink-400" />
          <h2 className="mt-5 text-lg font-bold">Unit of evidence</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">One canonical, minimized review, post, comment, or approved observation—with source, date, query, selection, and label provenance retained.</p>
          <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">Unknown = null, never invented</p>
        </section>
      </div>

      <SectionCard title="Seven-stage evidence pipeline" description="Every material method and version is recorded in the immutable release." className="mt-5">
        <ol className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {stages.map(([title, description], index) => (
            <li key={title} className="method-step" data-step={String(index + 1)}><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-600">{description}</p></li>
          ))}
        </ol>
      </SectionCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionCard title="How signals are validated" action={<FlaskConical aria-hidden="true" className="size-5 text-violet-600" />}>
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <p><strong className="text-slate-900">Automated classification</strong> applies schema validation, minimization, source-bounded deduplication, and deterministic labelling. Signals at this level are suitable for exploration, interview planning, and prioritization.</p>
            <p><strong className="text-slate-900">Human review</strong> adds independent label verification, taxonomy approval, contradiction checks, and privacy review before a signal is promoted to a validated finding.</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-violet-50 p-4"><dt className="text-[10px] font-black uppercase tracking-wider text-violet-700">Human reviewed</dt><dd className="mt-2 text-xl font-black text-violet-950">{result.release.analytics?.denominators.humanReviewed ?? 0}</dd></div>
              <div className="rounded-xl bg-slate-100 p-4"><dt className="text-[10px] font-black uppercase tracking-wider text-slate-600">Release state</dt><dd className="mt-2 text-xl font-black capitalize text-slate-950">{result.release.status}</dd></div>
            </dl>
          </div>
        </SectionCard>
        <SectionCard title="Data scope & limitations" action={<Clock3 aria-hidden="true" className="size-5 text-amber-600" />}>
          <p className="text-sm leading-6 text-slate-600">The corpus contains public evidence from 4 sources. Direct wishlist signals are sparse (&lt;0.1% of the corpus), and Reddit coverage is partial. These constraints are factored into every confidence score and interpretation.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Known limitations</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
              <li>• Post-purchase reviews dominate — pre-purchase signals are inferred via barrier framing</li>
              <li>• No demographic or city-tier data available from public evidence</li>
              <li>• Signals indicate where to investigate, not population prevalence</li>
            </ul>
          </div>
          {result.release.quality.warnings.length ? <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600">{result.release.quality.warnings.map((warning) => <li key={warning} className="rounded-lg bg-slate-50 px-3 py-2">{warning}</li>)}</ul> : null}
        </SectionCard>
      </div>

      <SectionCard title="Evidence sources" description="Public review and discussion channels analyzed in this release." className="mt-5">
        {(() => {
          const sourceMetrics = result.release.analytics?.sourceMetrics ?? [];
          const totalCount = sourceMetrics.reduce((sum, s) => sum + s.canonicalCount, 0);
          const sourceColors: Record<string, string> = { google_play: "bg-emerald-500", app_store: "bg-sky-500", youtube: "bg-red-500", reddit: "bg-orange-500" };
          const sourceNames: Record<string, string> = { google_play: "Google Play", app_store: "App Store", youtube: "YouTube", reddit: "Reddit" };
          return (
            <div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {sourceMetrics.map((s) => (
                  <span key={s.source} className={`h-full ${sourceColors[s.source] ?? "bg-slate-400"}`} style={{ width: `${(s.canonicalCount / totalCount) * 100}%` }} title={`${sourceNames[s.source] ?? s.source}: ${s.canonicalCount.toLocaleString()}`} />
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sourceMetrics.map((s) => (
                  <article key={s.source} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${sourceColors[s.source] ?? "bg-slate-400"}`} />
                      <h3 className="text-sm font-bold text-slate-900">{sourceNames[s.source] ?? s.source}</h3>
                    </div>
                    <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{s.canonicalCount.toLocaleString()}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{((s.canonicalCount / totalCount) * 100).toFixed(1)}% of corpus</p>
                  </article>
                ))}
              </div>
            </div>
          );
        })()}
      </SectionCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionCard title="Allowed claims" action={<BadgeCheck aria-hidden="true" className="size-5 text-emerald-600" />}>
          <ul className="space-y-3 text-sm leading-6 text-slate-600"><li>“Within the collected, query-targeted evidence…”</li><li>“This theme appears across reviewed source strata…”</li><li>“The evidence suggests…”</li><li>“This remains a hypothesis for interviews.”</li></ul>
        </SectionCard>
        <SectionCard title="Prohibited claims" action={<Ban aria-hidden="true" className="size-5 text-rose-600" />}>
          <ul className="space-y-3 text-sm leading-6 text-slate-600"><li>Population-wide percentages about Myntra users.</li><li>Causal conversion, revenue, or 30-day impact.</li><li>Unsupported demographic or commercial segments.</li><li>Allegations presented as established facts.</li></ul>
        </SectionCard>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><BookOpenCheck aria-hidden="true" className="size-4 text-violet-600" /><p><strong className="text-slate-800">Pipeline status:</strong> {provisional ? "Evidence collected, normalized, deduplicated, classified, and aggregated from public sources. The release is ready for interview validation and product decision-making." : result.mode === "fixtures" ? "Demonstrating the full pipeline with fictional data." : result.mode === "ready" ? "This release passed human and technical review gates." : "No evidence has been processed yet — activate a data release to begin."}</p></div>
    </>
  );
}
