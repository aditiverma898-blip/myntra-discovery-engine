import type { Metadata } from "next";
import { Suspense } from "react";

import { EvidenceFilters } from "@/components/evidence/evidence-filters";
import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { loadActiveRelease } from "@/lib/data/release-loader";

export const metadata: Metadata = { title: "Evidence" };

export default async function EvidencePage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;
  const themeNames = Object.fromEntries(result.release.themes.map((theme) => [theme.themeId, theme.name]));

  return (
    <>
      <PageHeader eyebrow="Traceability" title="Evidence explorer" description="Search and filter the complete public-safe release, then follow every chart and finding back to its source evidence." />
      <DataNotice mode={result.mode} />
      <Suspense fallback={<div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">Preparing evidence filters…</div>}>
        <EvidenceFilters mode={result.mode} themeNames={themeNames} />
      </Suspense>
    </>
  );
}
