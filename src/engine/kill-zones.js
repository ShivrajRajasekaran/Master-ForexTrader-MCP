/**
 * Kill Zone Engine
 * Determines if current time is within a tradeable session.
 * Based on ICT Kill Zone framework used by 15+ year master traders.
 */

const KILL_ZONES = {
  london: { start: 2, end: 5, label: "London KZ", type: "manipulation" },
  ny_am: { start: 9.5, end: 11, label: "NY AM KZ", type: "distribution" },
  silver_bullet: { start: 10, end: 11, label: "Silver Bullet", type: "backup" },
};

const AVOID_ZONES = {
  asian: { start: 20, end: 2, label: "Asian", reason: "Mark range only" },
  dead: { start: 0, end: 3, label: "Dead Zone", reason: "No liquidity" },
  ny_lunch: { start: 12, end: 13, label: "NY Lunch", reason: "Low volume chop" },
  ny_pm: { start: 13, end: 16, label: "NY PM", reason: "Low volume" },
};

const SESSION_PIVOTS = {
  asia: { startUTC: 0, endUTC: 6, role: "Builds pivot, mark H/L" },
  london: { startUTC: 6, endUTC: 12, role: "Sweeps Asia H/L, lowest % for daily H/L" },
  new_york: { startUTC: 12, endUTC: 20, role: "Sweeps London H/L, 12:30 key pivot" },
  close: { startUTC: 20, endUTC: 24, role: "Mean reversion into NY range" },
};

export function getCurrentSession(timestampMs = Date.now(), timezoneOffset = -5) {
  const d = new Date(timestampMs);
  const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const estHour = ((utcHour + timezoneOffset + 24) % 24);

  let activeKZ = null;
  let inAvoidZone = null;
  let sessionPivot = null;

  for (const [key, kz] of Object.entries(KILL_ZONES)) {
    if (estHour >= kz.start && estHour < kz.end) {
      activeKZ = { key, ...kz };
      break;
    }
  }

  for (const [key, az] of Object.entries(AVOID_ZONES)) {
    if (az.start > az.end) {
      if (estHour >= az.start || estHour < az.end) {
        inAvoidZone = { key, ...az };
        break;
      }
    } else {
      if (estHour >= az.start && estHour < az.end) {
        inAvoidZone = { key, ...az };
        break;
      }
    }
  }

  for (const [key, sp] of Object.entries(SESSION_PIVOTS)) {
    if (utcHour >= sp.startUTC && utcHour < sp.endUTC) {
      sessionPivot = { key, ...sp };
      break;
    }
  }

  return {
    timestamp: timestampMs,
    estHour: estHour.toFixed(2),
    utcHour: utcHour.toFixed(2),
    activeKillZone: activeKZ,
    avoidZone: inAvoidZone,
    sessionPivot,
    canTrade: activeKZ !== null && inAvoidZone === null,
    reason: activeKZ
      ? `Inside ${activeKZ.label} (${activeKZ.type})`
      : inAvoidZone
        ? `AVOID: ${inAvoidZone.label} — ${inAvoidZone.reason}`
        : "Off-session — WAIT",
  };
}

export function getSessionRange(bars, sessionStart, sessionEnd) {
  const sessionBars = bars.filter((b) => {
    const h = new Date(b.time * 1000).getUTCHours();
    return h >= sessionStart && h < sessionEnd;
  });

  if (sessionBars.length === 0) return null;

  const high = Math.max(...sessionBars.map((b) => b.high));
  const low = Math.min(...sessionBars.map((b) => b.low));

  return { high, low, bars: sessionBars.length };
}

export { KILL_ZONES, AVOID_ZONES, SESSION_PIVOTS };
