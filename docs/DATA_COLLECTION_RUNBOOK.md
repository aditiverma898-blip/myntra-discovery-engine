# Data Collection and External API Runbook

## Current status

This is the operational procedure for the project owner to run real data collection on the **destination computer**, after implementation, tests, source review, and empty-mode QA are complete.

Version `1.4.0` adds a separate bounded Reddit expansion after the successful v1.3.3 recovery. All transport verification used mocks; no source request, collector dry-run, model call or credential was used on this computer. Live execution remains destination-operated. Gemini is paused and is not required.

The v1.0 run returned 613 valid comments and is closed. The partial v1.1 YouTube batch remains resumable with its unchanged configuration. The new `youtube-myntra-coverage-v12-20260823-001` batch uses the same 100-search-call ceiling across more topic strata; it starts in a separate output directory and must not overwrite the v1.1 checkpoint. Raw YouTube API data is not permanent: delete or refresh it within 30 days, as recorded in the manifest.

The completed v1.2 store return contained 4,137 Google Play and 2,506 Apple records (6,643 total), with zero reported request failures. The `myntra-store-topup-v13-20260823-001` collection config avoids mutating that completed batch: Google Play traverses known page ranges before retaining later pages, while Apple uses eight additional storefronts and treats a missing feed as exhausted. Its 13,000 new-record ceiling is capacity, not promised yield.

The primary Reddit collection config is `reddit-myntra-official-v13-20260823-001`. It is free of provider charges but not automatically authorized. Its first invocation creates a disabled local approval and exits without calling Reddit. Execution requires explicit Reddit approval for the exact use case, a recorded authorization reference, three destination-only OAuth fields, and both runtime safety opt-ins. The collector searches Myntra posts within six selected communities, then retrieves bounded top-level comments because the official API does not support general comment-body search.

The three earlier conditional batches are retired. The v1.3.2 run was safely recovered into 49 valid `IndianFashionAddicts` comments at USD 0.22 cumulative cost. The current separate `reddit-myntra-apify-expansion-v14-20260823-001` pack excludes that completed community and searches the other five reviewed communities for at most 1,000 comments. It pins build `5.7.9`, uses asynchronous checkpoints and row-isolated mapping, and is capped at USD 4.25. At current Free-plan pricing, five full runs project to about USD 4.10; combined with the recovered run, the planned maximum is USD 4.32. It requires `APIFY_TOKEN` and a new approval confirming the expanded volume. Free Apify credit does not establish authorization or guarantee that cash billing is disabled.

Detailed step-by-step operator guides for the destination computer are maintained internally and are not part of the released documentation set. The limited external operator must follow those guides exactly and must not redesign or implement the system.

## Safety contract

The project has three execution classes.

### Implementation-computer commands

Only empty/fixture development commands are executed on the current implementation computer. They must not access a network or require credentials:

```bash
npm run pipeline:empty
npm run pipeline:fixtures
npm run publish:empty
npm run test
```

### Destination-computer dry run

After export, the project owner runs:

```bash
npm run collect:dry-run:destination -- --config <batch.json> --approval <approval.json>
```

This command is not executed on the implementation computer. It must not contact a source or construct a source client.

### Destination-computer external commands

These are owner-operated only on the destination computer at the final stage:

```bash
npm run collect:external -- --allow-external
npm run classify:external -- --allow-external
npm run embed:external -- --allow-external
```

An implementation must refuse every deferred command unless both `ALLOW_EXTERNAL_CALLS=true` and `--allow-external` are present. Reddit additionally requires `REDDIT_SOURCE_APPROVAL=approved` and a current source approval record.

## Roles

| Role | Responsibility |
|---|---|
| Project owner | Exports the project; approves source scope, intended use, costs, credentials, destination dry-run, external execution, and final publication. |
| Implementer | Builds guarded adapters using fixtures/mocks and documents their exact behavior; executes neither dry-run nor external runs on the implementation computer. |
| Research reviewer | Audits relevance, labels, themes, contradictions, examples, and claim language. |
| Release reviewer | Confirms privacy, artifact integrity, QA, and deployment behavior. |

One person may hold multiple roles, but each decision must still be recorded.

## Prerequisites before any external execution

Do not proceed until all are true:

- Empty and fixture test suites pass with network denial enabled.
- The application builds and every route works with no credentials.
- The selected source has an `approved` entry using the template in [SOURCE_REGISTER.md](SOURCE_REGISTER.md).
- The exact API, library, actor/build, terms pages, intended use, and publication method were reviewed recently.
- Collection limits, request/quota limits, and maximum cost are finite.
- Raw/intermediate/output locations are outside client-public assets and gitignored.
- Retention and deletion deadlines are configured.
- The adapter dry-run shows no hidden source or fallback route.
- Credentials are stored only in an uncommitted local secret file or approved secret manager.
- The owner accepts that public availability and third-party tooling do not themselves establish authorization.

