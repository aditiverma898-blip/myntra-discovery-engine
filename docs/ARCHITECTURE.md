# Technical Architecture

## Architecture goals

The system must be:

- safe to build and run without data, credentials, scraping, or external API access;
- explainable enough to summarize in one slide;
- reproducible through versioned, validated artifacts;
- evidence-first rather than dependent on a fixed theme taxonomy;
- traceable from aggregate findings to reviewed evidence;
- small enough to deploy and run as a self-contained app;
- modular enough to replace local JSON/vector storage later without rewriting the product.

## Locked stack

### Application

- Next.js 16 App Router and React 19.
- TypeScript in strict mode.
- Tailwind CSS for the design system.
- Recharts for accessible analytical charts.
- Framer Motion for restrained interaction and transitions.
- Lucide for icons.
- Zod for environment, artifact, request, and response validation.
- Vitest and React Testing Library for unit/component tests.
- Playwright for browser acceptance tests.
- Vercel-compatible deployment.

### Offline processing

- TypeScript for CLI orchestration, collectors, normalization, validation, classification adapters, aggregation, publishing, and artifact management.
- Python only for offline exploratory clustering in `analysis/discover_themes.py`.
- JSONL for record-level stages and JSON for manifests/aggregates.
- No application database in v1.

### AI and retrieval

- The required zero-cost path uses deterministic offline classification, reviewed lexical theme discovery, BM25 retrieval and extractive answers; it needs no model API or vector database.
- External classification and embeddings are optional, offline, explicitly user-run stages and are not required for a ready release.
- AI providers sit behind typed adapters and are developed only with mocked responses.
- Provider model ID, prompt version, embedding dimensions, and response schema version are stored in artifacts rather than assumed in code.
- Theme discovery supports local lexical features without embeddings so fixture mode remains independent of APIs.
- Ready-mode Copilot uses hybrid local retrieval. Generative answering is optional and server-side; deterministic extractive answers remain available.

Verify model availability, cost, data-use terms, and dimensions immediately before the user enables an external AI stage. Do not copy model IDs from the Spotify reference without verification.

The Spotify reference's strongest free pattern is retained: heuristics label the complete corpus, lexical retrieval provides a no-key fallback, and offline artifacts are cached. Gemini is paused after its optional synthetic probe and is not part of the YouTube 20K workflow. No YouTube API data is submitted to Gemini.

## System boundary

```text
                         IMPLEMENTATION-TIME BOUNDARY
                   no network, no scraping, no API requests

fixtures / empty artifacts
          |
          v
approved live runner -> normalize -> deduplicate -> relevance
          |                                      |
          |                                      v
          |                           theme discovery/classification
          |                                      |
          v                                      v
 fixture-validated                       aggregate + quality report
 pure dry-run + mocked live runner
                                                  |
                                                  v
                                      versioned release artifacts
                                                  |
                         +------------------------+-------------------+
                         |                                            |
                         v                                            v
                 Next.js dashboard                          Evidence/RAG services
                 client-safe aggregates                     server-only corpus

              DESTINATION-COMPUTER USER-OPERATED STAGE
 execution pack -> dry run -> approved source call -> return artifacts
                         -> primary-agent review -> local deterministic analysis
                                      -> reviewed release
```

The deployed application never runs collectors, rebuilds the corpus, or performs batch classification. It reads an immutable active release.

## Runtime modes

| Mode | Data source | External access | Visible behavior |
|---|---|---|---|
| `empty` | Canonical empty release | Disabled | Complete UI, “Not collected” metrics, hypotheses clearly labelled, no Copilot generation. |
| `fixtures` | Synthetic test release | Disabled | Populated demonstration used only for local development/tests; visibly marked synthetic. |
| `provisional` | Checksummed partial real-data release | Disabled | Local-only candidate aggregates/evidence, unmistakably marked unreviewed and blocked from production promotion. |
| `ready` | Reviewed real-data release | Disabled by default | Real aggregates/evidence; local retrieval. Optional generation only when separately enabled by owner. |

Release state is separate from runtime mode:

- `empty`: no collection has occurred;
- `partial`: one or more planned stages/sources are incomplete;
- `ready`: all required release gates passed;
- `error`: release invalid or unavailable; application falls back safely without presenting stale data as current.

## Mandatory external-access guard

