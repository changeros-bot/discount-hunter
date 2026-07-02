# MIGRATION_GUIDE.md

> 目標：未來換 GPT、換 SSH App、換 Oracle/VPS 時，依照本文件在 30 分鐘內重建 DCA 折價獵人。

## A. 換 SSH App，不換主機

可替代 Termius：

```text
JuiceSSH
ConnectBot
Windows/Mac/Linux OpenSSH
```

連線設定：

```text
Host: 158.179.185.67
Port: 22
Username: ubuntu
Auth: Private Key
Private key: ssh-key-2026-07-01.key
```

登入後驗證：

```bash
pm2 status
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3000/api/v17/health
```

## B. 換 VPS / Oracle 新主機

### 1. 建立主機

建議：Ubuntu 24.04 LTS。

最低規格：

```text
1 vCPU
1 GB RAM
40 GB disk
Public IP
```

開放連接埠：

```text
22    SSH
3000  Discount Hunter Next.js
3001  Oracle Binance Proxy
```

### 2. 安裝基礎環境

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

執行 PM2 顯示的 `sudo env PATH=...` 指令。

### 3. Clone 專案

```bash
cd ~
git clone https://github.com/changeros-bot/discount-hunter.git
cd discount-hunter
npm install
```

### 4. 建立 `.env.local`

照 `docs/ENV_TEMPLATE.md` 建立。

### 5. Build + PM2 啟動

```bash
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

### 6. 建立 Binance Proxy

```bash
cd ~
mkdir -p binance-proxy
cd binance-proxy
npm init -y
npm install express dotenv
```

建立 `index.js`：

```js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3001;
const BINANCE_BASE = "https://api.binance.com";

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "oracle-binance-proxy", checkedAt: new Date().toISOString() });
});

app.use(async (req, res) => {
  try {
    const target = `${BINANCE_BASE}${req.originalUrl}`;
    const response = await fetch(target, {
      method: req.method,
      headers: { "X-MBX-APIKEY": req.headers["x-mbx-apikey"] || "" }
    });
    const text = await response.text();
    res.status(response.status).type(response.headers.get("content-type") || "application/json").send(text);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Oracle Binance Proxy running on port ${PORT}`);
});
```

啟動：

```bash
pm2 start index.js --name oracle-binance-proxy
pm2 save
```

## C. 新主機驗證

```bash
curl http://NEW_IP:3001/health
curl http://NEW_IP:3001/api/v3/ticker/price?symbol=BTCUSDT
curl http://NEW_IP:3000/api/v17/health
curl http://NEW_IP:3000/api/binance-exchange-position
curl http://NEW_IP:3000/api/sync-wallet
```

## D. 換 IP 後要改的地方

`.env.local`：

```env
BINANCE_REST_BASE_URL=http://NEW_IP:3001
```

如果程式內有硬編碼舊 IP，也要查：

```bash
grep -R "158.179.185.67" . --exclude-dir=node_modules --exclude-dir=.next
```

## E. 安全遷移原則

不要 commit 真實：

```text
BINANCE_API_SECRET
UPSTASH_REDIS_REST_TOKEN
SSH private key
```

若曾貼到聊天或截圖，請 rotate。
