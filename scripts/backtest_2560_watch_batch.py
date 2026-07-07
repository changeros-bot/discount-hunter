#!/usr/bin/env python3
"""2560 batch watchlist backtest. Research only, no order execution."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional, Sequence

DEFAULT_TICKERS = ["DELL", "INTC", "ORCL", "CRWV", "NBIS"]


def run(args):
    root = Path(__file__).resolve().parents[1]
    script = root / "scripts" / "backtest_2560_single.py"
    tickers = [t.strip().upper() for t in args.tickers if t.strip()]
    for ticker in tickers:
        cmd = [
            sys.executable,
            str(script),
            "--ticker",
            ticker,
            "--source",
            args.source,
            "--industry",
            args.industry,
            "--start",
            args.start,
        ]
        print("RUN", " ".join(cmd))
        subprocess.run(cmd, check=True)
    print(f"Batch 2560 watchlist complete. tickers={','.join(tickers)}")


def parse_args(argv: Optional[Sequence[str]] = None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", nargs="+", default=DEFAULT_TICKERS)
    ap.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    ap.add_argument("--industry", default="政策/AI觀察")
    ap.add_argument("--start", default="2024-01-01")
    return ap.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
