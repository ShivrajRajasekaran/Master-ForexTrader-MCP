/**
 * Time Engine
 * Quarterly Theory, Macro Time Windows, Silver Bullet, Power of 3.
 * Master traders know WHEN price moves — time > price.
 *
 * All windows are New York local time. Every function takes an optional
 * `timezoneOffset` (fixed UTC offset in hours); omit it to use real New York
 * time from Intl, which switches EST/EDT automatically.
 */

import { nyDecimalHour } from "./tz.js";

export const QUARTERLY_THEORY = {
  q1: { start: 0, end: 15, phase: "Accumulation", note: "First 15 min of hour — range builds" },
  q2: { start: 15, end: 30, phase: "Manipulation", note: "15-30 min — fake move / sweep" },
  q3: { start: 30, end: 45, phase: "Distribution", note: "30-45 min — REAL move begins" },
  q4: { start: 45, end: 60, phase: "Continuation/Reversal", note: "45-60 min — continuation or profit-taking" },
};

export const MACRO_WINDOWS = [
  { start: "02:33", end: "03:00", session: "London", note: "London macro — first expansion" },
  { start: "04:03", end: "04:30", session: "London", note: "London macro 2 — second push" },
  { start: "08:50", end: "09:10", session: "NY Pre", note: "Pre-NY macro — setup builds" },
  { start: "09:50", end: "10:10", session: "NY", note: "NY Open macro — KEY window" },
  { start: "10:50", end: "11:10", session: "NY", note: "Silver Bullet macro — sniper entry" },
  { start: "13:50", end: "14:10", session: "NY PM", note: "PM macro — late session" },
];

export const SILVER_BULLET = {
  window: { start: 10, end: 11, tz: "EST" },
  rules: [
    "Only valid during NY session (10-11 AM EST)",
    "Wait for FVG to form within this window",
    "Enter at FVG midpoint with SL below FVG",
    "TP at next liquidity level (EQH/EQL, PDH/PDL)",
    "Only ONE Silver Bullet per day",
  ],
  description: "ICT Silver Bullet — single high-probability entry within a 1-hour window",
};

export const POWER_OF_3 = {
  description: "London open AMD within first 30 minutes. Asia H/L = manipulation targets.",
  phases: {
    accumulation: "00:00-02:00 EST — Asia range forms",
    manipulation: "02:00-05:00 EST — London sweeps Asia H or L",
    distribution: "05:00-12:00 EST — Real move from London sweep to NY target",
  },
};

export function getQuarterlyPhase(timestampMs = Date.now(), timezoneOffset) {
  // Quarters depend only on the minute of the hour, which is the same in UTC and
  // New York (whole-hour offsets), so no zone conversion is needed here.
  const d = new Date(timestampMs);
  const utcMin = d.getUTCMinutes();

  let quarter;
  if (utcMin < 15) quarter = QUARTERLY_THEORY.q1;
  else if (utcMin < 30) quarter = QUARTERLY_THEORY.q2;
  else if (utcMin < 45) quarter = QUARTERLY_THEORY.q3;
  else quarter = QUARTERLY_THEORY.q4;

  return {
    minute: utcMin,
    quarter: quarter.phase,
    note: quarter.note,
    tradeable: quarter.phase === "Distribution" || quarter.phase === "Continuation/Reversal",
    bestEntry: quarter.phase === "Distribution",
  };
}

export function getMacroWindow(timestampMs = Date.now(), timezoneOffset) {
  const nyHour = nyDecimalHour(timestampMs, timezoneOffset);
  const estHour = Math.floor(nyHour);
  const estMin = Math.floor((nyHour - estHour) * 60 + 1e-9);
  const estTimeStr = `${String(estHour).padStart(2, "0")}:${String(estMin).padStart(2, "0")}`;

  let activeMacro = null;
  let nextMacro = null;

  for (const macro of MACRO_WINDOWS) {
    if (estTimeStr >= macro.start && estTimeStr < macro.end) {
      activeMacro = macro;
      break;
    }
    if (!nextMacro && estTimeStr < macro.start) {
      nextMacro = macro;
    }
  }

  return {
    currentTime: estTimeStr + " EST",
    activeMacro,
    nextMacro,
    inMacro: activeMacro !== null,
    action: activeMacro
      ? `INSIDE MACRO WINDOW (${activeMacro.session}) — ${activeMacro.note}. High-probability move expected.`
      : nextMacro
        ? `Next macro at ${nextMacro.start} EST (${nextMacro.session}) — ${nextMacro.note}`
        : "No upcoming macro windows today.",
  };
}

export function isSilverBulletWindow(timestampMs = Date.now(), timezoneOffset) {
  const estHour = nyDecimalHour(timestampMs, timezoneOffset);

  const inWindow = estHour >= SILVER_BULLET.window.start && estHour < SILVER_BULLET.window.end;

  return {
    inWindow,
    rules: inWindow ? SILVER_BULLET.rules : null,
    action: inWindow
      ? "SILVER BULLET ACTIVE — Look for FVG formation. ONE shot only."
      : `Silver Bullet window: ${SILVER_BULLET.window.start}-${SILVER_BULLET.window.end} AM EST`,
  };
}

export function getOptimalEntryTiming(timestampMs = Date.now(), timezoneOffset) {
  const quarterly = getQuarterlyPhase(timestampMs, timezoneOffset);
  const macro = getMacroWindow(timestampMs, timezoneOffset);
  const silverBullet = isSilverBulletWindow(timestampMs, timezoneOffset);

  const score = (quarterly.bestEntry ? 1 : 0) + (macro.inMacro ? 1 : 0) + (silverBullet.inWindow ? 1 : 0);

  let timing;
  if (score >= 2) timing = "OPTIMAL — Multiple time confluences aligned";
  else if (score === 1) timing = "GOOD — One time factor aligned";
  else timing = "POOR — No time confluence. Wait.";

  return {
    score,
    timing,
    quarterly,
    macro,
    silverBullet,
    recommendation: score >= 2
      ? "ENTER NOW if other gates pass — time is aligned."
      : score === 1
        ? "Acceptable timing — proceed if setup is A+."
        : "WAIT for better timing window.",
  };
}