Default environment:

```dotenv
DATA_MODE=empty
ALLOW_EXTERNAL_CALLS=false
ENABLE_RUNTIME_LLM=false
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APIFY_TOKEN=
REDDIT_SOURCE_APPROVAL=disabled
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=
```

Every external adapter must call a shared `assertExternalCallsAllowed()` before importing/constructing a network client. An external command proceeds only when:

1. `ALLOW_EXTERNAL_CALLS` parses to literal `true`;
2. the CLI receives `--allow-external`;
3. the selected source is enabled in the current source register/configuration;
4. source-specific approval gates pass;
5. required cost/record limits are finite and positive.

Missing approval fails closed with a human-readable plan; it must never silently downgrade to an alternate scraper.

Tests install a global network-denial handler. Any unmocked HTTP, socket, fetch, provider SDK, or child collector request fails the test suite.

## Repository layout for later phases

```text
src/
  app/
    page.tsx
    opportunities/page.tsx
    themes/page.tsx
    segments/page.tsx
    evidence/page.tsx
    methodology/page.tsx
    copilot/page.tsx
    api/evidence/route.ts
    api/copilot/route.ts
  components/
    layout/
    dashboard/
    charts/
    evidence/
    copilot/
    ui/
  lib/
    analytics/
    data/
    llm/
    rag/
    schemas/
    types/
    external-access.ts

data-pipeline/
  cli/
  collectors/
  normalize/
  classify/
  aggregate/
  publish/
  adapters/
  fixtures/

analysis/
  discover_themes.py
  tests/

data/
  raw/
  intermediate/
  releases/
    empty/

docs/
tests/
```

This keeps the straightforward root-level shape of the Spotify implementation while adding explicit release, safety, and schema boundaries.

## Pipeline stages

### 1. Collect/import

Collectors produce append-only raw JSONL and an atomic run manifest. Version `1.3.2` supports the same guarded routes behind source-approval, explicit-flag and process-local external-call gates:

- official YouTube Data API discovery with candidate deduplication, batched duration/comment-count enrichment, title/metadata eligibility and balanced selection across 20 query and hashed-channel strata;
- pinned `google-play-scraper` for the exact `com.myntra.android` listing, with locale, sort, date, rating and text-quality filters;
- a typed direct client for Apple's bounded public customer-review JSON feed for exact app ID `907394059`, with storefront, sort, date, rating and text-quality filters.
- the official Reddit Data API through application-only OAuth, with one-subreddit-at-a-time post search followed by bounded comment-tree retrieval for matching Myntra threads.

The authenticated Google Play Developer and App Store Connect review APIs are intended for apps controlled by the caller, so they cannot provide Myntra reviews to this independent project. The credential-free store routes are not described as official owner APIs or automatic authorization. Their approval templates remain disabled until the owner reviews current terms.

The official Reddit route is also disabled by default. It requires current Reddit approval for the exact use case, a recorded non-secret authorization reference, client ID/secret, truthful user agent, `REDDIT_SOURCE_APPROVAL=approved`, the generic external-call opt-in and `--allow-external`. It does not perform general comment-body search because the official API does not expose that capability.

A mutually exclusive conditional pack uses `trudax/reddit-scraper-lite` build number `5.7.9` when—and only when—the recorded Reddit authorization explicitly permits that scraper and Apify processor route. Version 1.3.2 starts the Actor asynchronously, persists the returned run ID as a checkpoint, polls that same run with a provider wait shorter than the HTTP timeout, and excludes polling checkpoints from source-page caps. Poll timeouts retry only GET requests. A start request whose outcome is unknown is never automatically repeated because an unseen run may exist. The transport records the resolved build number/ID and preserves only a bounded, credential-redacted provider error code/message. It searches comment bodies for exact Myntra mentions, caps output at 1,350, caps charge at USD 5, and applies Apify's paid-item cap as well as the batch cost guard. Actor-returned usernames/flairs are not mapped. PullPush, Arctic Shift and other HTML scraping are not fallbacks. Both Reddit routes cap raw retention at 14 days and keep AI/model use disabled unless authorization specifically permits it.

Version 1.3 also fixes the real-corpus deduplication bottleneck. Exact matches are merged in one pass and near-duplicate candidates are generated through a frequency-ordered token-prefix index rather than falling back to an all-pairs quadratic scan. The original fixture semantics at Jaccard `0.78` are retained while the audited 6,643-row store corpus completes in seconds.

