# Research and Analysis Methodology

## Purpose

This methodology is designed for product discovery, not population measurement. It explains how the engine will turn approved public evidence into transparent opportunity hypotheses without confusing targeted public feedback with representative Myntra customer data.

## Evidence units and strata

Each retained record is one canonical evidence unit: an app review, product review, video comment, forum post/comment, or approved imported observation. Reposts, cross-query hits, and duplicated comments share one canonical ID while retaining all discovery routes.

Evidence is reported by source stratum:

- Myntra-specific app feedback;
- product/category decision evidence;
- Myntra-specific external fashion-shopping conversation;
- official Myntra capability/policy context;
- academic/industry mechanism context.

Only Myntra-specific customer Voice-of-Customer strata contribute to evidence counts. Official Myntra, academic, and industry materials inform context, labels, and questions but never increase theme frequency. Other shopping platforms are excluded from collection and analysis.

## Discovery and sampling

1. Freeze source, query, language, geography, date, sort, and result limits before collection.
2. Start with broad wishlist/decision queries before targeted barrier terms.
3. Add disconfirming and positive-resolution queries.
4. Sample across dates, ratings, query groups, and source strata where the source permits.
5. Record whether discovery was organic, keyword-targeted, video-targeted, thread-targeted, or manually sampled.
6. Never combine incompatible source/query samples into a population percentage.
7. Retain result position and run ID so selection can be audited.

The full initial query vocabulary is preserved in the scoping study. Query terms are inputs to discovery, not the taxonomy and not evidence that the named problem exists.

## Relevance levels

| Label | Inclusion rule | Example interpretation |
|---|---|---|
| `direct_wishlist` | A saved/wishlisted item and a decision/progression outcome are explicit. | Saved item; still unsure of size; continues waiting. |
| `journey_adjacent` | A fashion purchase uncertainty, workaround, or risk is explicit, but a saved item is not. | Uses customer photos to verify colour before an online purchase. |
| `general` | Myntra/fashion-shopping feedback without a saved-item decision mechanism. | Generic delivery or support complaint. |
| `irrelevant` | Unrelated, spam, unusable, or insufficient text. | Promotional template or unrelated app issue. |

Rules that prevent overclassification:

1. A post-purchase review remains adjacent unless the writer explicitly connects it to a later saved-item decision.
2. Price language requires an explicit purchase dependency before assigning price-waiting intent.
3. “Size issue” must be subclassified; a return does not automatically establish pre-purchase fit anxiety.
4. Unavailable size is a decision blocker only when it is the preferred/required variant and no accepted substitute is chosen.
5. Watching a video, asking a friend, or visiting a store is a workaround only when tied to the decision.
6. Product mismatch, catalog inaccuracy, authenticity suspicion, wrong fulfillment, and review distrust remain distinct.
7. Multi-label evidence is allowed; forced single-theme assignment is not.
8. Positive and contradictory evidence is retained.
9. A query or parent-video title may establish collection context but never establishes the commenter's wishlist intent, journey stage, barrier, action, or experience.
10. Other-shopping-platform comparisons encountered incidentally are excluded from analysis under the Myntra-only scope rather than treated as comparative evidence.

The zero-cost deterministic classifier produces candidate labels only. It records `method: rule`, a classifier/taxonomy version, confidence reason and `humanReviewStatus: unreviewed`. Candidate labels cannot complete a real pipeline release until reviewed; a model API is not required.

## Intent and journey coding

Wishlist intent modes:

- near-term purchase;
- comparison shortlist;
- occasion/deadline planning;
- passive inspiration;
- price tracking;
- gift planning;
- mixed;
- unknown.

Journey stages:

- wishlist add;
- active intent/revisit;
- research;
- comparison;
- decision;
- bag;
- checkout;
- post-purchase;
- unknown.

The classifier must attach an evidence reason/confidence and use `unknown` rather than inventing context.

## Provisional barrier vocabulary

The following are candidate dimensions, not a fixed discovery result:

- fit/size/silhouette uncertainty;
- material/quality uncertainty;
- colour/image mismatch;
- review or authenticity trust gap;
- comparison/choice overload;
- styling/occasion uncertainty;
- social-validation gap;
- price or budget timing;
- stock/variant unavailability;
- delivery/deadline uncertainty;
- return/refund risk;
- wishlist clutter/forgetting;
- passive low-intent bookmarking;
- checkout/payment friction;
- other/candidate new theme.

Open-ended discovery is performed before taxonomy v1 is finalized.

## Theme-discovery procedure

1. Select an 800–1,500-record sample from the planned 20,000-record raw collection when sufficient approved data exists. Balance it across Myntra source strata and relevance; do not simply take the newest rows.
2. Generate local lexical vectors or user-operated embeddings.
3. Cluster the sample and inspect cluster stability.
4. Name each cluster only from its evidence IDs and spans.
5. Human-review over-broad clusters, duplicates, operational failures, positive cases, and contradictions.
6. Write a theme definition, user goal, barrier/root, journey stage, inclusion criteria, exclusion criteria, workarounds, and representative IDs.
7. Publish taxonomy v1 with `other` and `candidate_new_theme` available.
8. Classify the approved corpus as zero-or-more themes.
9. Review frequent unclassified content and update the taxonomy as a new version rather than mutating the old release.

