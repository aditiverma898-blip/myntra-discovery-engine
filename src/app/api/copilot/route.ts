import { buildEmptyCopilotResponse } from "@/lib/data/empty-responses";
import { readPublicEvidenceIndex } from "@/lib/data/evidence-reader";
import { loadActiveRelease } from "@/lib/data/release-loader";
import { readServerEnv } from "@/lib/env";
import { copilotRequestSchema } from "@/lib/schemas";
import { buildExtractiveCopilotResponse } from "@/lib/rag/extractive";
import { buildGenerativeCopilotResponse } from "@/lib/rag/generative";
import { generateCopilotAnswer, resolveGeminiModels } from "@/lib/rag/gemini-runtime";

export const maxDuration = 30;

function noStoreJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  if (!request.headers.get("content-type")?.toLocaleLowerCase("en-IN").includes("application/json")) {
    return noStoreJson({ error: "UNSUPPORTED_CONTENT_TYPE", message: "Copilot requests require application/json." }, { status: 415 });
  }

  try {
    const text = await request.text();
    if (text.length > 16_000) return noStoreJson({ error: "REQUEST_TOO_LARGE", message: "The Copilot request exceeds 16 KB." }, { status: 413 });
    payload = JSON.parse(text) as unknown;
  } catch {
    return noStoreJson(
      {
        error: "INVALID_JSON",
        message: "The request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const parsed = copilotRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return noStoreJson(
      {
        error: "INVALID_COPILOT_REQUEST",
        message: "The Copilot question or filters are invalid.",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }

  const result = await loadActiveRelease();
  if (!result.ok) {
    return noStoreJson(
      { error: result.error.code, message: result.error.message },
      { status: 503 },
    );
  }

  if (result.mode !== "empty") {
    const evidence = await readPublicEvidenceIndex(result);
    const context = { mode: result.mode, status: result.release.status, totalEvidence: evidence.items.length };
    const env = readServerEnv();

    // Generative (Gemini) path activates only when runtime LLM is enabled AND a key
    // is present. Without a key this branch is skipped and the deterministic
    // extractive answer is returned, so the app runs unchanged with no credentials.
    if (env.ENABLE_RUNTIME_LLM && env.GEMINI_API_KEY) {
      const apiKey = env.GEMINI_API_KEY;
      const models = resolveGeminiModels(env.GEMINI_MODEL);
      try {
        const generated = await buildGenerativeCopilotResponse(
          parsed.data,
          evidence.items,
          result.release.datasetVersion,
          context,
          (prompt) => generateCopilotAnswer(prompt, { apiKey, models }),
        );
        return noStoreJson(generated);
      } catch {
        // Defence in depth: the builder already falls back internally, but any
        // unexpected throw still returns the deterministic extractive answer.
      }
    }

    return noStoreJson(
      buildExtractiveCopilotResponse(
        parsed.data,
        evidence.items,
        result.release.datasetVersion,
        context,
      ),
    );
  }

  return noStoreJson(buildEmptyCopilotResponse(result.release));
}
