/**
 * Time-zone helpers.
 * All session logic is anchored to New York local time. Always derive it with
 * Intl (IANA zones), never a fixed UTC offset: New York is UTC-5 in winter (EST)
 * and UTC-4 in summer (EDT), and a fixed -5 is one hour wrong for ~8 months a year.
 * Pure functions — no I/O.
 */

export const NEW_YORK = "America/New_York";
export const LONDON = "Europe/London";
export const KOLKATA = "Asia/Kolkata";

const formatterCache = new Map();

function getFormatter(timeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      timeZoneName: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/**
 * Wall-clock parts of a UTC timestamp in an IANA time zone.
 * @returns {{year:number, month:number, day:number, hour:number, minute:number,
 *            second:number, weekday:string, zoneName:string, decimalHour:number}}
 */
export function zonedParts(timestampMs, timeZone) {
  const parts = {};
  for (const p of getFormatter(timeZone).formatToParts(new Date(timestampMs))) {
    parts[p.type] = p.value;
  }
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
    second,
    weekday: parts.weekday.toLowerCase(),
    zoneName: parts.timeZoneName,
    decimalHour: hour + minute / 60 + second / 3600,
  };
}

/** New York wall-clock parts (EST or EDT, chosen by Intl). */
export function nyParts(timestampMs = Date.now()) {
  return zonedParts(timestampMs, NEW_YORK);
}

/**
 * New York decimal hour (0–24). If an explicit numeric UTC offset is given it is
 * used instead (kept for callers/tests that need a fixed offset).
 */
export function nyDecimalHour(timestampMs = Date.now(), fixedOffsetHours) {
  if (typeof fixedOffsetHours === "number") {
    const d = new Date(timestampMs);
    const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    return (utcHour + fixedOffsetHours + 24) % 24;
  }
  return nyParts(timestampMs).decimalHour;
}

/** "HH:MM" wall-clock time in a zone. */
export function formatHHMM(timestampMs, timeZone) {
  const p = zonedParts(timestampMs, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Clock readout for the session tools: UTC ISO, New York, London and IST, with minutes. */
export function sessionClock(timestampMs = Date.now()) {
  const ny = nyParts(timestampMs);
  const ldn = zonedParts(timestampMs, LONDON);
  return {
    utc: new Date(timestampMs).toISOString(),
    est: `${formatHHMM(timestampMs, NEW_YORK)} ${ny.zoneName}`,
    newYorkZone: ny.zoneName,
    newYorkDay: ny.weekday,
    london: `${formatHHMM(timestampMs, LONDON)} ${ldn.zoneName}`,
    ist: `${formatHHMM(timestampMs, KOLKATA)} IST`,
  };
}