All transport behavior is accepted through injected mocks only on the implementation computer; live calls remain destination-operated.

YouTube raw data is treated as a renewable restricted cache. Current policy limits non-authorized API data such as comment text, titles and descriptions to 30 calendar days before deletion or refresh. The project records a deadline but does not silently delete owner data. A logically continuous research corpus therefore uses refreshed/versioned snapshots and removes expired raw copies; permanent unrefreshed storage is not supported without applicable YouTube approval.

### 2. Normalize and minimize

- Standardize dates, URLs, ratings, language and source fields.
- Normalize text without destroying the original evidence span.
- Remove usernames, profile URLs, avatars and unnecessary identifiers.
- Hash content for deduplication.
- Quarantine invalid rows with explicit error codes.

### 3. Deduplicate

- Stable source ID match.
- Canonical URL match.
- Normalized content hash.
- Near-duplicate grouping for reposted/cross-query evidence.
- Retain all query/run associations on the canonical evidence unit.

### 4. Relevance gate

Classify into `direct_wishlist`, `journey_adjacent`, `general`, or `irrelevant`. Direct requires both a saved/wishlisted item and an explicit decision/progression outcome.

### 5. Theme discovery and classification

- Draw an 800–1,500-record source-balanced, high-relevance sample from the planned 20,000-record raw collection.
- Create embeddings or local lexical vectors.
- Cluster without forcing the provisional theme list.
- Name clusters from evidence.
- Human-review merges, splits, inclusion rules, exclusions, and contradictions.
- Version taxonomy v1.
- Classify the approved corpus as multi-label, retaining `other` and `candidate_new_theme`.

### 6. Aggregate and score

Generate source-specific counts, relevance distributions, journey/intent/barrier relationships, behavioral segment cues, contradiction measures, and opportunity inputs. Direct and adjacent evidence remain separable in every calculation.

### 7. Publish

Validate a candidate release in a temporary location, create a quality report, and atomically promote the active manifest only if all gates pass. The prior accepted release remains recoverable.

## Release artifacts

```text
data/releases/<dataset-version>/
  manifest.json
  aggregates.json
  methodology.json
  taxonomy.json
  quality-report.json
  evidence.server.jsonl
  embeddings.server.jsonl
```

- `manifest.json`: identity, status, versions, coverage, counts, checksums, and filenames.
- `aggregates.json`: client-safe dashboard data.
- `methodology.json`: source/query and method metadata safe for public display.
- `taxonomy.json`: reviewed labels and inclusion/exclusion rules.
- `quality-report.json`: gates, failures, sampling audit, and known limitations.
- `evidence.server.jsonl`: redacted, reviewed evidence; never placed under `public/` by default.
- `embeddings.server.jsonl`: server-only vectors aligned to evidence IDs.

Raw source exports, unredacted text, prompts/responses, caches, failed rows, and intermediate clustering files remain local/restricted and gitignored.

## Application data flow

```text
active release manifest
  -> Zod validation
  -> status-aware data repository
       -> server components load client-safe aggregates
       -> /api/evidence queries reviewed server corpus
       -> /api/copilot retrieves bounded, source-diverse evidence
  -> UI renders status, denominators, versions, and limitations
```

An invalid release cannot partially populate the dashboard. The loader exposes an error state and the UI explains that the release failed validation.

## Empty-release contract

The first publishable release contains no fabricated data:

```json
{
  "status": "empty",
  "datasetVersion": "empty-001",
  "generatedAt": null,
  "productScope": "myntra",
  "sources": { "configured": [], "collected": [] },
  "totals": {
    "evidence": null,
    "themes": null,
    "segments": null,
    "opportunities": null
  },
  "themes": [],
  "segments": [],
  "opportunities": [],
  "sourceStats": [],
  "quality": { "status": "not_evaluated" }
}
```

Unknown is represented by `null`, not numerical zero.

## Evidence API

`GET /api/evidence` is the only Evidence Explorer data source and supports validated, URL-backed, capped query parameters:

- `q`; repeated `source`, `relevance`, `theme`, `barrier`, `journey`, `segment`, `rating`, and exact `id`; `confidence`, `from`, `to`, and `sort`;
- an opaque filter-fingerprinted `cursor` and `limit` (25 default, 100 maximum);
- stable evidence ordering and opaque pagination.

