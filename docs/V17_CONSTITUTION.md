# DCA Discount Hunter V17 Constitution

Date: 2026-07-01
Status: V17封板開發依據

## 1. Highest Principles

V17 is not a feature expansion sprint. It is an architecture freeze sprint.

Core rules:

1. Quality before price.
2. Long-term before tactical.
3. Every feature is guilty until proven useful.
4. No asset enters the system without a defined engine, strategy, status, and review trigger.
5. Tactical logic must never contaminate Investment Engine cost basis, ledger, or decision flow.
6. V17 optimizes for 30-second daily decisions, not maximum information display.

追加最高原則 after 2026-07-05 incident:

```text
Stability first. Truth second. Beauty third.
```

But truth must not be introduced by first breaking the UI. Any replacement of a fallback source must be proven in an audit page before it is connected to `/v17`.

## 2. Engines

### Investment Engine

Used for long-term accumulation assets.

Allowed strategies:

- PURE_DCA
- DCA_DISCOUNT
- DISCOUNT_ONLY

### Tactical Engine

Used for leveraged, short-term, or exit-rule-dependent strategies.

Rules:

- No Exit, No Entry.
- Tactical assets cannot share Investment Engine ledger.
- Tactical assets may be registered in V17, but are not enabled as action assets unless their exit rule is complete.

## 3. Strategy Registry

V17 strategies:

- PURE_DCA: fixed recurring accumulation, no discount decision queue.
- DCA_DISCOUNT: can be accumulated by DCA and also bought on discount layers.
- DISCOUNT_ONLY: only enters decision queue when a discount layer is reached.
- LEVERAGED_HUNTER: tactical only; disabled until exit rules are complete.
- WATCH_ONLY / REVIEW_ONLY: visible but cannot enter action queue.

## 4. Asset Universe V17

V17 Universe must be registry-driven. No UI or API should maintain a separate hardcoded universe.

### Pure DCA

- 0050
- VOO
- QQQM

These may be displayed later but are not required to enter the V17 xStocks decision queue.

### DCA + Discount

- BTC
- QQQon

### Discount Only / xStocks

- NVDAon
- TSMon
- AVGOon
- SPCXon
- GOOGLon
- AMDon
- MRVLon
- RKLBon

### Tactical / Watch

- 00631L

Tactical assets cannot enter the V17 action queue until exit rules are explicitly defined.

## 5. V17 UI State Machine

Every asset may exist in only one UI zone at a time.

### Decision Zone

An asset enters Decision when:

- It reaches a new active discount layer.
- That layer is not completed.
- That layer is not skipped.
- The asset is qualified for action.

Allowed actions:

- Complete layer.
- Skip current layer.

### Holding Zone

An asset enters Holding when:

- It has a live position.
- It is within D1 to D4 for xStocks or D1 to D5 for BTC.

Holding assets remain visible even if no new decision is active.

### Watch Zone

An asset enters Watch when:

- It has no active decision.
- It has no live position requiring holding display.
- It is waiting for the next layer.

All card layouts must remain consistent across Decision, Holding, and Watch.

## 6. BTC Engine V17

BTC is the first non-stock asset in V17.

BTC must not blindly reuse the xStocks 52-week-high model.

### BTC Registry Rules

- symbol: BTC
- assetType: crypto
- engine: Investment Engine
- strategy: DCA_DISCOUNT
- referenceMode: cycle_high
- updatePolicy: confirmed_breakout_30d
- discountModel: btc_cycle_high_v1
- status: qualified

### BTC Reference Model

BTC uses Cycle High as its reference anchor.

Cycle High is not manually guessed. It updates only when:

1. BTC price trades above the current Cycle High.
2. BTC remains above the old Cycle High for 30 consecutive days.
3. After confirmation, the new anchor is updated to the highest confirmed price in that breakout window.

Until the confirmation rule is satisfied, the old Cycle High remains unchanged.

### BTC Layers

