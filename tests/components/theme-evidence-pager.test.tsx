import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeEvidencePager, type ThemeEvidenceExcerpt } from "@/components/themes/theme-evidence-pager";

const evidence: ThemeEvidenceExcerpt[] = Array.from({ length: 10 }, (_, index) => ({
  evidenceId: `evidence-${index + 1}`,
  excerpt: `Representative comment ${index + 1}`,
  source: index % 2 === 0 ? "google_play" : "reddit",
}));

describe("ThemeEvidencePager", () => {
  it("shows four excerpts at a time and supports bounded page navigation", () => {
    render(<ThemeEvidencePager items={evidence} themeName="Fit confidence" />);

    expect(screen.getByText("Showing 1–4 of 10 representative excerpts")).toBeInTheDocument();
    expect(screen.getByText(/Representative comment 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Representative comment 5/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous Fit confidence evidence page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next Fit confidence evidence page" }));
    expect(screen.getByText("Showing 5–8 of 10 representative excerpts")).toBeInTheDocument();
    expect(screen.getByText(/Representative comment 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Representative comment 1/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next Fit confidence evidence page" }));
    expect(screen.getByText("Showing 9–10 of 10 representative excerpts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next Fit confidence evidence page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous Fit confidence evidence page" }));
    expect(screen.getByText("Showing 5–8 of 10 representative excerpts")).toBeInTheDocument();
  });
});
