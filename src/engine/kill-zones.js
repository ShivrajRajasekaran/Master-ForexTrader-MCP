/**
 * Kill Zone Engine
 * Determines if current time is within a tradeable session.
 * Based on ICT Kill Zone framework used by 15+ year master traders.
 */

import { nyDecimalHour } from "./tz.js";

const KILL_ZONES = {
  london: { start: 2, end: 5, label: "London KZ", type: "manipulation" },
  ny_am: { start: 9.5, end: 11, label: "NY AM KZ", type: "distribution" },
  silver_bullet: { start: 10, end: 11, label: "Silver Bullet", type: "sniper" },
  ny_pm_kz: { start: 13.5, end: 15, label: "NY PM KZ", type: "continuation" },
};

const AVOID_ZONES = {
  asian: { start: 20, end: 0, label: "Asian Session", reason: "Mark range only — no entries" },
  pre_london: { start: 0, end: 2, label: "Pre-London", reason: "No liquidity — only accumulation" },
  london_ny_gap: { start: 5, end: 9.5, label: "London-NY Gap", reason: "Transition — wait for NY" },
  ny_lunch: { start: 11, end: 13.5, label: "NY Lunch", reason: "Low volume chop — avoid" },
  ny_close: { start: 15, end: 20, label: "NY Close", reason: "Reversion — not trending" },
};

const SESSION_PIVOTS = {
  asia: { startUTC: 0, endUTC: 6, role: "Builds pivot, mark H/L" },
  london: { startUTC: 6, endUTC: 12, role: "Sweeps Asia H/L, lowest % for daily H/L" },
  new_york: { startUTC: 12, endUTC: 20, role: "Sweeps London H/L, 12:30 key pivot" },
  close: { startUTC: 20, endUTC: 24, role: "Mean reversion into NY range" },
};

/**
 * Session status at a timestamp. Kill-zone hours are New York local time.
 * timezoneOffset: optional fixed UTC offset in hours. Omit it (default) to use the
 * real New York time from Intl, which switches EST/EDT automatically.
 */
export function getCurrentSession(timestampMs = Date.now(), timezoneOffset) {
  const d = new Date(timestampMs);
  const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const estHour = nyDecimalHour(timestampMs, timezoneOffset);

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

/**
 * Kill zones sorted by time until their next start, from New York local time.
 * timezoneOffset: optional fixed UTC offset in hours (default: real NY time via Intl).
 */
export function getNextKillZone(timestampMs = Date.now(), timezoneOffset) {
  const estHour = nyDecimalHour(timestampMs, timezoneOffset);

  const upcoming = [];
  for (const [key, kz] of Object.entries(KILL_ZONES)) {
    let hoursUntil = kz.start - estHour;
    if (hoursUntil < 0) hoursUntil += 24;
    const totalMin = Math.round(hoursUntil * 60);
    upcoming.push({
      ...kz,
      key,
      hoursUntil: hoursUntil.toFixed(1),
      countdown: `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, "0")}m`,
    });
  }

  upcoming.sort((a, b) => parseFloat(a.hoursUntil) - parseFloat(b.hoursUntil));

  return {
    currentEST: estHour.toFixed(2),
    nextKillZone: upcoming[0],
    allUpcoming: upcoming,
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
