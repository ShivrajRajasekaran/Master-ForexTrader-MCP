/**
 * Elliott Wave Engine
 * Counts 5-wave impulse structures and ABC corrections.
 * Identifies current wave position for trade timing.
 *
 * Rules:
 * - Wave 2 never retraces more than 100% of Wave 1
 * - Wave 3 is never the shortest impulse wave
 * - Wave 4 never overlaps Wave 1 price territory (in impulsive moves)
 */

export function analyzeElliottWave(bars, config = {}) {
  const { minSwingSize = 0.005, lookback = 100 } = config;

  if (!bars || bars.length < 30) {
    return { wave: null, reason: "Insufficient data" };
  }

  const relevant = bars.slice(-lookback);
  const swings = detectSwingPoints(relevant, minSwingSize);

  if (swings.length < 5) {
    return { wave: null, reason: "Not enough swing points for wave count", swings: swings.length };
  }

  // Try to fit impulse (5-wave)
  const impulse = fitImpulseWave(swings, relevant);

  // Try to fit correction (ABC)
  const correction = fitCorrectionWave(swings, relevant);

  // Determine which pattern fits better
  let result;
  if (impulse.valid && (!correction.valid || impulse.confidence > correction.confidence)) {
    result = impulse;
  } else if (correction.valid) {
    result = correction;
  } else {
    return {
      wave: null,
      reason: "No clear Elliott Wave pattern detected",
      swings: swings.length,
      hint: "Market may be in complex correction or early stage",
    };
  }

  // Trading implications
  const trade = getWaveTradePlan(result, relevant);

  return {
    ...result,
    trade,
    swingCount: swings.length,
  };
}

function detectSwingPoints(bars, minSwingPct) {
  const swings = [];
  const lookLeft = 3;
  const lookRight = 3;

  for (let i = lookLeft; i < bars.length - lookRight; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookLeft; j++) {
      if (bars[i].high <= bars[i - j].high) isSwingHigh = false;
      if (bars[i].low >= bars[i - j].low) isSwingLow = false;
    }
    for (let j = 1; j <= lookRight; j++) {
      if (bars[i].high <= bars[i + j].high) isSwingHigh = false;
      if (bars[i].low >= bars[i + j].low) isSwingLow = false;
    }

    if (isSwingHigh) {
      // Filter by minimum size
      if (swings.length > 0) {
        const lastSwing = swings[swings.length - 1];
        const move = Math.abs(bars[i].high - lastSwing.price) / lastSwing.price;
        if (move < minSwingPct) continue;
      }
      swings.push({ type: "HIGH", price: bars[i].high, index: i, bar: bars[i] });
    }
    if (isSwingLow) {
      if (swings.length > 0) {
        const lastSwing = swings[swings.length - 1];
        const move = Math.abs(bars[i].low - lastSwing.price) / lastSwing.price;
        if (move < minSwingPct) continue;
      }
      swings.push({ type: "LOW", price: bars[i].low, index: i, bar: bars[i] });
    }
  }

  // Remove consecutive same-type swings (keep extremes)
  const filtered = [];
  for (let i = 0; i < swings.length; i++) {
    if (i === 0) { filtered.push(swings[i]); continue; }
    const prev = filtered[filtered.length - 1];
    if (prev.type === swings[i].type) {
      if (swings[i].type === "HIGH" && swings[i].price > prev.price) {
        filtered[filtered.length - 1] = swings[i];
      } else if (swings[i].type === "LOW" && swings[i].price < prev.price) {
        filtered[filtered.length - 1] = swings[i];
      }
    } else {
      filtered.push(swings[i]);
    }
  }

  return filtered;
}

function fitImpulseWave(swings, bars) {
  // Need at least 5 alternating swings for impulse
  // Bullish impulse: L-H-L-H-L-H (waves 1-2-3-4-5)
  // Bearish impulse: H-L-H-L-H-L

  const lastPrice = bars[bars.length - 1].close;

  // Try bullish impulse (last 6 swings: start-low, w1-high, w2-low, w3-high, w4-low, w5-high)
  const bullish = tryFitBullishImpulse(swings);
  const bearish = tryFitBearishImpulse(swings);

  if (bullish.valid && bearish.valid) {
    return bullish.confidence > bearish.confidence ? bullish : bearish;
  }
  return bullish.valid ? bullish : bearish;
}

