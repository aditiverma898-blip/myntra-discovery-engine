import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditPublicBoundary } from "../../scripts/audit-public-boundary";

describe("public artifact boundary", () => {
  it("accepts client-safe assets and rejects restricted filenames", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "myntra-public-audit-"));
    await writeFile(path.join(root, "client.js"), "synthetic dashboard asset", "utf8");
    await expect(auditPublicBoundary([root])).resolves.toEqual({ filesChecked: 1 });
    await writeFile(path.join(root, "evidence.server.jsonl"), "{}", "utf8");
    await expect(auditPublicBoundary([root])).rejects.toThrow("Forbidden public artifact filename");
  });
});
