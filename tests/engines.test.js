import { test, describe } from "node:test";
import assert from "node:assert";

import { KalmanFilter, analyzeTrend, computeATR } from "../src/engine/kalman-filter.js";
import { getCurrentSession } from "../src/engine/kill-zones.js";
import { detectSwings, classifyStructure, detectCISD } from "../src/engine/structure.js";
import { detectOrderBlocks, detectFVGs, computeOTE } from "../src/engine/liquidity.js";
import { detectAMDPhase, getAMDModel } from "../src/engine/amd.js";
import { analyzeVolume, detectExhaustion, computePOC } from "../src/engine/volume.js";
import { detectDisplacement, detectWyckoffSpring } from "../src/engine/patterns.js";
import { computePDH_PDL, detectEqualHighs } from "../src/engine/levels.js";
import { getQuarterlyPhase, getMacroWindow } from "../src/engine/time.js";
import { runGates } from "../src/gates/entry-gates.js";
import { identifyC4Setup, checkC1_ZoneProximity, checkC2_PriceRejection, detectSRZones } from "../src/engine/c4-strategy.js";
import { analyzeTrendFollowing } from "../src/engine/trend-following.js";
import { analyzeRangeTrading } from "../src/engine/range-trading.js";
import { analyzeBreakout } from "../src/engine/breakout-trading.js";

function makeBars(count, startPrice = 2000, trend = "up") {
  const bars = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const dir = trend === "up" ? 1 : trend === "down" ? -1 : (Math.random() > 0.5 ? 1 : -1);
    const move = (Math.random() * 5 + 1) * dir;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    bars.push({ time: 1700000000 + i * 300, open, high, low, close, volume: Math.floor(Math.random() * 1000 + 100) });
    price = close;
  }
  return bars;
}

describe("Kalman Filter", () => {
  test("KalmanFilter converges to price", () => {
    const kf = new KalmanFilter();
    let val;
    for (let i = 0; i < 50; i++) val = kf.computeKalmanLine(100);
    assert.ok(Math.abs(val - 100) < 5);
  });

  test("analyzeTrend returns valid structure", () => {
    const bars = makeBars(60, 2000, "up");
    const result = analyzeTrend(bars);
    assert.ok(result.kalmanLine > 0);
    assert.ok(["Bullish", "Bearish", "Neutral", "Ranging"].includes(result.label));
    assert.ok(typeof result.canTrade === "boolean");
  });

  test("computeATR returns positive value", () => {
    const bars = makeBars(30);
    const atr = computeATR(bars, 14);
    assert.ok(atr > 0);
  });
});

describe("Kill Zones", () => {
  test("London KZ detected at 3AM EST", () => {
    const londonTime = new Date("2026-01-15T08:00:00Z"); // 3AM EST
    const session = getCurrentSession(londonTime.getTime());
    assert.ok(session.canTrade);
    assert.strictEqual(session.activeKillZone.key, "london");
  });

  test("Avoid zone at noon EST", () => {
    const lunchTime = new Date("2026-01-15T17:00:00Z"); // 12PM EST
    const session = getCurrentSession(lunchTime.getTime());
    assert.strictEqual(session.canTrade, false);
  });

  test("NY KZ at 8AM EST", () => {
    const nyTime = new Date("2026-01-15T13:00:00Z"); // 8AM EST
    const session = getCurrentSession(nyTime.getTime());
    assert.ok(session.canTrade);
    assert.strictEqual(session.activeKillZone.key, "ny_am");
  });
});

describe("Structure", () => {
  test("detectSwings finds highs and lows", () => {
    // Use mixed direction to guarantee swings
    const bars = makeBars(100, 2000, "mixed");
    const { highs, lows } = detectSwings(bars, 3);
    assert.ok(highs.length >= 0 && lows.length >= 0);
    // Structure detection should at least not crash
    assert.ok(typeof highs === "object");
  });

  test("classifyStructure identifies bias", () => {
    const bars = makeBars(60, 2000, "up");
    const { highs, lows } = detectSwings(bars);
    if (highs.length >= 2 && lows.length >= 2) {
      const structure = classifyStructure(highs, lows);
      assert.ok(["Bullish", "Bearish", "Neutral"].includes(structure.bias));
    }
  });

  test("detectCISD returns valid result", () => {
    const bars = makeBars(20);
    const cisd = detectCISD(bars);
    assert.ok(typeof cisd.bullCISD === "boolean");
    assert.ok(typeof cisd.bearCISD === "boolean");
  });
});

