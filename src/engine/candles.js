/**
 * Candle Pattern Engine
 * Entry confirmation candles at key levels — the final trigger.
 * A master trader NEVER enters without a confirmation candle at the zone.
 */

export function detectEngulfing(bars) {
  if (bars.length < 2) return { found: false };

  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];

  const prevBody = Math.abs(prev.close - prev.open);
  const currBody = Math.abs(curr.close - curr.open);

  const bullEngulfing =
    prev.close < prev.open &&
    curr.close > curr.open &&
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    currBody > prevBody;

  const bearEngulfing =
    prev.close > prev.open &&
    curr.close < curr.open &&
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    currBody > prevBody;

  if (bullEngulfing) return { found: true, type: "bullish_engulfing", strength: (currBody / prevBody).toFixed(1) };
  if (bearEngulfing) return { found: true, type: "bearish_engulfing", strength: (currBody / prevBody).toFixed(1) };
  return { found: false };
}

export function detectPinBar(bars, wickRatio = 2.0) {
  if (bars.length < 1) return { found: false };

  const bar = bars[bars.length - 1];
  const body = Math.abs(bar.close - bar.open);
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const totalRange = bar.high - bar.low;

  if (totalRange === 0) return { found: false };

  // Bullish pin bar: long lower wick, small body at top
  const bullPin = lowerWick > body * wickRatio && lowerWick > upperWick * 2 && body < totalRange * 0.35;
  // Bearish pin bar: long upper wick, small body at bottom
  const bearPin = upperWick > body * wickRatio && upperWick > lowerWick * 2 && body < totalRange * 0.35;

  if (bullPin) return { found: true, type: "bullish_pin_bar", wickLength: lowerWick.toFixed(4) };
  if (bearPin) return { found: true, type: "bearish_pin_bar", wickLength: upperWick.toFixed(4) };
  return { found: false };
}

export function detectHammer(bars) {
  if (bars.length < 3) return { found: false };

  const bar = bars[bars.length - 1];
  const body = Math.abs(bar.close - bar.open);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const totalRange = bar.high - bar.low;

  if (totalRange === 0) return { found: false };

  // Check if we're in a downtrend (last 3 bars declining)
  const inDowntrend = bars.slice(-3).every((b, i, arr) => i === 0 || b.close < arr[i - 1].close);
  const inUptrend = bars.slice(-3).every((b, i, arr) => i === 0 || b.close > arr[i - 1].close);

  // Hammer: long lower wick, small body at top, after downtrend
  const isHammer = lowerWick > body * 2 && upperWick < body * 0.5 && inDowntrend;
  // Inverted hammer / shooting star: long upper wick, small body at bottom, after uptrend
  const isShootingStar = upperWick > body * 2 && lowerWick < body * 0.5 && inUptrend;

  if (isHammer) return { found: true, type: "hammer", signal: "bullish_reversal" };
  if (isShootingStar) return { found: true, type: "shooting_star", signal: "bearish_reversal" };
  return { found: false };
}

export function detectDoji(bars, bodyThreshold = 0.1) {
  if (bars.length < 1) return { found: false };

  const bar = bars[bars.length - 1];
  const body = Math.abs(bar.close - bar.open);
  const totalRange = bar.high - bar.low;

  if (totalRange === 0) return { found: false };

  const isDoji = body / totalRange < bodyThreshold;

  if (!isDoji) return { found: false };

  const upperWick = bar.high - Math.max(bar.open, bar.close);
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;

  let dojiType = "standard_doji";
  if (upperWick > lowerWick * 3) dojiType = "gravestone_doji";
  else if (lowerWick > upperWick * 3) dojiType = "dragonfly_doji";
  else if (upperWick > body * 3 && lowerWick > body * 3) dojiType = "long_legged_doji";

  return {
    found: true,
    type: dojiType,
    signal: "indecision — watch next candle for confirmation",
    bodyPercent: ((body / totalRange) * 100).toFixed(1) + "%",
  };
}

export function detectMorningStar(bars) {
  if (bars.length < 3) return { found: false };

  const first = bars[bars.length - 3];
  const middle = bars[bars.length - 2];
  const last = bars[bars.length - 1];

  const firstBody = Math.abs(first.close - first.open);
  const middleBody = Math.abs(middle.close - middle.open);
  const lastBody = Math.abs(last.close - last.open);

  // Morning star: big bearish → small body (doji-like) → big bullish
  const isMorningStar =
    first.close < first.open &&
    middleBody < firstBody * 0.3 &&
    last.close > last.open &&
    lastBody > firstBody * 0.5 &&
    last.close > (first.open + first.close) / 2;

  // Evening star: big bullish → small body → big bearish
  const isEveningStar =
    first.close > first.open &&
    middleBody < firstBody * 0.3 &&
    last.close < last.open &&
    lastBody > firstBody * 0.5 &&
    last.close < (first.open + first.close) / 2;

  if (isMorningStar) return { found: true, type: "morning_star", signal: "strong_bullish_reversal" };
  if (isEveningStar) return { found: true, type: "evening_star", signal: "strong_bearish_reversal" };
  return { found: false };
}

export function getConfirmationCandle(bars) {
  const engulfing = detectEngulfing(bars);
  const pinBar = detectPinBar(bars);
  const hammer = detectHammer(bars);
  const doji = detectDoji(bars);
  const star = detectMorningStar(bars);

  const patterns = [engulfing, pinBar, hammer, doji, star].filter((p) => p.found);

  if (patterns.length === 0) {
    return { confirmed: false, patterns: [], note: "No confirmation candle — WAIT for entry trigger." };
  }

  const isBullish = patterns.some((p) => p.type?.includes("bullish") || p.type === "hammer" || p.type === "morning_star" || p.type === "dragonfly_doji");
  const isBearish = patterns.some((p) => p.type?.includes("bearish") || p.type === "shooting_star" || p.type === "evening_star" || p.type === "gravestone_doji");

  return {
    confirmed: true,
    direction: isBullish ? "bullish" : isBearish ? "bearish" : "neutral",
    patterns: patterns.map((p) => p.type),
    note: `Confirmation: ${patterns.map((p) => p.type).join(", ")}`,
  };
}
