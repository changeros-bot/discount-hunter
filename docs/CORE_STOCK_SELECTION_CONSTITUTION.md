# Core Stock Selection Constitution

**Project:** Josh Portfolio Project  
**Version:** V19.0  
**Status:** Ratified  
**Effective Date:** 2026-07-13  
**Priority:** Constitution Level (Highest)

This document supersedes previous draft versions regarding Bot stock selection methodology.

---

## Constitution #0 — Core Stock Selection Constitution

### Philosophy

> Quality First.  
> Price Second.  
> Rules Above Emotion.

---

## Constitution #1 — Rule Stability

Investment rules must not be modified because of:

- short-term market events
- temporary performance
- market sentiment
- popular themes

Rules may only change if one of the following occurs:

1. Long-term backtesting demonstrates superior performance.
2. A logical contradiction or structural flaw is identified.
3. Market structure fundamentally changes.

---

## Constitution #2 — Quality First

The first question is never:

> Has it fallen enough?

The first question is:

> Is this an asset worth owning for the next decade?

Every asset must pass the Quality Gate before entering the Buy Engine.

Quality Gate includes:

- Competitive moat
- Long-term industry trend
- Revenue quality
- Free Cash Flow
- Balance sheet
- Management quality
- Investment thesis intact

**Failure = No Buy.**

---

## Constitution #3 — Liquidity First

Bot trades only assets with sufficient liquidity.

Requirements:

- Large / Mid Cap equities
- Highly liquid ETFs
- Reasonable spread
- Sufficient average daily volume

---

## Constitution #4 — Valuation Before Discount

Price decline alone never justifies buying.

Bot evaluates:

- Forward PE
- PEG
- EV/FCF
- FCF Yield
- Appropriate valuation metric by industry

Only after valuation becomes reasonable may Discount Hunter activate.

---

## Constitution #5 — Asset-specific Anchor

Different assets require different reference highs.

### Mature Stocks / ETFs

Use **Confirmed 52 Week High**.

Examples:

- VOO
- VT
- QQQM
- META
- MSFT
- GOOGL

### High Volatility Growth

Use **Cycle High**.

Examples:

- RKLB
- HOOD
- ARM

### BTC

Use **Cycle High only**.

Never use rolling 52 Week High.

---

## Constitution #6 — MDD Determines Discount Depth

Maximum Drawdown (MDD) determines:

- deepest DCA layer
- maximum acceptable drawdown

Beta must **NOT** determine maximum discount.

---

## Constitution #7 — Beta / ATR Calibration

Beta and ATR are used only for:

- spacing between DCA levels
- volatility calibration

Never as:

- quality filter
- stock selection criterion

---

## Constitution #8 — Price Is Only A Trigger

Buying sequence:

```text
Quality PASS
    ↓
Liquidity PASS
    ↓
Valuation PASS
    ↓
Anchor Confirmed
    ↓
Drawdown Reached
    ↓
Execute DCA
```

Price decline alone is insufficient.

---

## Constitution #9 — Relative Strength

Relative Strength is **NOT** a pre-filter.

Purpose:

- final risk confirmation only
- identify structural deterioration
- identify persistent weakness caused by thesis failure

It is not intended for momentum investing.

---

## Constitution #10 — Position Limit

No DCA may violate Position Limits.

If allocation exceeds predefined limits:

- stop further buying
- never average down indefinitely

---

## Constitution #11 — Decision Engine

Bot outputs structured decisions instead of Buy / Sell.

Required output:

- Quality Status
- Liquidity Status
- Valuation Status
- Asset Classification
- Anchor Type
- Current Drawdown Level (D1-D5)
- MDD Status
- Relative Strength Status
- Position Status
- Recommended Action

---

## Core Execution Pipeline

```text
Quality Gate
    ↓
Liquidity Filter
    ↓
Valuation Overlay
    ↓
Asset Classification
    ↓
Anchor Selection
    ↓
MDD Model
    ↓
Beta / ATR Calibration
    ↓
Drawdown Level
    ↓
Relative Strength Check
    ↓
Position Limit Check
    ↓
Execute DCA
```

---

## Architectural Decisions (ADR)

### Rejected: Relative Strength as a pre-buy filter

**Reason:** Conflicts with the Discount Hunter philosophy.

### Rejected: Beta used to determine maximum drawdown

**Reason:** MDD better represents historical downside risk.

### Rejected: One universal 52 Week High model for all assets

**Reason:** High-volatility assets require Cycle High.

### Rejected: Buying solely because price declined

**Reason:** Price is only a trigger. Quality and valuation remain primary.

---

## Implementation Notes

This Constitution is the highest-level stock selection specification.

The following documents must reference this Constitution instead of duplicating rules:

- Discount Hunter Playbook
- Quality Gate
- Asset Universe
- Research Queue
- Backtesting Rules

Future modifications must preserve consistency with this Constitution.

---

## Governance

Any future amendment must:

1. Explicitly identify the Constitution section being changed.
2. State the evidence or structural reason for the amendment.
3. Confirm compatibility with the remaining Constitution.
4. Be versioned and ratified before implementation.

No implementation detail, temporary experiment, market narrative, or short-term result may silently override this document.
