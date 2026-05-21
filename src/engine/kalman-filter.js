/**
 * Kalman Filter + Supertrend Trend Confirmation Engine
 * Ported from AlgoAlpha "Range Filtered Trend Signals"
 *
 * Detects TRENDING vs RANGING markets.
 * Master traders NEVER trade during ranging conditions.
 */

export class KalmanFilter {
  constructor(options = {}) {
    this.alpha = options.alpha || 0.01;
    this.beta = options.beta || 0.1;
    this.period = options.period || 77;
    this.deviation = options.deviation || 1.2;
    this.stFactor = options.stFactor || 0.7;
    this.stAtrPeriod = options.stAtrPeriod || 7;

    this.v1 = null;
    this.v2 = 1.0;
    this.v3 = this.alpha * this.beta;
  }

  computeKalmanLine(price) {
    if (this.v1 === null) {
      this.v1 = price;
      return price;
    }

    const v5 = this.v1;
    const v4 = this.v2 / (this.v2 + this.v3);
    this.v1 = v5 + v4 * (price - v5);
    this.v2 = (1 - v4) * this.v2 + this.beta / this.period;

    return this.v1;
  }

  reset() {
    this.v1 = null;
    this.v2 = 1.0;
  }
}

export function computeATR(bars, period = 14) {
  if (bars.length < period + 1) return null;

  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    sum += tr;
  }
  return sum / period;
}

export function computeWMA(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < slice.length; i++) {
    const w = i + 1;
    weightedSum += slice[i] * w;
    weightTotal += w;
  }
  return weightedSum / weightTotal;
}

export function computeSupertrend(kalmanValues, bars, factor = 0.7, atrPeriod = 7) {
  if (bars.length < atrPeriod + 1 || kalmanValues.length < 2) {
    return { direction: 0, value: null };
  }

  const atr = computeATR(bars, atrPeriod);
  if (!atr) return { direction: 0, value: null };

  const k = kalmanValues[kalmanValues.length - 1];
  const kPrev = kalmanValues[kalmanValues.length - 2];

  const upperBand = k + factor * atr;
  const lowerBand = k - factor * atr;

  // Simplified: if price (kalman) breaks above upper → bullish (-1 in original)
  // if price breaks below lower → bearish (1 in original)
  const direction = k > upperBand ? -1 : k < lowerBand ? 1 : 0;

  return { direction, value: direction === -1 ? lowerBand : upperBand, atr };
}

export function analyzeTrend(bars, options = {}) {
  const kf = new KalmanFilter(options);
  const kalmanValues = [];
  const ranges = [];

  for (const bar of bars) {
    const kLine = kf.computeKalmanLine(bar.close);
    kalmanValues.push(kLine);
    ranges.push(bar.high - bar.low);
  }

  const k = kalmanValues[kalmanValues.length - 1];
  const price = bars[bars.length - 1].close;
  const deviation = options.deviation || 1.2;

  // Volatility bands (WMA of range * deviation)
  const vola = computeWMA(ranges, Math.min(200, ranges.length));
  const kalmanUpper = k + (vola || 0) * deviation;
  const kalmanLower = k - (vola || 0) * deviation;

  // Short-term trend (price vs Kalman bands)
  let trendAA = 0;
  if (price > kalmanUpper) trendAA = 1;
  else if (price < kalmanLower) trendAA = -1;

  // Long-term trend (Supertrend on Kalman)
  const st = computeSupertrend(kalmanValues, bars, options.stFactor, options.stAtrPeriod);
  const ktrend = st.direction < 0 ? 1 : st.direction > 0 ? -1 : 0;

  // Master flags
  const trendConfirmed = ktrend * trendAA === 1;
  const isRanging = ktrend * trendAA === -1;

  let label = "Neutral";
  if (isRanging) label = "Ranging";
  else if (trendAA === 1 && trendConfirmed) label = "Bullish";
  else if (trendAA === -1 && trendConfirmed) label = "Bearish";

  return {
    kalmanLine: k,
    kalmanUpper,
    kalmanLower,
    trendAA,
    ktrend,
    trendConfirmed,
    isRanging,
    label,
    atr: st.atr || computeATR(bars, 14),
    canTrade: !isRanging,
    reason: isRanging
      ? "RANGING — Kalman + Supertrend disagree. NO TRADE."
      : trendConfirmed
        ? `TRENDING ${label.toUpperCase()} — confirmed`
        : "Neutral — wait for confirmation",
  };
}
