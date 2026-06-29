# V17 Universe Freeze

Purpose: V17 must freeze the asset list, engine ownership, and strategy assignment before replacing the old discount-buy rules.

Rule:

> Do not migrate discount tiers before the asset universe is approved.

---

## 1. Freeze Sequence

| Step | Item | Goal | Status |
|---|---|---|---|
| 1 | Confirm asset list | Decide which assets are in V17 | In Progress |
| 2 | Confirm engine ownership | Investment / Tactical separation | In Progress |
| 3 | Confirm strategy | Pure DCA / DCA + Discount / Discount Only / Tactical | In Progress |
| 4 | Confirm asset status | Qualified / Watch / Research Queue | In Progress |
| 5 | Freeze V17 Universe v1 | No new asset without committee flow | Pending |
| 6 | Replace discount-buy rules | Only after freeze | Blocked |
| 7 | Regression check | Ensure V16 behavior not broken | Pending |

---

## 2. Proposed V17 Universe v1

### Pure DCA

| Asset | Engine | Strategy | Status | Note |
|---|---|---|---|---|
| VT | Investment | Pure DCA | Watch | Global all-market ETF candidate |
| VWRA | Investment | Pure DCA | Watch | Ireland-domiciled global ETF candidate |
| VOO | Investment | Pure DCA | Qualified | Long-term US core |
| 0050 | Investment | Pure DCA | Qualified | Long-term Taiwan core |

### DCA + Discount

| Asset | Engine | Strategy | Status | Note |
|---|---|---|---|---|
| BTC | Investment | DCA + Discount | Qualified | Must use BTC-specific discount model |
| QQQM | Investment | DCA + Discount | Watch | Pending confirmation |

### Discount Only

| Asset | Engine | Strategy | Status | Note |
|---|---|---|---|---|
| SOXX | Investment | Discount Only | Watch | Semiconductor ETF candidate |
| NVDA | Investment | Discount Only | Qualified | AI GPU core leader |
| AVGO | Investment | Discount Only | Qualified | AI networking + ASIC leader |
| MU | Investment | Discount Only | Watch | Memory cycle candidate |
| AMD | Investment | Discount Only | Qualified | AI GPU challenger |
| MRVL | Investment | Discount Only | Qualified | AI networking / ASIC supply chain |
| TSM | Investment | Discount Only | Watch | Pending discussion |

### Tactical

| Asset | Engine | Strategy | Status | Note |
|---|---|---|---|---|
| 00631L | Tactical | Leveraged Hunter | Watch | Taiwan leveraged tactical |
| TQQQ | Tactical | Leveraged Hunter | Watch | US Nasdaq leveraged tactical |
| SOXL | Tactical | Leveraged Hunter | Watch | US semiconductor leveraged tactical |

### Watch / Research Queue

| Asset | Proposed Engine | Proposed Strategy | Status | Note |
|---|---|---|---|---|
| DRAM ETF | Investment | Discount Only | Research Queue | Needs product selection |
| RKLB | Investment | Discount Only | Watch | High-risk growth, not core |
| Allianz Taiwan Technology Fund | Investment | Discount Only | Research Queue | Needs fee/liquidity review |
| 009826 | Investment | Discount Only | Research Queue | Needs product review |

---

## 3. Tokenized Mapping Rule

V17 architecture should distinguish between underlying assets and trading wrappers.

Examples:

| Underlying | Possible Wrapper | Rule |
|---|---|---|
| NVDA | NVDAon | Same thesis, wrapper-specific liquidity/risk must be noted |
| AVGO | AVGOon | Same thesis, wrapper-specific liquidity/risk must be noted |
| TSM | TSMon | Same thesis, wrapper-specific liquidity/risk must be noted |
| BTC | spot BTC / exchange balance | BTC model must not reuse ETF rules blindly |

---

## 4. Rule Migration Blocker

The old fixed discount tiers must not be replaced until all of the following are true:

- Asset list is approved.
- Each asset has one primary engine.
- Each asset has one strategy.
- Investment and Tactical ledgers are separate.
- BTC model boundary is explicit.
- Watch assets are not treated as Qualified assets.

---

## 5. Decision

Until this file is approved, V17 Decision Engine may produce read-only explanations, but must not finalize the new discount-buy tier rules.
