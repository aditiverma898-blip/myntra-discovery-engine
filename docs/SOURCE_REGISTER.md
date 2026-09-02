# Source Register

## Purpose and status language

This register records why a source is useful, how it could be accessed, what it may support, and which gate must pass before use. It is an engineering/product-research control, not legal advice or proof of authorization.

Status values:

- `context_only`: may inform product capability or research vocabulary; not counted as Voice of Customer.
- `planned_disabled`: adapter may be implemented against fixtures, but neither dry-run nor live collection is executed on the implementation computer.
- `approval_required`: must remain disabled until the owner records a source/terms decision.
- `approved`: an owner/date/scope-specific approval exists; not currently assigned to any source.
- `rejected`: do not implement or use as a dependency.

**Current implementation status:** YouTube has a separately reviewed official-API execution record. Destination-operated store runs returned valid Google Play and Apple records with zero provider failures. The v1.3.3 recovery preserved 49 valid Reddit comments from the first successful Actor dataset. Version 1.4 adds a separate five-community, 1,000-result expansion pack under a USD 4.25 cap; it is mock/offline-verified here and ships disabled. No collector or provider dry-run was run on this implementation computer.

## Source decision table

| Source | Research value | Proposed access route | Current status | Key risks and controls |
|---|---|---|---|---|
| Google Play Myntra reviews | Broad dated app/service vocabulary; may reveal wishlist or progression defects. | Implemented pinned `google-play-scraper` route for exact package `com.myntra.android`; no key/provider fee. | `planned_disabled` | Unofficial and parser-sensitive; no automatic authorization. Preserve locale/query/sort/version, stratify ratings and fail closed on schema change. |
| Apple App Store Myntra reviews | Complementary app feedback by version/date/country. | Implemented typed direct Apple public customer-review JSON feed for exact app ID `907394059`; no key/provider fee. | `planned_disabled` | Public feed is bounded and storefront-biased; current terms/access must be checked. Preserve title/rating/date/country/version and record feed ceiling. |
| YouTube videos/comments | Try-on, sizing, haul, comparison, quality, returns, and external validation behavior. | Official YouTube Data API. | `planned_disabled` | Quota/cost, creator sponsorship, comment sorting, commenter not verified purchaser. Record video/query and separate creator claims from comments. |
| Myntra product reviews/customer photos | Strong product-level fit, material, colour, quality evidence. Usually post-purchase adjacent. | Approved manual/structured import unless a permitted official route is confirmed. | `approval_required` | No assumed public API; terms/robots, media rights, user identifiers, review survivorship. Do not bulk scrape by default. |
| Official Myntra listing/help/PDP pages | Capability, policy, and product-context truth. | Manual research references or approved requests. | `context_only` | Does not establish need or prevalence; page behavior may vary by session/product. |
| Reddit communities | Rich decision language, workarounds, comparisons, and contradictory discussion. | Primary: implemented official application-only OAuth route. Conditional: pinned `trudax/reddit-scraper-lite` Apify actor for comment search under a USD 5 hard cap. | `approval_required` and environment-disabled | Reddit currently requires explicit approval. The actor is not authorization and may scrape through proxies. Enforce an exact-route authorization reference, deletion/retention, identity minimization, finite limits, and no model training/LLM transfer without permission. |
| Academic/industry sources | Mechanisms and taxonomy vocabulary. | Cited desk research. | `context_only` | Different samples/geographies/tasks; never counted as Myntra VoC. |
| Manual CSV/JSONL import | Permits owner-supplied, reviewed, already-authorized data. | Local file adapter with schema validation. | `planned_disabled` | Owner must establish provenance and rights; reject missing provenance, secrets, or unnecessary PII. |
| PullPush/Arctic Shift/unofficial Reddit archives | Historical technical access and comment search. | None. | `rejected` for the current build | Availability is not Reddit authorization; deletion freshness, completeness, current-data lag, uptime and downstream-use permission are unsuitable for the primary evidence route. |
| Instagram/X/Quora/search-result scraping | Potential external behavior evidence. | None. | `rejected` as critical dependency | Access controls, unstable scraping, login/bot-evasion risks, privacy and terms concerns. |