## Locked target and recommended source order

The first real cycle targets **20,000 raw Myntra-specific records**, with an acceptable range of **18,000–22,000**:

| Source | Preferred target |
|---|---:|
| Google Play Myntra reviews | 8,000 |
| Apple App Store Myntra reviews | 3,000 |
| Myntra-focused YouTube comments | 5,000 |
| Approved Reddit records explicitly about Myntra | 2,000 |
| Approved Myntra product reviews | 2,000 |
| **Total** | **20,000** |

If Reddit or Myntra product-review access is not approved, use the documented Myntra-only fallback of 10,000 Google Play reviews, 3,000 App Store reviews, and 7,000 Myntra-focused YouTube comments. Do not replace a missing source with another shopping platform. Full sampling rules are in [SOURCE_REGISTER.md](SOURCE_REGISTER.md).

Enable sources one at a time so schema, relevance, and bias can be evaluated before adding complexity:

1. Approved manual JSONL/CSV import for an end-to-end real-format smoke test.
2. Google Play, after current access/terms review.
3. Apple App Store, after current access/terms review.
4. YouTube official API, after quota/project setup.
5. Myntra product evidence only through an approved method.
6. Reddit official OAuth only if its separate written approval and authorization-reference gate pass; otherwise omit it.

The engine must not require Reddit to reach a valid release.

## Step 1 — Create source approval records

For every planned source:

1. Copy the approval template from the source register into a restricted/versioned approvals location.
2. Record owner, date, URLs reviewed, purpose, commercial context, route, allowed/prohibited fields, limits, retention, deletion, publication, AI processing, cost cap, and review expiry.
3. Set decision to `approved` or `rejected`.
4. Add only the approval ID and status to collection configuration; do not copy confidential legal notes into public artifacts.
5. Reject any adapter that uses a different route from the approved record.

## Step 2 — Configure a collection batch

Create a batch configuration with separate query IDs. Illustrative shape:

```yaml
batch_id: batch-YYYY-MM-DD-NNN
sources:
  - source: google_play
    enabled: true
    approval_id: source-YYYY-NNN
    locale: en_IN
    max_items: 50
    rating_strata: [1, 2, 3, 4, 5]
    date_from: YYYY-MM-DD
    date_to: YYYY-MM-DD
queries: []
raw_retention_days: 2
max_total_cost: 0
```

Use a small first batch. Never start with an unbounded actor/API run or the full query pack.

For query-targeted sources, include broad, targeted, price-control, and positive/disconfirming groups. Preserve each query separately.

## Step 3 — Export and add credentials on the destination computer

Before adding credentials:

1. Export/copy the completed project to the destination computer.
2. Install dependencies and run the empty/fixture tests there with external access disabled.
3. Confirm the empty application renders and no secret file was included in the transfer.
4. Create the destination-only environment file.

Target environment:

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

Rules:

- Begin with `ALLOW_EXTERNAL_CALLS=false`.
- Add only credentials required for the selected approved source.
- Never paste secrets into committed configuration, shell history examples, logs, screenshots, run manifests, or the browser.
- Never expose a source or model key through `NEXT_PUBLIC_*`.
- Do not add Reddit credentials when Reddit is omitted. The preferred official route does not use Apify; the mutually exclusive conditional actor route uses only `APIFY_TOKEN`.

### Destination credential and route setup

Before enabling any source, set up destination-only credentials following [config/destination/README.md](../config/destination/README.md): copy the relevant example approval into `config/destination/local/`, edit it on the destination computer, and place credentials only in the destination `.env` (never in committed files). The dry-run reports credential presence as booleans only; revoke unused credentials after the run.

Every source follows the same guarded flow using the Step 4–5 commands — a dry-run (`npm run collect:dry-run:destination`) that makes no call and prints the plan, then the owner-run `npm run collect:external -- --allow-external` once the exact route is approved:

