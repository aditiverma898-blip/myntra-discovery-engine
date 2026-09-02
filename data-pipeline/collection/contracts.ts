import type { CollectionBatch } from "../../src/lib/schemas/collection";

export interface LiveProviderItem {
  id: string;
  parentId: string | null;
  url: string;
  title: string | null;
  text: string;
  publishedAt: string | null;
  rating: number | null;
  language: string | null;
  resultPosition: number | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CollectionPage {
  items: LiveProviderItem[];
  rejectedItems?: Array<{
    code: string;
    message: string;
  }>;
  nextCursor: string | null;
  checkpointOnly?: boolean;
  requestCount: number;
  costUsd: number;
  providerRunId: string | null;
  warnings: string[];
  processedParentIds?: string[];
  diagnostics?: {
    searchedVideos: number;
    eligibleVideos: number;
    skippedVideos: number;
    processedVideos: number;
    videosWithComments: number;
    processedParentIds: string[];
  };
}

export interface CollectionPageRequest {
  batch: CollectionBatch;
  query: CollectionBatch["queries"][number];
  cursor: string | null;
  remainingItems: number;
  remainingRequests: number;
  remainingCostUsd: number;
  environment: Record<string, string | undefined>;
  processedParentIds?: readonly string[];
  forbidNewProviderRun?: boolean;
}

export type CollectionTransport = (request: CollectionPageRequest) => Promise<CollectionPage>;
export type CollectionTransportFactory = () => Promise<CollectionTransport>;
