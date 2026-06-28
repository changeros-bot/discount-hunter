# DCA 折價獵人 Project Principles

Last updated: 2026-06-29

---

## 1. Wallet Live first

Current holdings must be verified from live wallet balance data. Transfer history and ledger are not substitutes for live holdings.

---

## 2. No hidden writes

Read paths should not secretly mutate production state. Any write path must be explicit, documented, and testable.

---

## 3. Ledger is accounting, not wallet truth

Ledger records completed buy layers. Wallet Live records actual current holdings.

---

## 4. Shared health gate

All routes that decide health must use shared health logic. Divergent health rules are not allowed.

---

## 5. Notifications are shared events first

Telegram, App Push, and future channels must use the same event definitions and dedupe keys.

---

## 6. V16 is hardening, not feature expansion

During V16 hardening, only bug fixes, regression work, and documentation are allowed unless explicitly approved.

---

## 7. Documentation is part of completion

A change is not complete until the relevant master docs are updated.

---

## 8. Production evidence beats assumptions

Do not mark a feature PASS without production evidence, screenshot, logs, or code inspection.

---

## 9. One production domain

Final validation must use the confirmed production domain:

```text
https://discount-hunter-sigma.vercel.app
```

---

## 10. User trust over speed

If a claim is not verified, state it as pending. Do not pretend a commit, deploy, or validation happened.
