/**
 * Advanced Block Types Engine
 * Rejection Blocks, Propulsion Blocks, and Fibonacci Extensions.
 */

import { computeATR } from "./kalman-filter.js";

export function detectRejectionBlock(bars, lookback = 20) {
  /**
   * Rejection Block: 2-3 candles showing strong rejection at a level.
   * Long wicks on same side = institutional rejection of that price.
   * Forms at key levels (OB/FVG/POC/session H/L).
   */
  if (bars.length < lookback) return [];

  const rejections = [];
  const recent = bars.slice(-lookback);

  for (let i = 2; i < recent.length; i++) {
    const curr = recent[i];
    const prev = recent[i - 1];
    const prev2 = recent[i - 2];

    const currBody = Math.abs(curr.close - curr.open);
    const currRange = curr.high - curr.low;
    const currUpperWick = curr.high - Math.max(curr.open, curr.close);
    const currLowerWick = Math.min(curr.open, curr.close) - curr.low;

    const prevUpperWick = prev.high - Math.max(prev.open, prev.close);
    const prevLowerWick = Math.min(prev.open, prev.close) - prev.low;

    if (currRange === 0) continue;

    // Bearish rejection block: 2+ candles with long upper wicks at similar levels
    const upperRejection =
      currUpperWick > currBody * 1.5 &&
      prevUpperWick > Math.abs(prev.close - prev.open) * 1.5 &&
      Math.abs(curr.high - prev.high) < currRange * 0.3;

    // Bullish rejection block: 2+ candles with long lower wicks at similar levels
    const lowerRejection =
      currLowerWick > currBody * 1.5 &&
      prevLowerWick > Math.abs(prev.close - prev.open) * 1.5 &&
      Math.abs(curr.low - prev.low) < currRange * 0.3;

    if (upperRejection) {
      rejections.push({
        type: "bearish_rejection_block",
        top: Math.max(curr.high, prev.high),
        bottom: Math.max(curr.open, curr.close, prev.open, prev.close),
        time: curr.time,
        action: "Institutions REJECTING higher prices — short zone",
      });
    }

    if (lowerRejection) {
      rejections.push({
        type: "bullish_rejection_block",
        top: Math.min(curr.open, curr.close, prev.open, prev.close),
        bottom: Math.min(curr.low, prev.low),
        time: curr.time,
        action: "Institutions REJECTING lower prices — buy zone",
      });
    }
  }

  return rejections;
}

export function detectPropulsionBlock(bars, lookback = 30) {
  /**
   * Propulsion Block: A zone where price consolidates briefly during
   * a strong impulsive move, then continues. Used for:
   * 1. Re-entry on pullback
   * 2. Scale-in opportunities
   * 3. Trail stop placement
   */
  if (bars.length < lookback) return [];

  const propulsions = [];
  const recent = bars.slice(-lookback);
  const bodies = recent.map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;

  for (let i = 2; i < recent.length - 2; i++) {
    const before = recent[i - 1];
    const consolidation = recent[i];
    const after = recent[i + 1];

    const beforeBody = Math.abs(before.close - before.open);
    const consBody = Math.abs(consolidation.close - consolidation.open);
    const afterBody = Math.abs(after.close - after.open);

    // Propulsion: big candle → small candle (pause) → big candle (same direction)
    const isBullProp =
      before.close > before.open &&
      beforeBody > avgBody * 1.5 &&
      consBody < avgBody * 0.6 &&
      after.close > after.open &&
      afterBody > avgBody * 1.5;

    const isBearProp =
      before.close < before.open &&
      beforeBody > avgBody * 1.5 &&
      consBody < avgBody * 0.6 &&
      after.close < after.open &&
      afterBody > avgBody * 1.5;

    if (isBullProp) {
      propulsions.push({
        type: "bullish_propulsion",
        top: consolidation.high,
        bottom: consolidation.low,
        time: consolidation.time,
        action: "Bullish propulsion — re-entry zone on pullback. Trail SL here.",
      });
    }

    if (isBearProp) {
      propulsions.push({
        type: "bearish_propulsion",
        top: consolidation.high,
        bottom: consolidation.low,
        time: consolidation.time,
        action: "Bearish propulsion — re-entry zone on pullback. Trail SL here.",
      });
    }
  }

  return propulsions;
}

export function computeFibExtensions(swingHigh, swingLow, direction) {
  /**
   * Fibonacci Extensions for TP beyond the range.
   * Used when price breaks out and you need TP targets:
   * -27.2%, -61.8%, -100%, -161.8% (negative = extension beyond range)
   */
  const range = swingHigh - swingLow;

  if (direction === "bullish") {
    return {
      fib_100: swingHigh,
      fib_127: swingHigh + range * 0.272,
      fib_162: swingHigh + range * 0.618,
      fib_200: swingHigh + range * 1.0,
      fib_262: swingHigh + range * 1.618,
      targets: {
        tp1: swingHigh + range * 0.272,
        tp2: swingHigh + range * 0.618,
        tp3: swingHigh + range * 1.0,
      },
      note: "Extensions above swing high — use as TP for breakout trades",
    };
  }

  return {
    fib_100: swingLow,
    fib_127: swingLow - range * 0.272,
    fib_162: swingLow - range * 0.618,
    fib_200: swingLow - range * 1.0,
    fib_262: swingLow - range * 1.618,
    targets: {
      tp1: swingLow - range * 0.272,
      tp2: swingLow - range * 0.618,
      tp3: swingLow - range * 1.0,
    },
    note: "Extensions below swing low — use as TP for breakdown trades",
  };
}

export function detectLiquidityVoid(bars, minGapMultiplier = 2.0) {
  /**
   * Liquidity Void: Large unfilled gap in price action (bigger than FVG).
   * Price WILL return to fill these — they act as magnets.
   * Used for TP targeting and mean reversion entries.
   */
  if (bars.length < 10) return [];

  const voids = [];
  const bodies = bars.slice(-20).map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;
  const threshold = avgBody * minGapMultiplier;

  for (let i = bars.length - 1; i >= 2; i--) {
    const prev = bars[i - 2];
    const curr = bars[i];

    // Bullish void: gap UP (current low > prev high by a large amount)
    if (curr.low - prev.high > threshold) {
      voids.push({
        type: "bullish_void",
        top: curr.low,
        bottom: prev.high,
        size: (curr.low - prev.high).toFixed(4),
        time: bars[i - 1].time,
        midpoint: ((curr.low + prev.high) / 2).toFixed(4),
        note: "Unfilled bullish void — price may retrace to fill",
      });
    }

    // Bearish void: gap DOWN (prev low > current high by a large amount)
    if (prev.low - curr.high > threshold) {
      voids.push({
        type: "bearish_void",
        top: prev.low,
        bottom: curr.high,
        size: (prev.low - curr.high).toFixed(4),
        time: bars[i - 1].time,
        midpoint: ((prev.low + curr.high) / 2).toFixed(4),
        note: "Unfilled bearish void — price may retrace to fill",
      });
    }

    if (voids.length >= 5) break;
  }

  return voids;
}
