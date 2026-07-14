#!/usr/bin/env python3
"""Archive active paper trades created by pre-V1 2560 rules.

Legacy trades are preserved for audit, but they must not remain active or block
new RUSH_VOLUME / BUILT_VOLUME / VOLUME_PIT signals.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

VALID_PATTERNS = {"RUSH_VOLUME", "BUILT_VOLUME", "VOLUME_PIT"}
ACTIVE_STATUSES = {"OPEN", "PENDING"}


def main() -> None:
    output_dir = Path("reports/paper")
    ledger_path = output_dir / "2560_paper_trades.csv"
    if not ledger_path.exists() or ledger_path.stat().st_size == 0:
        print("No 2560 ledger found; legacy migration skipped.")
        return

    ledger = pd.read_csv(ledger_path).fillna("")
    for column in [
        "pattern", "pattern_zh", "status", "ticker", "last_date", "last_price",
        "exit_date", "exit_price", "exit_reason", "updated_at", "signal_reason",
    ]:
        if column not in ledger.columns:
            ledger[column] = ""

    pattern = ledger["pattern"].astype(str).str.strip()
    status = ledger["status"].astype(str).str.strip().str.upper()
    legacy_mask = status.isin(ACTIVE_STATUSES) & ~pattern.isin(VALID_PATTERNS)
    migrated = int(legacy_mask.sum())

    if migrated:
        now = datetime.now(timezone.utc).isoformat()
        ledger.loc[legacy_mask, "status"] = "CLOSED"
        ledger.loc[legacy_mask, "exit_date"] = ledger.loc[legacy_mask, "last_date"]
        ledger.loc[legacy_mask, "exit_price"] = ledger.loc[legacy_mask, "last_price"]
        ledger.loc[legacy_mask, "exit_reason"] = "legacy_rule_replaced"
        ledger.loc[legacy_mask, "signal_reason"] = "LEGACY_RULE_REPLACED"
        ledger.loc[legacy_mask, "updated_at"] = now
        ledger.to_csv(ledger_path, index=False)

    open_positions = ledger[ledger["status"].astype(str).str.upper().isin(ACTIVE_STATUSES)]
    closed_trades = ledger[ledger["status"].astype(str).str.upper() == "CLOSED"]
    open_positions.to_csv(output_dir / "2560_open_positions.csv", index=False)
    closed_trades.to_csv(output_dir / "2560_closed_trades.csv", index=False)
    print(f"Archived {migrated} pre-V1 active paper records.")


if __name__ == "__main__":
    main()