No LLM calculates the final score or decides whether a theme is true. It may propose structured labels or cluster names that are schema-validated and reviewable.

## Behavioral segment rules

Segments describe an observable sequence or decision strategy, such as an active fit-anxious revisitor or comparison-heavy shortlister. A segment requires:

- qualifying behavioral criteria;
- one or more evidence spans;
- evidence confidence;
- unknown fields explicitly represented;
- a recruitment rule suitable for interviews.

Do not infer age, gender, income, body type, customer value, personality, tenure, purchase frequency, or plan from a single public record.

## Opportunity scoring

Opportunity scoring ranks research candidates inside the collected corpus. It does not estimate market size or causal lift.

Each component is normalized from 0 to 100:

```text
Base Opportunity Score =
    0.25 x corpus frequency
  + 0.20 x severity
  + 0.20 x conversion proximity
  + 0.15 x non-monetary solvability
  + 0.10 x target-segment value
  + 0.10 x evidence confidence
```

Where:

- **Corpus frequency** is the share of relevant evidence in the same declared denominator, deduplicated and reported by source/query stratum.
- **Severity** uses explicit outcomes: inconvenience, postpone, abandon, purchase elsewhere, return/loss.
- **Conversion proximity** maps the barrier to revisit, decision, bag, or checkout.
- **Non-monetary solvability** judges whether the underlying problem can plausibly be addressed without an incentive.
- **Target-segment value** is directional and behavior-based; without internal data it cannot be commercial value.
- **Evidence confidence** combines directness, source diversity, sample size, label confidence, human review, and contradiction handling.

Apply a monetary-dependency adjustment:

```text
Adjusted Score = Base Score x (1 - 0.5 x monetary_dependency)
```

`monetary_dependency` is normalized from 0 (none) to 1 (entirely price-dependent).

Every displayed score must show its raw component values, denominator, direct/adjacent split, source concentration, and confidence. A high score is a prioritization aid, not scientific truth.

## Quality controls

### Before scaling classification

Create a human-labelled evaluation set of at least 300 records when real data exists:

- 100 direct or likely-direct candidates;
- 100 journey-adjacent candidates;
- 100 general/irrelevant candidates.

For at least 150 relevant records, also label journey stage and barriers. Measure relevance precision/recall, barrier agreement, journey agreement, unsupported segment inference, and schema failures.

### Human review requirements

Review:

- every high-severity allegation selected for display;
- low-confidence direct-wishlist records;
- representative evidence for each published theme/opportunity;
- new-theme candidates and contradictions;
- a source-stratified sample of exclusions;
- any translated evidence used in a finding.

### Release quality signals

- count before/after normalization, deduplication, relevance, and review;
- missing dates and URLs;
- invalid/schema-failure count;
- duplicate rate;
- language distribution;
- source/query concentration;
- classification coverage and confidence;
- human audit agreement;
- unresolved failures and source omissions.

## Claim language

Allowed:

- “Within the collected, query-targeted evidence…”
- “This theme appears across two reviewed source strata…”
- “The evidence suggests…”
- “Direct evidence is limited; adjacent evidence indicates…”
- “This remains a hypothesis for interviews.”

Prohibited:

- “X% of Myntra users…”
- causal conversion, revenue, or 30-day impact from comments;
- all wishlists imply purchase intent;
- a missing public page proves a feature does not exist;
- demographic or commercial attributes not explicitly and ethically supplied;
- an allegation of fraud/authenticity as fact;
- incompatible cross-source percentages;
- sentiment equals severity, intent, or opportunity value;
- the top public complaint is the top internal blocker;
- the engine alone validated the problem or selected the MVP.

## Copilot methodology

- Retrieve only reviewed evidence from the active release.
- Treat the question and evidence text as untrusted content.
- Apply relevance/source/theme filters and diversify by source and parent thread.
- Answer only from retrieved aggregates and evidence.
- Cite evidence IDs and source links where permitted.
- State denominator, source/query context, confidence, and limitations.
- Abstain when evidence is absent, weak, off-topic, or inconsistent.
- Optionally compose the answer prose with a server-side LLM (Google Gemini) when `ENABLE_RUNTIME_LLM=true` and a `GEMINI_API_KEY` is present; the LLM authors only the narrative, while citations and typed fields stay deterministic. Without a key, or on any error, answers remain deterministic and extractive.
- In empty mode, return a deterministic explanation and perform no external request.

## Reproducibility

Every release records:

- dataset, schema, taxonomy, prompt, classifier, embedding, and analytics versions;
- collection run IDs, source/query coverage, dates, and selection methods;
- code commit SHA when available;
- record counts at each stage;
- artifact checksums;
- quality-gate status and known failures.

Changes to methods create a new release. Published results are never silently overwritten.
