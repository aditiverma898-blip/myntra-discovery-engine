import http from "node:http";
import https from "node:https";
import net from "node:net";

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATA_MODE = "empty";
});

export const NETWORK_DENIED_MESSAGE =
  "Unexpected network access is denied in empty and fixture tests.";

function denyNetwork(): never {
  throw new Error(NETWORK_DENIED_MESSAGE);
}

beforeEach(() => {
  process.env.DATA_MODE = "empty";
  vi.stubGlobal("fetch", denyNetwork);
  vi.spyOn(http, "request").mockImplementation(denyNetwork);
  vi.spyOn(http, "get").mockImplementation(denyNetwork);
  vi.spyOn(https, "request").mockImplementation(denyNetwork);
  vi.spyOn(https, "get").mockImplementation(denyNetwork);
  vi.spyOn(net, "connect").mockImplementation(denyNetwork);
  vi.spyOn(net, "createConnection").mockImplementation(denyNetwork);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
