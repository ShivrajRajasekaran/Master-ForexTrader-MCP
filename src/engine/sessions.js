/**
 * Session Liquidity Tracking Engine
 * Tracks which session H/L has been swept vs untapped.
 * Untapped session H/L = highest probability DOL targets.
 */

import { getAsiaRange, getLondonRange, getNYRange } from "./levels.js";

export function trackSessionLiquidity(bars) {
  const asia = getAsiaRange(bars);
  const london = getLondonRange(bars);
  const ny = getNYRange(bars);

  const sessions = [];

  if (asia) {
    sessions.push(
      { label: "Asia High", price: asia.high, session: "asia", side: "BSL", swept: false },
      { label: "Asia Low", price: asia.low, session: "asia", side: "SSL", swept: false }
    );
  }

  if (london) {
    sessions.push(
      { label: "London High", price: london.high, session: "london", side: "BSL", swept: false },
      { label: "London Low", price: london.low, session: "london", side: "SSL", swept: false }
    );
  }

  if (ny) {
    sessions.push(
      { label: "NY High", price: ny.high, session: "ny", side: "BSL", swept: false },
      { label: "NY Low", price: ny.low, session: "ny", side: "SSL", swept: false }
    );
  }

  // Check which levels have been swept
  for (const level of sessions) {
    for (const bar of bars) {
      if (bar.time <= (level.time || 0)) continue;
      if (level.side === "BSL" && bar.high > level.price) {
        level.swept = true;
        level.sweepTime = bar.time;
        break;
      }
      if (level.side === "SSL" && bar.low < level.price) {
        level.swept = true;
        level.sweepTime = bar.time;
        break;
      }
    }
  }

  const untapped = sessions.filter((s) => !s.swept);
  const swept = sessions.filter((s) => s.swept);

  return {
    untapped,
    swept,
    nextTarget: untapped.length > 0 ? untapped[0] : null,
    note: untapped.length > 0
      ? `${untapped.length} untapped session levels — nearest: ${untapped[0].label} @ ${untapped[0].price.toFixed(2)}`
      : "All session levels swept — look for fresh levels",
  };
}

export function detectAsianBreakout(bars, confirmBars = 3) {
  /**
   * Asian Range Breakout Model:
   * 1. Mark Asia H/L (00:00-06:00 UTC)
   * 2. Wait for London to break one side
   * 3. If break is with displacement → trade in breakout direction
   * 4. If break is a false break (returns inside) → trade opposite direction (Judas Swing)
   */
  const asia = getAsiaRange(bars);
  if (!asia) return { breakout: false };

  // Get bars after Asia session
  const postAsiaBars = bars.filter((b) => {
    const hour = new Date(b.time * 1000).getUTCHours();
    return hour >= 6;
  });

  if (postAsiaBars.length < confirmBars) return { breakout: false };

  let breakAbove = false;
  let breakBelow = false;
  let breakBar = null;
  let judasSwing = false;

  for (let i = 0; i < postAsiaBars.length; i++) {
    const bar = postAsiaBars[i];

    if (!breakAbove && !breakBelow) {
      if (bar.close > asia.high) {
        breakAbove = true;
        breakBar = bar;
      } else if (bar.close < asia.low) {
        breakBelow = true;
        breakBar = bar;
      }
    } else {
      // Check for Judas Swing (false breakout)
      if (breakAbove && bar.close < asia.high) {
        judasSwing = true;
        break;
      }
      if (breakBelow && bar.close > asia.low) {
        judasSwing = true;
        break;
      }
    }
  }

  if (!breakAbove && !breakBelow) return { breakout: false };

  // Check displacement on breakout candle
  const bodies = bars.slice(-20).map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;
  const breakBody = breakBar ? Math.abs(breakBar.close - breakBar.open) : 0;
  const hasDisplacement = breakBody > avgBody * 1.5;

  if (judasSwing) {
    return {
      breakout: true,
      type: "judas_swing",
      direction: breakAbove ? "bearish" : "bullish",
      asiaHigh: asia.high,
      asiaLow: asia.low,
      action: breakAbove
        ? "JUDAS SWING: False break above Asia → SELL (trap). Smart money sells after retail buys breakout."
        : "JUDAS SWING: False break below Asia → BUY (trap). Smart money buys after retail sells breakdown.",
    };
  }

  if (hasDisplacement) {
    return {
      breakout: true,
      type: "displacement_breakout",
      direction: breakAbove ? "bullish" : "bearish",
      asiaHigh: asia.high,
      asiaLow: asia.low,
      action: breakAbove
        ? "Asia HIGH broken with displacement → BULLISH. Enter on pullback to Asia High (now support)."
        : "Asia LOW broken with displacement → BEARISH. Enter on pullback to Asia Low (now resistance).",
    };
  }

  return {
    breakout: true,
    type: "weak_breakout",
    direction: breakAbove ? "bullish" : "bearish",
    asiaHigh: asia.high,
    asiaLow: asia.low,
    action: "Breakout without displacement — WAIT for confirmation or Judas Swing.",
  };
}

export function detectJudasSwing(bars, lookback = 15) {
  /**
   * Judas Swing (Stop Hunt):
   * Price makes a false move in one direction (taking stops),
   * then aggressively reverses. Classic London open manipulation.
   */
  if (bars.length < lookback) return { found: false };

  const recent = bars.slice(-lookback);
  const firstHalf = recent.slice(0, Math.floor(lookback / 2));
  const secondHalf = recent.slice(Math.floor(lookback / 2));

  const firstHigh = Math.max(...firstHalf.map((b) => b.high));
  const firstLow = Math.min(...firstHalf.map((b) => b.low));
  const lastClose = recent[recent.length - 1].close;

  // Bearish Judas: first spiked UP (above range), then crashed below
  const bearishJudas =
    Math.max(...firstHalf.map((b) => b.high)) > Math.max(...secondHalf.map((b) => b.high)) &&
    lastClose < firstLow;

  // Bullish Judas: first spiked DOWN (below range), then rallied above
  const bullishJudas =
    Math.min(...firstHalf.map((b) => b.low)) < Math.min(...secondHalf.map((b) => b.low)) &&
    lastClose > firstHigh;

  if (bearishJudas) {
    return {
      found: true,
      type: "bearish_judas_swing",
      fakeHigh: firstHigh,
      realDirection: "bearish",
      action: "JUDAS SWING — Fake pump then dump. Smart money sold into retail buying. SHORT.",
    };
  }

  if (bullishJudas) {
    return {
      found: true,
      type: "bullish_judas_swing",
      fakeLow: firstLow,
      realDirection: "bullish",
      action: "JUDAS SWING — Fake dump then pump. Smart money bought retail panic selling. LONG.",
    };
  }

  return { found: false };
}
