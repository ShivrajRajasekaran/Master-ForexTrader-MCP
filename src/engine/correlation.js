/**
 * Currency Correlation & DXY Engine
 * Macro bias: DXY direction determines USD pairs.
 * High correlation pairs = don't trade both (doubled risk).
 */

const CORRELATION_MAP = {
  positive: [
    ["EURUSD", "GBPUSD", 0.85],
    ["AUDUSD", "NZDUSD", 0.90],
    ["EURUSD", "AUDUSD", 0.70],
    ["GBPUSD", "AUDUSD", 0.65],
  ],
  negative: [
    ["EURUSD", "USDCHF", -0.92],
    ["GBPUSD", "USDCHF", -0.80],
    ["XAUUSD", "USDX", -0.85],
    ["EURUSD", "USDX", -0.90],
  ],
  xauusd: {
    correlatedWith: ["USDX_inverse", "EURUSD_positive", "USDJPY_inverse"],
    note: "Gold rises when DXY falls. Gold is anti-dollar.",
  },
};

export function getDXYBias(dxyBars) {
  /**
   * Determine DXY (Dollar Index) direction.
   * DXY UP = USD pairs bearish (EURUSD down, GBPUSD down, XAUUSD down)
   * DXY DOWN = USD pairs bullish (EURUSD up, GBPUSD up, XAUUSD up)
   */
  if (!dxyBars || dxyBars.length < 10) {
    return { bias: "unknown", note: "Need DXY data for macro bias" };
  }

  const closes = dxyBars.map((b) => b.close);
  const current = closes[closes.length - 1];
  const prev5 = closes.slice(-6, -1);
  const avg5 = prev5.reduce((s, c) => s + c, 0) / prev5.length;
  const prev20 = closes.slice(-21, -1);
  const avg20 = prev20.reduce((s, c) => s + c, 0) / prev20.length;

  const shortTrend = current > avg5 ? "rising" : "falling";
  const longTrend = current > avg20 ? "rising" : "falling";

  let bias, impact;
  if (shortTrend === "rising" && longTrend === "rising") {
    bias = "strong_dollar";
    impact = {
      EURUSD: "BEARISH", GBPUSD: "BEARISH", AUDUSD: "BEARISH",
      NZDUSD: "BEARISH", XAUUSD: "BEARISH", USDJPY: "BULLISH", USDCHF: "BULLISH",
    };
  } else if (shortTrend === "falling" && longTrend === "falling") {
    bias = "weak_dollar";
    impact = {
      EURUSD: "BULLISH", GBPUSD: "BULLISH", AUDUSD: "BULLISH",
      NZDUSD: "BULLISH", XAUUSD: "BULLISH", USDJPY: "BEARISH", USDCHF: "BEARISH",
    };
  } else {
    bias = "mixed";
    impact = { note: "DXY conflicting — avoid USD pairs or use tighter risk" };
  }

  return {
    bias,
    dxyPrice: current.toFixed(2),
    shortTrend,
    longTrend,
    impact,
    rule: "ALWAYS check DXY before trading any USD pair. DXY is the #1 macro filter.",
  };
}

export function checkCorrelation(symbol1, symbol2) {
  /**
   * Check if two pairs are correlated.
   * If correlation > 0.7, trading both = doubled risk exposure.
   */
  for (const [pair1, pair2, corr] of CORRELATION_MAP.positive) {
    if ((pair1 === symbol1 && pair2 === symbol2) || (pair1 === symbol2 && pair2 === symbol1)) {
      return {
        correlated: true,
        correlation: corr,
        type: "positive",
        warning: `${symbol1} and ${symbol2} are ${(corr * 100).toFixed(0)}% correlated — trading both in same direction = DOUBLED RISK`,
      };
    }
  }

  for (const [pair1, pair2, corr] of CORRELATION_MAP.negative) {
    if ((pair1 === symbol1 && pair2 === symbol2) || (pair1 === symbol2 && pair2 === symbol1)) {
      return {
        correlated: true,
        correlation: corr,
        type: "negative",
        warning: `${symbol1} and ${symbol2} are ${(Math.abs(corr) * 100).toFixed(0)}% inversely correlated — trading both OPPOSITE direction = DOUBLED RISK`,
      };
    }
  }

  return { correlated: false, correlation: 0, type: "none", warning: null };
}

export function getMacroBias(symbol, dxyBars = null) {
  /**
   * Get macro bias for a specific symbol based on DXY.
   */
  if (!dxyBars) {
    return {
      symbol,
      bias: "unknown",
      note: "Pass DXY bars for macro bias. Without it, rely on structure only.",
      rule: "DXY falling = XAUUSD/EURUSD/GBPUSD bullish. DXY rising = bearish.",
    };
  }

  const dxy = getDXYBias(dxyBars);
  const pairBias = dxy.impact?.[symbol] || "unknown";

  return {
    symbol,
    dxy: dxy.bias,
    macroBias: pairBias,
    aligned: pairBias !== "unknown",
    action: pairBias === "BULLISH"
      ? `MACRO BULLISH for ${symbol} — only take LONG signals`
      : pairBias === "BEARISH"
        ? `MACRO BEARISH for ${symbol} — only take SHORT signals`
        : "No clear macro bias — rely on structure/SMC only",
  };
}

export { CORRELATION_MAP };