## Locked first-cycle collection matrix

The first real collection targets **20,000 raw records**, with an acceptable operating range of **18,000–22,000**. Targets are upper planning allocations, not instructions to collect irrelevant or duplicated content merely to reach a number.

Every retained Voice-of-Customer record must be explicitly Myntra-specific through its app listing, Myntra product context, Myntra-focused video, explicit Myntra text, or Myntra URL. Other shopping platforms are not sources, query targets, comparison entities, or dashboard dimensions.

### Preferred five-source allocation

| Source | Raw target | Share | Sampling requirement | Expected analytical role |
|---|---:|---:|---|---|
| Google Play Myntra reviews | 8,000 | 40% | Balance rating, time, locale, and app version where available. | Broad Myntra app vocabulary and progression/service context. |
| Apple App Store Myntra reviews | 3,000 | 15% | Balance rating/date and record storefront/version coverage. | Independent Myntra app-review stratum. |
| Myntra-focused YouTube comments | 5,000 | 25% | Use roughly 80–120 Myntra-focused videos; cap any one video at 100 retained top-level comments/replies combined. | Fit, try-on, quality, trust, external research, and decision language. |
| Approved Reddit Myntra posts/comments | 2,000 | 10% | Discover up to 200 candidate posts; retain roughly 40–60 relevant threads; cap any one thread at 100 retained comments. | Detailed decision journeys, workarounds, and contradictions. |
| Approved Myntra product reviews | 2,000 | 10% | Balance categories, ratings, and dates; text only by default. | Product-specific fit/material/visual evidence, normally journey-adjacent. |
| **Total** | **20,000** | **100%** | Deduplicate across queries before analytical counts. | Multi-source Myntra corpus. |

### Approval-safe three-source fallback

If Reddit or Myntra product-review collection is not approved, do not silently substitute another shopping platform. Use this Myntra-only fallback:

| Source | Raw target |
|---|---:|
| Google Play Myntra reviews | 10,000 |
| Apple App Store Myntra reviews | 3,000 |
| Myntra-focused YouTube comments | 7,000 |
| **Total** | **20,000** |

If a source cannot supply its target without excessive duplication or poor relevance, accept a release within 18,000–22,000 and document the shortfall. Do not inflate a source with irrelevant content.

### Planning yields, not promised findings

The following bands are capacity expectations used to size the pipeline; they are not research claims:

- 20,000 raw rows;
- approximately 16,000–19,000 canonical rows after validation/deduplication;
- approximately 3,000–6,000 direct plus journey-adjacent records after relevance filtering;
- 800–1,500 source-balanced relevant records for exploratory theme discovery;
- at least 300 human-labelled evaluation records;
- full structured classification of every approved relevant record, not only the discovery sample.

No minimum number of direct-wishlist records will be fabricated. The release reports the actual yield. If direct evidence is too sparse, opportunity results remain qualitative and limitations are elevated.

## Important interpretation: Apify and PullPush

Apify is a platform that can execute an actor and return a dataset. PullPush is an unofficial archive/access route. Neither property means the underlying source permits the proposed collection or downstream use.

“Available through a tool” is different from:

- free: actors, platform compute, proxies, APIs, storage, or quotas may cost money;
- authorized: the source’s current terms and required permission still apply;
- compliant: the project remains responsible for purpose, minimization, retention, deletion, and publication;
- reliable: community actors and unofficial archives may be incomplete, stale, insecure, or change schema;
- safe to publish: collection permission does not automatically permit bulk redistribution or model use.

Therefore an actor or archive is only a potential processing route after source approval. Vendor text such as “public data,” “no OAuth,” or “compliant” is not accepted as proof.

## Reddit approval hierarchy

