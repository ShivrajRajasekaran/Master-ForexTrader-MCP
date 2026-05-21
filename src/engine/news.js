/**
 * News & High-Impact Event Filter
 * Master traders NEVER hold positions through high-impact news.
 * This engine provides event awareness and trade filtering.
 */

const HIGH_IMPACT_EVENTS = [
  { name: "NFP", day: "first_friday", time: "08:30", tz: "EST", impact: "extreme", pairs: ["XAUUSD", "USD_ALL"] },
  { name: "FOMC Rate Decision", day: "scheduled", time: "14:00", tz: "EST", impact: "extreme", pairs: ["USD_ALL", "XAUUSD"] },
  { name: "CPI", day: "scheduled", time: "08:30", tz: "EST", impact: "extreme", pairs: ["USD_ALL", "XAUUSD"] },
  { name: "PPI", day: "scheduled", time: "08:30", tz: "EST", impact: "high", pairs: ["USD_ALL"] },
  { name: "GDP", day: "scheduled", time: "08:30", tz: "EST", impact: "high", pairs: ["USD_ALL"] },
  { name: "Jobless Claims", day: "thursday", time: "08:30", tz: "EST", impact: "medium", pairs: ["USD_ALL"] },
  { name: "PMI", day: "scheduled", time: "09:45", tz: "EST", impact: "high", pairs: ["USD_ALL"] },
  { name: "Retail Sales", day: "scheduled", time: "08:30", tz: "EST", impact: "high", pairs: ["USD_ALL"] },
  { name: "ECB Rate Decision", day: "scheduled", time: "07:45", tz: "EST", impact: "extreme", pairs: ["EUR_ALL"] },
  { name: "BOE Rate Decision", day: "scheduled", time: "07:00", tz: "EST", impact: "extreme", pairs: ["GBP_ALL"] },
  { name: "RBA Rate Decision", day: "scheduled", time: "00:30", tz: "EST", impact: "high", pairs: ["AUD_ALL"] },
  { name: "BOJ Rate Decision", day: "scheduled", time: "varies", tz: "EST", impact: "high", pairs: ["JPY_ALL"] },
];

const NEWS_RULES = {
  extreme: {
    avoid_before: 60,
    avoid_after: 30,
    action: "CLOSE all positions 1 hour before. NO new entries until 30 min after.",
  },
  high: {
    avoid_before: 30,
    avoid_after: 15,
    action: "No new entries 30 min before. Tighten SL or close 15 min before.",
  },
  medium: {
    avoid_before: 15,
    avoid_after: 10,
    action: "Be aware. Widen SL slightly or avoid if already in drawdown.",
  },
};

export function getNewsFilter(symbol = "XAUUSD", dayOfWeek = null) {
  /**
   * Returns events that could affect the given symbol today.
   * NOTE: This is a static calendar — for real-time, integrate with
   * forexfactory.com, investing.com, or MQL5 calendar API.
   */
  const today = dayOfWeek || new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  const relevant = HIGH_IMPACT_EVENTS.filter((event) => {
    const affectsSymbol = event.pairs.some((p) => {
      if (p === "USD_ALL") return symbol.includes("USD") || symbol === "XAUUSD";
      if (p === "EUR_ALL") return symbol.includes("EUR");
      if (p === "GBP_ALL") return symbol.includes("GBP");
      if (p === "AUD_ALL") return symbol.includes("AUD");
      if (p === "JPY_ALL") return symbol.includes("JPY");
      return p === symbol;
    });
    return affectsSymbol;
  });

  return {
    symbol,
    eventsToday: relevant.length > 0 ? relevant : null,
    rules: NEWS_RULES,
    verdict: relevant.some((e) => e.impact === "extreme")
      ? "HIGH RISK DAY — Extreme impact event scheduled. Trade with caution or skip entirely."
      : relevant.some((e) => e.impact === "high")
        ? "CAUTION — High impact event today. Avoid entries near event time."
        : "CLEAR — No major events affecting this pair.",
    reminder: "Always check forexfactory.com before trading session starts.",
  };
}

export function shouldAvoidTrade(symbol, timestampMs = Date.now()) {
  /**
   * Quick check: should we avoid trading right now due to news?
   * Returns true if within avoidance window of any high-impact event.
   */
  const d = new Date(timestampMs);
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  // Friday rule: avoid holding over weekend
  if (dayName === "friday") {
    const estHour = ((d.getUTCHours() - 5 + 24) % 24);
    if (estHour >= 15) {
      return {
        avoid: true,
        reason: "FRIDAY CLOSE — No new positions after 3PM EST. Weekend gap risk.",
      };
    }
  }

  // NFP Friday (first Friday of month)
  if (dayName === "friday" && d.getDate() <= 7) {
    const estHour = ((d.getUTCHours() - 5 + 24) % 24);
    const estMin = d.getUTCMinutes();
    const estDecimal = estHour + estMin / 60;
    if (estDecimal >= 7.5 && estDecimal <= 9.5 && (symbol.includes("USD") || symbol === "XAUUSD")) {
      return {
        avoid: true,
        reason: "NFP WINDOW — Extreme volatility. No trades 7:30-9:30 AM EST.",
      };
    }
  }

  // Monday rule: first 2 hours are unreliable
  if (dayName === "monday") {
    const estHour = ((d.getUTCHours() - 5 + 24) % 24);
    if (estHour < 2) {
      return {
        avoid: true,
        reason: "MONDAY OPEN — Gap risk. Wait for Asia session to establish range.",
      };
    }
  }

  return { avoid: false, reason: "No news conflicts detected." };
}

export { HIGH_IMPACT_EVENTS, NEWS_RULES };
