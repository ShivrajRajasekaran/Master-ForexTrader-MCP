/**
 * Anchored VWAP Engine
 * Dynamic S/R from volume-weighted average price anchored to key events.
 */

export function computeVWAP(bars, anchorIndex = 0) {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  const vwapValues = [];

  for (let i = anchorIndex; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const vol = bars[i].volume || 1;
    cumulativeTPV += tp * vol;
    cumulativeVolume += vol;
    vwapValues.push({
      index: i,
      vwap: cumulativeTPV / cumulativeVolume,
      upperBand: null,
      lowerBand: null,
    });
  }

  // Standard deviation bands
  for (let i = 0; i < vwapValues.length; i++) {
    const realIndex = i + anchorIndex;
    let sumSqDiff = 0;
    let count = 0;
    for (let j = anchorIndex; j <= realIndex; j++) {
      const tp = (bars[j].high + bars[j].low + bars[j].close) / 3;
      sumSqDiff += Math.pow(tp - vwapValues[i].vwap, 2);
      count++;
    }
    const stdDev = Math.sqrt(sumSqDiff / count);
    vwapValues[i].upperBand = vwapValues[i].vwap + stdDev * 2;
    vwapValues[i].lowerBand = vwapValues[i].vwap - stdDev * 2;
  }

  return vwapValues;
}

export function anchorToSessionOpen(bars) {
  if (bars.length === 0) return computeVWAP(bars, 0);

  const lastBar = bars[bars.length - 1];
  const lastDate = new Date(lastBar.time || lastBar.timestamp || Date.now()).toDateString();

  let anchorIdx = 0;
  for (let i = bars.length - 1; i >= 0; i--) {
    const barDate = new Date(bars[i].time || bars[i].timestamp || Date.now()).toDateString();
    if (barDate !== lastDate) {
      anchorIdx = i + 1;
      break;
    }
  }

  return computeVWAP(bars, anchorIdx);
}

export function anchorToSwingHigh(bars, swingHighIndex) {
  return computeVWAP(bars, swingHighIndex);
}

export function anchorToSwingLow(bars, swingLowIndex) {
  return computeVWAP(bars, swingLowIndex);
}

export function anchorToLiquiditySweep(bars, sweepIndex) {
  return computeVWAP(bars, sweepIndex);
}

export function getVWAPAnalysis(bars, anchors = {}) {
  const price = bars[bars.length - 1].close;

  const sessionVWAP = anchorToSessionOpen(bars);
  const currentVWAP = sessionVWAP.length > 0 ? sessionVWAP[sessionVWAP.length - 1] : null;

  const result = {
    sessionVWAP: currentVWAP ? currentVWAP.vwap : null,
    upperBand: currentVWAP ? currentVWAP.upperBand : null,
    lowerBand: currentVWAP ? currentVWAP.lowerBand : null,
    priceVsVWAP: null,
    zone: null,
    anchored: {},
  };

  if (currentVWAP) {
    if (price > currentVWAP.upperBand) {
      result.priceVsVWAP = "above_upper_band";
      result.zone = "PREMIUM — overextended above VWAP";
    } else if (price > currentVWAP.vwap) {
      result.priceVsVWAP = "above_vwap";
      result.zone = "BULLISH — above VWAP";
    } else if (price < currentVWAP.lowerBand) {
      result.priceVsVWAP = "below_lower_band";
      result.zone = "DISCOUNT — overextended below VWAP";
    } else if (price < currentVWAP.vwap) {
      result.priceVsVWAP = "below_vwap";
      result.zone = "BEARISH — below VWAP";
    } else {
      result.priceVsVWAP = "at_vwap";
      result.zone = "NEUTRAL — at VWAP";
    }
  }

  if (anchors.swingHigh !== undefined) {
    const swVWAP = anchorToSwingHigh(bars, anchors.swingHigh);
    if (swVWAP.length > 0) result.anchored.swingHigh = swVWAP[swVWAP.length - 1].vwap;
  }

  if (anchors.swingLow !== undefined) {
    const slVWAP = anchorToSwingLow(bars, anchors.swingLow);
    if (slVWAP.length > 0) result.anchored.swingLow = slVWAP[slVWAP.length - 1].vwap;
  }

  if (anchors.sweepIndex !== undefined) {
    const spVWAP = anchorToLiquiditySweep(bars, anchors.sweepIndex);
    if (spVWAP.length > 0) result.anchored.liquiditySweep = spVWAP[spVWAP.length - 1].vwap;
  }

  return result;
}

export function vwapConfluence(price, vwapAnalysis) {
  if (!vwapAnalysis.sessionVWAP) return { confluent: false, reason: "No VWAP data" };

  const distFromVWAP = Math.abs(price - vwapAnalysis.sessionVWAP) / vwapAnalysis.sessionVWAP * 100;
  const nearVWAP = distFromVWAP < 0.05;

  const atBand = vwapAnalysis.priceVsVWAP === "above_upper_band" || vwapAnalysis.priceVsVWAP === "below_lower_band";

  return {
    confluent: nearVWAP || atBand,
    nearVWAP,
    atBand,
    distancePercent: distFromVWAP.toFixed(3),
    bias: vwapAnalysis.priceVsVWAP?.includes("above") ? "bullish" : vwapAnalysis.priceVsVWAP?.includes("below") ? "bearish" : "neutral",
    reason: nearVWAP ? "Price at VWAP — mean reversion zone" : atBand ? "Price at VWAP band — reversal zone" : "Price between VWAP levels",
  };
}
