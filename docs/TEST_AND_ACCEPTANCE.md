# Test and Acceptance Plan

## Purpose

Testing must prove both analytical correctness and the absence of unsafe behavior. A visually polished dashboard is not accepted if it fabricates empty-state values, loses provenance, makes external calls during implementation, or overstates public evidence.

## Test layers

| Layer | Tool/approach | Primary responsibility |
|---|---|---|
| Schema/unit | Vitest + Zod | Environment, artifact, scoring, normalization, validation, and guard functions. |
| Component | React Testing Library | Status-aware cards, tables, filters, errors, labels, and accessibility semantics. |
| Integration | Vitest with temp artifacts/fixtures | Complete offline pipeline stages, APIs, release validation, and network denial. |
| Analytical Python | Python test runner | Clustering input/output determinism, invalid vectors, and local fallback. |
| Browser | Playwright | Routes, responsive behavior, keyboard use, empty/fixture/error states. |
| Manual research QA | Structured sampling worksheet | Relevance, taxonomy, evidence, contradiction, privacy, and claim review. |

## Gate 1 — Documentation consistency

Acceptance:

- README identifies `docs/` as canonical and legacy plans as supporting history.
- The business metric, cohort, no-monetary constraint, provisional problem, and research boundary agree across documents.
- Architecture, data contract, source register, and runbook use the same status/source/relevance language.
- No documentation implies that Apify, PullPush, public data, or a third-party actor is automatically free or authorized.
- Commands not yet implemented are visibly identified as target interfaces.
- No provisional theme, segment, count, or score is described as a finding.
- The collection target is consistently 20,000 raw Myntra-specific records, with an accepted 18,000–22,000 range and no non-Myntra shopping-platform scope.

## Gate 2 — External-access safety

Automated scenarios:

1. No credentials, no flag: external adapter throws before client construction.
2. Credential only: blocked.
3. `ALLOW_EXTERNAL_CALLS=true` only: blocked.
4. `--allow-external` only: blocked.
5. Both controls but source disabled: blocked.
6. Reddit controls enabled but approval record absent/expired/mismatched: blocked.
7. Unlimited/invalid limit or cost: blocked.
8. The dry-run planner and executable CLI return a sanitized plan and import no transport; only the disabled example dry-run is executed on the implementation computer.
9. Empty/fixture pipelines: pass with `fetch`, HTTP/HTTPS, sockets, provider SDK transports, and collector processes denied.
10. Logs and errors never contain credential values.

Acceptance:

- `npm install`, tests, production build, and empty/fixture application startup require no API key.
- The complete automated suite passes in a network-denied environment.
- No test is allowed to bypass denial with an untracked allow-list; fixtures/mocks are explicit.
- Destination external execution remains deferred; the CLI/transport contracts are accepted through dependency-injected mocks and global network denial.

## Gate 3 — Empty release

Artifact tests:

- status is `empty`, version is present, and `generatedAt` is `null`;
- product scope is exactly `myntra`;
- all unknown totals/counts are `null`, not zero;
- evidence-derived arrays are empty;
- quality is `not_evaluated`;
- no evidence, quote, embedding, finding, or synthetic fixture exists in the active empty release;
- checksum/reference validation passes.

Application tests:

- every route renders without data or credentials;
- global dataset badge and “not collected” banner are visible;
- metrics read “Not collected” and do not render zero-value trend charts;
- research lenses/segments are labelled provisional hypotheses;
- filters have understandable empty states;
- `/api/evidence` returns `status: empty`, `items: []`, `total: null`;
- `/api/copilot` returns `usedLLM: false`, `mode: unavailable`, and no evidence IDs;
- no provider module is initialized in empty mode;
- invalid active release renders a safe error state rather than partial/stale claims.

## Gate 4 — Synthetic fixture vertical slice

The fixture set must be explicitly synthetic and cover:

