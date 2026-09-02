"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section className="surface-card mx-auto max-w-2xl border-rose-200" role="alert">
      <span className="grid size-12 place-items-center rounded-xl bg-rose-100 text-rose-700">
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <p className="eyebrow mt-5 text-rose-700">Application error</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">This view could not be rendered safely</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">No partial evidence or stale analytical result is being displayed. Retry the current route after checking the active release.</p>
      <button type="button" className="primary-button mt-6" onClick={() => unstable_retry()}><RotateCcw aria-hidden="true" className="size-4" />Try again</button>
    </section>
  );
}