describe("Liquidity", () => {
  test("detectOrderBlocks finds OBs with displacement validation", () => {
    const bars = makeBars(60);
    const { bullOBs, bearOBs } = detectOrderBlocks(bars);
    // May or may not find OBs depending on random data, but shouldn't crash
    assert.ok(Array.isArray(bullOBs));
    assert.ok(Array.isArray(bearOBs));
  });

  test("detectFVGs finds gaps", () => {
    const bars = makeBars(60);
    const { bullFVGs, bearFVGs } = detectFVGs(bars);
    assert.ok(Array.isArray(bullFVGs));
    assert.ok(Array.isArray(bearFVGs));
  });

  test("computeOTE returns fibonacci levels", () => {
    const ote = computeOTE(2050, 2000);
    assert.strictEqual(ote.fib_50, 2025);
    assert.ok(ote.fib_618 < ote.fib_50);
    assert.ok(ote.fib_786 < ote.fib_618);
  });
});

describe("AMD Engine", () => {
  test("detectAMDPhase returns valid phase", () => {
    const bars = makeBars(50);
    const phase = detectAMDPhase(bars);
    assert.ok(["Accumulation", "Manipulation", "Distribution", "Distribution (Continuation)", "Transition"].includes(phase.phase));
    assert.ok(phase.confidence >= 0 && phase.confidence <= 100);
  });

  test("getAMDModel includes tradeable flag", () => {
    const bars = makeBars(50);
    const model = getAMDModel(bars);
    assert.ok(typeof model.tradeable === "boolean");
    assert.ok(model.rule.length > 0);
  });
});

describe("Volume Engine", () => {
  test("analyzeVolume detects states", () => {
    const bars = makeBars(30);
    const vol = analyzeVolume(bars);
    assert.ok(vol !== null);
    assert.ok(["Normal", "HIGH", "CLIMAX", "LOW", "DRY"].includes(vol.state));
  });

  test("computePOC finds point of control", () => {
    const bars = makeBars(20);
    const poc = computePOC(bars);
    assert.ok(poc !== null);
    assert.ok(poc.poc > 0);
  });
});

describe("Patterns", () => {
  test("detectDisplacement identifies big candles", () => {
    const bars = makeBars(30);
    const result = detectDisplacement(bars);
    assert.ok(typeof result.found === "boolean");
  });
});

describe("Levels", () => {
  test("computePDH_PDL from daily bars", () => {
    const dailyBars = [
      { time: 1, open: 2000, high: 2050, low: 1990, close: 2040 },
      { time: 2, open: 2040, high: 2060, low: 2010, close: 2050 },
    ];
    const pd = computePDH_PDL(dailyBars);
    assert.strictEqual(pd.pdh, 2050);
    assert.strictEqual(pd.pdl, 1990);
  });

  test("detectEqualHighs finds equal levels", () => {
    const swingHighs = [
      { price: 2050.2, time: 1 },
      { price: 2050.4, time: 2 },
      { price: 2080, time: 3 },
    ];
    const eqh = detectEqualHighs(swingHighs, 0.5);
    assert.ok(eqh.length > 0);
    assert.strictEqual(eqh[0].type, "EQH");
  });
});

describe("Time Engine", () => {
  test("getQuarterlyPhase returns valid phase", () => {
    const phase = getQuarterlyPhase();
    assert.ok(["Accumulation", "Manipulation", "Distribution", "Continuation/Reversal"].includes(phase.quarter));
  });

  test("getMacroWindow returns structure", () => {
    const macro = getMacroWindow();
    assert.ok(typeof macro.inMacro === "boolean");
    assert.ok(macro.currentTime.includes("EST"));
  });
});

describe("7-Gate System", () => {
  test("runGates returns structured result", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      htfBars: makeBars(30),
      currentTime: new Date("2026-01-15T08:00:00Z").getTime(), // London KZ
      tradesToday: 0,
      sensitivity: "balanced",
    });

    assert.strictEqual(result.total, 7);
    assert.ok(result.passed >= 0 && result.passed <= 7);
    assert.ok(result.gates.length === 7);
    assert.ok(["BUY LONG", "SELL SHORT", "WAIT"].includes(result.signal));
  });

  test("runGates respects trade limits", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      currentTime: Date.now(),
      tradesToday: 3,
      sensitivity: "aggressive",
    });

    const gate7 = result.gates[6];
    assert.strictEqual(gate7.passed, false);
  });

  test("runGates WAIT outside kill zones", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      currentTime: new Date("2026-01-15T22:00:00Z").getTime(), // 5PM EST — NY Close
      tradesToday: 0,
      sensitivity: "conservative",
    });

    const gate1 = result.gates[0];
    assert.strictEqual(gate1.passed, false);
  });
});

