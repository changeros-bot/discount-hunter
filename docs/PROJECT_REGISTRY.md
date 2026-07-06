# Josh OS Project Registry

**Registry Version:** Josh Portfolio V18.0  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Owner:** Josh  
**Updated:** 2026-07-06  
**Repository:** `changeros-bot/discount-hunter`

---

## Active Modules

| Module | App Version | Registry / Playbook | Status | Route | Owner Action |
|---|---:|---|---|---|---|
| DCA 折價獵人 | V17.1 | Josh Portfolio V18.0 | LIVE / Ready for Review | `/v17` | Build V17.2: Chinese labels, decision status, Quality shell, backtest pipeline |
| 槓桿獵人 | Draft | Separate Engine | DRAFT / PLANNING | `/leveraged-hunter` | Define 00631L buy / stop / exit rules before UI expansion |
| Josh 2026多元記帳本 | V4.4 | Local DB Ledger | LIVE | `/financial-os` | Stabilize CRUD, date filters, budget and asset editing |
| 富邦長期 DCA | Sealed | Core DCA | SEALED | `/fubon-dca` | Monthly execution check only |

---

## Discount Hunter Registry

```yaml
project: Discount Hunter
app_version: V17.1
portfolio_version: Josh Portfolio V18
playbook_version: V18.0
status: Ready for Review
owner: Josh
project_owner: ChatGPT / Josh OS Project Owner
module: Investment Operating System
source_of_truth: docs/V18_DISCOUNT_HUNTER_PLAYBOOK.md
future_draft: docs/V19_DISCOUNT_HUNTER_PLAYBOOK.md
pending_backtest_version: V18.1
```

### Finalized V18 Principles

- 品質優先
- 價格只是觸發器
- 買點只是允許買入，不是必須買
- BTC 版面可同頁，但引擎獨立
- ETF 以 Pure DCA 為主，折扣加碼為輔
- Exit 看 Investment Thesis Broken，不看價格

### Pending V18.1 Validation

- AI 基礎建設折扣門檻：Beta + MDD + 歷史觸發後報酬
- BTC Cycle High 層級
- ETF 額外加碼層級
- Position Limit 敏感度

---

## App Version Responsibilities

Project Owner must keep these aligned:

1. `/v17` Discount Hunter app should display App V17.1 + Playbook V18.0.
2. Telegram daily report should not show buy recommendations before a trigger is reached.
3. `/josh-os` should show Discount Hunter as V17.1 app + V18.0 playbook.
4. `/financial-os` should keep the official name: Josh 2026多元記帳本.
5. V19 must remain Future Draft until V18 review and V18.1 backtests are complete.
6. Auto-trading progress must advance in every relevant app version, but never skip guardrails.

---

## Quality Checklist Policy

Quality Checklist starts as semi-automation:

- 客觀財務資料：自動抓取，產生建議狀態。
- 質化條件：AI 協助整理，Josh 最終確認。
- ETF 不套用公司級 Checklist。
- BTC 使用獨立 BTC 檢查，不套用公司財報。

---

## Backtest Pipeline

Backtest framework exists at:

```text
scripts/backtest_discount_hunter.py
```

Output target:

```text
reports/backtests/discount_hunter_summary.csv
reports/backtests/discount_hunter_events.csv
```

---

## Next Registry Milestones

| Version | Scope |
|---|---|
| V17.2 | App version governance, Chinese category labels, decision status framework |
| V17.3 | Quality Checklist manual / semi-auto shell |
| V17.4 | Objective finance data auto-fetch |
| V17.5 | Quality status connected to decision engine |
| V17.6 | Position Limit / Budget Check |
| V17.7 | Telegram confirmation actions |
| V17.8 | Order draft, no direct execution |
| V18.1 | Historical backtests for AI Infrastructure, BTC, ETF, and position limits |
| V18.2 | Limited auto-trading test with Kill Switch and limits |
| V19 | Future major Playbook after V18 review + backtests |
