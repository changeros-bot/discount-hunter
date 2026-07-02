# ONE_CLICK_RECOVERY.md

## Goal

Recover Discount Hunter V17 on a new server as quickly as possible.

## Steps

```text
1. Provision Ubuntu server.
2. Open ports 22, 3000, 3001.
3. Install Node.js and PM2.
4. Clone repo.
5. Restore local runtime config.
6. Build app.
7. Start PM2 services.
8. Run verification script.
9. Open mobile UI.
```

## Commands

```bash
sudo apt update -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

cd ~
git clone https://github.com/changeros-bot/discount-hunter.git
cd discount-hunter
npm install
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

## Verify

```bash
bash scripts/verify-all.sh
```

## Pass Criteria

```text
proxy ok
v17 health ok
prices load
Binance BTC position loads
wallet sync loads
mobile UI opens
```