Empty response:

```json
{
  "status": "empty",
  "items": [],
  "nextCursor": null,
  "total": null
}
```

Only public-safe fields are returned. Raw provider responses and private processing metadata are never exposed.

`GET /api/analytics` applies the identical canonical filter contract without pagination and derives every KPI, source/relevance/rating distribution, barrier, journey, monthly coverage, heatmap intersection, facet, and denominator from the same matching evidence set. Parsed JSONL and the ID/source retrieval indexes are cached server-side by release directory plus dataset version. The browser never receives the complete 11,903-record corpus.

## Interview-ready presentation architecture

The primary runtime hierarchy is Overview → Analytics → Opportunities → Segments → Themes → Evidence → Copilot. Methodology is a secondary route. Segments ranks behavioural cohorts derived from barrier evidence; supported cohort evidence also appears in Analytics. Overview uses immutable release aggregates. Analytics and Evidence use coordinated URL state and canonical server APIs. Opportunity/theme/chart counts link back to exact Evidence filters. Copilot posts to `/api/copilot`; no browser-side corpus or retrieval code is used.

The source palette is stable across charts, charts include text/table equivalents, journey counts are explicitly non-exclusive, monthly series are labelled collection coverage rather than behaviour trends, and store ratings exclude YouTube/Reddit. One compact mode/status strip appears on every presentation page; full limitations stay on Overview and Methodology.

## Retrieval and Copilot

Ready-mode retrieval combines:

```text
semantic candidates + keyword/BM25 candidates + metadata filters
  -> rerank -> source/thread diversification -> bounded evidence set
```

Rules:

- corpus and question vectors must use the same provider/model/dimensions;
- vector mismatch causes abstention, not invalid similarity;
- retrieval returns stable evidence IDs;
- evidence excerpts are untrusted data and cannot override system rules;
- a generated answer may cite only IDs supplied in its context;
- off-topic, unsupported, or weak-evidence questions receive an abstention/limitations response;
- empty mode never initializes the provider and returns `usedLLM: false`, `mode: "unavailable"`.

The optional runtime LLM requires its own `ENABLE_RUNTIME_LLM=true`; it is not enabled by the data-collection flag. The shipped runtime uses deterministic BM25 retrieval; when `ENABLE_RUNTIME_LLM=true` and a `GEMINI_API_KEY` is present, Copilot composes the answer prose with Google Gemini (model IDs rotate; overridable via `GEMINI_MODEL`) grounded in that retrieved evidence. The LLM authors only the answer text — all citations and typed fields stay deterministic — and any failure or missing key falls back to the extractive answer (`mode: "extractive"`, `usedLLM: false`).

## Security, privacy, and operational controls

- Secrets remain server/pipeline-only and are validated as absent from client bundles.
- Request bodies have strict schemas, size caps, and content-type checks.
- Copilot is rate-limited and cached when externally enabled.
- Collected HTML is never rendered; text is escaped by default.
- Content Security Policy and standard security headers are configured.
- No raw corpus or embeddings are placed in public assets.
- Source-specific retention/deletion rules are enforced before publishing.
- Logs redact credentials, usernames, prompt content where sensitive, and raw provider bodies.
- Every destination attempt produces a restricted, credential-scanned operation report with explicit outcome, safety state, metrics, artifact hashes, sanitized failures, and next action.
- Dataset, schema, taxonomy, prompt, classifier, and embedding versions are visible.
- Public quotations are short, necessary, permitted, and linked; paraphrase is preferred.

## Scaling path

The local JSONL pipeline is designed for 18,000–22,000 raw Myntra-specific records and an expected smaller reviewed relevant corpus. The in-process vector scan applies only to the reviewed server corpus, not all raw data. If measured memory, cold-start, filtering, or latency becomes unacceptable, migrate the same typed evidence/vector contract to Postgres and `pgvector`. The dashboard, API response shapes, evidence IDs, and release methodology do not change.

## One-slide architecture statement

> The engine turns approved multi-source fashion conversations into versioned, evidence-backed wishlist opportunities through normalization, direct-relevance gating, open-ended theme discovery, structured coding, deterministic scoring, and a traceable dashboard/Copilot.
