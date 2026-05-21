/**
 * Classic Indicator Confluence Engine
 * EMA stack, RSI, MACD, Bollinger, Stochastic — scored as confluence.
 * Grandmaster uses indicator confluence 6+/8 as gate #7 in 10-point checklist.
 */

export function computeEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, c) => s + c, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

export function computeEMAStack(closes) {
  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes.length >= 200 ? closes : closes, Math.min(200, closes.length));

  if (!ema9 || !ema21 || !ema50) return { aligned: false, direction: "neutral" };

  const bullStack = ema9 > ema21 && ema21 > ema50;
  const bearStack = ema9 < ema21 && ema21 < ema50;

  return {
    ema9: ema9.toFixed(4),
    ema21: ema21.toFixed(4),
    ema50: ema50.toFixed(4),
    ema200: ema200?.toFixed(4),
    aligned: bullStack || bearStack,
    direction: bullStack ? "bullish" : bearStack ? "bearish" : "neutral",
  };
}

export function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return {
    value: rsi.toFixed(1),
    overbought: rsi > 70,
    oversold: rsi < 30,
    signal: rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral",
    direction: rsi > 50 ? "bullish" : "bearish",
  };
}

export function computeMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;

  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);
  if (!emaFast || !emaSlow) return null;

  const macdLine = emaFast - emaSlow;

  // Simplified signal line (using recent MACD values)
  const macdValues = [];
  const k = 2 / (fast + 1);
  let ef = closes.slice(0, fast).reduce((s, c) => s + c, 0) / fast;
  const ks = 2 / (slow + 1);
  let es = closes.slice(0, slow).reduce((s, c) => s + c, 0) / slow;

  for (let i = Math.max(fast, slow); i < closes.length; i++) {
    ef = closes[i] * k + ef * (1 - k);
    es = closes[i] * ks + es * (1 - ks);
    macdValues.push(ef - es);
  }

  const signalLine = macdValues.length >= signal
    ? macdValues.slice(-signal).reduce((s, v) => s + v, 0) / signal
    : 0;

  const histogram = macdLine - signalLine;

  return {
    macd: macdLine.toFixed(4),
    signal: signalLine.toFixed(4),
    histogram: histogram.toFixed(4),
    bullish: macdLine > signalLine,
    crossover: histogram > 0 && macdLine > 0 ? "bullish_cross" : histogram < 0 && macdLine < 0 ? "bearish_cross" : "none",
    direction: macdLine > signalLine ? "bullish" : "bearish",
  };
}

export function computeStochastic(bars, kPeriod = 14, dPeriod = 3) {
  if (bars.length < kPeriod + dPeriod) return null;

  const recentBars = bars.slice(-kPeriod);
  const highest = Math.max(...recentBars.map((b) => b.high));
  const lowest = Math.min(...recentBars.map((b) => b.low));
  const currentClose = bars[bars.length - 1].close;

  const kValue = highest === lowest ? 50 : ((currentClose - lowest) / (highest - lowest)) * 100;

  return {
    k: kValue.toFixed(1),
    overbought: kValue > 80,
    oversold: kValue < 20,
    signal: kValue > 80 ? "overbought" : kValue < 20 ? "oversold" : "neutral",
    direction: kValue > 50 ? "bullish" : "bearish",
  };
}

