import { FileWarning } from "lucide-react";

import type { ReleaseLoadError } from "@/lib/data/release-loader";

export function ReleaseErrorState({ error }: { error: ReleaseLoadError }) {
  return (
    <section className="surface-card border-rose-200" role="alert">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
          <FileWarning aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="eyebrow text-rose-700">Safe fallback</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            The active release could not be displayed
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {error.message} No partial or previously loaded findings are being
            shown. Regenerate and publish a validated release before continuing.
          </p>
          <code className="mt-4 inline-block rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            {error.code}
          </code>
        </div>
      </div>
    </section>
  );
}
