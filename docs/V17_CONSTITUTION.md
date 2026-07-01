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
