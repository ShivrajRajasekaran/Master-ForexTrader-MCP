/**
 * Market Structure Engine
 * Detects BOS, CHoCH, CISD, Swing Highs/Lows, and HTF Bias.
 */

export function detectSwings(bars, pivotLen = 5) {
  const highs = [];
  const lows = [];

  for (let i = pivotLen; i < bars.length - pivotLen; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= pivotLen; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) {
        isHigh = false;
      }
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) highs.push({ price: bars[i].high, time: bars[i].time, index: i });
    if (isLow) lows.push({ price: bars[i].low, time: bars[i].time, index: i });
  }

  return { highs, lows };
}

export function classifyStructure(highs, lows) {
  if (highs.length < 2 || lows.length < 2) {
    return { bias: "Neutral", highType: null, lowType: null };
  }

  const lastH = highs[highs.length - 1].price;
  const prevH = highs[highs.length - 2].price;
  const lastL = lows[lows.length - 1].price;
  const prevL = lows[lows.length - 2].price;

  const highType = lastH > prevH ? "HH" : "LH";
  const lowType = lastL > prevL ? "HL" : "LL";

  let bias = "Neutral";
  if (highType === "HH" && lowType === "HL") bias = "Bullish";
  else if (highType === "LH" && lowType === "LL") bias = "Bearish";

  return { bias, highType, lowType, lastHigh: lastH, lastLow: lastL, prevHigh: prevH, prevLow: prevL };
}

export function detectBOS(bars, structure) {
  if (!structure.lastHigh || !structure.lastLow) return { bullBOS: false, bearBOS: false };

  const lastClose = bars[bars.length - 1].close;

  const bullBOS = structure.bias === "Bullish" && lastClose > structure.lastHigh;
  const bearBOS = structure.bias === "Bearish" && lastClose < structure.lastLow;

  return { bullBOS, bearBOS };
}

export function detectCHoCH(bars, structure) {
  if (!structure.lastHigh || !structure.lastLow) return { bullCHoCH: false, bearCHoCH: false };

  const lastClose = bars[bars.length - 1].close;

  // CHoCH = break against current bias (character change)
  const bullCHoCH = structure.bias === "Bearish" && lastClose > structure.lastHigh;
  const bearCHoCH = structure.bias === "Bullish" && lastClose < structure.lastLow;

  return { bullCHoCH, bearCHoCH };
}

export function detectCISD(bars) {
  /**
   * CISD (Change in State of Delivery)
   * More precise than CHoCH — detects actual shift in order flow delivery.
   *
   * Bearish delivery → one candle closes above the last bearish candle's high = CISD bullish
   * Bullish delivery → one candle closes below the last bullish candle's low = CISD bearish
   */
  if (bars.length < 5) return { bullCISD: false, bearCISD: false, cisd_price: null };

  const curr = bars[bars.length - 1];
  let lastBearHigh = null;
  let lastBullLow = null;

  // Look back for last bearish candle (for bullish CISD)
  for (let i = bars.length - 2; i >= Math.max(0, bars.length - 10); i--) {
    if (bars[i].close < bars[i].open) {
      lastBearHigh = bars[i].high;
      break;
    }
  }

  // Look back for last bullish candle (for bearish CISD)
  for (let i = bars.length - 2; i >= Math.max(0, bars.length - 10); i--) {
    if (bars[i].close > bars[i].open) {
      lastBullLow = bars[i].low;
      break;
    }
  }

  const bullCISD = lastBearHigh !== null && curr.close > lastBearHigh;
  const bearCISD = lastBullLow !== null && curr.close < lastBullLow;

  return {
    bullCISD,
    bearCISD,
    cisd_price: bullCISD ? lastBearHigh : bearCISD ? lastBullLow : null,
  };
}

export function detectCRT(bars, htfCandle) {
  /**
   * CRT (Candle Range Theory)
   * Previous HTF candle H/L = liquidity targets.
   * Price sweeps one side → runs to the other.
   */
  if (!htfCandle) return { crtTriggered: false, direction: null };

  const lastBar = bars[bars.length - 1];
  const prevBars = bars.slice(-10);

  // Check if SSL (low) was swept
  const sslSwept = prevBars.some((b) => b.low < htfCandle.low && b.close > htfCandle.low);
  // Check if BSL (high) was swept
  const bslSwept = prevBars.some((b) => b.high > htfCandle.high && b.close < htfCandle.high);

  if (sslSwept) {
    return {
      crtTriggered: true,
      direction: "bullish",
      swept: "SSL",
      target: htfCandle.high,
      reason: `SSL swept at ${htfCandle.low.toFixed(2)} → target BSL ${htfCandle.high.toFixed(2)}`,
    };
  }

  if (bslSwept) {
    return {
      crtTriggered: true,
      direction: "bearish",
      swept: "BSL",
      target: htfCandle.low,
      reason: `BSL swept at ${htfCandle.high.toFixed(2)} → target SSL ${htfCandle.low.toFixed(2)}`,
    };
  }

  return { crtTriggered: false, direction: null };
}

export function getHTFBias(htfBars, pivotLen = 3) {
  const { highs, lows } = detectSwings(htfBars, pivotLen);
  return classifyStructure(highs, lows);
}
