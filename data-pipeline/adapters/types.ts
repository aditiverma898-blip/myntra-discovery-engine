import type { RawEvidence } from "../../src/lib/schemas/pipeline";
import type { SourceId } from "../../src/lib/schemas/release";

export interface SanitizedCollectionPlan {
  source: SourceId;
  adapterId: string;
  adapterVersion: string;
  approvalStatus: "approved" | "disabled" | "rejected";
  queryIds: string[];
  maxItems: number;
  maxRequests: number;
  maxCost: number;
  credentialsPresent: boolean;
  outputPath: string;
  quarantinePath: string;
  retentionDays: number;
  blockedReasons: string[];
  externalExecutionPerformed: false;
}

export interface CollectorAdapter<TFixture = unknown> {
  readonly id: string;
  readonly version: string;
  readonly source: SourceId;
  parseSavedFixture(payload: TFixture): RawEvidence[];
  collectExternal(options: ExternalCollectorOptions, transport: ExternalCollectorTransport): Promise<RawEvidence[]>;
}

export interface ExternalCollectorOptions {
  sourceApprovalStatus: "approved" | "disabled" | "rejected";
  maxItems: number;
  maxCost: number;
  argv?: readonly string[];
  environment?: Record<string, string | undefined>;
}

export type ExternalCollectorTransport = (options: { source: SourceId; maxItems: number }) => Promise<unknown>;
