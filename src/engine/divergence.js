/**
 * Divergence Engine
 * True price/volume divergence detection — not just exhaustion.
 * Divergence = price makes new extreme but momentum/volume doesn't confirm.
 * One of the strongest reversal signals when combined with liquidity sweep.
 */

export function detectPriceDivergence(bars, lookback = 20) {
  /**
   * Regular Bullish Divergence: Price makes Lower Low, but indicator makes Higher Low
   * Regular Bearish Divergence: Price makes Higher High, but indicator makes Lower High
   * Hidden Bullish: Price makes Higher Low, indicator makes Lower Low (continuation)
   * Hidden Bearish: Price makes Lower High, indicator makes Higher High (continuation)
   */
  if (bars.length < lookback + 5) return { divergences: [] };

  const recent = bars.slice(-lookback);
  const divergences = [];

  // Use volume as momentum proxy (RSI-like would need more data)
  const volumes = recent.map((b) => b.volume || 0);
  const closes = recent.map((b) => b.close);
  const lows = recent.map((b) => b.low);
  const highs = recent.map((b) => b.high);

  // Find swing lows in price and volume
  for (let i = 5; i < recent.length - 2; i++) {
    // Check for price making lower low
    const priceLow1 = Math.min(...lows.slice(0, i));
    const priceLow2 = lows[i];
    const volumeAtLow1Idx = lows.indexOf(priceLow1);
    const volumeAtLow1 = volumes[volumeAtLow1Idx] || 0;
    const volumeAtLow2 = volumes[i];

    // Regular Bullish Divergence: price LL + volume HL
    if (priceLow2 < priceLow1 && volumeAtLow2 > volumeAtLow1 * 0.7 && volumeAtLow2 < volumeAtLow1) {
      // Actually: price makes new low on DECLINING volume = no sellers left
      if (volumeAtLow2 < volumeAtLow1 * 0.8) {
        divergences.push({
          type: "regular_bullish_divergence",
          barIndex: i,
          time: recent[i].time,
          priceLevel: priceLow2,
          note: "Price made NEW LOW but volume DECLINING — sellers exhausted. Reversal UP likely.",
          strength: "strong",
        });
      }
    }

    // Check for price making higher high
    const priceHigh1 = Math.max(...highs.slice(0, i));
    const priceHigh2 = highs[i];
    const volumeAtHigh1Idx = highs.indexOf(priceHigh1);
    const volumeAtHigh1 = volumes[volumeAtHigh1Idx] || 0;
    const volumeAtHigh2 = volumes[i];

    // Regular Bearish Divergence: price HH + volume declining
    if (priceHigh2 > priceHigh1 && volumeAtHigh2 < volumeAtHigh1 * 0.8) {
      divergences.push({
        type: "regular_bearish_divergence",
        barIndex: i,
        time: recent[i].time,
        priceLevel: priceHigh2,
        note: "Price made NEW HIGH but volume DECLINING — buyers exhausted. Reversal DOWN likely.",
        strength: "strong",
      });
    }
  }

  // Hidden divergence (continuation signals)
  for (let i = 5; i < recent.length - 2; i++) {
    const prevLows = lows.slice(Math.max(0, i - 10), i);
    const prevHighs = highs.slice(Math.max(0, i - 10), i);

    if (prevLows.length < 3) continue;

    const prevSwingLow = Math.min(...prevLows);
    const prevSwingHigh = Math.max(...prevHighs);

    // Hidden Bullish: price makes Higher Low + volume makes Lower Low
    if (lows[i] > prevSwingLow && volumes[i] < Math.min(...volumes.slice(Math.max(0, i - 5), i))) {
      divergences.push({
        type: "hidden_bullish_divergence",
        barIndex: i,
        time: recent[i].time,
        priceLevel: lows[i],
        note: "Hidden bullish — trend continuation. Price HL + volume LL = accumulation.",
        strength: "moderate",
      });
    }

    // Hidden Bearish: price makes Lower High + volume spike
    if (highs[i] < prevSwingHigh && volumes[i] > Math.max(...volumes.slice(Math.max(0, i - 5), i))) {
      divergences.push({
        type: "hidden_bearish_divergence",
        barIndex: i,
        time: recent[i].time,
        priceLevel: highs[i],
        note: "Hidden bearish — trend continuation. Price LH + volume spike = distribution.",
        strength: "moderate",
      });
    }
  }

  // Deduplicate (keep most recent of each type)
  const unique = {};
  for (const d of divergences) {
    if (!unique[d.type] || d.barIndex > unique[d.type].barIndex) {
      unique[d.type] = d;
    }
  }

  return {
    divergences: Object.values(unique),
    hasBullish: Object.values(unique).some((d) => d.type.includes("bullish")),
    hasBearish: Object.values(unique).some((d) => d.type.includes("bearish")),
  };
}

export function detectMomentumDivergence(bars, period = 14) {
  /**
   * Simple momentum-based divergence using rate of change.
   * When price trends but momentum fades — reversal incoming.
   */
  if (bars.length < period + 10) return { divergence: false };

  const closes = bars.map((b) => b.close);
  const roc = [];
  for (let i = period; i < closes.length; i++) {
    roc.push((closes[i] - closes[i - period]) / closes[i - period]);
  }

  if (roc.length < 5) return { divergence: false };

  const recentRoc = roc.slice(-5);
  const recentPrice = closes.slice(-5);

  // Price rising but ROC declining = bearish divergence
  const priceRising = recentPrice[recentPrice.length - 1] > recentPrice[0];
  const rocDeclining = recentRoc[recentRoc.length - 1] < recentRoc[0];

  // Price falling but ROC rising = bullish divergence
  const priceFalling = recentPrice[recentPrice.length - 1] < recentPrice[0];
  const rocRising = recentRoc[recentRoc.length - 1] > recentRoc[0];

  if (priceRising && rocDeclining) {
    return {
      divergence: true,
      type: "bearish_momentum_divergence",
      note: "Price UP but momentum FADING — watch for reversal DOWN",
      rocCurrent: recentRoc[recentRoc.length - 1].toFixed(4),
    };
  }

  if (priceFalling && rocRising) {
    return {
      divergence: true,
      type: "bullish_momentum_divergence",
      note: "Price DOWN but momentum RECOVERING — watch for reversal UP",
      rocCurrent: recentRoc[recentRoc.length - 1].toFixed(4),
    };
  }

  return { divergence: false };
}
