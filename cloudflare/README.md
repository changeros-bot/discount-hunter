# Cloudflare Workers Cron for DCA Discount Hunter

目的：用 Cloudflare Workers Free 作為高頻免費排程器，定時呼叫 Vercel 的 Telegram alert API。

## 架構

```text
Cloudflare Cron Trigger
  -> Cloudflare Worker
  -> https://discount-hunter-sigma.vercel.app/api/telegram-alerts
  -> Telegram
```

Vercel 繼續負責 App、行情、錢包同步與 Telegram 發送邏輯。Cloudflare 只負責定時叫醒。

## 建議頻率

```cron
*/15 * * * *
```

每 15 分鐘一次，約 96 次/天。

## 檔案

- `discount-hunter-cron-worker.js`：Cloudflare Worker 程式
- `wrangler.toml.example`：Wrangler 設定範例

## 部署方式 A：Cloudflare Dashboard

1. Cloudflare Dashboard -> Workers & Pages -> Create Worker
2. 貼上 `discount-hunter-cron-worker.js` 的內容
3. Settings -> Variables 新增：
   - `ALERT_URL = https://discount-hunter-sigma.vercel.app/api/telegram-alerts`
4. Triggers -> Cron Triggers 新增：
   - `*/15 * * * *`
5. 部署後先打開 Worker URL 的 `/run` 測試一次

## 部署方式 B：Wrangler CLI

```bash
cd cloudflare
cp wrangler.toml.example wrangler.toml
wrangler deploy
```

## 測試

部署後打開：

```text
https://<your-worker>.<your-subdomain>.workers.dev/health
```

應回：

```json
{"ok":true}
```

手動觸發一次：

```text
https://<your-worker>.<your-subdomain>.workers.dev/run
```

如果 Telegram 收到通知，代表 Cloudflare -> Vercel -> Telegram 這條鏈正常。

## 保留 Vercel Cron 的理由

Vercel Cron 目前可保留低頻備援，例如一天 4 次。Cloudflare Cron 提供高頻檢查。若 Cloudflare 暫時失效，Vercel 仍有備援通知。