1. Use Reddit's truthful current access path and obtain explicit written approval for this exact purpose. Academic research must use Reddit for Researchers; a genuinely non-commercial developer app uses the Data API request form. Do not misclassify research as an app to bypass eligibility.
2. After approval, use the implemented official OAuth route with the exact approved client identity, truthful user agent, finite limits, and deletion/retention plan.
3. Creating credentials or finding a working endpoint is not approval. The local approval record must contain a non-secret authorization/ticket reference.
4. If bulk collection is not approved, consider only a small owner-reviewed set of permitted public URLs and paraphrased observations.
5. If permission remains unclear, omit Reddit. The dashboard and pipeline must still function.

Apify is not the primary route. The conditional transport pins `trudax/reddit-scraper-lite` Actor build number `5.7.9`, starts asynchronously, persists the run ID, and polls the same run because it can search comment bodies that the official API cannot. The recovered v1.3.2 batch is complete and must not be resumed. The version 1.4 expansion excludes its completed community and caps the other five at 200 results each, 1,000 total, 120 API/poll requests and USD 4.25. It requires `APIFY_TOKEN` and a fresh expanded-volume approval. A dedicated scoped token with Actor Run and generated-dataset access remains preferred; the successful recovery proved that a full-account token is unnecessary. PRAW is maintained but duplicates a small TypeScript OAuth surface; archived `snoowrap` is not added.

`REDDIT_SOURCE_APPROVAL` remains `disabled` until the approval record below is complete. The environment flag is an application safety control, not a legal conclusion.

The destination-only steps for the request form, OAuth app card, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, truthful `REDDIT_USER_AGENT`, scoped `APIFY_TOKEN`, `.env` editing, presence checks and revocation follow [config/destination/README.md](../config/destination/README.md).

## Candidate Reddit communities

Community rules and relevance must be rechecked immediately before any approved run.

| Priority | Community | Potential evidence | Sampling warning |
|---:|---|---|---|
| 1 | `r/IndianFashionAddicts` | Fit/sizing, fabric/quality, occasion choice, returns, wrong-product and photo-review use. | Advice posts overrepresent uncertainty/problem cases. |
| 2 | `r/IndianBeautyDeals` | Wishlist/cart behavior, buy-now/wait, sale timing, stock and seller trust. | Price/deal selected and beauty-heavy; use as context or negative control. |
| 2 | `r/TwoXIndia` | Clothing quality, shopping experience, sale timing and decision discussion. | Broad community scope; retain only explicit Myntra search hits. |
| 2, diagnostic | `r/IsThisAScamIndia` | Non-delivery, wrong-product, refund and dispute narratives. | Strong incident/negative-selection bias; allegations remain user claims. |
| 3, diagnostic | `r/MyntraSucks` | Wishlist defects and extreme service/return failures. | Severe negative-selection bias; never use for prevalence or untriangulated ranking. |
| 3, discovery only | `r/india` | Occasional Myntra trust, quality, support, and purchase-decision discussion. | Very low signal density; use only explicit Myntra search hits. |

Do not collect private, restricted, quarantined, deleted, identity-sensitive, or user-profile data. Do not bulk collect a community merely because one relevant thread exists.

## Initial query groups

Every query must be Myntra-specific. Other shopping-platform names are prohibited from collection configuration. Preserve a separate query ID for every individual phrase.

### Direct wishlist and intent

```text
Myntra wishlist buy later
Myntra wishlist saved item bought
Myntra wishlist saved item did not buy
Myntra wishlist forgot
Myntra wishlist revisit
Myntra wishlist remove
Myntra wishlist clutter
Myntra wishlist limit
Myntra wishlist move to bag
Myntra wishlist size
Myntra wishlist out of stock
Myntra wishlist waiting
Myntra wishlist deciding
Myntra wishlist confused
Myntra wishlist compare
Myntra wishlisted for wedding
Myntra wishlisted for party
Myntra wishlisted for office
Myntra wishlisted for trip
Myntra wishlisted for gift
Myntra saved item
Myntra should I buy
```

### Fit, size, and silhouette

