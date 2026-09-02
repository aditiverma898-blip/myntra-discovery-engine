import type { SourceId } from "@/lib/schemas";
import { readServerEnv, type ServerEnv } from "@/lib/env";

export type ExternalAccessDenialCode =
  | "EXTERNAL_CALLS_DISABLED"
  | "EXPLICIT_FLAG_MISSING"
  | "SOURCE_NOT_APPROVED"
  | "REDDIT_NOT_APPROVED"
  | "INVALID_ITEM_LIMIT"
  | "INVALID_COST_LIMIT";

export class ExternalAccessDeniedError extends Error {
  readonly code: ExternalAccessDenialCode;

  constructor(code: ExternalAccessDenialCode, message: string) {
    super(message);
    this.name = "ExternalAccessDeniedError";
    this.code = code;
  }
}

export interface ExternalAccessRequest {
  source: SourceId;
  sourceApprovalStatus: "approved" | "disabled" | "rejected";
  maxItems: number;
  maxCost: number;
  argv?: readonly string[];
  environment?: Record<string, string | undefined>;
}

export interface ApprovedExternalAccess {
  source: SourceId;
  maxItems: number;
  maxCost: number;
  environment: ServerEnv;
}

export function assertExternalCallsAllowed(
  request: ExternalAccessRequest,
): ApprovedExternalAccess {
  const environment = readServerEnv(request.environment);
  const argv = request.argv ?? process.argv.slice(2);

  if (!environment.ALLOW_EXTERNAL_CALLS) {
    throw new ExternalAccessDeniedError(
      "EXTERNAL_CALLS_DISABLED",
      "External calls are disabled. Keep them disabled on the implementation computer.",
    );
  }

  if (!argv.includes("--allow-external")) {
    throw new ExternalAccessDeniedError(
      "EXPLICIT_FLAG_MISSING",
      "The explicit --allow-external flag is required on the destination computer.",
    );
  }

  if (request.sourceApprovalStatus !== "approved") {
    throw new ExternalAccessDeniedError(
      "SOURCE_NOT_APPROVED",
      `Source ${request.source} does not have an active approval record.`,
    );
  }

  if (
    request.source === "reddit" &&
    environment.REDDIT_SOURCE_APPROVAL !== "approved"
  ) {
    throw new ExternalAccessDeniedError(
      "REDDIT_NOT_APPROVED",
      "Reddit remains disabled until its separate approval control is enabled.",
    );
  }

  if (!Number.isSafeInteger(request.maxItems) || request.maxItems <= 0) {
    throw new ExternalAccessDeniedError(
      "INVALID_ITEM_LIMIT",
      "A finite, positive integer item limit is required.",
    );
  }

  if (!Number.isFinite(request.maxCost) || request.maxCost < 0) {
    throw new ExternalAccessDeniedError(
      "INVALID_COST_LIMIT",
      "A finite, non-negative cost cap is required.",
    );
  }

  return {
    source: request.source,
    maxItems: request.maxItems,
    maxCost: request.maxCost,
    environment,
  };
}
