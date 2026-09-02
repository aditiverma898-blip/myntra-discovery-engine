import { describe, expect, it } from "vitest";

import {
  assertExternalCallsAllowed,
  type ExternalAccessDenialCode,
  ExternalAccessDeniedError,
  type ExternalAccessRequest,
} from "@/lib/external-access";

const safeEnvironment = {
  ALLOW_EXTERNAL_CALLS: "false",
  REDDIT_SOURCE_APPROVAL: "disabled",
};

function expectDenial(
  request: ExternalAccessRequest,
  expectedCode: ExternalAccessDenialCode,
  onAllowed?: () => void,
): void {
  try {
    assertExternalCallsAllowed(request);
    onAllowed?.();
  } catch (error) {
    expect(error).toBeInstanceOf(ExternalAccessDeniedError);
    expect((error as ExternalAccessDeniedError).code).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected external access denial ${expectedCode}.`);
}

describe("assertExternalCallsAllowed", () => {
  it("blocks before a client can be constructed", () => {
    let clientConstructed = false;

    expectDenial(
      {
        source: "youtube",
        sourceApprovalStatus: "approved",
        maxItems: 10,
        maxCost: 0,
        argv: ["--allow-external"],
        environment: safeEnvironment,
      },
      "EXTERNAL_CALLS_DISABLED",
      () => {
        clientConstructed = true;
      },
    );

    expect(clientConstructed).toBe(false);
  });

  it("requires the explicit CLI flag", () => {
    expectDenial(
      {
        source: "youtube",
        sourceApprovalStatus: "approved",
        maxItems: 10,
        maxCost: 0,
        argv: [],
        environment: { ALLOW_EXTERNAL_CALLS: "true" },
      },
      "EXPLICIT_FLAG_MISSING",
    );
  });

  it("requires an approved source record", () => {
    expectDenial(
      {
        source: "youtube",
        sourceApprovalStatus: "disabled",
        maxItems: 10,
        maxCost: 0,
        argv: ["--allow-external"],
        environment: { ALLOW_EXTERNAL_CALLS: "true" },
      },
      "SOURCE_NOT_APPROVED",
    );
  });

  it("requires Reddit's independent approval control", () => {
    expectDenial(
      {
        source: "reddit",
        sourceApprovalStatus: "approved",
        maxItems: 10,
        maxCost: 1,
        argv: ["--allow-external"],
        environment: {
          ALLOW_EXTERNAL_CALLS: "true",
          REDDIT_SOURCE_APPROVAL: "disabled",
        },
      },
      "REDDIT_NOT_APPROVED",
    );
  });

  it("rejects unbounded item and cost settings", () => {
    expectDenial(
      {
        source: "youtube",
        sourceApprovalStatus: "approved",
        maxItems: Number.POSITIVE_INFINITY,
        maxCost: 0,
        argv: ["--allow-external"],
        environment: { ALLOW_EXTERNAL_CALLS: "true" },
      },
      "INVALID_ITEM_LIMIT",
    );

    expectDenial(
      {
        source: "youtube",
        sourceApprovalStatus: "approved",
        maxItems: 10,
        maxCost: Number.POSITIVE_INFINITY,
        argv: ["--allow-external"],
        environment: { ALLOW_EXTERNAL_CALLS: "true" },
      },
      "INVALID_COST_LIMIT",
    );
  });

  it("allows a fully approved, bounded destination request", () => {
    const approval = assertExternalCallsAllowed({
      source: "reddit",
      sourceApprovalStatus: "approved",
      maxItems: 20,
      maxCost: 5,
      argv: ["--allow-external"],
      environment: {
        ALLOW_EXTERNAL_CALLS: "true",
        REDDIT_SOURCE_APPROVAL: "approved",
      },
    });

    expect(approval).toMatchObject({
      source: "reddit",
      maxItems: 20,
      maxCost: 5,
    });
  });
});
