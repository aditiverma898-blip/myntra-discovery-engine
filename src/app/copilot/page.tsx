import type { Metadata } from "next";

import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { DataNotice } from "@/components/ui/data-notice";
import { PageHeader } from "@/components/ui/page-header";
import { ReleaseErrorState } from "@/components/ui/release-error-state";
import { loadActiveRelease } from "@/lib/data/release-loader";
import { readServerEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Copilot" };

export default async function CopilotPage() {
  const result = await loadActiveRelease();
  if (!result.ok) return <ReleaseErrorState error={result.error} />;

  const env = readServerEnv();
  const llmConfigured = env.ENABLE_RUNTIME_LLM && Boolean(env.GEMINI_API_KEY);

  return (
    <>
      <PageHeader eyebrow="Grounded research assistant" title="Copilot" description={llmConfigured ? "Ask questions against the loaded release. Answers are AI-written with Gemini and grounded in retrieved evidence." : "Ask questions against the loaded release. Answers are evidence-based; add a GEMINI_API_KEY to enable AI-written responses."} />
      <DataNotice mode={result.mode} />
      <CopilotPanel datasetVersion={result.release.datasetVersion} mode={result.mode} evidenceCount={result.release.totals.evidence} llmConfigured={llmConfigured} />
    </>
  );
}
