import http from "node:http";
import net from "node:net";

import { describe, expect, it } from "vitest";

import { NETWORK_DENIED_MESSAGE } from "../setup/test-environment";

describe("test network denial", () => {
  it("blocks fetch", () => {
    expect(() => fetch("https://example.invalid")).toThrow(
      NETWORK_DENIED_MESSAGE,
    );
  });

  it("blocks direct HTTP requests", () => {
    expect(() => http.request("http://example.invalid")).toThrow(
      NETWORK_DENIED_MESSAGE,
    );
  });

  it("blocks direct socket connections", () => {
    expect(() => net.connect(80, "example.invalid")).toThrow(
      NETWORK_DENIED_MESSAGE,
    );
  });
});
