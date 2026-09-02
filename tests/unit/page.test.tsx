import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("Phase 3 overview page", () => {
  it("renders an honest empty-data product state", async () => {
    render(await HomePage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Where shopping confidence breaks",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No evidence release yet" })).toBeInTheDocument();
    expect(screen.getByText(/keeps unknown values unknown/)).toBeInTheDocument();
    expect(screen.getByText("No data loaded")).toBeInTheDocument();
  });
});
