# RELEASE_CHECKLIST.md

## V17 Release Checklist

本檔用於 V17 及後續版本封板前檢查。

## 1. Infrastructure

- [ ] Oracle / VPS Running
- [ ] Public IP 正常
- [ ] Port 22 / 3000 / 3001 已開
- [ ] `pm2 status` 兩個服務 online
- [ ] `discount-hunter` online
- [ ] `oracle-binance-proxy` online

驗證：

```bash
pm2 status
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3000/api/v17/health
```

## 2. Storage

- [ ] Upstash Redis REST URL 已設定
- [ ] Upstash Redis REST Token 已設定
- [ ] `storage.mode = upstash_kv`
- [ ] `storage.durable = true`
- [ ] 不使用 runtime file 寫入 production mutable state

驗證：

```bash
curl http://158.179.185.67:3000/api/v17/health
```

## 3. Binance BTC Sync

- [ ] `BINANCE_API_KEY` 已設定
- [ ] `BINANCE_API_SECRET` 已設定
- [ ] API key 只開 Read-only
- [ ] `BINANCE_REST_BASE_URL=http://158.179.185.67:3001`
- [ ] `/api/binance-exchange-position` 成功
- [ ] BTC quantity > 0
- [ ] averageBuyPrice > 0
- [ ] marketPrice > 0
- [ ] currentValue > 0

驗證：

```bash
curl http://158.179.185.67:3000/api/binance-exchange-position
```

## 4. xStocks Wallet Sync

- [ ] `WALLET_ADDRESS` 已設定
- [ ] `/api/sync-wallet` 成功
- [ ] liveBalanceHoldingsCount > 0
- [ ] holdingsCount > 0
- [ ] priceSource = binance_xstocks_live
- [ ] wallet address 顯示 `0x657f...AD76`

驗證：

```bash
curl http://158.179.185.67:3000/api/sync-wallet
```

## 5. Cost Basis

目前狀態：

- [x] BTC 成本：Binance myTrades 真實還原
- [ ] xStocks 成本：仍需 Moralis / NodeReal / MegaNode transfer history

若 xStocks 出現：

```text
costBasisEstimated: true
fallback_first_layer_cost_missing_transfer_stablecoin_leg
```

代表持倉數量與市值為真實，但成本仍是 fallback。

封正式版前目標：

```text
totalTransfers > 0
buyRecordCount > 0
costBasisEstimated: false
```

## 6. UI Smoke Test

手機開啟：

```text
http://158.179.185.67:3000/v17
```

檢查：

- [ ] 頁面可開啟
- [ ] 紅色 `v17_requires_durable_storage_upstash_kv` 消失
- [ ] BTC 顯示正常
- [ ] xStocks holdings 顯示正常
- [ ] 今日決策區正常
- [ ] 持倉區正常
- [ ] 觀察區正常

## 7. Self Test

```bash
curl http://158.179.185.67:3000/api/v17/self-test
curl http://158.179.185.67:3000/api/v17/health
```

目前已知可能還有 4 個邏輯測試失敗：

```text
btc_uses_dedicated_model
d2_reenters_after_d1_complete
missing_price_suspect
deeper_layer_reenters_after_skip
```

這些是 V17 action queue / state machine 邏輯問題，不是部署問題。

## 8. Security Before Seal

- [ ] Binance API Key 重新產生
- [ ] Binance API Secret 未出現在 GitHub / Docs / Chat
- [ ] Upstash REST Token 已 rotate
- [ ] `.env.local` 未 commit
- [ ] SSH private key 未上傳
- [ ] GitHub repo 無真實 secret

## 9. GitHub State

- [ ] 程式變更 commit
- [ ] docs 更新
- [ ] deployment kit 更新
- [ ] release notes 更新

## 10. Final Seal Criteria

V17 可封板條件：

```text
Infrastructure: pass
Storage: pass
Binance BTC: pass
xStocks live holdings: pass
Mobile UI smoke: pass
Security rotation: pass
Known failing self-tests either fixed or explicitly documented
```
