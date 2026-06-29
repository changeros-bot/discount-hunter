# DCA 折價獵人 V17 Architecture Refactor Plan

Last updated: 2026-06-29

---

## Purpose

V17 is the architecture cleanup line.

V16 should remain the stable usable version. V16 only accepts necessary bug fixes, display fixes, regression checks, and release closeout. Refactoring, module restructuring, Event Engine, and notification-center work belong to V17.

---

## Version boundary

| Version | Purpose | Allowed work |
|---|---|---|
| V16 | Stable daily-use release | bug fixes, regression, release closeout |
| V17 | Architecture refactor | module split, event model, notification expansion, UI slimming |

---

## Current V16 problem

`pages/v16-full.js` contains too many responsibilities:

- React UI
- API calls
- symbol normalization
- wallet comparison
- ledger display
- decision state
- D1-D4 tier progress
- reconcile behavior

This makes small fixes risky because a change in one part can unintentionally break another part.

---

## V17 target structure

```text
lib/v16/
├── index.js
├── symbol.js
├── ledger.js
├── wallet.js
├── tier.js
└── decision.js
```

Later, after V17 is stable, the folder can be renamed or aliased to a version-neutral core.

---

## Existing V17 prep already created

```text
lib/v16/symbol.js
lib/v16/ledger.js
lib/v16/index.js
```

These files are preparation only. They should not be treated as production behavior until `pages/v16-full.js` explicitly imports and uses them.

---

## Refactor rule

Refactor one domain at a time:

1. Extract helper.
2. Add or update regression check.
3. Connect homepage.
4. Verify production behavior.
5. Only then move to next helper.

Do not extract many helpers at once without wiring and verification.

---

## First V17 target

Ledger display:

```text
已登帳：D1｜D2 尚未登帳
已登帳：D1 / D2｜D3 尚未登帳
已登帳：D1 / D2 / D3｜D4 尚未登帳
已登帳：D1 / D2 / D3 / D4
```

This should be implemented through `lib/v16/ledger.js` and then connected to `pages/v16-full.js` in a small patch or PR.

---

## V17 non-goals

Do not include in the first V17 cleanup pass:

- auto-trading
- new assets
- new investment strategy
- UI redesign
- LINE integration
- advanced charts

---

## Success criteria

V17 cleanup is successful only if:

- homepage behavior remains identical or clearer
- no regression in `/api/regression-v16`
- Ledger display is correct
- Wallet does not directly mark tiers as bought
- `pages/v16-full.js` becomes smaller and easier to review
