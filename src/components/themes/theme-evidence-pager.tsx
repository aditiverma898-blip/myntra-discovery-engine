"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const PAGE_SIZE = 4;
const sourceLabels: Record<string, string> = { google_play: "Google Play", app_store: "App Store", youtube: "YouTube", reddit: "Reddit" };

export interface ThemeEvidenceExcerpt {
  evidenceId: string;
  excerpt: string;
  source: string;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function ThemeEvidencePager({ items, themeName }: { items: ThemeEvidenceExcerpt[]; themeName: string }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visibleItems = items.slice(start, start + PAGE_SIZE);
  const end = Math.min(start + visibleItems.length, items.length);

  if (!items.length) {
    return <p className="mt-3 rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">No representative excerpts are available for this theme.</p>;
  }

  return (
    <div className="mt-3" aria-label={`${themeName} representative evidence`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <Link key={item.evidenceId} href={`/evidence?id=${encodeURIComponent(item.evidenceId)}`} className="flex min-h-40 flex-col rounded-xl border border-slate-200 p-4 transition-colors hover:border-pink-300 focus-visible:ring-2 focus-visible:ring-pink-500">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-pink-700">{sourceLabels[item.source] ?? humanize(item.source)}</p>
              <span className="text-[10px] font-semibold text-slate-400">View evidence</span>
            </div>
            <blockquote className="mt-3 line-clamp-4 text-sm leading-6 text-slate-700">“{item.excerpt}”</blockquote>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold tabular-nums text-slate-500">Showing {start + 1}–{end} of {items.length} representative excerpts</p>
        <div className="flex items-center gap-2">
          <button type="button" className="secondary-button disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0} aria-label={`Previous ${themeName} evidence page`}><ArrowLeft aria-hidden="true" className="size-3.5" />Previous</button>
          <span className="min-w-16 text-center text-xs font-bold tabular-nums text-slate-600">{safePage + 1} / {pageCount}</span>
          <button type="button" className="secondary-button disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={safePage === pageCount - 1} aria-label={`Next ${themeName} evidence page`}>Next<ArrowRight aria-hidden="true" className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
