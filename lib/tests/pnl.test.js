const assert = require("assert");

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function calculatePnL({ totalCost, currentValue }) {
  const cost = Number(totalCost || 0);
  const value = Number(currentValue || 0);
  const unrealizedPnL = value - cost;
  const returnPct = cost > 0 ? unrealizedPnL / cost : 0;
  return {
    totalCost: cost,
    currentValue: value,
    unrealizedPnL,
    returnPct,
  };
}

function runCase(name, input, expected) {
  const result = calculatePnL(input);
  assert.strictEqual(round(result.unrealizedPnL, 2), expected.unrealizedPnL, `${name}: PnL mismatch`);
  assert.strictEqual(round(result.returnPct * 100, 1), expected.returnPctPercent, `${name}: return % mismatch`);
}

runCase(
  "positive holding: TSMON-style gain",
  { totalCost: 5, currentValue: 5.24 },
  { unrealizedPnL: 0.24, returnPctPercent: 4.8 }
);

runCase(
  "negative holding: SPCXON-style drawdown",
  { totalCost: 5, currentValue: 4.24 },
  { unrealizedPnL: -0.76, returnPctPercent: -15.2 }
);

runCase(
  "flat holding",
  { totalCost: 5, currentValue: 5 },
  { unrealizedPnL: 0, returnPctPercent: 0 }
);

console.log("PnL smoke tests passed");

module.exports = { calculatePnL };