```text
Myntra saved item not sure size
Myntra between sizes
Myntra size chart wrong
Myntra sizing issue
Myntra fit different by brand
Myntra model fit
Myntra dress length
Myntra too loose
Myntra too tight
Myntra too small
Myntra too large
Myntra size nahi samajh
Myntra perfect fit
Myntra size chart accurate
```

### Material, quality, visual fidelity, and trust

```text
Myntra material
Myntra fabric
Myntra fabric thin
Myntra fabric thick
Myntra transparent
Myntra quality after wash
Myntra colour different from photo
Myntra actual product
Myntra product looks different
Myntra review photo
Myntra customer photo
Myntra reviews fake
Myntra reviews rejected
Myntra trusted reviews
Myntra authenticity
Myntra exactly like picture
Myntra photo jaisa nahi
Myntra kapda quality
```

Allegations such as “fake” or “authenticity” remain user claims and must not be published as established facts.

### Decision comparison and external workarounds

```text
Myntra compare products
Myntra same product confused
Myntra alternative product
Myntra worth it
Myntra recommendation
which one should I buy Myntra
confused between two dresses Myntra
confused between two shoes Myntra
Myntra screenshot ask friend
Myntra WhatsApp outfit advice
Myntra Reddit outfit advice
Myntra YouTube haul
Myntra try on
Myntra sizing video
Myntra visit store
Myntra brand website
Myntra Google Lens
```

These queries investigate comparison behavior while keeping Myntra as the only shopping platform in scope.

### Availability, return risk, delivery, and progression

```text
Myntra wishlisted size out of stock
Myntra wishlist restock
Myntra delivery before wedding
Myntra delivery before event
Myntra return size
Myntra exchange only decided not to buy
Myntra return risk
Myntra wishlist add to bag problem
Myntra checkout abandoned
Myntra payment verification
Myntra additional fee abandoned
Myntra easy return made me buy
Myntra fast delivery event
```

### Price as a competing explanation

```text
Myntra wishlist price
Myntra sale cart
Myntra lowest price
Myntra waiting for sale
Myntra buy now or wait
Myntra payday wishlist
```

These queries measure price dependency but must not drive a monetary solution.

### Positive and disconfirming evidence

```text
Myntra wishlist useful
Myntra bought from wishlist
Myntra perfect fit
Myntra size chart accurate
Myntra exactly like picture
Myntra trusted reviews
Myntra easy return made me buy
Myntra no need to compare
Myntra repeat brand size
```

The query groups cover:

- direct wishlist intent/progression;
- fit, size, silhouette, and brand consistency;
- material, quality, colour, visual mismatch, review trust, authenticity;
- comparison, alternatives, external research, and advice;
- occasion, styling, deadline, stock, delivery, return, and bag progression;
- price as a competing explanation;
- positive/disconfirming cases.

Run broad wishlist discovery before targeted themes, and store exact terms rather than translating them into an opaque combined query. Include observed Hindi/Hinglish variants only after the vocabulary is reviewed. A record returned by a Myntra query must still pass `myntraSpecific=true`; incidental or unrelated matches are rejected.

## Source sampling requirements

### Google Play

- Target package currently documented as `com.myntra.android`; verify before execution.
- Sample across rating and time rather than newest-only or lowest-rated-only.
- Store country, language, sort, collection range, app version when available, and current listing URL.
- Apply relevance classification before analytics.

### Apple App Store

- Target India App Store ID currently documented as `907394059`; verify before execution.
- Store country/feed, title, rating, published date, app version when available, and listing/review URL.
- Record feed limitations and missing dates.

### YouTube

- Use official search/video/comment endpoints when approved.
- Store query, video/channel IDs, video URL/title, publication time, result position/sort, comment/reply relationship, and collection time.
- Separate video metadata/creator statement/commenter statement.
- Capture sponsorship/creator-affiliation signals only when explicitly visible; do not infer them.

### Reddit

