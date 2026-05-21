/**
 * 7-Gate Entry System
 * ALL gates must pass before a trade signal is generated.
 * This is what separates a master from an amateur.
 */

import { getCurrentSession } from "../engine/kill-zones.js";
import { analyzeTrend } from "../engine/kalman-filter.js";
import {
  detectSwings,
  classifyStructure,
  detectBOS,
  detectCHoCH,
  detectCISD,
  getHTFBias,
} from "../engine/structure.js";
import {
  detectRecentSweep,
  detectOrderBlocks,
  detectFVGs,
  priceInZone,
  computeOTE,
  priceInOTE,
} from "../engine/liquidity.js";

const MAX_TRADES_PER_DAY = 3;
const SIGNAL_COOLDOWN_BARS = 20;

export function runGates(data) {
  const {
    bars,
    htfBars,
    currentTime,
    tradesToday = 0,
    lastSignalBar = null,
    currentBarIndex = null,
    sensitivity = "conservative",
  } = data;

  const results = {
    gates: [],
    passed: 0,
    total: 7,
    signal: "WAIT",
    direction: null,
    confidence: null,
    entry: null,
    sl: null,
    tp: null,
    rr: null,
  };

  // GATE 1: Kill Zone
  const session = getCurrentSession(currentTime);
  const gate1 = {
    name: "Kill Zone",
    passed: session.canTrade,
    detail: session.reason,
  };
  results.gates.push(gate1);

  // GATE 2: Trending (Kalman Filter)
  const trend = analyzeTrend(bars);
  const gate2 = {
    name: "Trend Filter (Kalman)",
    passed: trend.canTrade,
    detail: trend.reason,
    data: { label: trend.label, kalmanLine: trend.kalmanLine },
  };
  results.gates.push(gate2);

  // GATE 3: HTF Bias
  const htfBias = htfBars ? getHTFBias(htfBars) : { bias: "Neutral" };
  const gate3 = {
    name: "HTF Bias",
    passed: htfBias.bias !== "Neutral",
    detail: `HTF: ${htfBias.bias} (${htfBias.highType || "?"}/${htfBias.lowType || "?"})`,
    data: htfBias,
  };
  results.gates.push(gate3);

  // GATE 4: Structure (BOS or CHoCH)
  const { highs, lows } = detectSwings(bars);
  const structure = classifyStructure(highs, lows);
  const bos = detectBOS(bars, structure);
  const choch = detectCHoCH(bars, structure);
  const cisd = detectCISD(bars);

  const hasStructureEvent = bos.bullBOS || bos.bearBOS || choch.bullCHoCH || choch.bearCHoCH || cisd.bullCISD || cisd.bearCISD;
  const gate4 = {
    name: "Structure Event (BOS/CHoCH/CISD)",
    passed: hasStructureEvent,
    detail: bos.bullBOS ? "Bullish BOS" :
            bos.bearBOS ? "Bearish BOS" :
            choch.bullCHoCH ? "Bullish CHoCH" :
            choch.bearCHoCH ? "Bearish CHoCH" :
            cisd.bullCISD ? "Bullish CISD" :
            cisd.bearCISD ? "Bearish CISD" : "No structure event",
    data: { bos, choch, cisd },
  };
  results.gates.push(gate4);

  // GATE 5: Liquidity Sweep (within last 10 bars)
  const sweep = detectRecentSweep(bars, highs, lows, 10);
  const gate5 = {
    name: "Liquidity Sweep",
    passed: sweep.swept,
    detail: sweep.swept
      ? `${sweep.type} sweep at ${sweep.price?.toFixed(2)} (${sweep.barsAgo} bars ago)`
      : "No recent sweep",
    data: sweep,
  };
  results.gates.push(gate5);

  // GATE 6: Price at Institutional Zone (OB/FVG/OTE)
  const price = bars[bars.length - 1].close;
  const obs = detectOrderBlocks(bars);
  const fvgs = detectFVGs(bars);
  const rangeH = Math.max(...bars.slice(-50).map((b) => b.high));
  const rangeL = Math.min(...bars.slice(-50).map((b) => b.low));
  const ote = computeOTE(rangeH, rangeL);

  const allBullZones = [...obs.bullOBs, ...fvgs.bullFVGs];
  const allBearZones = [...obs.bearOBs, ...fvgs.bearFVGs];
  const inBullZone = priceInZone(price, allBullZones);
  const inBearZone = priceInZone(price, allBearZones);
  const inOTE = priceInOTE(price, ote);

  const atZone = inBullZone.inZone || inBearZone.inZone || inOTE;
  const gate6 = {
    name: "Institutional Zone (OB/FVG/OTE)",
    passed: atZone,
    detail: inBullZone.inZone ? "At Bull OB/FVG" :
            inBearZone.inZone ? "At Bear OB/FVG" :
            inOTE ? "Inside OTE Zone" : "Not at any institutional zone",
    data: { obs, fvgs, ote, inBullZone, inBearZone, inOTE },
  };
  results.gates.push(gate6);

  // GATE 7: Max Trades + Cooldown
  const cooldownOk = lastSignalBar === null ||
    currentBarIndex === null ||
    (currentBarIndex - lastSignalBar) >= SIGNAL_COOLDOWN_BARS;
  const tradesOk = tradesToday < MAX_TRADES_PER_DAY;
  const gate7 = {
    name: "Trade Limit & Cooldown",
    passed: tradesOk && cooldownOk,
    detail: !tradesOk
      ? `Max trades reached (${tradesToday}/${MAX_TRADES_PER_DAY})`
      : !cooldownOk
        ? `Cooldown active (${SIGNAL_COOLDOWN_BARS} bars required)`
        : `OK (${tradesToday}/${MAX_TRADES_PER_DAY} trades, cooldown clear)`,
  };
  results.gates.push(gate7);

  // COUNT PASSES
  results.passed = results.gates.filter((g) => g.passed).length;

  // DETERMINE SIGNAL based on sensitivity
  const minGates = sensitivity === "conservative" ? 7 :
                   sensitivity === "balanced" ? 6 : 5;

  if (results.passed >= minGates) {
    // Determine direction
    const bullSignals = [
      bos.bullBOS, choch.bullCHoCH, cisd.bullCISD,
      sweep.type === "bullish",
      htfBias.bias === "Bullish",
      trend.label === "Bullish",
    ].filter(Boolean).length;

    const bearSignals = [
      bos.bearBOS, choch.bearCHoCH, cisd.bearCISD,
      sweep.type === "bearish",
      htfBias.bias === "Bearish",
      trend.label === "Bearish",
    ].filter(Boolean).length;

    if (bullSignals > bearSignals) {
      results.signal = "BUY LONG";
      results.direction = "bullish";
    } else if (bearSignals > bullSignals) {
      results.signal = "SELL SHORT";
      results.direction = "bearish";
    }

    // Compute entry, SL, TP
    if (results.direction) {
      const atr = trend.atr || 10;

      if (results.direction === "bullish") {
        results.entry = price;
        const slBase = (sweep.price || rangeL) - atr * 0.2;
        results.sl = Math.min(slBase, trend.kalmanLower || slBase);
        const risk = results.entry - results.sl;
        results.tp = results.entry + risk * 2.0;
        results.rr = risk > 0 ? ((results.tp - results.entry) / risk).toFixed(1) : "N/A";
      } else {
        results.entry = price;
        const slBase = (sweep.price || rangeH) + atr * 0.2;
        results.sl = Math.max(slBase, trend.kalmanUpper || slBase);
        const risk = results.sl - results.entry;
        results.tp = results.entry - risk * 2.0;
        results.rr = risk > 0 ? ((results.entry - results.tp) / risk).toFixed(1) : "N/A";
      }
    }

    results.confidence = `${results.passed}/${results.total} gates passed`;
  } else {
    results.signal = "WAIT";
    results.reason = `Only ${results.passed}/${results.total} gates passed (need ${minGates} for ${sensitivity})`;
  }

  return results;
}
