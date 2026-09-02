import { describe, expect, it } from "vitest";

import { readServerEnv } from "@/lib/env";

describe("readServerEnv", () => {
  it("defaults to safe empty mode without credentials", () => {
    expect(readServerEnv({})).toEqual({
      DATA_MODE: "empty",
      ALLOW_EXTERNAL_CALLS: false,
      ENABLE_RUNTIME_LLM: false,
      REDDIT_SOURCE_APPROVAL: "disabled",
    });
  });

  it("turns blank credential fields into undefined", () => {
    const environment = readServerEnv({
      GEMINI_API_KEY: "",
      YOUTUBE_API_KEY: "",
      APIFY_TOKEN: "",
    });

    expect(environment.GEMINI_API_KEY).toBeUndefined();
    expect(environment.YOUTUBE_API_KEY).toBeUndefined();
    expect(environment.APIFY_TOKEN).toBeUndefined();
  });

  it("parses explicit destination-computer controls", () => {
    const environment = readServerEnv({
      DATA_MODE: "ready",
      ALLOW_EXTERNAL_CALLS: "true",
      ENABLE_RUNTIME_LLM: "false",
      REDDIT_SOURCE_APPROVAL: "approved",
    });

    expect(environment.DATA_MODE).toBe("ready");
    expect(environment.ALLOW_EXTERNAL_CALLS).toBe(true);
    expect(environment.REDDIT_SOURCE_APPROVAL).toBe("approved");
  });

  it("parses the local-only provisional inspection mode", () => {
    expect(readServerEnv({ DATA_MODE: "provisional" }).DATA_MODE).toBe("provisional");
  });

  it("rejects ambiguous boolean values", () => {
    expect(() =>
      readServerEnv({ ALLOW_EXTERNAL_CALLS: "yes" }),
    ).toThrow();
  });
});