- Prefer the approved official OAuth route. The only implemented alternative is the separately approved/capped Reddit Scraper Lite pack; never fall back silently to it, other HTML scraping, PullPush, Pushshift or Arctic Shift.
- Search posts within one explicitly configured subreddit at a time and require `Myntra` in the returned title/body.
- Fetch comments only from those matching posts because the official Data API has no general comment-body search endpoint.
- First-cycle pack: `r/IndianFashionAddicts`, `r/IndianBeautyDeals`, `r/india`, `r/TwoXIndia`, `r/IsThisAScamIndia`, and `r/MyntraSucks`; up to 50 top-level comments per post, 2,000 total items and 300 requests.
- Store post/comment IDs, parent post ID, URL, subreddit, time and non-identifying engagement metadata. Never retain author identity or profile data.
- Report community/thread/query imbalance and keep positive or contradictory evidence; do not interpret complaint-heavy communities as prevalence.
- If the conditional actor expansion is approved, search comments only, use the exact `Myntra` term and one selected community per query, drop actor-returned usernames/flairs immediately, and enforce both Apify paid-item and USD 4.25 expansion charge caps.

### Product evidence

- Treat post-purchase reviews as adjacent by default.
- Store product/category/variant context where permitted.
- Do not collect customer images for redistribution without explicit review.
- Prefer short text excerpts or paraphrases in published evidence.

## Collection-run manifest requirements

Every future run records:

- internal collection run ID;
- source, adapter, adapter version, and code commit;
- approval record ID/status;
- exact query/sort/time/locale/limits;
- start/end time and final status;
- request/item/error/duplicate counts;
- finite budget/quota caps and observed cost where available;
- raw output location and checksum;
- retention/deletion deadline;
- schema warnings and source changes.

For Apify also store actor ID, build/tag, actor permissions, run ID, dataset ID, input schema version where available, and exact sanitized input.

## Privacy, retention, and publication

- Drop usernames, profile URLs, avatars, flairs, and user-history fields before normalization/AI stages.
- Do not hash identities unless an approved research question genuinely requires longitudinal linkage.
- Store unredacted exports only in restricted temporary storage and delete them by the source-specific deadline.
- The v1.3 Reddit pack uses a 14-day raw-export ceiling. Shorten it if the recorded authorization requires; never extend it merely for convenience.
- Honor Reddit/User deletion requests within the applicable deadline (the current Developer DPA specifies no later than 10 days after a request) and refresh/remove expired research snapshots.
- Maintain deletion refresh/expiry where the source requires honoring deletions.
- Do not train or fine-tune models on collected source text in this project.
- Do not publish bulk source corpora or embeddings.
- Prefer paraphrases plus source links; use short quotations only when permitted and necessary.
- Do not log or commit API tokens, cookies, credentials, or complete provider payloads.

## Batch acceptance criteria

A source batch can enter normalization only if:

- current approval/configuration permits the exact source and use;
- adapter/build matches the approved record;
- limits and cost caps are finite;
- required provenance fields meet the configured completeness threshold;
- unexpected schema/error rows are identified;
- raw output is stored in the approved restricted location;
- retention/deletion deadline is recorded;
- zero profile-only records enter the corpus;
- failures are visible rather than silently skipped.

A Reddit batch also requires a source-stratified relevance audit, no unintended domination by one subreddit/query/thread, valid parent relationships, and an explicit human decision to accept or omit it.

## Approval record template

Create one versioned record per source before enabling it:

```yaml
approval_id: source-YYYY-NNN
source: example
owner: project-owner
decision: approved | rejected
decision_date: YYYY-MM-DD
reviewed_urls: []
intended_purpose: qualitative product discovery
commercial_context: potentially commercial assignment/prototype
access_route: official-api | approved-processor | manual-import
allowed_content: []
prohibited_content: []
collection_limits: {}
retention_rule: ""
deletion_process: ""
publication_rule: ""
ai_processing_rule: ""
cost_cap: null
expiry_or_review_date: YYYY-MM-DD
notes: ""
```

Approval is scoped to the recorded route, purpose, date, and limits. A source or actor change requires re-review.
