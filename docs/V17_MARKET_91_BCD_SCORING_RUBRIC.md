# V17 Market 91 B/C/D Scoring Rubric

Status: Draft scoring rubric. This document approves no ticker.

## 0. Roles

- A backtest layer is automated.
- B/C/D are source-verified manual inputs.
- User role is review and challenge, not data hunting.
- Assistant role is to gather sources, fill scores, and expose reasons.

Every B/C score must include a short reason. A score without a reason is invalid.

## 1. B Objective Financial Layer, 30 points

B uses five checks, each scored 0/1/2. Raw score is converted as:

`B score = raw objective score / 10 * 30`

### B1 Revenue trend

Score 2:
- Latest quarter YoY revenue growth is at least 10%, and TTM/FY revenue trend is positive; or
- Mature/cyclical company has at least 5% growth plus clear orders/backlog/pricing recovery.

Score 1:
- Revenue growth is between 0% and 10%; or
- Growth is positive but clearly decelerating; or
- One segment is strong but another major segment is weak.

Score 0:
- Latest quarter and TTM/FY trend are negative; or
- Guidance points to continuing decline without credible recovery evidence.

### B2 Free cash flow

Score 2:
- TTM or latest FY free cash flow is positive.
- FCF margin is sustainable for the company type.
- FCF is not dependent on debt/equity financing.

Score 1:
- FCF is positive but weak, volatile, working-capital driven, or temporarily pressured.

Score 0:
- FCF is negative; or
- Future operations/capex require material external financing.

Hard blocker:
- If B2 = 0 and either B4 = 0 or B5 = 0, the ticker cannot become Formal Observation Candidate.

### B3 Margin quality

Score 2:
- Gross margin and operating margin are stable or improving.
- Margin structure fits the business model.

Score 1:
- Mild margin compression, mixed segment margins, or temporary acquisition/integration pressure.

Score 0:
- Severe margin compression, structurally weak margins, or margin deterioration without credible recovery path.

### B4 Balance sheet

Score 2:
- Net cash or low leverage.
- No visible funding stress.

Score 1:
- Elevated but manageable leverage.
- Debt is acceptable but must be monitored.

Score 0:
- Material debt stress; or
- Likely need for debt/equity financing; or
- Balance sheet risk can directly impair the investment thesis.

### B5 CapEx / capital discipline

Score 2:
- CapEx is funded by operating cash flow.
- Return path is credible and not purely narrative.

Score 1:
- CapEx is elevated but manageable.
- Payoff is plausible but not yet fully proven.

Score 0:
- CapEx drives negative FCF; or
- CapEx requires external funding; or
- Payoff is highly uncertain.

## 2. C Sector Quality Layer, 20 points

C uses four checks, each scored 0/1/2. Raw score is converted as:

`C score = raw sector quality score / 8 * 20`

C cannot be scored without a sector module. If the right sector checklist does not exist, status is Research Only.

### C1 Industry position

Score 2:
- Clear leader or top-tier player in its sector.
- Scale or specialization is visible in revenue, market share, customers, or product position.

Score 1:
- Competitive but not clearly leading.
- Good niche player or strong in one segment only.

Score 0:
- Weak or unclear position.
- No durable evidence of sector relevance.

### C2 Moat / switching cost / scale advantage

Score 2:
- Strong moat such as IP, patents, ecosystem, switching cost, network effect, scale, regulated advantage, or irreplaceable infrastructure.

Score 1:
- Some advantage exists, but competitors can pressure pricing, share, or margins.

Score 0:
- Commodity-like business, low switching cost, or moat not visible.

### C3 Management / capital allocation

Score 2:
- Execution record is strong.
- Capital allocation is disciplined and aligned with long-term value.

Score 1:
- Mixed execution, acquisition/integration risk, or incomplete proof of discipline.

Score 0:
- Poor execution, value-destructive allocation, governance risk, or repeated missed guidance.

### C4 Thesis durability

Score 2:
- Investment thesis is supported by multi-year demand, product economics, and source-verified evidence.

Score 1:
- Thesis is plausible but depends on one major assumption still being proven.

Score 0:
- Thesis is mostly narrative, short-cycle, or contradicted by financial evidence.

## 3. Required sector modules

### Software / Cloud

Extra items to check:
- Net retention / customer expansion.
- FCF margin.
- SBC and dilution.
- Platform stickiness.
- AI monetization vs AI cost.

### Semiconductor

Extra items to check:
- Cycle stage.
- Gross margin and inventory.
- Customer concentration.
- IP/process moat.
- CapEx and supply-chain dependency.

### Industrial / Power

Extra items to check:
- Orders and backlog.
- Organic growth.
- Pricing power.
- Cycle sensitivity.
- Whether data center/grid demand appears in actual results.

### Energy

Extra items to check:
- Commodity price exposure.
- Reserve quality or infrastructure quality.
- CapEx discipline.
- Leverage.
- Payout safety.

### Biotech / Pharma

Extra items to check:
- Patent expiry calendar.
- Core product concentration.
- Pipeline phase distribution.
- FDA/clinical risk.
- Drug pricing and reimbursement risk.

### ETF

Extra items to check:
- Expense ratio.
- Liquidity.
- Holdings quality.
- Tracking quality.
- Instrument structure.

## 4. D Portfolio Risk-Fit Layer, 10 points

D is risk management only. It is not a preference score.

Start from 10 points and deduct only for measurable risks.

- Bucket concentration after inclusion would exceed limit: -3
- Same supply-chain or same factor as two or more existing holdings: -2
- Single-name cyclicality or factor risk requires special rule: -2
- Low liquidity, short history, or weak data maturity: -2
- Vehicle, tax, regulatory, or currency complexity: -1

Forbidden D bonuses:

- Fits AI.
- Fits current taste.
- Looks exciting.
- Matches previous narrative.

D can reduce priority. It cannot rescue a weak B score.

## 5. Review rule

Each scored item must show:

- score 0/1/2
- concrete reason
- source notes

If a reason is missing, the row is incomplete.

## 6. ORCL example rule

If a company has strong AI/cloud narrative but also:

- negative FCF,
- very large CapEx,
- expected debt/equity financing need,

then B2/B4/B5 force a block or downgrade. Narrative does not override objective financial risk.
