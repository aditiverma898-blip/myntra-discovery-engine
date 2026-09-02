import { Suspense } from "react";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { loadActiveRelease } from "@/lib/data/release-loader";

export default async function AnalyticsPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;
  return <><PageHeader eyebrow="Evidence intelligence · Analytics" title="See the shape behind the signals" description="Coordinate source, relevance, barrier, journey, rating, date, and keyword filters across every panel—then move from an aggregate directly to its evidence." /><DataNotice mode={result.mode} /><Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" />}><AnalyticsDashboard /></Suspense></>;
}