function tryFitBullishImpulse(swings) {
  // Find sequence: LOW, HIGH, LOW, HIGH, LOW, HIGH
  for (let start = Math.max(0, swings.length - 10); start < swings.length - 5; start++) {
    if (swings[start].type !== "LOW") continue;

    const candidates = [swings[start]];
    let expectedType = "HIGH";

    for (let i = start + 1; i < swings.length && candidates.length < 6; i++) {
      if (swings[i].type === expectedType) {
        candidates.push(swings[i]);
        expectedType = expectedType === "HIGH" ? "LOW" : "HIGH";
      }
    }

    if (candidates.length < 6) continue;

    const [w0, w1, w2, w3, w4, w5] = candidates;

    // Validate Elliott Wave rules
    const wave1 = w1.price - w0.price;
    const wave2ret = w1.price - w2.price;
    const wave3 = w3.price - w2.price;
    const wave4ret = w3.price - w4.price;
    const wave5 = w5.price - w4.price;

    // Rule 1: Wave 2 never retraces > 100% of Wave 1
    if (wave2ret >= wave1) continue;

    // Rule 2: Wave 3 is never the shortest
    if (wave3 < wave1 && wave3 < wave5) continue;

    // Rule 3: Wave 4 never enters Wave 1 territory
    if (w4.price < w1.price) continue;

    // All rules pass
    const w2fib = wave2ret / wave1;
    const w3fib = wave3 / wave1;
    const w4fib = wave4ret / wave3;

    let confidence = 50;
    if (w2fib > 0.5 && w2fib < 0.786) confidence += 15; // Ideal W2 retracement
    if (w3fib > 1.5 && w3fib < 2.618) confidence += 15; // Ideal W3 extension
    if (w4fib > 0.236 && w4fib < 0.5) confidence += 10; // Ideal W4 retracement
    if (wave3 > wave1 && wave3 > wave5) confidence += 10; // W3 longest (typical)

    // Determine current wave
    const currentWave = determineCurrentWave(candidates, swings);

    return {
      valid: true,
      pattern: "IMPULSE",
      direction: "BULLISH",
      confidence: Math.min(100, confidence),
      waves: {
        wave1: { start: w0.price, end: w1.price, size: round(wave1) },
        wave2: { start: w1.price, end: w2.price, retracement: round(w2fib * 100) + "%" },
        wave3: { start: w2.price, end: w3.price, extension: round(w3fib * 100) + "%" },
        wave4: { start: w3.price, end: w4.price, retracement: round(w4fib * 100) + "%" },
        wave5: { start: w4.price, end: w5.price, size: round(wave5) },
      },
      currentWave,
      fibLevels: {
        wave2_retrace: round(w2fib * 100) + "%",
        wave3_extension: round(w3fib * 100) + "%",
        wave4_retrace: round(w4fib * 100) + "%",
      },
    };
  }

  return { valid: false };
}

function tryFitBearishImpulse(swings) {
  for (let start = Math.max(0, swings.length - 10); start < swings.length - 5; start++) {
    if (swings[start].type !== "HIGH") continue;

    const candidates = [swings[start]];
    let expectedType = "LOW";

    for (let i = start + 1; i < swings.length && candidates.length < 6; i++) {
      if (swings[i].type === expectedType) {
        candidates.push(swings[i]);
        expectedType = expectedType === "LOW" ? "HIGH" : "LOW";
      }
    }

    if (candidates.length < 6) continue;

    const [w0, w1, w2, w3, w4, w5] = candidates;

    const wave1 = w0.price - w1.price;
    const wave2ret = w2.price - w1.price;
    const wave3 = w2.price - w3.price;
    const wave4ret = w4.price - w3.price;
    const wave5 = w4.price - w5.price;

    if (wave2ret >= wave1) continue;
    if (wave3 < wave1 && wave3 < wave5) continue;
    if (w4.price > w1.price) continue;

    const w2fib = wave2ret / wave1;
    const w3fib = wave3 / wave1;
    const w4fib = wave4ret / wave3;

    let confidence = 50;
    if (w2fib > 0.5 && w2fib < 0.786) confidence += 15;
    if (w3fib > 1.5 && w3fib < 2.618) confidence += 15;
    if (w4fib > 0.236 && w4fib < 0.5) confidence += 10;
    if (wave3 > wave1 && wave3 > wave5) confidence += 10;

    const currentWave = determineCurrentWave(candidates, swings);

    return {
      valid: true,
      pattern: "IMPULSE",
      direction: "BEARISH",
      confidence: Math.min(100, confidence),
      waves: {
        wave1: { start: w0.price, end: w1.price, size: round(wave1) },
        wave2: { start: w1.price, end: w2.price, retracement: round(w2fib * 100) + "%" },
        wave3: { start: w2.price, end: w3.price, extension: round(w3fib * 100) + "%" },
        wave4: { start: w3.price, end: w4.price, retracement: round(w4fib * 100) + "%" },
        wave5: { start: w4.price, end: w5.price, size: round(wave5) },
      },
      currentWave,
      fibLevels: {
        wave2_retrace: round(w2fib * 100) + "%",
        wave3_extension: round(w3fib * 100) + "%",
        wave4_retrace: round(w4fib * 100) + "%",
      },
    };
  }

  return { valid: false };
}

