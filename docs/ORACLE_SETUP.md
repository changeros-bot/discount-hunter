# ORACLE_SETUP.md

## 1. 建議規格

```text
Provider: Oracle Cloud Free Tier / VPS
OS: Ubuntu 24.04 LTS
Shape: VM.Standard.E2.1.Micro 或更高
Public IP: Enabled
Region: Tokyo / Singapore / non-restricted region
```

## 2. 建立 VM 注意事項

建立時確認：

```text
Public IPv4 Address: Enabled
SSH Key: Download private key
Subnet: Public subnet
```

如果 Public IP 顯示 `-`：

1. 建立 Reserved Public IP。
2. 綁定到 Primary Private IP。
3. 確認 Instance Details 顯示 Public IP。

## 3. 必開 Port

Oracle Security List 與所有綁定的 NSG 都要開：

```text
22/tcp    SSH
3000/tcp  Discount Hunter Web
3001/tcp  Binance Proxy
```

規則：

```text
Direction: Ingress
Source CIDR: 0.0.0.0/0
Protocol: TCP
Destination Port: 22 / 3000 / 3001
```

注意：若 VNIC 綁了兩個 `ig-quick-action-NSG`，兩個都要加相同規則。

## 4. Ubuntu iptables

Oracle Ubuntu image 可能有 iptables REJECT 規則，需放行 3000/3001：

```bash
sudo iptables -I INPUT 5 -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 3001 -j ACCEPT
sudo iptables -L INPUT -n --line-numbers
```

應看到：

```text
tcp dpt:3000
tcp dpt:3001
```

## 5. 安裝基礎環境

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
git --version
```

## 6. PM2

```bash
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

## 7. 驗證 Oracle 對 Binance 是否可用

```bash
curl -i https://api.binance.com/api/v3/time
curl -i "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
```

成功應為 HTTP 200。

若出現 HTTP 451，該區域或雲端出口不可用，需換區域或換 VPS。

## 8. 外部驗證

```bash
curl http://158.179.185.67:3001/health
curl http://158.179.185.67:3000/api/v17/health
```

手機瀏覽器：

```text
http://158.179.185.67:3000/v17
```
