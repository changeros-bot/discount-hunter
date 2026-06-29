# V17 Storage Policy

V17 must not repeat the V16 storage mistake.

## Core Rule

Static configuration can live in GitHub.
Mutable user state must live in durable storage.

## Allowed in GitHub / Repo

These are versioned product definitions:

- Asset Registry
- Strategy definitions
- Engine definitions
- Discount Model definitions
- Architecture documents
- Regression test definitions

## Not Allowed in Runtime Files

These must not be stored in Vercel runtime files or temporary JSON files:

- Investment Ledger
- Tactical Ledger
- Cost basis
- Lot history
- Review state
- Research Queue
- Manual buy records
- User-specific execution state

## Production Requirement

In production, V17 requires durable KV storage.

Required environment variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If production runs without durable KV, V17 must fail loudly instead of silently falling back to runtime files.

## Local Development

Local development may use memory fallback only.

Memory fallback is intentionally non-durable and must not be treated as production data.

## Ledger Separation

Investment Engine and Tactical Engine must use separate storage keys:

- `discount-hunter:v17:investment-ledger`
- `discount-hunter:v17:tactical-ledger`

The same asset may exist in both engines, but cost, performance, lots, and execution history must remain fully independent.

## Architecture Principle

A feature is not complete until its data persistence model is explicit.

No new mutable feature may be merged without answering:

1. What is the source of truth?
2. Is the data static or mutable?
3. If mutable, which durable key owns it?
4. How is it separated from Tactical or Investment state?
5. What happens if durable storage is missing?
