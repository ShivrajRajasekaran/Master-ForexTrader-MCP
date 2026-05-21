/**
 * Liquidity Engine
 * Detects sweeps, Order Blocks, Fair Value Gaps, and OTE zones.
 */

export function detectLiquiditySweep(bars, swingHighs, swingLows) {
  if (bars.length < 2) return { bullSweep: false, bearSweep: false };

  const curr = bars[bars.length - 1];
  const lastSH = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;
  const lastSL = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;

  // Bullish sweep: wick below swing low but close above it (stop hunt then recovery)
  const bullSweep = lastSL !== null && curr.low < lastSL && curr.close > lastSL;
  // Bearish sweep: wick above swing high but close below it
  const bearSweep = lastSH !== null && curr.high > lastSH && curr.close < lastSH;

  return {
    bullSweep,
    bearSweep,
    sweepPrice: bullSweep ? lastSL : bearSweep ? lastSH : null,
    sweepTime: bullSweep || bearSweep ? curr.time : null,
  };
}

export function detectRecentSweep(bars, swingHighs, swingLows, lookback = 10) {
  const recentBars = bars.slice(-lookback);
  for (let i = 0; i < recentBars.length; i++) {
    const bar = recentBars[i];
    const lastSL = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;
    const lastSH = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;

    if (lastSL && bar.low < lastSL && bar.close > lastSL) {
      return { swept: true, type: "bullish", price: lastSL, barsAgo: lookback - i };
    }
    if (lastSH && bar.high > lastSH && bar.close < lastSH) {
      return { swept: true, type: "bearish", price: lastSH, barsAgo: lookback - i };
    }
  }
  return { swept: false, type: null, price: null, barsAgo: null };
}

export function detectOrderBlocks(bars) {
  const bullOBs = [];
  const bearOBs = [];

  for (let i = bars.length - 1; i >= 1; i--) {
    const curr = bars[i];
    const prev = bars[i - 1];

    // Bull OB: last bearish candle before a bullish displacement
    if (curr.close > curr.open && prev.close < prev.open) {
      bullOBs.push({
        top: Math.max(prev.open, prev.close),
        bottom: prev.low,
        time: prev.time,
        timeEnd: curr.time,
      });
      if (bullOBs.length >= 2) break;
    }
  }

  for (let i = bars.length - 1; i >= 1; i--) {
    const curr = bars[i];
    const prev = bars[i - 1];

    // Bear OB: last bullish candle before a bearish displacement
    if (curr.close < curr.open && prev.close > prev.open) {
      bearOBs.push({
        top: prev.high,
        bottom: Math.min(prev.open, prev.close),
        time: prev.time,
        timeEnd: curr.time,
      });
      if (bearOBs.length >= 2) break;
    }
  }

  return { bullOBs, bearOBs };
}

export function detectFVGs(bars) {
  const bullFVGs = [];
  const bearFVGs = [];

  for (let i = bars.length - 1; i >= 2; i--) {
    const prev = bars[i - 2];
    const next = bars[i];

    // Bull FVG: gap between candle[i-2] high and candle[i] low
    if (next.low > prev.high) {
      bullFVGs.push({
        top: next.low,
        bottom: prev.high,
        time: bars[i - 1].time,
        midpoint: (next.low + prev.high) / 2,
      });
      if (bullFVGs.length >= 3) break;
    }
  }

  for (let i = bars.length - 1; i >= 2; i--) {
    const prev = bars[i - 2];
    const next = bars[i];

    // Bear FVG: gap between candle[i] high and candle[i-2] low
    if (next.high < prev.low) {
      bearFVGs.push({
        top: prev.low,
        bottom: next.high,
        time: bars[i - 1].time,
        midpoint: (prev.low + next.high) / 2,
      });
      if (bearFVGs.length >= 3) break;
    }
  }

  return { bullFVGs, bearFVGs };
}

export function computeOTE(rangeHigh, rangeLow) {
  const range = rangeHigh - rangeLow;
  return {
    fib_50: rangeHigh - range * 0.5,
    fib_618: rangeHigh - range * 0.618,
    fib_786: rangeHigh - range * 0.786,
    ote_top: rangeHigh - range * 0.618,
    ote_bottom: rangeHigh - range * 0.786,
    premium_above: rangeHigh - range * 0.5,
    discount_below: rangeHigh - range * 0.5,
  };
}

export function priceInZone(price, zones) {
  for (const zone of zones) {
    if (price >= zone.bottom && price <= zone.top) {
      return { inZone: true, zone };
    }
  }
  return { inZone: false, zone: null };
}

export function priceInOTE(price, ote) {
  return price >= ote.ote_bottom && price <= ote.ote_top;
}
