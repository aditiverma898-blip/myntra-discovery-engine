import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  activeReleasePointerSchema,
  dashboardReleaseSchema,
  releaseManifestSchema,
  type ActiveReleasePointer,
  type DataMode,
  type DashboardRelease,
  type ReleaseManifest,
} from "@/lib/schemas";
import { readServerEnv } from "@/lib/env";

export type ReleaseLoadErrorCode =
  | "ACTIVE_POINTER_UNAVAILABLE"
  | "ACTIVE_POINTER_INVALID"
  | "RELEASE_ARTIFACT_UNAVAILABLE"
  | "RELEASE_ARTIFACT_INVALID"
  | "RELEASE_VERSION_MISMATCH";

export interface ReleaseLoadError {
  code: ReleaseLoadErrorCode;
  message: string;
}

export type ActiveReleaseResult =
  | {
      ok: true;
      pointer: ActiveReleasePointer;
      manifest: ReleaseManifest;
      release: DashboardRelease;
      mode: DataMode;
      releaseDirectory: string;
    }
  | {
      ok: false;
      error: ReleaseLoadError;
    };

interface ReleaseLoaderOptions {
  releasesRoot?: string;
  dataMode?: DataMode;
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function safeReleaseDirectory(releasesRoot: string, releasePath: string): string {
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ releasesRoot);
  const resolvedRelease = path.resolve(
    /* turbopackIgnore: true */ resolvedRoot,
    releasePath,
  );

  if (!resolvedRelease.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Release path escapes the configured release directory.");
  }

  return resolvedRelease;
}

export async function readActiveRelease(
  options: ReleaseLoaderOptions = {},
): Promise<ActiveReleaseResult> {
  const releasesRoot =
    options.releasesRoot ??
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "releases");
  const mode = options.dataMode ?? "empty";
  const pointerFilename = mode === "fixtures" ? "fixture.json" : mode === "provisional" ? "provisional.json" : "active.json";

  let pointer: ActiveReleasePointer;

  try {
    const pointerText = await readFile(
      path.join(/* turbopackIgnore: true */ releasesRoot, pointerFilename),
      "utf8",
    );
    pointer = activeReleasePointerSchema.parse(parseJson(pointerText));
  } catch (error) {
    const unavailable =
      error instanceof Error && "code" in error && error.code === "ENOENT";

    return {
      ok: false,
      error: {
        code: unavailable
          ? "ACTIVE_POINTER_UNAVAILABLE"
          : "ACTIVE_POINTER_INVALID",
        message: unavailable
          ? "The active release pointer is unavailable."
          : "The active release pointer is invalid.",
      },
    };
  }

  try {
    const releaseDirectory = safeReleaseDirectory(
      releasesRoot,
      pointer.releasePath,
    );
    const [manifestText, aggregateText] = await Promise.all([
      readFile(
        path.join(/* turbopackIgnore: true */ releaseDirectory, "manifest.json"),
        "utf8",
      ),
      readFile(
        path.join(/* turbopackIgnore: true */ releaseDirectory, "aggregates.json"),
        "utf8",
      ),
    ]);

    const manifest = releaseManifestSchema.parse(parseJson(manifestText));
    const release = dashboardReleaseSchema.parse(parseJson(aggregateText));

    if (
      pointer.datasetVersion !== manifest.datasetVersion ||
      manifest.datasetVersion !== release.datasetVersion ||
      manifest.status !== release.status
    ) {
      return {
        ok: false,
        error: {
          code: "RELEASE_VERSION_MISMATCH",
          message: "The active release artifacts do not describe one release.",
        },
      };
    }

    return { ok: true, pointer, manifest, release, mode, releaseDirectory };
  } catch (error) {
    const unavailable =
      error instanceof Error && "code" in error && error.code === "ENOENT";

    return {
      ok: false,
      error: {
        code: unavailable
          ? "RELEASE_ARTIFACT_UNAVAILABLE"
          : "RELEASE_ARTIFACT_INVALID",
        message: unavailable
          ? "One or more active release artifacts are unavailable."
          : "The active release failed runtime validation.",
      },
    };
  }
}

export const loadActiveRelease = cache(() =>
  readActiveRelease({ dataMode: readServerEnv().DATA_MODE }),
);