- direct wishlist fit uncertainty;
- material/quality uncertainty;
- comparison-heavy active shortlist;
- return-risk moderation;
- positive/contradictory evidence;
- generic severe but irrelevant complaint;
- price-only waiting;
- passive saving;
- duplicate/cross-query record;
- missing optional fields;
- malformed record and mocked classifier failure.

Acceptance:

- same fixture input and versions produce byte-stable or semantically stable outputs as specified;
- normalization preserves minimized original text and provenance;
- exact duplicate is counted once with all query associations;
- direct, adjacent, general, and irrelevant examples classify as expected;
- multi-barrier classification is preserved;
- contradiction/positive cases reach aggregate output;
- failures enter a ledger and do not silently disappear;
- scores reproduce from displayed inputs;
- release validation catches broken references/checksums/vector dimensions;
- fixture UI is visibly marked synthetic and cannot be mistaken for project findings.

## Gate 5 — Normalization and privacy

Test cases:

- timestamp/string/null variants;
- invalid URL and source ID;
- HTML/script-like text remains escaped/plain;
- usernames/profile URLs/avatar/flair fields are removed;
- text hashing is stable under defined normalization;
- deleted/removed/empty records are handled explicitly;
- parent/child references resolve or quarantine;
- language/translation metadata is not fabricated;
- raw/restricted paths are excluded from client publishing;
- secrets and representative token formats are absent from generated artifacts and bundles.

Acceptance: no unnecessary identity field enters classification, embedding, client aggregates, public evidence, or logs.

## Gate 6 — Classification and methodology

Before real-corpus scale, the human-labelled evaluation set must include at least 300 records when sufficient records exist: 100 direct/likely-direct candidates, 100 journey-adjacent candidates, and 100 general/irrelevant candidates. At least 150 relevant records also receive barrier and journey-stage labels.

Initial release thresholds:

- relevance precision for `direct_wishlist`: at least 0.85;
- relevance recall across direct/adjacent: at least 0.80;
- structured-schema success after bounded retry: at least 0.98;
- unsupported demographic/commercial segment inference: 0 in reviewed sample;
- human agreement on primary barrier for relevant records: at least 0.75;
- every low-confidence direct record selected for publication is human-reviewed;
- every high-severity allegation displayed is human-reviewed.

If a threshold fails, keep the release `partial`, revise method/version, and repeat evaluation. Do not lower thresholds silently.

## Gate 7 — Theme and opportunity quality

Acceptance:

- taxonomy v1 is created only after open-ended clustering/review;
- theme definitions have inclusion/exclusion rules and representative evidence IDs;
- `other` and `candidate_new_theme` remain possible;
- source-balanced sample and clustering configuration are recorded;
- positive and contradictory evidence is displayed or noted;
- no theme is ranked solely by raw targeted-query count;
- direct and adjacent counts are separate;
- source/query concentration warning appears when appropriate;
- all opportunity score components, monetary adjustment, denominator, and limitations are visible;
- scoring code exactly matches the methodology formula;
- opportunity names/descriptions do not imply causal impact.

## Gate 8 — Evidence API and retrieval

Evidence API:

- invalid query enums, cursors, limit, or oversized `q` return controlled 4xx errors;
- default limit is 25 and maximum is 100;
- repeated filters, contextual facets, exact-ID lookup, date bounds, rating sorts, and every cursor fingerprint field are tested;
- pagination never skips or repeats an evidence ID, and every collected source returns non-zero results in provisional browser acceptance;
- server/restricted fields are never serialized;
- filters and pagination are stable;
- empty and malformed release behaviors match the contract.

Retrieval/Copilot:

- vector model/dimensions mismatch causes abstention/error;
- keyword fallback works without embeddings;
- top evidence is diversified by source and parent thread;
- supplied filters are honored;
- generated citations may reference only retrieved evidence IDs;
- prompt instructions inside evidence cannot change system behavior;
- off-topic and unsupported questions abstain;
- question length and content type are validated;
- rate limit/cache operate when optional runtime generation is enabled;
- deterministic extractive mode works with runtime LLM disabled.

