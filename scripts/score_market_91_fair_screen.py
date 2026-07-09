#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
IN_PATH = ROOT / "reports/backtests/market_91/market_91_best_verdict.csv"
MANUAL_INPUT_PATH = ROOT / "reports/backtests/market_91/market_91_fair_manual_inputs.csv"
TEMPLATE_PATH = ROOT / "reports/backtests/market_91/market_91_fair_manual_inputs_template.csv"
OUT_PATH = ROOT / "reports/backtests/market_91/market_91_fair_score.csv"
SUMMARY_PATH = ROOT / "reports/backtests/market_91/market_91_fair_score_summary.md"

RESEARCH_VERDICTS = {"STRONG_RESEARCH_CANDIDATE", "RESEARCH_CANDIDATE"}

MANUAL_COLUMNS = [
    "ticker",
    "revenue_trend",
    "free_cash_flow",
    "margin_quality",
    "balance_sheet",
    "capex_discipline",
    "industry_position",
    "moat",
    "management",
    "thesis_durability",
    "bucket_concentration_deduction",
    "overlap_deduction",
    "cyclicality_deduction",
    "data_maturity_deduction",
    "complexity_deduction",
    "sector_module_ready",
    "manual_notes",
]


def num(x: Any, default: float = math.nan) -> float:
    try:
        if pd.isna(x):
            return default
        return float(x)
    except Exception:
        return default


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def score_sample_size(events: float) -> int:
    if events >= 20:
        return 8
    if events >= 10:
        return 6
    if events >= 5:
        return 3
    return 0


def score_avg_ret_126(avg126: float) -> int:
    if pd.isna(avg126):
        return 0
    if avg126 >= 0.25:
        return 10
    if avg126 >= 0.15:
        return 8
    if avg126 >= 0.08:
        return 6
    if avg126 > 0:
        return 3
    return 0


def score_win_rate_126(win126: float) -> int:
    if pd.isna(win126):
        return 0
    if win126 >= 0.70:
        return 10
    if win126 >= 0.60:
        return 8
    if win126 >= 0.55:
        return 5
    if win126 >= 0.50:
        return 2
    return 0


def score_adverse(adverse: float) -> int:
    if pd.isna(adverse):
        return 4
    if adverse >= -0.10:
        return 8
    if adverse >= -0.20:
        return 6
    if adverse >= -0.30:
        return 3
    return 0


def score_ret_252(avg252: float, win252: float) -> int:
    if pd.isna(avg252) or pd.isna(win252):
        return 0
    if avg252 > 0 and win252 >= 0.55:
        return 4
    if avg252 > 0 and win252 >= 0.45:
        return 2
    return 0


def backtest_score(row: pd.Series) -> dict[str, Any]:
    events = num(row.get("events"), 0)
    avg126 = num(row.get("avg_ret_126d"))
    win126 = num(row.get("win_rate_ret_126d"))
    adverse = num(row.get("avg_max_adverse_252d"))
    avg252 = num(row.get("avg_ret_252d"))
    win252 = num(row.get("win_rate_ret_252d"))

    parts = {
        "a_sample_size": score_sample_size(events),
        "a_avg_ret_126d": score_avg_ret_126(avg126),
        "a_win_rate_126d": score_win_rate_126(win126),
        "a_adverse": score_adverse(adverse),
        "a_ret_252d_validation": score_ret_252(avg252, win252),
    }
    parts["a_backtest_score"] = sum(parts.values())
    return parts


def parse_manual_score(x: Any) -> float | None:
    if x is None or pd.isna(x) or str(x).strip() == "":
        return None
    value = float(x)
    if value not in {0.0, 1.0, 2.0}:
        raise ValueError(f"manual score must be 0, 1, or 2; got {x}")
    return value


def truthy(x: Any) -> bool | None:
    if x is None or pd.isna(x) or str(x).strip() == "":
        return None
    return str(x).strip().lower() in {"1", "true", "yes", "y", "ready"}


