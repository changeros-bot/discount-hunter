# TROUBLESHOOTING.md

## 1. `v17_requires_durable_storage_upstash_kv`

原因：production 沒有 Upstash Redis REST env。

修法：建立 `.env.local`：

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

重啟：

```bash
pm2 restart discount-hunter --update-env
```

驗證：

```bash
curl http://158.179.185.67:3000/api/v17/health
```

應看到：

```text
storage.mode = upstash_kv
storage.durable = true
```

## 2. Binance API 顯示未設定

症狀：

```text
apiKeyPresent=false
apiSecretPresent=false
```

修法：`.env.local` 加入：

```env
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_REST_BASE_URL=http://158.179.185.67:3001
```

重啟：

```bash
pm2 restart discount-hunter --update-env
```

## 3. Binance 回 HTTP 451

原因：雲端出口 IP 被 Binance 視為 restricted location。

解法：不要用 Cloudflare Workers；改用 Oracle/VPS 固定出口。

驗證：

```bash
curl -i https://api.binance.com/api/v3/time
```

成功應為 HTTP 200。

## 4. `/api/binance-exchange-position` 市價為 0

症狀：

```text
tokenPrice: 0
currentValue: 0
returnPct: -1
```

原因：BTC market price 沒傳入 provider。

驗證：

```bash
curl "http://158.179.185.67:3000/api/binance-exchange-position?btcPrice=60786"
```

若成功，需讓 endpoint 自動抓 Binance ticker。

## 5. xStocks 成本是 fallback 5U

症狀：

```text
costBasisEstimated: true
costBasisSource: fallback_first_layer_cost_missing_transfer_stablecoin_leg
totalTransfers: 0
buyRecordCount: 0
```

原因：缺 transfer history provider。

修法：接 Moralis / NodeReal / MegaNode。

目標：

```text
totalTransfers > 0
buyRecordCount > 0
costBasisEstimated: false
```

## 6. 外部打不開 3000 / 3001

檢查 Node 是否監聽：

```bash
ss -ltnp | grep 3000
ss -ltnp | grep 3001
```

應看到：

```text
*:3000
0.0.0.0:3001
```

檢查 iptables：

```bash
sudo iptables -L INPUT -n --line-numbers
```

若只有 22，放行：

```bash
sudo iptables -I INPUT 5 -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 3001 -j ACCEPT
```

Oracle Security List 與所有 NSG 也要開 3000 / 3001。

## 7. `Could not find a production build in the .next directory`

原因：沒有完整 build。

修法：

```bash
cd ~/discount-hunter
npm run build
pm2 restart discount-hunter --update-env
```

## 8. `npm run build` 卡住

Oracle E2 Micro 只有 1GB RAM，Next build 可能要數分鐘。

檢查：

```bash
free -h
dmesg | tail -30
```

若出現 OOM，需加 swap 或升級主機。

## 9. PM2 logs 無法輸入指令

因為在 tail logs 模式。

按：

```text
Ctrl + C
```

回到 `$` 後再輸入指令。

## 10. 手機貼指令進入 `>` 多行模式

原因：引號或 heredoc 沒結束。

解法：按 `Ctrl + C` 回到 `$`。

手機避免用 nano，可用：

```bash
cat > .env.local <<EOF
KEY=value
EOF
```

## 11. API Key / Token 貼到聊天

視為外洩。

處理：

1. Binance 刪除舊 key，重建 read-only key。
2. Upstash rotate token。
3. 更新 `.env.local`。
4. `pm2 restart discount-hunter --update-env`。
