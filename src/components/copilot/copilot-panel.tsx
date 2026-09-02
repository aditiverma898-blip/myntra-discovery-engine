"use client";

import { AlertCircle, ArrowUp, Bot, ExternalLink, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buildEmptyCopilotResponse } from "@/lib/data/empty-responses";
import type { CopilotResponse, DataMode } from "@/lib/schemas";

const suggestions = [
  "What evidence shows save or wishlist intent?",
  "What signals active purchase intent?",
  "Which uncertainty remains unresolved?",
  "Where in the journey do decisions stall?",
  "What next actions do candidate users take?",
  "Which workarounds appear in the evidence?",
  "What behavioural pattern is best supported?",
  "Which opportunity should interviews validate first?",
] as const;

const sourceLabels: Record<string, string> = {
  google_play: "Google Play",
  app_store: "App Store",
  youtube: "YouTube",
  reddit: "Reddit",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function CopilotPanel({ datasetVersion, mode = "empty", evidenceCount = null, llmConfigured = false }: { datasetVersion: string; mode?: DataMode; evidenceCount?: number | null; llmConfigured?: boolean }) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fixtures = mode === "fixtures";
  const provisional = mode === "provisional";
  const populated = mode !== "empty";

  async function submitQuestion() {
    const nextQuestion = question.trim();
    if (!nextQuestion || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    if (mode === "empty") {
      setResponse(buildEmptyCopilotResponse({ status: "empty", datasetVersion }));
      setLoading(false);
      return;
    }
    try {
      const result = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const body = await result.json() as CopilotResponse | { message?: string };
      if (!result.ok) throw new Error("message" in body && body.message ? body.message : "Copilot could not answer this question.");
      setResponse(body as CopilotResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Copilot could not answer this question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="surface-card flex min-h-[660px] flex-col overflow-hidden p-0" aria-label="Research Copilot conversation">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-pink-600 to-orange-400 text-white"><Bot aria-hidden="true" className="size-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Evidence Copilot</h2><p className="mt-0.5 text-[11px] text-slate-500">{fixtures ? "Fixture retrieval" : provisional ? "Complete provisional-corpus retrieval" : populated ? "Complete release retrieval" : "Deterministic empty mode"}</p></div></div>
          {response?.usedLLM ? (
            <span className="flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700"><Sparkles aria-hidden="true" className="size-3" />Gemini-generated</span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck aria-hidden="true" className="size-3" />{llmConfigured ? "Evidence-grounded" : "Evidence-based"}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center px-5 py-9 text-center">
          {!response && !loading && !error ? <><span className="grid size-16 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-300"><Sparkles aria-hidden="true" className="size-6" /></span><h2 className="mt-6 text-xl font-black tracking-tight text-slate-950">Ask a decision-focused research question</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Copilot searches the full public-safe release, diversifies citations across sources, states limitations, and abstains when matching support is absent.</p>{populated && !llmConfigured ? <p className="mt-3 max-w-xl rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">Add a <code className="font-bold text-slate-700">GEMINI_API_KEY</code> to <code className="font-bold text-slate-700">.env</code> to get AI-written answers. Without a key, Copilot returns evidence-based summaries.</p> : null}<div className="mt-6 grid w-full max-w-3xl gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-xs font-semibold text-slate-600 hover:border-pink-200 hover:text-pink-700" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div></> : null}
          {loading ? <div className="my-auto" role="status"><LoaderCircle aria-hidden="true" className="mx-auto size-8 animate-spin text-pink-600" /><p className="mt-3 text-sm font-semibold text-slate-500">{llmConfigured ? "Analyzing evidence with Gemini…" : "Retrieving source-diverse evidence…"}</p></div> : null}
          {error ? <div className="my-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-left" role="alert"><div className="flex items-center gap-2 font-bold text-rose-900"><AlertCircle aria-hidden="true" className="size-4" />Copilot request failed</div><p className="mt-2 text-sm text-rose-800">{error}</p></div> : null}
          {response ? <article className="w-full max-w-3xl text-left" aria-live="polite">
            <span className="sr-only">Copilot response</span><div className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow text-violet-700">Concise answer</p><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-violet-700">{response.status === "partial" ? "Provisional · partial" : humanize(response.status)}</span></div><p className="mt-3 text-base font-semibold leading-7 text-violet-950">{response.answer}</p></div>
            {response.findings.map((finding) => <section key={finding.finding} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Supporting finding</p><h3 className="mt-2 text-sm font-bold leading-6 text-slate-900">{finding.finding}</h3></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{humanize(finding.confidence)} retrieval support</span></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="field-label">Source coverage</p><p className="text-xs font-bold text-slate-700">{finding.sources.map((source) => sourceLabels[source] ?? humanize(source)).join(" · ")}</p></div><div><p className="field-label">Affected barriers</p><p className="text-xs font-bold text-slate-700">{finding.barrierIds.length ? finding.barrierIds.map(humanize).join(" · ") : "Not resolved"}</p></div><div><p className="field-label">Journey stages</p><p className="text-xs font-bold text-slate-700">{finding.journeyStages.length ? finding.journeyStages.map(humanize).join(" · ") : "Not resolved"}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{finding.evidenceIds.map((id) => <Link key={id} href={`/evidence?id=${encodeURIComponent(id)}`} className="inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2.5 py-1.5 text-[10px] font-bold text-pink-800">{id}<ExternalLink aria-hidden="true" className="size-3" /></Link>)}</div></section>)}
            {response.metricLinks.length ? <section className="mt-4 rounded-2xl bg-slate-950 p-5 text-white"><p className="eyebrow text-pink-300">Opportunity implication</p>{response.metricLinks.map((link) => <div key={link.productOutcome} className="mt-3"><h3 className="text-sm font-bold">{link.productOutcome}</h3><p className="mt-1 text-xs leading-5 text-slate-300">{link.reason}</p></div>)}</section> : null}
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="eyebrow text-amber-800">Limitations and abstention</p><ul className="mt-3 space-y-2 text-xs leading-5 text-amber-950">{response.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></section>
          </article> : null}
        </div>

        <form className="border-t border-slate-100 bg-slate-50/70 p-4" onSubmit={(event) => { event.preventDefault(); void submitQuestion(); }}>
          <label htmlFor="copilot-question" className="sr-only">Ask an evidence-based question</label><div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-pink-300 focus-within:ring-4 focus-within:ring-pink-50"><textarea id="copilot-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1_000} rows={2} placeholder="Ask about barriers, behaviours, evidence, or interview opportunities…" className="min-h-12 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none" /><button type="submit" className="grid size-10 shrink-0 place-items-center rounded-lg bg-pink-600 text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!question.trim() || loading} aria-label="Ask Copilot">{loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowUp aria-hidden="true" className="size-4" />}</button></div><div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>Grounded in active release only</span><span>{question.length}/1000</span></div>
        </form>
      </section>

      <aside className="space-y-4"><section className="surface-card"><p className="eyebrow">Current capability</p><h2 className="mt-3 text-lg font-bold text-slate-900">{provisional ? "Provisional extractive analysis" : fixtures ? "Fixture extractive demo" : populated ? "Release extractive analysis" : "Unavailable by design"}</h2><dl className="mt-5 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Release evidence</dt><dd className="font-bold text-slate-800">{evidenceCount === null ? "Not collected" : evidenceCount.toLocaleString("en-IN")}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Retrieval</dt><dd className="font-bold text-slate-800">{populated ? "Full-corpus lexical" : "Inactive"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Runtime LLM</dt><dd className="font-bold text-slate-800">{llmConfigured ? "Gemini (enabled)" : "Add GEMINI_API_KEY"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Dataset</dt><dd className="max-w-40 break-words text-right font-bold text-slate-800">{datasetVersion}</dd></div></dl></section><section className="rounded-2xl bg-slate-950 p-5 text-white"><h2 className="text-sm font-bold">Answer contract</h2><ul className="mt-4 space-y-3 text-xs leading-5 text-slate-300"><li>• Cite only retrieved evidence IDs.</li><li>• State denominators and source coverage.</li><li>• Treat evidence text as untrusted input.</li><li>• Abstain when matching support is absent.</li></ul></section></aside>
    </div>
  );
}