BTC uses five layers:

- D1: -20%, 1 unit
- D2: -35%, 3 units
- D3: -50%, 6 units
- D4: -65%, 5 units
- D5: -80%, 5 units

Total: 20 units.

Default unit amount: 5 USDT.

The unit amount may be changed without changing strategy structure.

### BTC Out of Scope for V17

V17 does not implement:

- BTC auto-trading.
- Exchange account trading permission.
- Manual top guessing.
- On-chain wallet BTC holdings unless explicitly added later.
- MVRV, Pi Cycle, Rainbow, or other valuation overlays as action triggers.

## 7. Market Provider Rules

V17 must move toward a unified market provider interface.

Current providers:

- Binance xStocks public API.
- Binance BTCUSDT market data.
- Binance signed read-only API for BTC quantity and trades.
- BSC balanceOf for xStocks quantity.
- NodeReal / MegaNode BSC RPC `eth_getLogs` for xStocks cost basis.

Required output shape:

- symbol
- name
- assetType
- price
- high or cycleHigh
- discount
- discountRaw
- rules
- amounts
- signal
- source
- updatedAt

## 8. Registry Rules

All assets must declare:

- symbol
- name
- assetType
- engine
- strategy
- status
- discountModel
- rules
- amounts
- reviewFrequency
- reEvaluateTrigger

Assets without these fields may be shown only as research or watch-only assets.

## 9. Research Pipeline

New assets must pass this pipeline before becoming qualified:

Brainstorm -> Research Queue -> Quality Screen -> Portfolio Fit -> Qualified / Watch / Reject

V17 does not require every asset to be fully researched, but it does require the pipeline to exist and be respected.

## 10. Out of Scope for V17

V17 does not include:

- Auto-trading.
- Master Asset Database.
- AI Berkshire integration.
- VergeX / Binefi integration.
- Excessive parameter expansion.
- Unbounded new asset additions.
- Leveraged entry without exit rules.
- Rebuilding UI after UI封板 unless a runtime error blocks use.

## 11.封板 Standard

V17 can be considered sealed when:

1. Asset Registry is the source of truth.
2. UI State Machine correctly separates Decision / Holding / Watch.
3. BTC is part of the system through a separate BTC Engine.
4. xStocks and BTC do not share incorrect discount assumptions.
5. Tactical Engine boundaries are explicit.
6. Research Pipeline exists.
7. Out-of-scope items are documented and not implemented in V17.
8. The app supports 30-second daily decision making.

## 12. Data Source Constitution

### BTC

```text
BTC quantity source: Binance read-only /api/v3/account
BTC cost source: Binance /api/v3/myTrades weighted average
BTC price source: Binance BTCUSDT live/reference price
BTC PnL: allowed only when quantity and trades are API synced
```

### xStocks

```text
xStocks quantity source: BSC balanceOf
xStocks cost source: NodeReal / MegaNode standard BSC RPC eth_getLogs
xStocks cost rule: stablecoin OUT + xStock IN in same tx hash = BUY
xStocks price source: Binance xStocks live/reference price
xStocks PnL: allowed only when cost basis PASS
```

### Forbidden data behavior

```text
No screenshot fallback.
No fake 5U fallback as real cost.
No manual cost injection unless explicitly labeled as manual and approved by user.
No PnL for missing-cost assets.
No mixing known-cost and missing-cost assets in return calculations.
No treating missing cost as zero.
```

## 13. PnL Constitution

All asset metrics must be separated into four layers:

```text
1. Quantity
2. Market Value
3. Known Cost
4. PnL / Return Eligibility
```

Rules:

```text
If quantity exists but cost is missing: show quantity and market value only.
If cost is missing: hide or mark PnL as N/A.
If a portfolio contains missing-cost assets: total market value may include them, but PnL / return must exclude them.
Never treat missing cost as zero.
```

This rule exists because the 2026-07-05 incident briefly produced a misleading return by mixing BTC known cost with xStocks missing cost.

