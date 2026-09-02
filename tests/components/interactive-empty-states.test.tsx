import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { EvidenceFilters } from "@/components/evidence/evidence-filters";

describe("interactive empty states", () => {
  it("keeps Evidence empty mode honest without inventing results", () => {
    render(<EvidenceFilters />);

    expect(screen.getByRole("heading", { name: "Evidence has not been collected" })).toBeInTheDocument();
    expect(screen.getByText(/No result count is fabricated/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply filters/i })).not.toBeInTheDocument();
  });

  it("answers empty mode locally without claiming evidence", async () => {
    render(<CopilotPanel datasetVersion="empty-001" />);

    fireEvent.change(screen.getByLabelText("Ask an evidence-based question"), {
      target: { value: "What is known?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask Copilot" }));

    await waitFor(() => expect(screen.getByText("Copilot response")).toBeInTheDocument());
    expect(screen.getByText(/No reviewed evidence is available yet/)).toBeInTheDocument();
    expect(screen.getByText(/No model or external provider was used/)).toBeInTheDocument();
  });
});