def manual_scores(manual: pd.Series | None) -> dict[str, Any]:
    if manual is None:
        return {
            "manual_status": "PENDING_MANUAL_INPUTS",
            "b_objective_score": math.nan,
            "b_objective_raw_10": math.nan,
            "c_sector_quality_score": math.nan,
            "c_sector_quality_raw_8": math.nan,
            "d_portfolio_risk_fit_score": math.nan,
            "hard_blocker": "PENDING_MANUAL_INPUTS",
        }

    b_names = ["revenue_trend", "free_cash_flow", "margin_quality", "balance_sheet", "capex_discipline"]
    c_names = ["industry_position", "moat", "management", "thesis_durability"]
    b_values = [parse_manual_score(manual.get(name)) for name in b_names]
    c_values = [parse_manual_score(manual.get(name)) for name in c_names]

    if any(v is None for v in b_values + c_values):
        return {
            "manual_status": "INCOMPLETE_MANUAL_INPUTS",
            "b_objective_score": math.nan,
            "b_objective_raw_10": math.nan,
            "c_sector_quality_score": math.nan,
            "c_sector_quality_raw_8": math.nan,
            "d_portfolio_risk_fit_score": math.nan,
            "hard_blocker": "INCOMPLETE_MANUAL_INPUTS",
        }

    b_raw = sum(float(v) for v in b_values if v is not None)
    c_raw = sum(float(v) for v in c_values if v is not None)
    b_score = b_raw / 10.0 * 30.0
    c_score = c_raw / 8.0 * 20.0

    deduction_cols = [
        "bucket_concentration_deduction",
        "overlap_deduction",
        "cyclicality_deduction",
        "data_maturity_deduction",
        "complexity_deduction",
    ]
    deductions = sum(abs(num(manual.get(col), 0)) for col in deduction_cols)
    d_score = clamp(10.0 - deductions, 0, 10)

    fcf = float(b_values[1] or 0)
    balance = float(b_values[3] or 0)
    capex = float(b_values[4] or 0)
    sector_ready = truthy(manual.get("sector_module_ready"))

    blockers: list[str] = []
    if b_score < 18:
        blockers.append("B_OBJECTIVE_BELOW_18")
    if fcf == 0 and (balance == 0 or capex == 0):
        blockers.append("NEGATIVE_FCF_PLUS_BALANCE_OR_CAPEX_RISK")
    if sector_ready is not True:
        blockers.append("SECTOR_MODULE_NOT_READY")

    return {
        "manual_status": "COMPLETE",
        "b_objective_score": round(b_score, 2),
        "b_objective_raw_10": b_raw,
        "c_sector_quality_score": round(c_score, 2),
        "c_sector_quality_raw_8": c_raw,
        "d_portfolio_risk_fit_score": round(d_score, 2),
        "hard_blocker": ";".join(blockers) if blockers else "",
    }


def classification(total: float | None, hard_blocker: str, verdict: str) -> str:
    if verdict not in RESEARCH_VERDICTS:
        return "NOT_IN_RESEARCH_POOL"
    if hard_blocker:
        return f"BLOCKED__{hard_blocker}"
    if total is None or pd.isna(total):
        return "PENDING_MANUAL_INPUTS"
    if total >= 80:
        return "FORMAL_OBSERVATION_CANDIDATE_ONLY"
    if total >= 65:
        return "RESERVE_SECOND_REVIEW"
    if total >= 50:
        return "RESEARCH_POOL_ONLY"
    return "EXCLUDE_CURRENT_WORKFLOW"


def make_template(research: pd.DataFrame) -> None:
    rows = []
    for _, r in research.sort_values("ticker").iterrows():
        rows.append({"ticker": r["ticker"], **{c: "" for c in MANUAL_COLUMNS if c != "ticker"}})
    pd.DataFrame(rows, columns=MANUAL_COLUMNS).to_csv(TEMPLATE_PATH, index=False)


def load_manual() -> dict[str, pd.Series]:
    if not MANUAL_INPUT_PATH.exists():
        return {}
    df = pd.read_csv(MANUAL_INPUT_PATH)
    if "ticker" not in df.columns:
        raise ValueError("manual input must contain ticker column")
    return {str(r["ticker"]): r for _, r in df.iterrows()}


def main() -> None:
    if not IN_PATH.exists():
        raise FileNotFoundError(f"missing input: {IN_PATH}")
    df = pd.read_csv(IN_PATH)
    if "verdict" not in df.columns:
        raise ValueError("best verdict CSV must contain verdict column")

    research = df[df["verdict"].isin(RESEARCH_VERDICTS)].copy()
    make_template(research)
    manual_map = load_manual()

    rows = []
    for _, r in research.iterrows():
        out = r.to_dict()
        out.update(backtest_score(r))
        m = manual_map.get(str(r.get("ticker")))
        out.update(manual_scores(m))
        if out["manual_status"] == "COMPLETE":
            out["fair_total_score"] = round(
                out["a_backtest_score"]
                + out["b_objective_score"]
                + out["c_sector_quality_score"]
                + out["d_portfolio_risk_fit_score"],
                2,
            )
        else:
            out["fair_total_score"] = math.nan
        out["fair_classification"] = classification(out.get("fair_total_score"), str(out.get("hard_blocker") or ""), str(out.get("verdict") or ""))
        rows.append(out)

    result = pd.DataFrame(rows).sort_values(["fair_classification", "a_backtest_score", "ticker"], ascending=[True, False, True])
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUT_PATH, index=False)

    summary = [
        "# Market 91 Fair Score Summary",
        "",
        "This file is generated by `scripts/score_market_91_fair_screen.py`.",
        "",
        "No ticker is approved by this output. The 100-point screen only decides observation-candidate eligibility; 18-point Quality Gate still controls all trading permissions.",
        "",
        f"- Research pool rows scored for backtest layer: {len(result)}",
        f"- Manual input file present: {'yes' if MANUAL_INPUT_PATH.exists() else 'no'}",
        f"- Template written: `{TEMPLATE_PATH.relative_to(ROOT)}`",
        f"- Output written: `{OUT_PATH.relative_to(ROOT)}`",
        "",
        "## Classification counts",
        "",
    ]
    counts = result["fair_classification"].value_counts(dropna=False).sort_index()
    for label, count in counts.items():
        summary.append(f"- {label}: {count}")
    summary.append("")
    summary.append("## Governance note")
    summary.append("")
    summary.append("A backtest score can be computed automatically. B/C/D require explicit manual source-verified inputs. If manual inputs are missing, the ticker remains pending and cannot be upgraded.")
    SUMMARY_PATH.write_text("\n".join(summary), encoding="utf-8")


if __name__ == "__main__":
    main()