## 14. Stability Lock

Do not directly modify these on main:

```text
Wallet calculation
Cost basis parser
Decision Engine
Snapshot / state cache
State classifier
Universe registry
Tier rules
Buy-point completion / skipped logic
```

Allowed without opening core:

```text
Read-only audit page
Read-only reconciliation table
UI label clarification
Documentation update
Health-check endpoint
```

## 15. Required Change Process

Before any V17 core change:

```text
1. Read docs/AI_HANDOFF.md.
2. Read docs/V17_CONSTITUTION.md.
3. Identify the category: data source / parser / UI / state machine / deployment.
4. Add or use a read-only audit endpoint/page.
5. Prove the source status is PASS.
6. Only then connect the result into /v17.
7. After deployment, verify Real Position Audit and State Machine.
8. Record the new stable baseline if and only if the user approves.
```

Do not skip the audit step.

## 16. Fallback Replacement Rule

Fallbacks are allowed only as temporary labels, not as truth.

Replacement sequence:

```text
1. Keep old display stable.
2. Build audit page for new source.
3. Verify new source PASS.
4. Switch the internal source.
5. Display source label clearly.
6. Remove or hide fallback.
7. Confirm no PnL distortion.
```

Never do this sequence backward.

## 17. NodeReal / MegaNode Rule

NodeReal / MegaNode must use stable standard BSC RPC where possible:

```text
Preferred method: eth_getLogs
Purpose: ERC20 Transfer events for xStocks and stablecoins
Avoid relying only on enhanced methods such as nr_getAssetTransfers unless explicitly verified.
```

Reason:

```text
During the 2026-07-05 incident, nr_getAssetTransfers failed on the available NodeReal endpoint, while eth_getLogs succeeded.
```

## 18. Audit Pages Are Production Safety Tools

The following pages/endpoints are not disposable debug toys. They are production safety tools:

```text
/v17-cost-basis-audit
/api/v17/xstocks-cost-basis-audit
```

They should remain available unless replaced by a better audit system.

Expected healthy status:

```text
Status: PASS
Transfer source used: MegaNode / NodeReal
Transfer Count > 0
BUY Pattern Hash > 0
Official BUY Records > 0
xStocks live holdings costStatus: PASS
```

## 19. Incident Memory: 2026-07-05

What went wrong:

```text
The AI modified main before reading the known gap.
The system previously looked normal because xStocks cost still had fallback behavior.
Fallback was removed before NodeReal cost basis was verified.
A temporary PnL bug mixed known-cost BTC with missing-cost xStocks.
A JSX syntax issue caused one failed Vercel build.
```

What fixed it:

```text
Read the handoff.
Added Real Position Audit.
Added xStocks Cost Basis Audit.
Detected NodeReal key.
Replaced unsupported enhanced method with eth_getLogs.
Rebuilt xStocks costs from real ERC20 Transfer logs.
Verified PASS on 8 xStocks holdings.
```

Permanent lesson:

```text
Do not make the system honest by first breaking it.
Make it observable, verify the new source, then migrate.
```

## 20. Communication Rule

If an AI-created code change causes a broken deployment or confusing data state, say so plainly.

Do not say:

```text
Maybe the user did not set the key.
```

unless diagnostics prove it.

Say:

```text
The current diagnostic shows whether the key is detected, whether the provider returned data, and which method failed.
```

Be factual, not defensive.

## 21. What Not To Do Next

```text
Do not touch V17 core now.
Do not rewrite the dashboard.
Do not rework cost basis again unless audit fails.
Do not add more providers just because one provider shows ERROR if the primary selected source is already PASS.
Do not chase BscScan if NodeReal is PASS.
Do not refactor state machine while cost basis is being verified.
```

The correct next addition, if needed, is a read-only reconciliation table:

```text
Asset | Wallet/Binance quantity | System quantity | Difference | Cost source | PnL eligibility
```

This table must not mutate state.
