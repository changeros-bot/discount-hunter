# V17 Market 91 Score Confidence Flags

Status: governance addendum. No ticker is approved by this document.

## 1. Why this addendum exists

A numeric score can look more precise than the underlying evidence deserves.

Therefore every Market 91 B/C/D score must carry a confidence flag.

## 2. Confidence flags

### SOURCE_SUPPORTED_DRAFT

Use when:

- Current or recent source evidence exists.
- The correct sector module exists.
- The score can be reviewed as a draft.

Meaning:

- The score can be displayed.
- It is still not trading permission.
- It still needs the 18-point Quality Gate before any action.

### OBJECTIVE_BLOCKED

Use when:

- Narrative is strong, but the objective financial layer triggers a hard blocker.

Meaning:

- The ticker may stay in research or reserve watch.
- It cannot be a Formal Observation Candidate.
- It cannot enter DCA, buy-the-dip, semi-auto draft, or whitelist.

### PENDING_LATEST_OFFICIAL_QUARTER

Use when:

- The draft relies on older source material or incomplete latest-quarter financial details.

Meaning:

- The score is provisional.
- It must be visually separated from source-supported draft scores.
- It cannot be upgraded until the latest official quarter is checked.

### SECTOR_MODULE_PENDING

Use when:

- The ticker belongs to an asset type whose checklist is not yet built or not yet applied.

Meaning:

- The numeric score is provisional.
- The ticker must be rescored after the sector module is ready.
- It cannot be treated as a stable Reserve or Formal Observation Candidate.

## 3. First batch application

- NOW: SOURCE_SUPPORTED_DRAFT
- QCOM: SOURCE_SUPPORTED_DRAFT
- ORCL: OBJECTIVE_BLOCKED
- HUBB: PENDING_LATEST_OFFICIAL_QUARTER
- REGN: SECTOR_MODULE_PENDING

## 4. Additional hard blocker

If C4 Thesis Durability is scored 0, the ticker cannot become a Formal Observation Candidate.

Reason:

- A ticker with a contradicted, short-cycle, or purely narrative thesis should not be rescued by backtest performance or portfolio fit.

## 5. Display rule

The App must not display all first-batch scores as equally reliable.

Required visual separation:

1. Source-supported draft scores.
2. Objective-blocked scores.
3. Provisional scores pending latest official quarter.
4. Provisional scores pending sector module.
