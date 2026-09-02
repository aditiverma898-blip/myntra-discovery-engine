import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ActiveReleaseResult } from "@/lib/data/release-loader";
import { publicEvidenceItemSchema } from "@/lib/schemas";
export { filterPublicEvidence, type PublicEvidenceItem } from "@/lib/data/public-evidence";
import type { PublicEvidenceItem } from "@/lib/data/public-evidence";

const evidenceCache = new Map<string, Promise<readonly PublicEvidenceItem[]>>();

export interface PublicEvidenceIndex {
  items: readonly PublicEvidenceItem[];
  byId: ReadonlyMap<string, PublicEvidenceItem>;
  bySource: ReadonlyMap<PublicEvidenceItem["source"], readonly PublicEvidenceItem[]>;
}

const evidenceIndexCache = new Map<string, Promise<PublicEvidenceIndex>>();

function cacheKey(result: Extract<ActiveReleaseResult, { ok: true }>): string {
  return `${result.releaseDirectory}\u0000${result.release.datasetVersion}`;
}

async function loadPublicEvidence(result: Extract<ActiveReleaseResult, { ok: true }>): Promise<readonly PublicEvidenceItem[]> {
  if (result.mode === "empty") return [];
  const text = await readFile(path.join(result.releaseDirectory, "evidence.server.jsonl"), "utf8");
  return Object.freeze(text.split(/\r?\n/u).filter(Boolean).map((line) => publicEvidenceItemSchema.parse(JSON.parse(line) as unknown)));
}

export async function readPublicEvidence(result: Extract<ActiveReleaseResult, { ok: true }>, limit?: number): Promise<PublicEvidenceItem[]> {
  const key = cacheKey(result);
  let pending = evidenceCache.get(key);
  if (!pending) {
    pending = loadPublicEvidence(result);
    evidenceCache.set(key, pending);
  }
  const items = await pending;
  return limit === undefined ? [...items] : items.slice(0, limit);
}

export async function readPublicEvidenceIndex(result: Extract<ActiveReleaseResult, { ok: true }>): Promise<PublicEvidenceIndex> {
  const key = cacheKey(result);
  let pending = evidenceIndexCache.get(key);
  if (!pending) {
    pending = readPublicEvidence(result).then((items) => {
      const bySource = new Map<PublicEvidenceItem["source"], PublicEvidenceItem[]>();
      for (const item of items) {
        const sourceItems = bySource.get(item.source) ?? [];
        sourceItems.push(item);
        bySource.set(item.source, sourceItems);
      }
      return { items, byId: new Map(items.map((item) => [item.evidenceId, item])), bySource };
    });
    evidenceIndexCache.set(key, pending);
  }
  return pending;
}

export function clearPublicEvidenceCache(): void {
  evidenceCache.clear();
  evidenceIndexCache.clear();
}
