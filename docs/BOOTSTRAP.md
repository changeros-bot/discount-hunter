# BOOTSTRAP.md

## Fresh Ubuntu Bootstrap

Run on a new Ubuntu server.

```bash
sudo apt update -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Clone and install:

```bash
cd ~
git clone https://github.com/changeros-bot/discount-hunter.git
cd discount-hunter
npm install
```

Create local runtime config from the secure template. Do not commit local runtime config.

Build and run:

```bash
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

Start proxy:

```bash
cd ~/binance-proxy
pm2 start index.js --name oracle-binance-proxy
pm2 save
```

Verify:

```bash
curl http://localhost:3001/health
curl http://localhost:3000/api/v17/health
curl http://localhost:3000/api/binance-exchange-position
curl http://localhost:3000/api/sync-wallet
```
