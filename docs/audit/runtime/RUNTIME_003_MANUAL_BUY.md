# RUNTIME-003 Manual Buy Validation

Date: 2026-06-27
Status: PENDING - BLOCKED BY DURABLE STATE CONFIG

## Scope

Validate live behavior for manual Ledger writes:

- D1-D4 first write.
- D1-D4 duplicate protection.
- N tier recurring DCA writes.
- v16-manual UI refresh after write.

## Important Runtime Constraint

Current live `/api/v16-status` shows:

```text
releaseBlocked: true
storage: missing_required_upstash_kv
durableStateOk: false
requiresDurableKv: true
hasKvConfig: false
```

Therefore production Ledger writes should be blocked by durable-state policy.

This is expected behavior.

## Current Expected Result Before Upstash Is Configured

### POST `/api/manual-buy`

Expected before durable state is configured:

```json
{
  "ok": false,
  "error": "missing_required_upstash_kv"
}
```

or equivalent failure surfaced through the API.

Reason:

Production must not write Ledger into memory/file fallback.

## Full Validation After Upstash Is Configured

### Test 1 - First D1 Write

Request:

```http
POST /api/manual-buy
Content-Type: application/json

{
  "symbol": "NVDAon",
  "tier": "D1",
  "amount": 5,
  "price": 0,
  "note": "runtime_test_d1_first"
}
```

Expected:

```json
{
  "ok": true,
  "duplicate": false,
  "storage": "upstash_kv"
}
```

### Test 2 - Duplicate Same D1

Request:

```http
POST /api/manual-buy
Content-Type: application/json

{
  "symbol": "NVDAon",
  "tier": "D1",
  "amount": 5,
  "price": 0,
  "note": "runtime_test_d1_duplicate"
}
```

Expected:

```json
{
  "ok": true,
  "duplicate": true,
  "storage": "unchanged",
  "duplicateReason": "same_tier_already_recorded"
}
```

### Test 3 - N Tier First Write

Request:

```http
POST /api/manual-buy
Content-Type: application/json

{
  "symbol": "NVDAon",
  "tier": "N",
  "amount": 5,
  "price": 0,
  "note": "runtime_test_n_first"
}
```

Expected:

```json
{
  "ok": true,
  "duplicate": false,
  "storage": "upstash_kv"
}
```

### Test 4 - N Tier Repeat Write

Expected:

```json
{
  "ok": true,
  "duplicate": false,
  "storage": "upstash_kv"
}
```

N tier is recurring DCA and must remain appendable.

## UI Validation

After a successful write:

- `/v16-manual` should refresh.
- Completed D-tier decision should disappear.
- Ledger details should include the new row.
- Duplicate result should display `已存在，未重複登帳`.

## Current Result

Manual Buy live validation cannot be fully completed until Upstash KV is configured.

Do not proceed to Release while this remains pending.
