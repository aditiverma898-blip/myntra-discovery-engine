# Myntra Discovery Engine — Problem Statement

## Status

This is the **starting problem for discovery**, not a validated conclusion about all Myntra users.

The Discovery Engine, real-data analysis, and later user interviews may confirm, narrow, or reject it.

## Background

Myntra allows users to save fashion products to a wishlist and return to them later. A saved item, however, does not always mean the user plans to purchase it soon.

People may use a wishlist to:

- remember an item;
- compare shortlisted products;
- plan for an occasion;
- wait before making a decision;
- track price or availability;
- collect inspiration without a clear purchase plan.

Because these intentions are different, every wishlist non-purchase should not be treated as the same problem.

## Business problem

Myntra wants to increase the percentage of eligible users who purchase at least one wishlisted item within 30 days of adding it.

The eventual solution cannot mainly depend on discounts, coupons, cashback, loyalty points, or another monetary incentive.

The important business question is therefore:

> Why do users who are still interested in a wishlisted item fail to progress confidently from wishlist revisit to bag and purchase?

## Simple user problem statement

> Some users still want an item saved in their Myntra wishlist, but they do not feel confident enough to buy it. When they revisit the item, they may still be unsure about fit, size, appearance, material, quality, comparison, or return risk. They continue researching, comparing, waiting, or abandoning instead of choosing a variant and moving the item to bag.

This is the project’s provisional problem statement. It does not claim that every wishlist user has this problem or that fit is already proven to be the largest barrier.

## Why the problem matters

A user may have already shown interest by saving and revisiting an item. If an important question remains unresolved at that point, purchase intent can weaken or the decision can move outside the Myntra journey.

Possible consequences include:

- repeated visits without a decision;
- repeated reading of reviews or customer photos;
- searching for additional evidence elsewhere;
- asking other people for advice;
- comparing several saved products repeatedly;
- waiting until the preferred variant is unavailable;
- buying elsewhere or abandoning the purchase.

These behaviors may reduce decision confidence and wishlist-to-bag progression. Public feedback alone cannot prove their effect on the 30-day conversion metric, so the engine will treat that connection as a product hypothesis.

## Initial research focus

### Primary focus: fit, size, and silhouette confidence

The first question is whether still-interested wishlist users can confidently judge:

- which size to select;
- whether sizing is consistent across brands;
- how the item will look, fit, or drape on them;
- whether length, width, comfort, tightness, or looseness will match their preference;
- whether the preferred size or variant is available.

The engine must distinguish a pre-purchase fit question from an incorrect item, fulfillment error, or post-purchase return.

### Secondary focus areas

1. **Material, quality, colour, and visual confidence** — whether the user trusts that the received product will match its images, description, reviews, and expectations.
2. **Comparison and decision-resumption effort** — whether an active shortlist is difficult to compare or reconsider after returning to it.
3. **Return and exchange risk** — whether uncertainty about reversing a poor decision increases hesitation.
4. **Occasion, delivery, and availability** — whether a product can arrive in the required variant before a real deadline.

### Competing explanations to retain

- The wishlist may be passive inspiration rather than active purchase intent.
- The user may be waiting only for a lower price or a future budget date.
- The barrier may be a general service, inventory, checkout, or fulfillment problem.
- Existing Myntra information may already resolve the decision for many users.

These alternatives must remain visible so the engine does not force every record into a product-confidence theme.

## Target user behavior

The initial candidate is:

> A user who added a fashion item to their Myntra wishlist within the last 30 days, revisited it, still wants or needs it, has not purchased or progressed it to bag, and can identify an unresolved decision.

Candidate behavioral groups include:

- fit-anxious active revisitors;
- users evaluating an unfamiliar brand or category;
- quality and review-evidence seekers;
- comparison-heavy active shortlisters;
- occasion or deadline shoppers;
- return-risk-sensitive shoppers;
- users waiting for a preferred size or variant.

Contrast groups include passive inspiration savers, price-dependent waiters, and users who purchased quickly because current information was sufficient.

These are behavior-based research groups. The project will not infer age, gender, income, body type, personality, purchase frequency, or customer value from public text.

## Discovery Engine goal

Build an AI-assisted research system that analyzes approximately 20,000 Myntra-specific public records and converts unstructured feedback into structured, traceable product evidence.

The system should determine:

- why an item was saved;
- whether purchase intent remained active;
- what remained unknown or untrusted;
- where the user was in the decision journey;
- what the user did next;
- which workaround was used and whether it helped;
- which behavioral pattern the evidence supports;
- which non-monetary opportunity should advance to interviews.

The engine will use Myntra Google Play reviews, Myntra App Store reviews, Myntra-focused YouTube comments, and only approved Myntra-specific Reddit or product-review evidence. Other shopping platforms are outside the project scope.

## Core research questions

### Intent

- Why did the user save the item?
- Was it an active purchase candidate or passive bookmark?
- What evidence shows that the user still wanted it?

### Unresolved decision

- What did the user still need to know or trust?
- Was the primary barrier fit, product confidence, comparison, return risk, availability, logistics, price, or something else?
- Did the barrier occur before bagging, during checkout, or after purchase?

### Behavior and workaround

- Did the user wait, revisit, compare, ask someone, research externally, move to bag, buy, buy elsewhere, or abandon?
- Which workaround did the user use?
- Did the workaround resolve the decision?

### Opportunity

- Which themes appear in direct wishlist evidence rather than only general shopping complaints?
- Which themes are supported across multiple Myntra source types?
- What positive or contradictory evidence weakens each theme?
- Which problem is purchase-proximate, non-monetary, evidence-backed, and recruitable for interviews?

## What the engine must not claim

The engine must not claim:

- that a public-feedback percentage represents all Myntra users;
- that public comments prove conversion or revenue impact;
- that all wishlist saves represent purchase intent;
- that fit is the largest barrier before the analysis is complete;
- that an allegation about authenticity or reviews is a verified fact;
- that the most frequent public complaint is the largest internal conversion problem;
- that the engine alone has validated the problem or selected the final MVP.

## How the problem will be validated

After the reviewed real-data release, one problem and behavioral segment can advance to interviews only when:

- it has credible direct or strongly connected journey-adjacent evidence;
- the result is not driven by duplicates, one query, or one source;
- its connection to wishlist-to-bag progression is clear and plausible;
- it has a meaningful non-monetary root;
- the target behavior can be recruited and observed;
- positive, contradictory, and uncertain evidence is documented;
- interviews can confirm or disprove the proposed mechanism.

The selected problem will then be tested with five or six recent-behavior interviews. Only after that validation should the consumer-facing MVP be defined.