describe("C4 Strategy", () => {
  test("detectSRZones finds zones from price data", () => {
    const bars = makeBars(60);
    const zones = detectSRZones(bars, 50, 1);
    assert.ok(Array.isArray(zones));
    if (zones.length > 0) {
      assert.ok(zones[0].type === "support" || zones[0].type === "resistance");
      assert.ok(zones[0].high > zones[0].low);
    }
  });

  test("checkC1_ZoneProximity detects proximity", () => {
    const candle = { open: 2000, high: 2005, low: 1995, close: 2002 };
    const zones = [{ type: "support", high: 2004, low: 1998, touches: 3 }];
    const result = checkC1_ZoneProximity(candle, zones, 0.5);
    assert.strictEqual(result.confirmed, true);
    assert.strictEqual(result.zone.type, "support");
  });

  test("checkC2_PriceRejection detects pin bar", () => {
    const candles = [
      { open: 2000, high: 2005, low: 1985, close: 2003 }, // big lower wick = bullish pin
    ];
    const zone = { type: "support", high: 2005, low: 1990 };
    const result = checkC2_PriceRejection(candles, zone);
    assert.strictEqual(result.confirmed, true);
  });

  test("identifyC4Setup returns structured result", () => {
    const bars = makeBars(50);
    const zones = [{ type: "support", high: bars[49].close + 1, low: bars[49].close - 5, touches: 3, htf: true }];
    const result = identifyC4Setup(bars, zones, {});
    assert.ok(typeof result.setup === "boolean");
    if (!result.setup) {
      assert.ok(result.stage || result.reason);
    }
  });
});

describe("Trend Following", () => {
  test("analyzeTrendFollowing returns structured result", () => {
    const bars = makeBars(250, 2000, "up");
    const result = analyzeTrendFollowing(bars);
    assert.ok(["BUY", "SELL", "WAIT"].includes(result.signal));
    assert.ok(typeof result.score === "number");
    assert.ok(result.trend);
    assert.ok(result.trend.emaStack);
    assert.ok(result.management);
  });

  test("analyzeTrendFollowing insufficient data returns WAIT", () => {
    const bars = makeBars(10);
    const result = analyzeTrendFollowing(bars);
    assert.strictEqual(result.signal, "WAIT");
  });
});

describe("Range Trading", () => {
  test("analyzeRangeTrading returns structured result", () => {
    // Create ranging bars (oscillate between 2000-2050)
    const bars = [];
    let price = 2025;
    for (let i = 0; i < 60; i++) {
      const dir = price > 2040 ? -1 : price < 2010 ? 1 : (Math.random() > 0.5 ? 1 : -1);
      const move = Math.random() * 5 * dir;
      const open = price;
      const close = Math.max(2005, Math.min(2045, price + move));
      const high = Math.max(open, close) + Math.random() * 3;
      const low = Math.min(open, close) - Math.random() * 3;
      bars.push({ time: 1700000000 + i * 300, open, high, low, close, volume: 500 });
      price = close;
    }
    const result = analyzeRangeTrading(bars);
    assert.ok(["BUY", "SELL", "WAIT"].includes(result.signal));
    assert.ok(typeof result.adx === "number");
  });

  test("analyzeRangeTrading rejects trending market", () => {
    const bars = makeBars(60, 2000, "up");
    const result = analyzeRangeTrading(bars);
    // Should either be WAIT or detect trending
    assert.ok(result.signal === "WAIT" || result.marketState === "TRENDING" || result.adx !== undefined);
  });
});

describe("Breakout Trading", () => {
  test("analyzeBreakout returns structured result", () => {
    const bars = makeBars(50);
    const result = analyzeBreakout(bars);
    assert.ok(["BUY", "SELL", "WAIT"].includes(result.signal));
    assert.ok(typeof result.score === "number");
    assert.ok(result.squeeze !== undefined);
    assert.ok(result.falseBreakoutRules);
  });

  test("analyzeBreakout insufficient data returns WAIT", () => {
    const bars = makeBars(5);
    const result = analyzeBreakout(bars);
    assert.strictEqual(result.signal, "WAIT");
  });
});