- **Store top-up (Google Play + Apple):** free public routes, no token. The `myntra-store-topup-v13-20260823-001` config avoids mutating the completed v1.2 batch; run the dry-run first, then the bounded external collection after both exact routes are approved.
- **Reddit (official OAuth):** requires `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, a truthful `REDDIT_USER_AGENT`, `REDDIT_SOURCE_APPROVAL=approved`, and a current approval record. Keep the persistent flags disabled until the approval is validated.
- **Reddit (conditional Apify Scraper Lite):** mutually exclusive with the official route. The recovered v1.3.2 batch is complete and must not be resumed; the `reddit-myntra-apify-expansion-v14-20260823-001` config excludes that community. It requires only a scoped `APIFY_TOKEN` and a fresh expanded-volume approval — confirm at least USD 4.25 of free credit remains before running.

## Step 4 — Run and inspect dry-run on the destination computer

Example target command:

```bash
npm run collect:dry-run:destination -- \
  --config config/destination/local/batch-YYYY-MM-DD-NNN.json \
  --approval config/destination/local/source-approval-YYYY-NNN.json
```

The dry-run must print/write only a plan containing:

- source/adapter and approval status;
- sanitized queries/parameters;
- intended request/item limits;
- cost/quota ceiling;
- output and quarantine paths;
- retention deadline;
- whether credentials are present as booleans only;
- exact reasons an external run would be blocked.

Dry-run success does not mean collection is authorized. It means configuration is internally valid.

Reject the plan if it shows:

- unexpected proxy, login, cookie, user-profile, or alternate scraper use;
- an unlimited item/comment/request/cost setting;
- an unreviewed actor build or source route;
- public/raw output paths;
- a missing approval or deletion policy;
- broad community/feed collection when a targeted query was intended.

## Step 5 — Execute a small approved collection

Only the project owner performs this step.

1. Set `ALLOW_EXTERNAL_CALLS=true` on the destination computer.
2. If and only if Reddit is approved, set `REDDIT_SOURCE_APPROVAL=approved` and point configuration to the current approval ID.
3. Run the selected collector with `--allow-external`, the small config, and explicit output path.
4. Observe request counts/costs and terminate if the live route differs from the dry-run.
5. Set `ALLOW_EXTERNAL_CALLS=false` again immediately after the run.

Implemented target command:

```bash
npm run collect:external -- \
  --config config/destination/local/<batch>.json \
  --approval config/destination/local/<source-approval>.json \
  --allow-external
MYNTRA_OPERATION_EXIT_CODE=$?
```

The exit-code assignment must be the first command after execution. Restore `ALLOW_EXTERNAL_CALLS=false`, then produce the mandatory summary:

```bash
npm run destination:report -- \
  --kind collection_external \
  --id <batch-id>-external \
  --exit-code "$MYNTRA_OPERATION_EXIT_CODE" \
  --plan data/raw/<batch-id>/collection-plan.sanitized.json \
  --manifest data/raw/<batch-id>/run-manifest.json \
  --failures data/raw/<batch-id>/failures.jsonl
```

The generated `data/intermediate/operator-reports/<batch-id>-external/DESTINATION_EXECUTION_REPORT.json` records `success`, `partial`, `failed`, `blocked`, or `unsafe_incomplete`, plus counts, request/cost totals, restored safety state, artifact hashes, and sanitized failures. Generate and return it even when the external command failed before producing a manifest.

## Step 6 — Audit the raw batch before processing

Inspect the run manifest and a source-stratified sample:

- received, valid, invalid, duplicate, and error counts;
- stable IDs, URLs, publication dates, source/query/run provenance;
- unexpected fields, identity data, deleted/removed rows, or HTML;
- whether the sample actually contains relevant decision language;
- language and date/rating distributions;
- query/source domination;
- provider/actor cost and status;
- raw retention deadline.

Reject/quarantine the batch if the collection route changed, PII minimization cannot be completed, provenance is missing, relevance is unusably low, costs exceeded limits, or errors were silently embedded as successful rows.

## Step 7 — Normalize and deduplicate locally

Run the offline pipeline on the destination computer with external access disabled:

```bash
npm run pipeline:real -- \
  --input data/raw/batch-YYYY-MM-DD-NNN/raw-records.jsonl \
  --run-id real-run-YYYY-MM-DD-NNN \
  --dataset-version myntra-candidate-NNN \
  --raw-retention-deadline YYYY-MM-DDTHH:mm:ss.sssZ \
  --restricted-retention-deadline YYYY-MM-DDTHH:mm:ss.sssZ \
  --retention-policy approved-policy-id \
  --prepare-only