export function computeBollingerBands(closes, period = 20, deviation = 2) {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const sma = slice.reduce((s, c) => s + c, 0) / period;
  const variance = slice.reduce((s, c) => s + (c - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  const upper = sma + deviation * std;
  const lower = sma - deviation * std;
  const price = closes[closes.length - 1];

  const bbWidth = (upper - lower) / sma;
  const percentB = (price - lower) / (upper - lower);

  return {
    upper: upper.toFixed(4),
    middle: sma.toFixed(4),
    lower: lower.toFixed(4),
    width: bbWidth.toFixed(4),
    percentB: percentB.toFixed(3),
    squeeze: bbWidth < 0.02,
    pricePosition: price > upper ? "above_upper" : price < lower ? "below_lower" : "inside",
    direction: percentB > 0.5 ? "bullish" : "bearish",
  };
}

export function getIndicatorConfluence(bars) {
  /**
   * Scores indicator confluence: 0-8 scale.
   * Grandmaster checklist item #7: need 6+/8 for entry.
   */
  if (bars.length < 50) return { score: 0, maxScore: 8, signals: [] };

  const closes = bars.map((b) => b.close);
  const signals = [];
  let bullScore = 0;
  let bearScore = 0;

  // 1. EMA Stack
  const emaStack = computeEMAStack(closes);
  if (emaStack.direction === "bullish") { bullScore++; signals.push("EMA Stack: Bullish"); }
  else if (emaStack.direction === "bearish") { bearScore++; signals.push("EMA Stack: Bearish"); }

  // 2. Price vs EMA9
  const price = closes[closes.length - 1];
  const ema9 = computeEMA(closes, 9);
  if (ema9 && price > ema9) { bullScore++; signals.push("Price > EMA9"); }
  else if (ema9 && price < ema9) { bearScore++; signals.push("Price < EMA9"); }

  // 3. RSI
  const rsi = computeRSI(closes);
  if (rsi?.direction === "bullish") { bullScore++; signals.push(`RSI: ${rsi.value} (Bullish)`); }
  else if (rsi?.direction === "bearish") { bearScore++; signals.push(`RSI: ${rsi.value} (Bearish)`); }

  // 4. MACD
  const macd = computeMACD(closes);
  if (macd?.direction === "bullish") { bullScore++; signals.push("MACD: Bullish"); }
  else if (macd?.direction === "bearish") { bearScore++; signals.push("MACD: Bearish"); }

  // 5. Stochastic
  const stoch = computeStochastic(bars);
  if (stoch?.direction === "bullish") { bullScore++; signals.push(`Stoch: ${stoch.k} (Bullish)`); }
  else if (stoch?.direction === "bearish") { bearScore++; signals.push(`Stoch: ${stoch.k} (Bearish)`); }

  // 6. Bollinger Bands
  const bb = computeBollingerBands(closes);
  if (bb?.direction === "bullish") { bullScore++; signals.push("BB: Bullish position"); }
  else if (bb?.direction === "bearish") { bearScore++; signals.push("BB: Bearish position"); }

  // 7. Higher closes (last 3 bars)
  const last3 = closes.slice(-3);
  if (last3[2] > last3[1] && last3[1] > last3[0]) { bullScore++; signals.push("3 Higher Closes"); }
  else if (last3[2] < last3[1] && last3[1] < last3[0]) { bearScore++; signals.push("3 Lower Closes"); }

  // 8. Price vs EMA200 (macro direction)
  const ema200 = closes.length >= 200 ? computeEMA(closes, 200) : computeEMA(closes, Math.min(closes.length, 100));
  if (ema200 && price > ema200) { bullScore++; signals.push("Price > EMA200 (Macro Bull)"); }
  else if (ema200 && price < ema200) { bearScore++; signals.push("Price < EMA200 (Macro Bear)"); }

  const maxScore = 8;
  const dominantScore = Math.max(bullScore, bearScore);
  const direction = bullScore > bearScore ? "bullish" : bearScore > bullScore ? "bearish" : "neutral";

  return {
    score: dominantScore,
    maxScore,
    direction,
    bullScore,
    bearScore,
    signals,
    confluent: dominantScore >= 6,
    verdict: dominantScore >= 6
      ? `STRONG ${direction.toUpperCase()} confluence (${dominantScore}/8) — proceed`
      : dominantScore >= 4
        ? `MODERATE ${direction.toUpperCase()} confluence (${dominantScore}/8) — caution`
        : `WEAK confluence (${dominantScore}/8) — DO NOT trade`,
    indicators: { emaStack, rsi, macd, stoch, bb },
  };
}