## Gate 9 — UI quality and accessibility

Browser acceptance at representative mobile and desktop viewports:

- all six primary presentation routes and the secondary Methodology route work; Segments is absent from primary navigation;
- no horizontal overflow or obscured controls;
- keyboard navigation, visible focus, skip/main landmarks, headings, and table semantics are correct;
- charts include non-colour encodings, legends/labels, and text summaries;
- contrast meets WCAG AA for normal interface text;
- loading, empty, partial, ready, and error states are distinguishable;
- dataset version, generated time/status, denominators, and warnings are visible;
- evidence drawer/modal manages focus and escape correctly;
- reduced-motion preference is respected;
- production dashboard loads within the agreed budget using the fixture-size release;
- no sensitive raw corpus or embedding asset is downloadable from `public/`.

Target performance budget for the initial dashboard: approximately three seconds on normal broadband, with client artifacts kept deliberately compact. Measure rather than claim before release.

## Gate 10 — Candidate real-data release

This gate is deferred until the project owner runs approved external stages.

Acceptance:

- the collection contains 18,000–22,000 raw Myntra-specific records or documents a quality/availability reason for an approved shortfall;
- no other shopping platform appears as a source, comparison target, classification entity, or dashboard dimension;
- every source run maps to a current approval record;
- run route, limits, costs, output, and deletion deadline match the dry-run/approval;
- source-required provenance completeness reaches the configured threshold;
- unexpected zero counts, date gaps, duplicates, schema changes, and source concentration are reviewed;
- quality report includes failures and omissions;
- classification evaluation passes;
- representative evidence and paraphrase/quotation permissions are reviewed;
- aggregates reproduce from evidence;
- all references/checksums/versions pass;
- published bundle contains only client-safe aggregates/method metadata;
- ready-mode application works with all external collection/classification flags disabled;
- claims use corpus/source-specific language and state limitations.

### Provisional inspection mode

When technical processing is complete but volume or human gates are open, a partial release may be loaded only through `DATA_MODE=provisional` and `data/releases/provisional.json`.

Acceptance:

- the header and persistent notice say the labels/findings are unreviewed candidates;
- the partial release is never written to `active.json` by the promotion command;
- simulated review/taxonomy artifacts say they are workflow-only and are not release-eligible;
- UI/API/Copilot use only minimized release evidence and make no external/model call;
- desktop and mobile provisional Playwright tests pass;
- missing raw-volume, human-review, taxonomy, privacy/claim, and interview gates remain visible in documentation and quality output.

## Gate 11 — Research to interview readiness

An opportunity may be selected for interviews only when:

- evidence is direct or has a defensible adjacent mechanism;
- multiple reviewed source/query contexts support it or concentration is explicitly accepted;
- conversion-stage link is plausible and stated as inference;
- the cohort has observable recruitment criteria;
- the root is meaningfully non-monetary;
- contradictory evidence and data gaps are documented;
- interview questions can confirm or disprove the mechanism.

The engine does not pass this gate merely because one opportunity has the highest numerical score.

## Phase 1 documentation acceptance checklist

- [x] Root README and authority/reading order.
- [x] Project overview and delivery sequence.
- [x] Provisional problem statement and disconfirmation criteria.
- [x] Research evidence boundary and prioritization.
- [x] Technical architecture and no-network contract.
- [x] Methodology, relevance rules, scoring, and claims policy.
- [x] Source register, Reddit/Apify decision, privacy, and approval template.
- [x] Data, release, Evidence API, and Copilot contracts.
- [x] Owner-operated collection/API runbook.
- [x] Implementation and real-release acceptance gates.

All code/runtime checkboxes remain future work; this checklist records only the Phase 1 documentation deliverable.
