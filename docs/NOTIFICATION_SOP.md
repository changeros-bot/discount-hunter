# V16-M Notification SOP

Last updated: 2026-06-28
Project: DCA Discount Hunter / 美股 DCA 折價追蹤

This document is the source of truth for Telegram and App notification behavior.
Any change to notification logic must update this SOP and be recorded in the changelog.

---

## 1. Notification Channels

All notification events should be designed as shared events first, then delivered to channels.

Channels:

1. Telegram Bot
2. App Push / In-App Alert

Target architecture:

```text
Event
  ├── Telegram
  └── App Push / In-App Alert
```

Telegram and App alerts should use the same trigger rules, same event identity, and same deduplication key.

---

## 2. Event Types

### 2.1 Near-Zone Warning Alerts

Purpose: warn the user to prepare USDT and open the app. This is not a buy instruction.

Thresholds:

- 92%
- 94%
- 96%
- 98%

Example:

```text
🟡 DCA 折價獵人 預警

SPCXon 接近 D2
目前進度：94%
還差：1.6%
本層建議：10U
```

Rules:

- Send when a symbol crosses one of the near-zone thresholds for the next target layer.
- Do not repeatedly send the same threshold for the same symbol and target layer.
- If the symbol leaves the zone and later re-enters, the alert can be sent again.

---

### 2.2 Buy Point Trigger Alerts

Purpose: notify the user that a real buy layer has been reached.

Buy layers:

- D1
- D2
- D3
- D4

Forward transitions that must notify:

```text
D0 → D1
D1 → D2
D2 → D3
D3 → D4
```

Example:

```text
🚨 DCA 折價獵人 買點警報

NVDAon 已觸發 D1
目前跌幅：-18.0%
本層建議：5U
請打開 App 檢查今日決策。
```

Rules:

- Send when a symbol first reaches D1, D2, D3, or D4.
- Do not repeat the same layer alert while the symbol remains in the same layer.
- If Ledger already records the completed layer, do not send a buy point alert for that completed layer.

---

### 2.3 Retreat Alerts

Purpose: notify the user that a symbol has recovered and moved back to a shallower layer or exited buy zones.

Retreat transitions that must notify:

```text
D4 → D3
D3 → D2
D2 → D1
D1 → D0
```

Any backward move must notify, regardless of how many layers it retreats.

Examples:

```text
🔄 DCA 折價獵人 回退通知

RKLBon 已退出 D3
目前回到 D2
原因：價格反彈，高於 D3 門檻。
```

```text
🔄 DCA 折價獵人 回退通知

NVDAon 已退出 D1
目前回到 D0，已離開買點區。
```

Rules:

- Send when the current layer becomes lower than the previous recorded layer.
- If the symbol retreats multiple layers at once, one notification is acceptable, but it must clearly show previous layer and current layer.
- Retreat alerts should update the stored state so future re-entry alerts can trigger correctly.

---

### 2.4 Ledger Alerts

Purpose: protect against false completion and missed accounting.

Events:

- Ledger reconcile success
- Wallet holding exists but Ledger is missing the corresponding completed layer
- Ledger / Wallet inconsistency
- Cost basis abnormality

Examples:

```text
✅ DCA 折價獵人 Ledger

SPCXon D1 補登成功
價格：152.73
數量：0.1053
```

```text
⚠️ DCA 折價獵人 Ledger 異常

Wallet 偵測到持倉，但 Ledger 尚未補登。
請檢查補登 Ledger。
```

Rules:

- Ledger success notifications are allowed.
- Ledger / Wallet inconsistency must alert.
- Ledger alerts should include symbol, layer, price, amount, and time when available.

---

### 2.5 Wallet / System Alerts

Purpose: warn the user when the system may be unable to make reliable decisions.

Events:

- Wallet Sync failed
- BSC RPC failed
- Binance xStocks price API failed
- Telegram send failed
- App Push send failed
- Missing environment variables

Example:

```text
⚠️ DCA 折價獵人 系統異常

Wallet Sync 失敗
本次不發送買點清單，避免錯誤提醒。
```

Rules:

- System error alerts should have cooldown to avoid spam.
- If Wallet cannot be verified, buy point alerts should be blocked or downgraded to warning status.

---

### 2.6 Daily Summary

Purpose: provide one daily overview.

Suggested content:

- Today Decision count
- Near-zone warning count
- Triggered buy point count
- Wallet market value
- Unrealized PnL
- Largest position
- Wallet status
- Ledger status

Example:

```text
📊 DCA 折價獵人 每日摘要

今日決策：0
接近買點：1
已觸發買點：0
持倉市值：73.55U
未實現損益：-6.45U
Wallet：LIVE
Ledger：PASS
```

Rules:

- Send at most once per day unless manually triggered.
- Daily summary is informational and should not replace real-time buy point alerts.

---

## 3. Deduplication Rules

All notification events must have a stable event key.

Recommended key format:

```text
notification:{channel}:{type}:{symbol}:{fromLayer}:{toLayer}:{threshold}
```

Examples:

```text
notification:telegram:near:SPCXon:D1:D2:94
notification:telegram:trigger:SPCXon:D1:D2:100
notification:telegram:retreat:SPCXon:D2:D1:none
notification:app:trigger:NVDAon:D0:D1:100
```

Rules:

- Same event key should not repeatedly notify within its cooldown window.
- Retreat events must reset relevant near-zone and trigger states when appropriate.
- App and Telegram may share event state, but channel delivery status should be tracked separately.

---

## 4. Cooldown Guidelines

Recommended cooldowns:

- Near-zone warning: one per threshold per symbol per target layer until reset
- Buy point trigger: one per symbol per layer until reset or new layer transition
- Retreat: one per layer transition
- System error: 6 to 12 hours
- Daily summary: 24 hours

---

## 5. App Push / In-App Alert Requirements

App alerts must mirror Telegram events.

Required app alert types:

1. Near-zone warning
2. Buy point trigger
3. Retreat alert
4. Ledger alert
5. Wallet / system alert
6. Daily summary

Minimum App UI behavior:

- Show alert badge or alert section in dashboard
- Show latest alert timestamp
- Allow user to distinguish warning vs real buy point vs retreat
- Do not hide active buy point alerts until resolved by Ledger or retreat

---

## 6. Audit Requirements

Audit-021 can only be closed when these are verified:

1. Telegram test message works
2. Near-zone warning sends at configured thresholds
3. Buy point trigger sends for D1 / D2 / D3 / D4
4. Retreat sends for D4→D3, D3→D2, D2→D1, D1→D0
5. Duplicate notification is blocked
6. Ledger completed layer stops further buy point notification for that layer
7. Wallet/API errors send system warning and block unreliable buy alerts
8. App alert uses the same event rules as Telegram

---

## 7. Change Control

Any change to notification behavior must update:

1. `docs/NOTIFICATION_SOP.md`
2. `CHANGELOG` or dashboard update record
3. Relevant Audit record

No notification logic should be changed only in chat history.
