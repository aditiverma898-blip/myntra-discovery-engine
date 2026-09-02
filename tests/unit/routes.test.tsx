import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CopilotPage from "@/app/copilot/page";
import EvidencePage from "@/app/evidence/page";
import MethodologyPage from "@/app/methodology/page";
import OpportunitiesPage from "@/app/opportunities/page";
import SegmentsPage from "@/app/segments/page";
import ThemesPage from "@/app/themes/page";

const routes = [
  ["Opportunities", OpportunitiesPage],
  ["Themes", ThemesPage],
  ["Segments", SegmentsPage],
  ["Evidence explorer", EvidencePage],
  ["Methodology", MethodologyPage],
  ["Copilot", CopilotPage],
] as const;

describe("Phase 3 feature routes", () => {
  for (const [heading, Page] of routes) {
    it(`renders ${heading} without credentials or data`, async () => {
      render(await Page());
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByText("No data loaded")).toBeInTheDocument();
    });
  }
});
