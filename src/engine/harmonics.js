/**
 * Harmonic Patterns Engine
 * Gartley, Bat, Butterfly, Crab, Cypher — institutional reversal zones.
 * Harmonic PRZ (Potential Reversal Zone) = highest confluence entry.
 */

const HARMONIC_RATIOS = {
  gartley: { XB: [0.618], AC: [0.382, 0.886], BD: [1.272, 1.618], XD: [0.786] },
  bat: { XB: [0.382, 0.5], AC: [0.382, 0.886], BD: [1.618, 2.618], XD: [0.886] },
  butterfly: { XB: [0.786], AC: [0.382, 0.886], BD: [1.618, 2.618], XD: [1.272, 1.618] },
  crab: { XB: [0.382, 0.618], AC: [0.382, 0.886], BD: [2.24, 3.618], XD: [1.618] },
  cypher: { XB: [0.382, 0.618], AC: [1.13, 1.414], BD: null, XD: [0.786] },
};

function withinTolerance(actual, targets, tolerance = 0.05) {
  return targets.some((t) => Math.abs(actual - t) <= tolerance);
}

export function detectHarmonicPattern(swings) {
  /**
   * Detects XABCD harmonic patterns from swing points.
   * swings: array of {price, time, type: "high"|"low"} in order
   * Returns identified pattern with PRZ (Potential Reversal Zone).
   */
  if (swings.length < 5) return { found: false, patterns: [] };

  const patterns = [];

  // Check last 5 swing points as potential XABCD
  for (let i = swings.length - 5; i >= 0; i--) {
    const [X, A, B, C, D] = swings.slice(i, i + 5);
    if (!X || !A || !B || !C || !D) continue;

    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(D.price - C.price);
    const XD = Math.abs(D.price - X.price);

    if (XA === 0) continue;

    const xbRatio = AB / XA;
    const acRatio = BC / AB;
    const bdRatio = CD / BC;
    const xdRatio = XD / XA;

    // Check each harmonic pattern
    for (const [name, ratios] of Object.entries(HARMONIC_RATIOS)) {
      const xbMatch = withinTolerance(xbRatio, ratios.XB);
      const acMatch = withinTolerance(acRatio, ratios.AC);
      const bdMatch = ratios.BD ? withinTolerance(bdRatio, ratios.BD) : true;
      const xdMatch = withinTolerance(xdRatio, ratios.XD);

      if (xbMatch && acMatch && bdMatch && xdMatch) {
        const isBullish = D.price < X.price; // D below X = bullish completion

        patterns.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: isBullish ? "bullish" : "bearish",
          points: { X: X.price, A: A.price, B: B.price, C: C.price, D: D.price },
          prz: D.price,
          ratios: {
            XB: xbRatio.toFixed(3),
            AC: acRatio.toFixed(3),
            BD: bdRatio.toFixed(3),
            XD: xdRatio.toFixed(3),
          },
          action: isBullish
            ? `BULLISH ${name.toUpperCase()} at PRZ ${D.price.toFixed(2)} — Enter LONG with SL below D`
            : `BEARISH ${name.toUpperCase()} at PRZ ${D.price.toFixed(2)} — Enter SHORT with SL above D`,
          time: D.time,
        });
        break; // Only match one pattern per XABCD
      }
    }

    if (patterns.length >= 3) break;
  }

  return {
    found: patterns.length > 0,
    patterns,
    bestSetup: patterns[0] || null,
  };
}

export function computePRZ(pattern) {
  /**
   * Compute Potential Reversal Zone bounds for a detected harmonic.
   * PRZ = cluster of D-point completion + fib levels.
   */
  if (!pattern) return null;

  const { X, A, D } = pattern.points;
  const XA = Math.abs(A - X);

  // PRZ is a zone around D-point, not a single price
  const przWidth = XA * 0.03; // 3% of XA leg

  return {
    top: D + przWidth,
    bottom: D - przWidth,
    midpoint: D,
    note: `${pattern.name} PRZ: ${(D - przWidth).toFixed(2)} - ${(D + przWidth).toFixed(2)}`,
  };
}

export { HARMONIC_RATIOS };
