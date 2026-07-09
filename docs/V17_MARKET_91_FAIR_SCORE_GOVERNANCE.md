# V17 Market 91 Fair Score Governance

Status: Draft governance rule. No ticker is approved by this document.

## 1. Pipeline relationship: 100-point screen vs 18-point Quality Gate

The 100-point system and the 18-point Quality Gate are not parallel scoring systems.

They are sequential:

1. Market 91 universe provenance
   - User screenshot list only.
   - It is not a recommendation list, not a ranking tool, and not a whitelist.

2. Price/backtest screen
   - Produces research labels such as STRONG_RESEARCH_CANDIDATE / RESEARCH_CANDIDATE.
   - This only means the historical discount-trigger behavior is worth researching.

3. 100-point Fair Observation Screen
   - Purpose: decide whether a ticker is worth entering the Formal Observation Candidate list.
   - This step does not grant trading permission.

4. 18-point Quality Gate
   - Purpose: decide actual permissions: fixed DCA, buy-the-dip, semi-auto draft, whitelist candidate.
   - A ticker that passes the 100-point screen still has zero trading permission until it passes the 18-point Quality Gate.

Priority rule:

If narrative strength conflicts with FCF / balance sheet / CapEx / financing risk, the objective financial layer wins.

## 2. 100-point Fair Observation Screen

Total score = A + B + C + D.

A. Backtest behavior: 40 points
B. Objective financial layer: 30 points
C. Sector-quality layer: 20 points
D. Portfolio risk-fit layer: 10 points

Interpretation:

- 80+ points: Formal Observation Candidate only, if no hard blocker.
- 65–79 points: Reserve / second review.
- 50–64 points: Research pool only.
- Below 50: Exclude from current workflow.

Hard blockers:

- Objective financial layer below 18/30: cannot become Formal Observation Candidate.
- Negative FCF plus material CapEx/financing need: cannot become Formal Observation Candidate.
- Unknown symbol/data maturity: cannot become Formal Observation Candidate.
- Missing sector checklist for the asset type: Research only.

## 3. A. Backtest behavior: 40 points

Use only the generated backtest result. Do not add narrative judgment.

A1. Event sample size: 8 points

- events >= 20: 8
- events 10–19: 6
- events 5–9: 3
- events < 5: 0

A2. 126-day average return after trigger: 10 points

- avg_ret_126d >= 25%: 10
- 15% to <25%: 8
- 8% to <15%: 6
- >0% to <8%: 3
- <=0%: 0

A3. 126-day win rate: 10 points

- >=70%: 10
- 60% to <70%: 8
- 55% to <60%: 5
- 50% to <55%: 2
- <50%: 0

A4. Average max adverse move after trigger: 8 points

- avg_max_adverse_252d >= -10%: 8
- -20% to <-10%: 6
- -30% to <-20%: 3
- < -30%: 0

A5. 252-day validation: 4 points

- avg_ret_252d > 0 and win_rate_ret_252d >= 55%: 4
- avg_ret_252d > 0 and win_rate_ret_252d >= 45%: 2
- otherwise: 0

## 4. B. Objective financial layer: 30 points

This is the 18-point Quality Gate objective layer converted to a 30-point screen.

Five objective checks, each 0–2 points. Raw objective score /10 × 30 = B score.

B1. Revenue trend
- 2: latest quarter and TTM/FY revenue trend are positive or clearly recovering.
- 1: mixed / flat / cycle-sensitive.
- 0: negative trend without credible recovery.

B2. Free cash flow
- 2: positive TTM/FY FCF and sustainable FCF margin.
- 1: positive but weak or volatile.
- 0: negative FCF or FCF dependent on external financing.

B3. Margin quality
- 2: gross/operating margin stable or improving.
- 1: mild compression or mixed.
- 0: severe compression / structurally low margin for its model.

B4. Balance sheet
- 2: net cash / low leverage / no funding stress.
- 1: elevated but manageable leverage.
- 0: material debt stress or expected debt/equity financing need.

B5. CapEx / capital discipline
- 2: CapEx funded by operating cash flow with credible return path.
- 1: elevated but manageable.
- 0: CapEx drives negative FCF, or future financing is required.

Hard blocker: If B2 = 0 and either B4 = 0 or B5 = 0, the ticker cannot become Formal Observation Candidate.

## 5. C. Sector-quality layer: 20 points

Do not compare raw sector scores across unrelated industries as if they were the same asset type.

Four quality checks, each 0–2 points. Raw quality score /8 × 20 = C score.

C1. Industry position
C2. Moat / switching cost / scale advantage
C3. Management / capital allocation
C4. Thesis durability

Sector-specific modules must define what these mean for each bucket:

- Software / cloud: retention, platform stickiness, FCF, SBC, AI monetization.
- Semiconductors: cycle, margin, customer concentration, process/IP moat, inventory.
- Industrial / power: orders, backlog, pricing power, cycle, data center/grid demand.
- Energy: commodity exposure, capital discipline, leverage, reserve quality, payout safety.
- Biotech / pharma: patent expiry, product concentration, pipeline phase mix, FDA/clinical risk, drug pricing.
- ETF: fee, liquidity, holdings, tracking quality, instrument structure.

If a sector module does not exist, the ticker stays Research Only.

## 6. D. Portfolio risk-fit layer: 10 points

This layer is risk management only. It is not a preference bonus.

Start with 10 points. Deduct only for measurable concentration or operational risks:

- Bucket concentration after inclusion would exceed limit: -3
- Same supply-chain / same factor as two or more existing holdings: -2
- Single-name cyclicality or factor risk requires special rule: -2
- Low liquidity / short history / weak data maturity: -2
- Vehicle / tax / regulatory / currency complexity: -1

Rules:

- Do not add points for “fits AI,” “fits current taste,” or “looks exciting.”
- Overlap is a risk flag, not an automatic rejection.
- D can reduce priority but cannot rescue a weak financial score.

## 7. Market 91 → 47 rule audit

The 91-name universe was built from user screenshots and de-duplicated to underlying symbols.

The backtest script explicitly labels it as a broad research screen, not an approval list.

Research labels are generated from the same price-behavior rules:

- Reference: rolling 252-day high, minimum 120 trading days.
- Event trigger: discount thresholds by asset category.
- STRONG_RESEARCH_CANDIDATE requires:
  - events >= 5
  - avg_ret_126d > 0
  - win_rate_ret_126d >= 60%
  - avg_max_adverse_252d > -25% or missing
- RESEARCH_CANDIDATE requires:
  - events >= 5
  - avg_ret_126d > 0
  - win_rate_ret_126d >= 55%
  - avg_max_adverse_252d > -35% or missing

This layer is more objective than manual curation, but it still depends on manually selected threshold schemes. Therefore it is a research filter, not a truth engine.

## 8. Immediate governance correction

Previous manual narrowing from 47 → 25 → 10 → 5 is paused as a final ranking.

Current accepted state:

- 91 names: screenshot universe.
- 47 names: price-backtest research pool.
- Manual 25/10/5 narrowing: not final; must be rerun through this 100-point fair screen.
- 18-point Quality Gate remains the only path to trading permissions.
