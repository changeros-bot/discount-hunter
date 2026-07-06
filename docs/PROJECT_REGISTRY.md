# Josh OS Project Registry

**Registry Version:** Josh Portfolio V19.0  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Owner:** Josh  
**Updated:** 2026-07-06  
**Repository:** `changeros-bot/discount-hunter`

---

## Active Modules

| Module | App Version | Registry / Playbook | Status | Route | Owner Action |
|---|---:|---|---|---|---|
| DCA 折價獵人 | V17.1 | Josh Portfolio V19.0 | LIVE / Ready for Review | `/v17` | Maintain app, align Telegram, run V19.1 backtests |
| 槓桿獵人 | Draft | Separate Engine | DRAFT / PLANNING | `/leveraged-hunter` | Define 00631L buy / stop / exit rules before UI expansion |
| Josh 2026多元記帳本 | V4.4 | Local DB Ledger | LIVE | `/financial-os` | Stabilize CRUD, date filters, budget and asset editing |
| 富邦長期 DCA | Sealed | Core DCA | SEALED | `/fubon-dca` | Monthly execution check only |

---

## Discount Hunter Registry

```yaml
project: Discount Hunter
portfolio_version: Josh Portfolio V19
playbook_version: V19.0
status: Ready for Review
owner: Josh
project_owner: ChatGPT / Josh OS Project Owner
module: Investment Operating System
source_of_truth: docs/V19_DISCOUNT_HUNTER_PLAYBOOK.md
pending_backtest_version: V19.1
```

### Finalized V19 Principles

- Quality First
- Price Is Trigger
- Buy Point Is Permission
- Quality > Price
- BTC has an independent engine
- ETF uses Pure DCA first, discount add-ons second
- Exit is based on Investment Thesis Broken, not price

### Pending V19.1 Validation

- AI Infrastructure discount thresholds using Beta + MDD
- BTC Cycle High layers
- ETF add-on layers
- Position limits sensitivity

---

## App Version Responsibilities

Project Owner must keep these aligned:

1. `/v17` Discount Hunter app should reflect V19 decision semantics.
2. Telegram daily report should not show buy recommendations before a trigger is reached.
3. `/josh-os` should show Discount Hunter as V17.1 app + V19.0 playbook.
4. `/financial-os` should keep the official name: Josh 2026多元記帳本.
5. Any pending backtest rule must remain labelled Pending until promoted by review.

---

## Next Registry Milestones

| Version | Scope |
|---|---|
| V19.1 | Historical backtests for AI Infrastructure, BTC, ETF, and position limits |
| V19.2 | Independent playbooks for ETF, BTC, AI Infrastructure, Platform, Crypto Innovation |
| V19.3 | Risk Management: position limits, cash management, rebalance, lot management |
| V20 | Full Investment Operating System: Constitution + Playbooks + Risk + Annual Review |
