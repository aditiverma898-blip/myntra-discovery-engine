import { describe, expect, it } from "vitest";

import {
  copilotRequestSchema,
  evidenceQuerySchema,
} from "@/lib/schemas";

describe("public API request schemas", () => {
  it("applies the evidence default limit", () => {
    expect(evidenceQuerySchema.parse({}).limit).toBe(25);
  });

  it("rejects oversized evidence limits and unknown source IDs", () => {
    expect(evidenceQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(evidenceQuerySchema.safeParse({ source: ["other_shop"] }).success).toBe(false);
  });

  it("validates repeated filters and ordered date bounds", () => {
    expect(evidenceQuerySchema.parse({ source: ["google_play", "reddit"], rating: ["1", "5"] })).toMatchObject({
      source: ["google_play", "reddit"],
      rating: [1, 5],
      sort: "newest",
    });
    expect(evidenceQuerySchema.safeParse({ from: "2026-08-23", to: "2026-08-22" }).success).toBe(false);
    expect(evidenceQuerySchema.safeParse({ from: "2026-13-40" }).success).toBe(false);
    expect(evidenceQuerySchema.safeParse({ sort: "popular" }).success).toBe(false);
  });

  it("trims Copilot questions and rejects empty or oversized questions", () => {
    expect(copilotRequestSchema.parse({ question: "  What is known?  " }).question).toBe("What is known?");
    expect(copilotRequestSchema.safeParse({ question: "   " }).success).toBe(false);
    expect(copilotRequestSchema.safeParse({ question: "x".repeat(1_001) }).success).toBe(false);
  });
});
