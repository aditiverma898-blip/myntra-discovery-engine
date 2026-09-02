import Link from "next/link";
import { ArrowRight, Beaker, ChevronDown, Layers3 } from "lucide-react";

import { ThemeEvidencePager, type ThemeEvidenceExcerpt } from "@/components/themes/theme-evidence-pager";
import { cn } from "@/lib/cn";

export type { ThemeEvidenceExcerpt } from "@/components/themes/theme-evidence-pager";

export interface ThemePresentation {
  themeId: string;
  name: string;
  barrierOrNeed: string;
  supportCount: number;
  relevantDenominator: number;
  directCount: number;
  adjacentCount: number;
  averageSeverity: number | null;
  sourceDistribution: Record<string, number>;
  sourceBreadth: number;
  journeyDistribution: Record<string, number>;
  barrierDistribution: Record<string, number>;
  labelConfidence: number;
  reviewLabel: string;
  representativeEvidence: ThemeEvidenceExcerpt[];
  controlEvidence: ThemeEvidenceExcerpt[];
}

export interface ThemeHypothesis {
  themeId: string;
  name: string;
  description: string;
}

const sourceLabels: Record<string, string> = { google_play: "Google Play", app_store: "App Store", youtube: "YouTube", reddit: "Reddit" };
const sourceColors: Record<string, string> = { google_play: "bg-emerald-500", app_store: "bg-sky-500", youtube: "bg-red-500", reddit: "bg-orange-500" };

