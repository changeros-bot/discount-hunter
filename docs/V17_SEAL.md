# V17_SEAL.md

## Release

DCA Discount Hunter V17

## Status

Production Candidate

## Verified

- Self-test: 22/22 passed
- Health check: ok:true
- Upstash KV: durable
- Universe U10: passed
- BTC cycle high model: passed
- Binance read-only sync: passed
- BSC wallet sync: passed
- Moralis transfer history: passed
- xStocks estimated cost basis count: 0
- PM2 production runtime: online

## Frozen Rules

- Universe U10 only
- BTC uses btc_cycle_high_v1
- BTC cycle high update requires confirmed 30-day breakout
- V17 mutable state must use Upstash KV
- Investment and Tactical ledgers must remain separated
- Decision Engine passed 22/22 and should not be changed without regression tests

## Pending Before Final Seal

- Mobile UI smoke test
- Optional HTTPS/domain
- Rotate exposed secrets before long-term production use
