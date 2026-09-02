# Research Basis

## Purpose

This document summarizes the research that narrows the Discovery Engine. It condenses a fuller internal evidence-based scoping study, which contains the detailed audit, evidence table, sources, query pack, and gaps.

The scoping study was completed on 22 August 2026 before implementation. It combined current Myntra product/capability review, official sources, academic and industry mechanisms, and a small traceable set of public Voice-of-Customer examples.

Some legacy research notes contain comparisons with other shopping platforms. Those references are historical context only and are excluded from the implemented collection plan, query pack, classification model, analytics, and dashboard.

## Research boundary

### Supported by the current evidence

- Myntra exposes substantial product-decision information, including product details, measurements, fit cues, reviews/photos, price/stock, delivery information, seller/authenticity claims, and item-specific return terms.
- Wishlists can act as decision-deferral tools and can contain heterogeneous intent.
- Fit/silhouette and material/quality uncertainty are credible online-fashion purchase barriers.
- Review usefulness/trust and return-policy risk can influence purchase intention.
- Fashion decisions can involve cross-channel information search.
- Choice overload is conditional; a large assortment or wishlist is not automatically a problem.

### Still hypotheses

- Existing Myntra information fails specifically when a user revisits a wishlisted item.
- Fit is Myntra’s largest 30-day wishlist blocker.
- Wishlist clutter, forgetting, styling, social validation, occasion needs, stock, or reminders are material opportunities.
- Public feedback has the same composition as the target Myntra cohort.
- Any specific feature would improve the business metric.

### To be determined by the engine

- the intent modes visible in direct saved-item evidence;
- recurring unresolved questions among still-interested users;
- barrier proximity to revisit-to-bag versus checkout or post-purchase;
- co-occurring categories, behaviors, and workarounds;
- themes that survive deduplication, source stratification, contradiction search, and human review;
- which roots are monetary versus meaningfully non-monetary.

### To be validated after the engine

- the real job of saving and the meaning of continued intent;
- the exact unresolved decision in a recent episode;
- workaround order and effectiveness;
- the causal role of fit, quality, comparison, returns, occasion, and logistics;
- the importance and recruitability of the selected problem.

## Provisional prioritization

The research used a directional seven-factor assessment rather than a prevalence estimate.

| Rank | Candidate problem | Directional result | Implementation decision |
|---:|---|---:|---|
| 1 | Fit and silhouette confidence | 32/35 | Primary discovery lens. |
| 2 | Material, quality, colour, and visual confidence | 31/35 | Secondary lens; separate information gaps from actual failures. |
| 3 | Comparison and resume cost | 27/35 | Investigate only for active shortlists. |
| 4 | Return/exchange downside risk | 27/35 | Standalone theme and cross-cutting moderator. |
| 5 | Occasion/deadline confidence | 26/35 | Retain as a candidate, with currently thinner evidence. |
| 6 | Preferred variant availability | 26/35 | Mechanical blocker; study communication/substitution only. |
| 7 | Checkout friction | 25/35 | Defer as a lead theme pending internal telemetry. |
| — | Price/budget timing | 28 raw | Measure as a competing explanation; deprioritize due to constraint. |

These numbers prioritize research effort only. They are not opportunity scores, prevalence, or evidence of business impact.

## Important audit insight

The observable Myntra product page is information-rich. The open question is not simply whether information exists, but whether it is:

- sufficiently diagnostic for the individual;
- trusted and internally consistent;
- relevant to the selected variant and context;
- easy to recover at wishlist revisit;
- capable of resolving the next decision.

This prevents the project from prematurely designing “more information” when the real issue may be trust, personalization, comparison, continuity, or operational failure.

## Behavioral segments retained for investigation

| Segment | Observable qualifying behavior | Evidence status |
|---|---|---|
| Still-interested fit-anxious revisitor | Recent saved item, revisit, unresolved fit/size question, no purchase. | Strong adjacent; direct prevalence unknown. |
| New-to-brand/category evaluator | Saved an unfamiliar brand/category and searched fit or quality evidence. | Medium-high. |
| Quality-evidence seeker | Uses reviews/photos or external sources to judge material/colour/quality. | Medium. |
| Comparison-heavy active shortlister | Has two or more substitutes for one need and switches among them. | Medium. |
| High-intent occasion shopper | Has a named event/date and still needs to choose. | Low-to-medium. |
| Return-risk-sensitive shopper | Checks reversibility or changes behavior after a prior return experience. | Medium adjacent. |
| Preferred-variant waiter | Wants a specific unavailable size/colour and waits. | Low-to-medium. |
| Passive inspiration saver | Saves without a purchase date or active decision. | Contrast group. |
| Deal/budget waiter | Purchase explicitly depends on sale, price, or budget timing. | Contrast/exclusion for solution selection. |

## Source evidence hierarchy

1. App-store reviews: broad, dated vocabulary but low direct-wishlist yield.
2. Myntra product reviews/customer photos: strong product evidence, usually post-purchase adjacent.
3. Approved Reddit fashion/shopping communities: rich workarounds, but query/community biased and currently disabled.
4. YouTube haul, try-on, sizing, comparison, and return discussions: useful external-validation behavior, with creator/sorting bias.
5. Official Myntra pages: product capability and policy truth, not barrier prevalence.
6. Academic and industry work: mechanism/taxonomy grounding, never counted as Myntra VoC.

The detailed access decisions live in [SOURCE_REGISTER.md](SOURCE_REGISTER.md).

## Research design consequences

- Run broad discovery queries before barrier-targeted ones.
- Store the exact source, query, result position, collection time, and selection method.
- Report targeted and organic strata separately.
- Keep direct, journey-adjacent, general, and irrelevant evidence separate.
- Preserve positive and disconfirming evidence.
- Keep source-specific denominators; do not combine incompatible samples into “X% of users.”
- Human-review high-severity allegations, low-confidence direct items, and dashboard examples.
- Use academic research to improve labels and questions, never to inflate Voice-of-Customer counts.

## Is more research required before coding?

No additional broad desk-research sprint is required before implementation. The current study is sufficient to define contracts, build an empty-data product, create synthetic fixtures, and implement source adapters for later dry-run on the destination computer.

Optional early think-aloud conversations may improve vocabulary and queries, but they do not block the engine. Formal five-to-six-person research must wait until the engine produces a defensible opportunity and recruitable behavioral segment.

## Recommended post-engine interview cell

Use engine results to adjust the final sample. The current starting cell is:

- two fit-anxious active revisitors;
- two quality/review-evidence seekers;
- one comparison-heavy active shortlister;
- one contradictory participant who bought quickly or found existing cues sufficient.
