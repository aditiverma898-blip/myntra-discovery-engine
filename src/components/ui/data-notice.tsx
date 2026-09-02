import { CircleAlert, ShieldCheck } from "lucide-react";
import type { DataMode } from "@/lib/schemas";

export function DataNotice({ mode = "empty" }: { mode?: DataMode }) {
  const fixtures = mode === "fixtures";
  const provisional = mode === "provisional";
  const ready = mode === "ready";
  const title = fixtures
    ? "Demonstration mode · fictional data"
    : provisional
      ? "Insights derived from public reviews & discussions"
      : ready
        ? "Reviewed evidence release"
        : "No data loaded";
  const description = fixtures
    ? "All values on this page are fictional and exist only to demonstrate the product experience."
    : provisional
      ? "Signals reflect observed patterns in public evidence. They indicate where to investigate — not population-wide statistics about Myntra users."
      : ready
        ? "This release passed its recorded review and publication gates."
        : "Activate a data release to populate the analytics views.";
  return (
    <aside className="data-notice" aria-label="Current research status">
      <div className="notice-icon">
        <CircleAlert aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-violet-950">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-violet-800">
          {description}
        </p>
      </div>
      <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 shadow-sm ring-1 ring-violet-200 sm:inline-flex">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        {fixtures ? "Demo mode" : provisional ? "Public-evidence insights" : ready ? "Reviewed release" : "No data"}
      </span>
    </aside>
  );
}
