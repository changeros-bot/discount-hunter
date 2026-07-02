# SERVER_RECOVERY.md

## 目的

當 Oracle / VPS 壞掉、SSH App 換掉、PM2 消失、或主機需要重建時，依照本文件快速恢復服務。

## 1. 最小恢復目標

恢復後必須通過：

```bash
curl http://SERVER_IP:3001/health
curl http://SERVER_IP:3001/api/v3/ticker/price?symbol=BTCUSDT
curl http://SERVER_IP:3000/api/v17/health
curl http://SERVER_IP:3000/api/binance-exchange-position
curl http://SERVER_IP:3000/api/sync-wallet
```

## 2. 必備備份資料

```text
GitHub Repo: changeros-bot/discount-hunter
SSH private key: ssh-key-2026-07-01.key
Oracle / VPS IP: 158.179.185.67
SSH user: ubuntu
Upstash Redis REST URL / TOKEN
Binance Read-only API KEY / SECRET
BSC Wallet Address: 0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
```

真實 secret 不應寫入 GitHub，只能放在主機 `.env.local` 或安全密碼庫。

## 3. 新主機恢復流程

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

建立專案：

```bash
cd ~
git clone https://github.com/changeros-bot/discount-hunter.git
cd discount-hunter
npm install
```

恢復 `.env.local`：

```bash
cat > .env.local <<EOF
UPSTASH_REDIS_REST_URL=YOUR_VALUE
UPSTASH_REDIS_REST_TOKEN=YOUR_VALUE
BINANCE_REST_BASE_URL=http://SERVER_IP:3001
BINANCE_API_KEY=YOUR_VALUE
BINANCE_API_SECRET=YOUR_VALUE
WALLET_ADDRESS=0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76
EOF
```

Build + 啟動：

```bash
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

## 4. Proxy 恢復流程

```bash
cd ~
mkdir -p binance-proxy
cd binance-proxy
npm init -y
npm install express dotenv
```

建立 `index.js` 內容請參考 `docs/MIGRATION_GUIDE.md`。

啟動：

```bash
pm2 start index.js --name oracle-binance-proxy
pm2 save
```

## 5. 防火牆恢復

Oracle Security List / NSG：

```text
22/tcp
3000/tcp
3001/tcp
```

Ubuntu iptables：

```bash
sudo iptables -I INPUT 5 -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 3001 -j ACCEPT
sudo iptables -L INPUT -n --line-numbers
```

## 6. 驗收

```bash
pm2 status
curl http://SERVER_IP:3001/health
curl http://SERVER_IP:3000/api/v17/health
```

成功後手機開：

```text
http://SERVER_IP:3000/v17
```
