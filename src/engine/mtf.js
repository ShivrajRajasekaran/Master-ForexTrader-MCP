/**
 * Multi-Timeframe (MTF) Alignment Engine
 * Proper institutional MTF: all timeframes must agree before entry.
 * HTF (Daily/4H) = Direction | ITF (1H) = Structure | LTF (5M/15M) = Entry
 */

import { detectSwings, classifyStructure, detectCISD } from "./structure.js";
import { analyzeTrend } from "./kalman-filter.js";

export function analyzeMTF(ltfBars, itfBars, htfBars) {
  const results = { aligned: false, direction: null, timeframes: {} };

  // HTF (Daily/4H) — DIRECTION
  if (htfBars && htfBars.length >= 20) {
    const { highs, lows } = detectSwings(htfBars, 3);
    const structure = classifyStructure(highs, lows);
    const trend = analyzeTrend(htfBars);
    results.timeframes.htf = {
      bias: structure.bias,
      highType: structure.highType,
      lowType: structure.lowType,
      trend: trend.label,
      canTrade: trend.canTrade,
    };
  } else {
    results.timeframes.htf = { bias: "Unknown", note: "Need 20+ HTF bars" };
  }

  // ITF (1H) — STRUCTURE
  if (itfBars && itfBars.length >= 20) {
    const { highs, lows } = detectSwings(itfBars, 4);
    const structure = classifyStructure(highs, lows);
    const cisd = detectCISD(itfBars);
    results.timeframes.itf = {
      bias: structure.bias,
      highType: structure.highType,
      lowType: structure.lowType,
      cisd: cisd.bullCISD ? "Bullish CISD" : cisd.bearCISD ? "Bearish CISD" : "None",
    };
  } else {
    results.timeframes.itf = { bias: "Unknown", note: "Need 20+ ITF bars" };
  }

  // LTF (5M/15M) — ENTRY
  if (ltfBars && ltfBars.length >= 30) {
    const { highs, lows } = detectSwings(ltfBars, 5);
    const structure = classifyStructure(highs, lows);
    const trend = analyzeTrend(ltfBars);
    const cisd = detectCISD(ltfBars);
    results.timeframes.ltf = {
      bias: structure.bias,
      highType: structure.highType,
      lowType: structure.lowType,
      trend: trend.label,
      cisd: cisd.bullCISD ? "Bullish CISD" : cisd.bearCISD ? "Bearish CISD" : "None",
    };
  } else {
    results.timeframes.ltf = { bias: "Unknown", note: "Need 30+ LTF bars" };
  }

  // ALIGNMENT CHECK
  const htfBias = results.timeframes.htf.bias;
  const itfBias = results.timeframes.itf.bias;
  const ltfBias = results.timeframes.ltf.bias;

  const allBullish = htfBias === "Bullish" && itfBias === "Bullish" && ltfBias === "Bullish";
  const allBearish = htfBias === "Bearish" && itfBias === "Bearish" && ltfBias === "Bearish";
  const htfItfAlign = htfBias === itfBias && htfBias !== "Neutral";

  if (allBullish || allBearish) {
    results.aligned = true;
    results.direction = allBullish ? "bullish" : "bearish";
    results.strength = "FULL ALIGNMENT";
    results.action = allBullish
      ? "ALL timeframes BULLISH — high-conviction LONG"
      : "ALL timeframes BEARISH — high-conviction SHORT";
  } else if (htfItfAlign) {
    results.aligned = true;
    results.direction = htfBias === "Bullish" ? "bullish" : "bearish";
    results.strength = "HTF+ITF ALIGNED";
    results.action = `HTF + ITF agree (${htfBias}) — wait for LTF to confirm for entry`;
  } else {
    results.aligned = false;
    results.direction = null;
    results.strength = "MISALIGNED";
    results.action = "Timeframes DISAGREE — NO TRADE. Wait for alignment.";
  }

  return results;
}

export function getMTFConfluence(ltfBars, itfBars, htfBars) {
  const mtf = analyzeMTF(ltfBars, itfBars, htfBars);

  let score = 0;
  if (mtf.aligned) score += 2;
  if (mtf.strength === "FULL ALIGNMENT") score += 1;
  if (mtf.timeframes.htf.canTrade !== false) score += 1;

  return {
    ...mtf,
    score,
    maxScore: 4,
    tradeable: score >= 2,
    verdict: score >= 3
      ? "STRONG MTF confluence — proceed with entry"
      : score >= 2
        ? "MODERATE MTF confluence — proceed with caution"
        : "WEAK MTF — DO NOT trade until alignment improves",
  };
}
