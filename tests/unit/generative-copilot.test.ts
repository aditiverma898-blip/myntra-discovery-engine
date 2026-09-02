import { describe, expect, it, vi } from "vitest";

import { buildGenerativeCopilotResponse } from "@/lib/rag/generative";
import { generateCopilotAnswer, resolveGeminiModels, DEFAULT_GEMINI_MODELS } from "@/lib/rag/gemini-runtime";
import { publicEvidenceItemSchema } from "@/lib/schemas";

const evidence = [
  { evidenceId: "ev-1", source: "reddit", sourceItemType: "comment", parentThreadId: "thread-1", canonicalUrl: null, publishedAt: null, excerpt: "I saved a Myntra kurta but size and fit uncertainty makes me wait.", relevance: "direct_wishlist", themeIds: ["fit-confidence"], segmentIds: ["active-confidence-seeker"], barrierIds: ["fit_size_uncertainty"], journeyStages: ["decision"], confidence: 0.9, labelMethod: "human", humanReviewStatus: "accepted" },
  { evidenceId: "ev-3", source: "youtube", sourceItemType: "comment", parentThreadId: "video-1", canonicalUrl: null, publishedAt: null, excerpt: "Myntra measurements helped me select the right size.", relevance: "direct_wishlist", themeIds: ["fit-confidence"], segmentIds: ["active-confidence-seeker"], barrierIds: ["fit_size_uncertainty"], journeyStages: ["bag"], confidence: 0.95, labelMethod: "human", humanReviewStatus: "accepted" },
].map((item) => publicEvidenceItemSchema.parse(item));

const context = { mode: "provisional" as const, status: "partial" as const, totalEvidence: evidence.length };
const request = { question: "What Myntra size evidence supports fit decisions?" };

describe("generative Copilot", () => {
  it("uses the LLM answer while keeping deterministic typed fields", async () => {
    const generate = vi.fn().mockResolvedValue({ relevant: true, answer: "Shoppers hesitate on Myntra size and fit [1]; clearer measurements helped others decide [2]." });
    const response = await buildGenerativeCopilotResponse(request, evidence, "fixture-test", context, generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(response.mode).toBe("generated");
    expect(response.usedLLM).toBe(true);
    expect(response.answer).toContain("Myntra size and fit");
    // Typed fields remain deterministic and citations are still real evidence IDs.
    expect(response.findings.flatMap((finding) => finding.evidenceIds).length).toBeGreaterThan(0);
    expect(response.findings[0]?.barrierIds).toContain("fit_size_uncertainty");
  });

  it("falls back to the extractive answer when the model throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("all models failed"));
    const response = await buildGenerativeCopilotResponse(request, evidence, "fixture-test", context, generate);

    expect(response.mode).toBe("extractive");
    expect(response.usedLLM).toBe(false);
    expect(response.findings.flatMap((finding) => finding.evidenceIds).length).toBeGreaterThan(0);
  });

  it("falls back without calling the model when the question is off-topic", async () => {
    const generate = vi.fn();
    const response = await buildGenerativeCopilotResponse({ question: "What is the weather today?" }, evidence, "fixture-test", context, generate);

    expect(generate).not.toHaveBeenCalled();
    expect(response.relevant).toBe(false);
    expect(response.usedLLM).toBe(false);
  });

  it("keeps the extractive answer when the model marks the question irrelevant", async () => {
    const generate = vi.fn().mockResolvedValue({ relevant: false, answer: "Not about Myntra." });
    const response = await buildGenerativeCopilotResponse(request, evidence, "fixture-test", context, generate);

    expect(response.mode).toBe("extractive");
    expect(response.usedLLM).toBe(false);
  });
});

describe("Gemini runtime client", () => {
  it("resolves model overrides and defaults", () => {
    expect(resolveGeminiModels("model-a, model-b")).toEqual(["model-a", "model-b"]);
    expect(resolveGeminiModels("")).toEqual([...DEFAULT_GEMINI_MODELS]);
    expect(resolveGeminiModels(undefined)).toEqual([...DEFAULT_GEMINI_MODELS]);
  });

  it("rotates to the next model when the first returns an HTTP error", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ relevant: true, answer: "grounded answer" }) }] } }] }),
      });

    const result = await generateCopilotAnswer("prompt", { apiKey: "test-key", models: ["bad-model", "good-model"], fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ relevant: true, answer: "grounded answer" });
  });

  it("throws when every model fails so the caller can fall back", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(generateCopilotAnswer("prompt", { apiKey: "test-key", models: ["a", "b"], fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow();
  });
});
