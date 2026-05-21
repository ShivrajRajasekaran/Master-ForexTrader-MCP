/**
 * Order Flow Engine
 * Delta, cumulative delta, bid/ask imbalance, absorption, footprint analysis.
 * Approximates order flow from OHLCV when tick data isn't available.
 */

export function estimateDelta(bars) {
  return bars.map((bar, i) => {
    const range = bar.high - bar.low;
    if (range === 0) return { index: i, delta: 0, buyVolume: 0, sellVolume: 0 };

    const closePosition = (bar.close - bar.low) / range;
    const vol = bar.volume || 1;
    const buyVolume = vol * closePosition;
    const sellVolume = vol * (1 - closePosition);

    return {
      index: i,
      delta: buyVolume - sellVolume,
      buyVolume,
      sellVolume,
      ratio: sellVolume > 0 ? (buyVolume / sellVolume).toFixed(2) : "Inf",
    };
  });
}

export function cumulativeDelta(bars) {
  const deltas = estimateDelta(bars);
  let cumDelta = 0;
  return deltas.map((d) => {
    cumDelta += d.delta;
    return { ...d, cumulativeDelta: cumDelta };
  });
}

export function detectDeltaDivergence(bars, lookback = 20) {
  if (bars.length < lookback) return { divergence: false };

  const recent = bars.slice(-lookback);
  const deltas = cumulativeDelta(recent);

  const priceRising = recent[recent.length - 1].close > recent[0].close;
  const deltaRising = deltas[deltas.length - 1].cumulativeDelta > deltas[0].cumulativeDelta;

  if (priceRising && !deltaRising) {
    return { divergence: true, type: "bearish", detail: "Price rising but delta falling — sellers absorbing" };
  }
  if (!priceRising && deltaRising) {
    return { divergence: true, type: "bullish", detail: "Price falling but delta rising — buyers accumulating" };
  }

  return { divergence: false, type: "none", detail: "Price and delta aligned" };
}

export function detectImbalance(bars, threshold = 3) {
  const deltas = estimateDelta(bars);
  const imbalances = [];

  for (const d of deltas) {
    const ratio = d.sellVolume > 0 ? d.buyVolume / d.sellVolume : 10;
    const invRatio = d.buyVolume > 0 ? d.sellVolume / d.buyVolume : 10;

    if (ratio >= threshold) {
      imbalances.push({ index: d.index, type: "buy_imbalance", ratio: ratio.toFixed(1), detail: "Aggressive buyers dominating" });
    } else if (invRatio >= threshold) {
      imbalances.push({ index: d.index, type: "sell_imbalance", ratio: invRatio.toFixed(1), detail: "Aggressive sellers dominating" });
    }
  }

  return imbalances;
}

export function detectAbsorption(bars, lookback = 10) {
  if (bars.length < lookback) return { absorbed: false };

  const recent = bars.slice(-lookback);
  const avgVolume = recent.reduce((s, b) => s + (b.volume || 1), 0) / lookback;
  const lastBar = recent[recent.length - 1];
  const lastDelta = estimateDelta([lastBar])[0];

  const highVolume = (lastBar.volume || 1) > avgVolume * 1.5;
  const smallBody = Math.abs(lastBar.close - lastBar.open) < (lastBar.high - lastBar.low) * 0.3;

  if (highVolume && smallBody) {
    const absorptionType = lastDelta.delta > 0 ? "sell_absorption" : "buy_absorption";
    return {
      absorbed: true,
      type: absorptionType,
      detail: absorptionType === "sell_absorption"
        ? "High volume + small body + buy delta — sellers being absorbed (bullish)"
        : "High volume + small body + sell delta — buyers being absorbed (bearish)",
      volume: lastBar.volume,
      avgVolume: avgVolume.toFixed(0),
    };
  }

  return { absorbed: false, detail: "No absorption detected" };
}

export function detectExhaustionVolume(bars, lookback = 20) {
  if (bars.length < lookback) return { exhaustion: false };

  const recent = bars.slice(-lookback);
  const avgVol = recent.reduce((s, b) => s + (b.volume || 1), 0) / lookback;
  const lastBar = recent[recent.length - 1];
  const prevBar = recent[recent.length - 2];

  const spikeVolume = (lastBar.volume || 1) > avgVol * 2.5;
  const trendUp = lastBar.close > recent[0].close;
  const trendDown = lastBar.close < recent[0].close;

  if (spikeVolume) {
    if (trendUp && lastBar.close < lastBar.open) {
      return { exhaustion: true, type: "bullish_exhaustion", detail: "Spike volume + bearish close at top — buyers exhausted, reversal likely" };
    }
    if (trendDown && lastBar.close > lastBar.open) {
      return { exhaustion: true, type: "bearish_exhaustion", detail: "Spike volume + bullish close at bottom — sellers exhausted, reversal likely" };
    }
  }

  return { exhaustion: false, detail: "No exhaustion signal" };
}

export function getOrderFlowAnalysis(bars, lookback = 20) {
  if (bars.length < lookback) return { error: "Need more bars for order flow analysis" };

  const deltas = cumulativeDelta(bars.slice(-lookback));
  const lastDelta = deltas[deltas.length - 1];
  const divergence = detectDeltaDivergence(bars, lookback);
  const imbalances = detectImbalance(bars.slice(-5));
  const absorption = detectAbsorption(bars, lookback);
  const exhaustion = detectExhaustionVolume(bars, lookback);

  const recentImbalance = imbalances.length > 0 ? imbalances[imbalances.length - 1] : null;

  let bias = "neutral";
  let confidence = 0;

  if (lastDelta.cumulativeDelta > 0) { bias = "bullish"; confidence += 25; }
  else { bias = "bearish"; confidence += 25; }

  if (divergence.divergence) confidence += 30;
  if (absorption.absorbed) confidence += 25;
  if (recentImbalance) confidence += 20;

  return {
    delta: lastDelta.delta.toFixed(0),
    cumulativeDelta: lastDelta.cumulativeDelta.toFixed(0),
    bias,
    confidence: Math.min(confidence, 100),
    divergence,
    absorption,
    exhaustion,
    recentImbalance,
    summary: divergence.divergence
      ? `ORDER FLOW ${divergence.type.toUpperCase()} DIVERGENCE — ${divergence.detail}`
      : absorption.absorbed
        ? `ABSORPTION — ${absorption.detail}`
        : exhaustion.exhaustion
          ? `EXHAUSTION — ${exhaustion.detail}`
          : `Order flow ${bias} — cumulative delta ${lastDelta.cumulativeDelta > 0 ? "positive" : "negative"}`,
  };
}
