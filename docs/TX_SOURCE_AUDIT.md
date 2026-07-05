# Tx Source Audit Workflow

This project must not use screenshots as cost-basis source data.

Valid source order:

1. Chain tx hash / receipt / logs
2. Binance export CSV / official transaction export
3. Existing app raw ledger as temporary recovered cost only

## API

```txt
/api/v17/tx-source-audit?tx=0x...
```

Multiple hashes:

```txt
/api/v17/tx-source-audit?hashes=0xaaa,0xbbb
```

## BUY rule

A tx hash is a verified BUY source only when the same receipt contains:

```txt
stablecoin OUT from wallet + xStock IN to wallet
```

## Not allowed

- Do not derive cost only from screenshots.
- Do not label screenshot-derived numbers as verified source.
- Do not connect screenshot numbers to /v17.
