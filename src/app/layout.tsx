import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { loadActiveRelease } from "@/lib/data/release-loader";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Myntra Discovery Engine",
    template: "%s · Myntra Discovery Engine",
  },
  description:
    "Evidence-driven insights into what keeps Myntra shoppers from converting wishlisted items.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const result = await loadActiveRelease();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppShell
          releaseStatus={result.ok ? result.release.status : "error"}
          datasetVersion={result.ok ? result.release.datasetVersion : null}
          dataMode={result.ok ? result.mode : "empty"}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