function fitCorrectionWave(swings, bars) {
  // ABC correction: 3-swing pattern after impulse
  if (swings.length < 3) return { valid: false };

  const last3 = swings.slice(-3);

  // Zigzag (sharp correction): A-B-C where C goes beyond A
  if (last3[0].type === "HIGH" && last3[1].type === "LOW" && last3[2].type === "HIGH") {
    const legA = last3[0].price - last3[1].price;
    const legB = last3[2].price - last3[1].price;
    const bRetrace = legB / legA;

    if (bRetrace > 0.382 && bRetrace < 0.786) {
      return {
        valid: true,
        pattern: "CORRECTION_ABC",
        direction: "BEARISH_CORRECTION",
        confidence: 60 + (bRetrace > 0.5 ? 15 : 0),
        waves: {
          waveA: { start: last3[0].price, end: last3[1].price },
          waveB: { start: last3[1].price, end: last3[2].price, retracement: round(bRetrace * 100) + "%" },
          waveC: { projected: round(last3[2].price - legA) },
        },
        currentWave: "In Wave C or complete",
        interpretation: "Correction likely ending — look for reversal to resume bull trend",
      };
    }
  }

  if (last3[0].type === "LOW" && last3[1].type === "HIGH" && last3[2].type === "LOW") {
    const legA = last3[1].price - last3[0].price;
    const legB = last3[1].price - last3[2].price;
    const bRetrace = legB / legA;

    if (bRetrace > 0.382 && bRetrace < 0.786) {
      return {
        valid: true,
        pattern: "CORRECTION_ABC",
        direction: "BULLISH_CORRECTION",
        confidence: 60 + (bRetrace > 0.5 ? 15 : 0),
        waves: {
          waveA: { start: last3[0].price, end: last3[1].price },
          waveB: { start: last3[1].price, end: last3[2].price, retracement: round(bRetrace * 100) + "%" },
          waveC: { projected: round(last3[2].price + legA) },
        },
        currentWave: "In Wave C or complete",
        interpretation: "Correction likely ending — look for reversal to resume bear trend",
      };
    }
  }

  return { valid: false };
}

function determineCurrentWave(wavePoints, allSwings) {
  const lastWavePoint = wavePoints[wavePoints.length - 1];
  const lastSwing = allSwings[allSwings.length - 1];

  if (lastSwing.index > lastWavePoint.index) {
    return "Post Wave 5 — expect ABC correction";
  }

  // Check which wave we're currently in based on position
  for (let i = wavePoints.length - 1; i >= 0; i--) {
    if (wavePoints[i].index === lastSwing.index) {
      const waveNum = Math.floor(i / 1) + 1;
      if (waveNum >= 5) return "Wave 5 complete — reversal imminent";
      if (waveNum === 4) return "In Wave 5 — final push, trail stop tight";
      if (waveNum === 3) return "In Wave 4 correction — prepare for Wave 5 entry";
      if (waveNum === 2) return "In Wave 3 — strongest wave, ride it";
      return `In Wave ${waveNum + 1}`;
    }
  }

  return "Wave 5 area — caution";
}

function getWaveTradePlan(waveResult, bars) {
  const currentPrice = bars[bars.length - 1].close;
  const { currentWave, direction, pattern } = waveResult;

  if (pattern === "IMPULSE") {
    if (currentWave && currentWave.includes("Wave 3")) {
      return {
        action: direction === "BULLISH" ? "BUY" : "SELL",
        reason: "Wave 3 is the strongest — ride the momentum",
        risk: "Trail stop below Wave 2 low",
        target: "Wave 3 typically extends 1.618× Wave 1",
      };
    }
    if (currentWave && currentWave.includes("Wave 4")) {
      return {
        action: "PREPARE",
        reason: "Wave 4 correction — wait for completion, then enter Wave 5",
        entry: direction === "BULLISH" ? "Buy at 38.2%-50% retracement of Wave 3" : "Sell at 38.2%-50% retracement",
        risk: "Stop beyond Wave 1 territory (invalidation)",
      };
    }
    if (currentWave && currentWave.includes("Wave 5")) {
      return {
        action: "CAUTION",
        reason: "Wave 5 is the final push — take profit, don't initiate new positions",
        risk: "Reversal imminent after Wave 5 completes",
        target: "Wave 5 ≈ Wave 1 in length (equality target)",
      };
    }
    if (currentWave && currentWave.includes("reversal")) {
      return {
        action: direction === "BULLISH" ? "SELL" : "BUY",
        reason: "5-wave impulse complete — ABC correction starting",
        entry: "Wait for Wave A to form, then trade Wave C",
        risk: "Stop beyond Wave 5 high/low",
      };
    }
  }

  if (pattern === "CORRECTION_ABC") {
    return {
      action: direction === "BEARISH_CORRECTION" ? "BUY" : "SELL",
      reason: "ABC correction ending — trend resumption expected",
      entry: "Enter at Wave C completion (look for reversal candle)",
      target: "New impulse Wave 1-2-3",
      risk: "Stop beyond Wave C extension (1.618× Wave A)",
    };
  }

  return { action: "WAIT", reason: "No clear wave-based trade setup" };
}

function round(val) {
  return Math.round(val * 100) / 100;
}
