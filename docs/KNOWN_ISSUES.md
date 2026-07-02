# KNOWN_ISSUES.md

## Current Known Issues

## 1. xStocks cost basis is estimated

Status: open

Symptom:

```text
costBasisEstimated: true
costBasisSource: fallback_first_layer_cost_missing_transfer_stablecoin_leg
```

Cause:

```text
Transfer history provider is not configured.
```

Impact:

```text
Wallet quantity is real.
Market price is real.
Market value is real.
Cost basis is estimated.
PnL for xStocks is not final truth.
```

Fix:

```text
Connect Moralis, NodeReal, MegaNode, or another transfer-history source.
```

Success criteria:

```text
totalTransfers > 0
buyRecordCount > 0
costBasisEstimated = false
```

## 2. V17 state machine self-test failures

Status: open

Known failing tests:

```text
btc_uses_dedicated_model
d2_reenters_after_d1_complete
missing_price_suspect
deeper_layer_reenters_after_skip
```

Impact:

```text
Infrastructure is fine.
Provider sync is fine.
Remaining work is action queue and state-machine logic.
```

## 3. Secrets were exposed during setup

Status: must rotate before final release

Rotate:

```text
Binance API key
Binance API secret
Upstash REST token
```

## 4. No HTTPS yet

Status: open

Current URL is plain HTTP.

Next step:

```text
Bind domain and add HTTPS reverse proxy.
```

## 5. Telegram decision push not sealed

Status: open

Need to verify:

```text
new decision notification
no duplicate notification
daily summary
manual test endpoint
```
