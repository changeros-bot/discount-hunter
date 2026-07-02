# PM2_SETUP.md

## 1. PM2 用途

PM2 負責：

```text
24 小時運行
程式崩潰自動重啟
VPS 重開機後自動復原
查看 logs
```

目前服務：

```text
discount-hunter
oracle-binance-proxy
```

## 2. 安裝

```bash
sudo npm install -g pm2
pm2 -v
```

## 3. 開機自動啟動

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

PM2 會輸出一行 `sudo env PATH=...`，複製執行。

保存：

```bash
pm2 save
```

## 4. 啟動 Discount Hunter

```bash
cd ~/discount-hunter
npm run build
pm2 start npm --name discount-hunter -- start
pm2 save
```

## 5. 啟動 Oracle Binance Proxy

```bash
cd ~/binance-proxy
pm2 start index.js --name oracle-binance-proxy
pm2 save
```

## 6. 常用指令

```bash
pm2 status
pm2 logs discount-hunter --lines 50
pm2 logs oracle-binance-proxy --lines 50
pm2 restart discount-hunter --update-env
pm2 restart oracle-binance-proxy
pm2 stop discount-hunter
pm2 delete discount-hunter
pm2 save
```

## 7. 更新程式後重啟

```bash
cd ~/discount-hunter
git pull
npm install
npm run build
pm2 restart discount-hunter --update-env
pm2 save
```

## 8. 驗證

```bash
curl http://158.179.185.67:3000/api/v17/health
curl http://158.179.185.67:3001/health
```

## 9. 常見問題

### PM2 save 警告沒有 process

```text
PM2 is not managing any process, skipping save
```

代表還沒啟動任何服務，正常。

### 修改 `.env.local` 後沒有生效

要用：

```bash
pm2 restart discount-hunter --update-env
```

### `next start` 找不到 production build

先執行：

```bash
npm run build
```

### Logs 模式無法輸入指令

按 `Ctrl + C` 離開。
