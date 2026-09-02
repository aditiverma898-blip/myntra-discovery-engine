import { createHash } from "node:crypto";

function fingerprint(query: object): string {
  return createHash("sha256").update(JSON.stringify(query)).digest("hex").slice(0, 16);
}

export function encodeEvidenceCursor(offset: number, query: object): string {
  return Buffer.from(JSON.stringify({ v: 1, o: offset, f: fingerprint(query) }), "utf8").toString("base64url");
}

export function decodeEvidenceCursor(cursor: string, query: object): number {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { v?: unknown; o?: unknown; f?: unknown };
    if (value.v !== 1 || !Number.isSafeInteger(value.o) || (value.o as number) < 0 || value.f !== fingerprint(query)) throw new Error("Invalid cursor payload.");
    return value.o as number;
  } catch { throw new Error("INVALID_EVIDENCE_CURSOR"); }
}
