/**
 * Money Management Engine
 * Beyond basic risk — compounding, recovery, Kelly Criterion, and drawdown management.
 * This is what separates funded traders from blown accounts.
 */

export function calculateKellyCriterion(winRate, avgWin, avgLoss) {
  /**
   * Kelly Criterion: optimal bet sizing for maximum growth.
   * f* = (bp - q) / b
   * Where: b = avgWin/avgLoss, p = winRate, q = 1-winRate
   *
   * Most traders use HALF-KELLY (more conservative).
   */
  if (winRate <= 0 || winRate >= 1 || avgLoss <= 0) {
    return { kelly: 0, halfKelly: 0, note: "Invalid inputs" };
  }

  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - p;

  const kelly = (b * p - q) / b;
  const halfKelly = kelly / 2;

  return {
    kelly: Math.max(0, kelly * 100).toFixed(2) + "%",
    halfKelly: Math.max(0, halfKelly * 100).toFixed(2) + "%",
    recommended: Math.max(0, Math.min(halfKelly * 100, 3)).toFixed(2) + "%",
    note: kelly <= 0
      ? "Negative edge — DO NOT TRADE this system until stats improve."
      : halfKelly * 100 > 3
        ? "Kelly suggests higher risk but CAPPED at 3% for safety."
        : "Half-Kelly is optimal for steady compounding.",
    edge: kelly > 0,
  };
}

export function compoundingPlan(balance, riskPercent, winRate, avgRR, trades) {
  /**
   * Projects account growth with compounding.
   * Shows where you'll be after N trades at given stats.
   */
  const results = [];
  let currentBalance = balance;
  let wins = 0;
  let losses = 0;

  for (let i = 1; i <= trades; i++) {
    const risk = currentBalance * (riskPercent / 100);
    const isWin = Math.random() < winRate; // Simulated for projection

    if (isWin) {
      currentBalance += risk * avgRR;
      wins++;
    } else {
      currentBalance -= risk;
      losses++;
    }

    if (i % 10 === 0 || i === trades) {
      results.push({
        trade: i,
        balance: currentBalance.toFixed(2),
        growth: (((currentBalance - balance) / balance) * 100).toFixed(1) + "%",
      });
    }
  }

  // Expected value calculation (deterministic)
  const ev = balance * (riskPercent / 100) * (winRate * avgRR - (1 - winRate));
  const expectedAfterN = balance + ev * trades;

  return {
    startBalance: `$${balance.toFixed(2)}`,
    riskPerTrade: `${riskPercent}%`,
    winRate: `${(winRate * 100).toFixed(0)}%`,
    avgRR: `1:${avgRR}`,
    expectedPerTrade: `$${ev.toFixed(2)}`,
    expectedAfter: {
      trades10: `$${(balance + ev * 10).toFixed(2)}`,
      trades50: `$${(balance + ev * 50).toFixed(2)}`,
      trades100: `$${(balance + ev * 100).toFixed(2)}`,
    },
    monthlyProjection: `$${(ev * 15).toFixed(2)} (assuming ~15 trades/month)`,
    note: ev > 0
      ? "Positive expectancy — system is profitable long-term. Trust the process."
      : "Negative expectancy — DO NOT trade until you fix win rate or RR.",
  };
}

export function drawdownRecovery(balance, drawdownPercent) {
  /**
   * How much you need to GAIN to recover from a drawdown.
   * 10% loss needs 11.1% gain. 50% loss needs 100% gain.
   * This is why risk management > everything.
   */
  const lostAmount = balance * (drawdownPercent / 100);
  const currentBalance = balance - lostAmount;
  const recoveryPercent = (lostAmount / currentBalance) * 100;

  const tradesToRecover = Math.ceil(recoveryPercent); // At 1% risk per trade with 1:2 RR

  return {
    originalBalance: `$${balance.toFixed(2)}`,
    currentBalance: `$${currentBalance.toFixed(2)}`,
    drawdown: `${drawdownPercent.toFixed(1)}%`,
    amountLost: `$${lostAmount.toFixed(2)}`,
    recoveryNeeded: `${recoveryPercent.toFixed(1)}%`,
    tradesToRecover: `~${tradesToRecover} winning trades at 1% risk, 1:2 RR`,
    lesson: drawdownPercent > 20
      ? "CRITICAL DRAWDOWN — Reduce risk to 0.5% per trade. Focus on A+ setups ONLY."
      : drawdownPercent > 10
        ? "SIGNIFICANT — Reduce risk to 0.75%. Take only 6/7+ gate signals."
        : "MANAGEABLE — Maintain 1% risk. Trust the system.",
    preventionRules: [
      "Max 3% daily loss → STOP",
      "Max 5% weekly loss → STOP for the week",
      "After 2 consecutive losses → take a break (minimum 1 hour)",
      "Never revenge trade",
      "Never increase lot size after a loss",
    ],
  };
}

export function getPositionSizeByEquity(equity, riskPercent, maxDrawdown = 10) {
  /**
   * Dynamic position sizing based on current equity vs starting balance.
   * Reduce size during drawdown, increase during growth (but capped).
   */
  const baseRisk = riskPercent;

  // Anti-martingale: reduce after losses
  // If equity is below starting (drawdown mode), reduce risk
  const drawdownAdjustment = equity < 0 ? Math.max(0.5, baseRisk * 0.5) : baseRisk;

  return {
    standardRisk: `${baseRisk}%`,
    adjustedRisk: `${drawdownAdjustment.toFixed(2)}%`,
    rule: "During drawdown → halve risk. During growth → maintain (never increase beyond 2%).",
  };
}

export function getMoneyManagementPlan(balance, stats = {}) {
  const { winRate = 0.55, avgRR = 2, riskPercent = 1, totalTrades = 0, currentStreak = 0 } = stats;

  const kelly = calculateKellyCriterion(winRate, avgRR, 1);
  const compound = compoundingPlan(balance, riskPercent, winRate, avgRR, 100);

  let riskAdjustment = riskPercent;
  let note = "";

  if (currentStreak <= -3) {
    riskAdjustment = riskPercent * 0.5;
    note = "3+ LOSS STREAK — Risk halved to 0.5%. Take only A+ setups.";
  } else if (currentStreak >= 5) {
    riskAdjustment = Math.min(riskPercent * 1.25, 2);
    note = "5+ WIN STREAK — Slight size increase allowed (capped at 2%).";
  } else {
    note = "Normal conditions — maintain standard risk.";
  }

  return {
    balance: `$${balance.toFixed(2)}`,
    kelly,
    projection: compound,
    currentRisk: `${riskAdjustment.toFixed(2)}%`,
    streakAdjustment: note,
    rules: [
      "1% base risk — NEVER exceed 2%",
      "After TP1 → SL to breakeven (zero risk remainder)",
      "3 consecutive losses → stop for the day",
      "5% weekly drawdown → stop for the week",
      "Never add to a losing position",
      "Scale OUT, never scale IN (unless propulsion block re-entry)",
    ],
  };
}
