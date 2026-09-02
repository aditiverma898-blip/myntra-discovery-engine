"use client";

import { ChevronDown, LoaderCircle, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DataMode, EvidenceResponse, PublicEvidenceItem } from "@/lib/schemas";

const SOURCE_LABELS: Record<string, string> = { google_play: "Google Play", app_store: "App Store", youtube: "YouTube", reddit: "Reddit" };
const SELECT_CLASS = "select-field min-w-0";

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function EvidenceCard({ item, themeNames }: { item: PublicEvidenceItem; themeNames: Record<string, string> }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className="source-chip" data-source={item.source}>{SOURCE_LABELS[item.source] ?? humanize(item.source)}</span>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-800">{humanize(item.relevance)}</span>
        {item.rating !== null ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">{item.rating.toFixed(0)}★</span> : null}
        <time className="ml-auto text-[11px] font-semibold text-slate-400" dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-700">{item.excerpt}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.primaryBarrier ? <Link href={`/evidence?barrier=${encodeURIComponent(item.primaryBarrier)}`} className="rounded-lg bg-pink-50 px-2.5 py-1.5 text-[10px] font-bold text-pink-800">{humanize(item.primaryBarrier)}</Link> : null}
        {item.themeIds.map((theme) => <Link href={`/evidence?theme=${encodeURIComponent(theme)}`} key={theme} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">{themeNames[theme] ?? humanize(theme)}</Link>)}
        {item.journeyStages.filter((stage) => stage !== "unknown").map((stage) => <span key={stage} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">{humanize(stage)}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-400">
        <span>{item.humanReviewStatus === "unreviewed" ? "Unreviewed candidate" : humanize(item.humanReviewStatus)} · severity {item.severity}/3 · label confidence {Math.round(item.confidence * 100)}%</span>
        <code>{item.evidenceId}</code>
      </div>
    </article>
  );
}

export function EvidenceFilters({ mode = "empty", themeNames = {} }: { mode?: DataMode; themeNames?: Record<string, string> }) {
  if (mode === "empty") {
    return <div className="min-h-64 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Search aria-hidden="true" className="mx-auto size-8 text-slate-300" /><h2 className="mt-4 text-lg font-black text-slate-900">Evidence has not been collected</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Activate a fixture, provisional, or ready release to search the public-safe evidence corpus. No result count is fabricated in empty mode.</p></div>;
  }
  return <PopulatedEvidenceFilters mode={mode} themeNames={themeNames} />;
}

function PopulatedEvidenceFilters({ mode, themeNames }: { mode: DataMode; themeNames: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [response, setResponse] = useState<EvidenceResponse | null>(null);
  const [items, setItems] = useState<PublicEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replaceParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const setSingle = useCallback((key: string, value: string) => {
    replaceParams((params) => { params.delete(key); if (value) params.append(key, value); });
  }, [replaceParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(urlQuery), 0);
    return () => window.clearTimeout(timeout);
  }, [urlQuery]);

  useEffect(() => {
    if (query === urlQuery) return;
    const timeout = window.setTimeout(() => setSingle("q", query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query, setSingle, urlQuery]);

  const requestQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    params.set("limit", "25");
    return params.toString();
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadEvidence() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetch(`/api/evidence?${requestQuery}`, { signal: controller.signal, cache: "no-store" });
        const body = await result.json() as EvidenceResponse | { message?: string };
        if (!result.ok) throw new Error("message" in body && body.message ? body.message : "Evidence could not be loaded.");
        const parsedBody = body as EvidenceResponse;
        setResponse(parsedBody);
        setItems(parsedBody.items);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Evidence could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadEvidence();
    return () => controller.abort();
  }, [requestQuery]);

  async function loadMore() {
    if (!response?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams(requestQuery);
      params.set("cursor", response.nextCursor);
      const result = await fetch(`/api/evidence?${params.toString()}`, { cache: "no-store" });
      const body = await result.json() as EvidenceResponse | { message?: string };
      if (!result.ok) throw new Error("message" in body && body.message ? body.message : "The next evidence page could not be loaded.");
      const page = body as EvidenceResponse;
      setItems((current) => [...current, ...page.items]);
      setResponse(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The next evidence page could not be loaded.");
    } finally { setLoadingMore(false); }
  }

  const facets = response?.facets;
  const total = response?.total ?? 0;

  return (
    <div>
      <div className="sticky top-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-4 2xl:grid-cols-6">
          <label className="lg:col-span-2"><span className="field-label">Search evidence</span><span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="text-field pl-9" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search review or discussion text…" maxLength={200} /></span></label>
          <label><span className="field-label">Source</span><select className={SELECT_CLASS} value={searchParams.get("source") ?? ""} onChange={(event) => setSingle("source", event.target.value)}><option value="">All sources</option>{facets?.source.map((item) => <option key={item.value} value={item.value}>{SOURCE_LABELS[item.value] ?? humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">Relevance</span><select className={SELECT_CLASS} value={searchParams.get("relevance") ?? ""} onChange={(event) => setSingle("relevance", event.target.value)}><option value="">All relevance</option>{facets?.relevance.map((item) => <option key={item.value} value={item.value}>{humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">Barrier</span><select className={SELECT_CLASS} value={searchParams.get("barrier") ?? ""} onChange={(event) => setSingle("barrier", event.target.value)}><option value="">All barriers</option>{facets?.barrier.map((item) => <option key={item.value} value={item.value}>{humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">Theme</span><select className={SELECT_CLASS} value={searchParams.get("theme") ?? ""} onChange={(event) => setSingle("theme", event.target.value)}><option value="">All themes</option>{facets?.theme.map((item) => <option key={item.value} value={item.value}>{themeNames[item.value] ?? humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">Journey stage</span><select className={SELECT_CLASS} value={searchParams.get("journey") ?? ""} onChange={(event) => setSingle("journey", event.target.value)}><option value="">All stages</option>{facets?.journey.map((item) => <option key={item.value} value={item.value}>{humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">Rating</span><select className={SELECT_CLASS} value={searchParams.get("rating") ?? ""} onChange={(event) => setSingle("rating", event.target.value)}><option value="">Any store rating</option>{facets?.rating.map((item) => <option key={item.value} value={item.value}>{item.value}★ ({item.count})</option>)}</select></label>
          <label><span className="field-label">Confidence</span><select className={SELECT_CLASS} value={searchParams.get("confidence") ?? ""} onChange={(event) => setSingle("confidence", event.target.value)}><option value="">Any confidence</option>{facets?.confidence.map((item) => <option key={item.value} value={item.value}>{humanize(item.value)} ({item.count})</option>)}</select></label>
          <label><span className="field-label">From</span><input className="text-field" type="date" value={searchParams.get("from") ?? ""} onChange={(event) => setSingle("from", event.target.value)} /></label>
          <label><span className="field-label">To</span><input className="text-field" type="date" value={searchParams.get("to") ?? ""} onChange={(event) => setSingle("to", event.target.value)} /></label>
          <label><span className="field-label">Sort</span><select className={SELECT_CLASS} value={searchParams.get("sort") ?? "newest"} onChange={(event) => setSingle("sort", event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="confidence_desc">Highest label confidence</option><option value="rating_desc">Highest rating</option><option value="rating_asc">Lowest rating</option></select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-500">{loading ? "Loading matching evidence…" : `Showing ${items.length.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} matching evidence units`}</p>
          <button type="button" className="secondary-button" onClick={() => { setQuery(""); router.replace(pathname, { scroll: false }); }}><RotateCcw aria-hidden="true" className="size-4" />Reset all filters</button>
        </div>
      </div>
      {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-900" role="alert">{error}</div> : null}
      {loading ? <div className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white"><div className="text-center"><LoaderCircle aria-hidden="true" className="mx-auto size-7 animate-spin text-pink-600" /><p className="mt-3 text-sm font-semibold text-slate-500">Filtering the complete release…</p></div></div> : null}
      {!loading && !items.length ? <div className="mt-5 min-h-64 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Search aria-hidden="true" className="mx-auto size-8 text-slate-300" /><h2 className="mt-4 text-lg font-black text-slate-900">{mode === "empty" ? "Evidence has not been collected" : "No evidence matches these filters"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{mode === "empty" ? "Run the application in fixture or provisional mode to inspect evidence." : "Reset one or more filters. Counts in each filter show the matching records available in the complete release."}</p></div> : null}
      {!loading && items.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{items.map((item) => <EvidenceCard key={item.evidenceId} item={item} themeNames={themeNames} />)}</div> : null}
      {response?.nextCursor ? <div className="mt-6 text-center"><button type="button" className="primary-button min-w-40 justify-center" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ChevronDown aria-hidden="true" className="size-4" />}{loadingMore ? "Loading…" : "Load 25 more"}</button></div> : null}
    </div>
  );
}