```

Review the failure ledger. Confirm identity fields are gone before classification, embedding, or AI use. Preserve one canonical evidence unit and all matching query IDs.

## Step 8 — Build the human relevance evaluation set

Before model-scale classification:

1. Draw a source-balanced set of at least 300 records when sufficient data exists.
2. Label 100 direct/likely-direct candidates, 100 adjacent candidates, and 100 general/irrelevant candidates.
3. Code barrier/journey stage for at least 150 relevant records.
4. Include positive, ambiguous, price-only, generic complaint, and contradictory cases.
5. Save adjudications separately from raw data.

Do not tune prompts only against obvious targeted matches.

## Step 9 — Execute classification only if approved

Classification sends minimized text to the configured provider and is therefore another external stage. Review the provider’s data-use terms, model, costs, region, retention, and approved fields first.

1. Dry-run prompt/config/sample sizes.
2. Enable external calls only for the run.
3. Start with the evaluation set and a low finite limit.
4. Require structured schema output, caching, checkpointing, retries, and a failure ledger.
5. Disable external calls after completion.
6. Measure relevance precision/recall, label agreement, unsupported inference, and schema failures.
7. Do not scale until quality thresholds in the test plan pass.

Target command:

```bash
npm run classify:external -- \
  --input data/intermediate/canonical/<batch-id>.jsonl \
  --limit 300 \
  --allow-external
```

## Step 10 — Discover and review themes

1. Build an 800–1,500-record source-balanced relevant sample.
2. Use local lexical clustering first or execute an approved embedding stage.
3. Run the offline Python clustering script against local vectors.
4. Inspect evidence IDs per cluster.
5. Human-review names, merges, splits, inclusion/exclusion rules, positive cases, and contradictions.
6. Version taxonomy v1.
7. Reclassify/assign the full approved corpus and inspect `other`/new-theme candidates.

Embeddings are an external stage when generated by a provider:

```bash
npm run embed:external -- \
  --input data/intermediate/reviewed/<batch-id>.jsonl \
  --allow-external
```

Never mix vectors from different models or dimensions.

## Step 11 — Aggregate and create a candidate release

With external access disabled:

```bash
npm run aggregate -- --dataset <dataset-version>
npm run release:validate -- --dataset <dataset-version>
npm run release:preview -- --dataset <dataset-version>
```

Inspect:

- direct/adjacent/general denominators;
- source/query concentration;
- every opportunity score input;
- contradictions and positive outcomes;
- example evidence and source/publication permission;
- privacy redaction and client/server visibility;
- taxonomy/model/prompt/embedding versions;
- quality warnings and failed rows.

No candidate becomes `ready` until a human reviewer accepts the examples and claim wording.

## Step 12 — Publish and QA

Promote atomically only after validation:

```bash
npm run publish:release -- --dataset <dataset-version>
```

Then run the app in ready mode with external access still disabled:

```dotenv
DATA_MODE=ready
ALLOW_EXTERNAL_CALLS=false
ENABLE_RUNTIME_LLM=false
```

Verify every dashboard number against artifacts, every evidence link/ID, empty filters, mobile behavior, methodology warnings, and Copilot extractive/abstention behavior.

Runtime LLM generation is a separate optional decision. Do not enable it merely because classification credentials exist.

## Step 13 — Retention and deletion

- Delete unredacted/raw temporary exports on schedule.
- Keep a deletion log with batch ID, artifact, due date, completion date, and reviewer.
- Refresh/remove deleted-source content when required.
- Rebuild the release if removal changes published evidence or aggregates materially.
- Revoke unused credentials and remove temporary secrets.
- Preserve manifests, aggregated results, review decisions, and permitted minimized evidence according to the approved policy.

## Failure recovery

- Never overwrite the previous accepted snapshot or release.
- Retry only categorized transient failures with bounded backoff.
- Do not call a different source/actor automatically.
- Resume from the last valid checkpoint and content-hash cache.
- Record permanently failed items without fabricating labels.
- A partial external run produces `partial`, not `ready`.
- If a provider quota/cost limit is reached, disable external access and review progress before continuing.
- Always generate the destination execution report after disabling external access; never retry before the primary agent reviews it.

## Final owner checklist

- [ ] Every enabled source has current approval.
- [ ] Dry-run matched live route and limits.
- [ ] Costs/quotas stayed within cap.
- [ ] `DESTINATION_EXECUTION_REPORT.json` exists and its safety/result state was reviewed.
- [ ] Raw data is restricted and scheduled for deletion.
- [ ] Identity fields were removed before AI/embedding stages.
- [ ] Relevance evaluation met thresholds.
- [ ] Themes were discovered/reviewed rather than imposed.
- [ ] Direct and adjacent evidence remain separate.
- [ ] Contradictions and positive cases are visible.
- [ ] No population or causal claims appear.
- [ ] Release schemas, checksums, counts, and references pass.
- [ ] Client artifacts contain no secret, raw corpus, or embedding vectors.
- [ ] Ready-mode app works with all external access disabled.