function humanize(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function MiniSourceBar({ theme }: { theme: ThemePresentation }) {
  const entries = Object.entries(theme.sourceDistribution).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${theme.sourceBreadth} supporting sources`}>
        {entries.map(([source, count]) => <span key={source} className={cn("h-full", sourceColors[source] ?? "bg-slate-400")} style={{ width: `${(count / theme.supportCount) * 100}%` }} title={`${sourceLabels[source] ?? humanize(source)}: ${count}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{entries.map(([source, count]) => <Link key={source} href={`/evidence?theme=${encodeURIComponent(theme.themeId)}&source=${encodeURIComponent(source)}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-pink-700"><span className={cn("size-1.5 rounded-full", sourceColors[source] ?? "bg-slate-400")} />{sourceLabels[source] ?? humanize(source)} {count}</Link>)}</div>
    </div>
  );
}

function RankedVolume({ themes }: { themes: ThemePresentation[] }) {
  const max = Math.max(...themes.map((theme) => theme.supportCount), 1);
  return (
    <section className="surface-card" aria-labelledby="theme-volume-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Candidate taxonomy</p><h2 id="theme-volume-title" className="section-title mt-1">Theme evidence volume</h2><p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">Counts show candidate-relevant records assigned to each non-zero theme. Records may support more than one theme.</p></div>
        <p className="text-xs font-semibold text-slate-500">Denominator: {themes[0]?.relevantDenominator.toLocaleString() ?? 0} relevant records</p>
      </div>
      <div className="mt-6 space-y-4">{themes.map((theme, index) => <Link key={theme.themeId} href={`#${theme.themeId}`} className="group grid items-center gap-3 sm:grid-cols-[190px_minmax(0,1fr)_90px]"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><span className="text-xs font-black text-slate-400">{index + 1}</span><span>{theme.name}</span></div><div className="h-8 overflow-hidden rounded-lg bg-slate-100"><div className="flex h-full items-center rounded-lg bg-gradient-to-r from-pink-600 to-violet-500 px-3 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.max((theme.supportCount / max) * 100, 7)}%` }}><span className="text-[10px] font-black text-white opacity-0 group-hover:opacity-100">Open detail</span></div></div><div className="text-right"><p className="text-sm font-black tabular-nums text-slate-900">{theme.supportCount.toLocaleString()}</p><p className="text-[10px] text-slate-500">{((theme.supportCount / theme.relevantDenominator) * 100).toFixed(1)}% relevant</p></div></Link>)}</div>
    </section>
  );
}

export function ThemeCatalog({ themes, hypotheses }: { themes: ThemePresentation[]; hypotheses: ThemeHypothesis[] }) {
  return (
    <div className="space-y-5">
      <RankedVolume themes={themes} />
      <section className="surface-card" aria-labelledby="candidate-themes-title">
        <div><p className="eyebrow">Traceable findings</p><h2 id="candidate-themes-title" className="section-title mt-1">Candidate themes</h2><p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--muted)]">Each theme is derived from public evidence using deterministic classification. Label confidence describes assignment consistency—not population prevalence.</p></div>
        <div className="mt-5 space-y-4">
          {themes.map((theme, index) => (
            <details id={theme.themeId} key={theme.themeId} className="group scroll-mt-24 rounded-2xl border border-slate-200 bg-white open:border-pink-200 open:shadow-sm" open={index === 0}>
              <summary className="cursor-pointer list-none p-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pink-600 [&::-webkit-details-marker]:hidden">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink-50 text-sm font-black text-pink-700">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-pink-700">Candidate theme</p><h3 className="mt-1 text-lg font-black text-slate-950">{theme.name}</h3></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{theme.reviewLabel}</span><ChevronDown aria-hidden="true" className="size-5 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></div></div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{theme.barrierOrNeed}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Support</p><p className="mt-1 font-black text-slate-900">{theme.supportCount.toLocaleString()} <span className="text-xs font-semibold text-slate-500">/ {theme.relevantDenominator.toLocaleString()}</span></p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Direct / adjacent</p><p className="mt-1 font-black text-slate-900">{theme.directCount} / {theme.adjacentCount.toLocaleString()}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Source breadth</p><p className="mt-1 font-black text-slate-900">{theme.sourceBreadth} of 4</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Label confidence</p><p className="mt-1 font-black text-slate-900">{Math.round(theme.labelConfidence * 100)}%</p></div></div>
                  </div>
                </div>
              </summary>
              <div className="border-t border-slate-100 px-5 pb-6 pt-5">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Source mix</p><div className="mt-3"><MiniSourceBar theme={theme} /></div>
                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <div><h4 className="text-sm font-black text-slate-900">Top barriers</h4><div className="mt-2 flex flex-wrap gap-2">{Object.entries(theme.barrierDistribution).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([barrier, count]) => <Link key={barrier} href={`/evidence?theme=${encodeURIComponent(theme.themeId)}&barrier=${encodeURIComponent(barrier)}`} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100">{humanize(barrier)} · {count}</Link>)}</div></div>
                      <div><h4 className="text-sm font-black text-slate-900">Journey stages <span className="font-medium text-slate-400">· non-exclusive</span></h4><div className="mt-2 flex flex-wrap gap-2">{Object.entries(theme.journeyDistribution).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([journey, count]) => <Link key={journey} href={`/evidence?theme=${encodeURIComponent(theme.themeId)}&journey=${encodeURIComponent(journey)}`} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800 hover:bg-violet-100">{humanize(journey)} · {count}</Link>)}</div></div>
                    </div>
                    <div className="mt-6"><div className="flex items-end justify-between gap-3"><div><h4 className="text-sm font-black text-slate-900">Representative evidence</h4><p className="mt-1 text-xs text-slate-500">A source-diverse sample, shown four excerpts at a time.</p></div><Link href={`/evidence?theme=${encodeURIComponent(theme.themeId)}`} className="inline-flex items-center gap-1 text-xs font-black text-pink-700">Explore all theme evidence <ArrowRight aria-hidden="true" className="size-3.5" /></Link></div><ThemeEvidencePager items={theme.representativeEvidence} themeName={theme.name} /></div>
                  </div>
                  <aside className="space-y-4">
                    <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-[10px] font-black uppercase tracking-wider text-pink-300">Interpretation boundary</p><p className="mt-3 text-sm leading-6 text-slate-300">{theme.supportCount.toLocaleString()} records received this candidate label. This does not establish prevalence among Myntra users or validate a solution.</p>{theme.averageSeverity !== null ? <p className="mt-3 text-xs font-bold text-white">Average candidate severity: {theme.averageSeverity.toFixed(1)} / 3</p> : null}</div>
                    <div className="rounded-2xl border border-slate-200 p-5"><h4 className="text-sm font-black text-slate-900">Positive or contrasting control evidence</h4><p className="mt-1 text-xs leading-5 text-slate-500">Records tagged as a possible positive outcome or contradiction. Human review is required to distinguish the two.</p>{theme.controlEvidence.length ? <div className="mt-3 space-y-2">{theme.controlEvidence.map((item) => <Link key={item.evidenceId} href={`/evidence?id=${encodeURIComponent(item.evidenceId)}`} className="block rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 hover:bg-pink-50"><span className="font-black text-slate-800">{sourceLabels[item.source] ?? humanize(item.source)}:</span> {item.excerpt}</Link>)}</div> : <p className="mt-3 text-xs font-bold text-slate-400">No control records available.</p>}</div>
                  </aside>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      {hypotheses.length ? <details className="surface-card group"><summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Beaker aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">Research hypotheses · not findings</p><p className="mt-1 text-xs text-slate-500">{hypotheses.length} investigation {hypotheses.length === 1 ? "lens has" : "lenses have"} zero supporting candidate records.</p></div><ChevronDown aria-hidden="true" className="size-5 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="mt-5 grid gap-3 sm:grid-cols-2">{hypotheses.map((item) => <article key={item.themeId} className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-4"><div className="flex items-center gap-2"><Layers3 aria-hidden="true" className="size-4 text-violet-600" /><h3 className="text-sm font-black text-violet-950">{item.name}</h3></div><p className="mt-2 text-xs leading-5 text-violet-800">{item.description}</p><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-violet-600">0 evidence · retain for future research</p></article>)}</div></details> : null}
    </div>
  );
}
