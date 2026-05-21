/**
 * Mitigation Tracking Engine
 * Tracks OB/FVG lifecycle: FRESH → TESTED → MITIGATED → BROKEN
 * A master trader only enters at FRESH zones — never at used ones.
 */

export function classifyZoneStatus(zone, bars) {
  /**
   * FRESH: Price hasn't returned to zone since creation
   * TESTED: Price wicked into zone once but held (still valid for entry)
   * MITIGATED: Price fully closed inside zone (50% fill — weakened)
   * BROKEN: Price closed through zone completely (invalid — becomes breaker)
   */
  const afterBars = bars.filter((b) => b.time > zone.timeEnd);
  if (afterBars.length === 0) return "FRESH";

  let touches = 0;
  let closedInside = false;
  let closedThrough = false;

  for (const bar of afterBars) {
    const barInZone = bar.low <= zone.top && bar.high >= zone.bottom;
    const closeInZone = bar.close >= zone.bottom && bar.close <= zone.top;
    const midpoint = (zone.top + zone.bottom) / 2;

    if (barInZone) touches++;

    if (closeInZone) {
      closedInside = true;
    }

    // Broken: close through the other side
    if (zone.side === "bull" && bar.close < zone.bottom) {
      closedThrough = true;
      break;
    }
    if (zone.side === "bear" && bar.close > zone.top) {
      closedThrough = true;
      break;
    }
  }

  if (closedThrough) return "BROKEN";
  if (closedInside) return "MITIGATED";
  if (touches > 0) return "TESTED";
  return "FRESH";
}

export function filterFreshZones(zones, bars) {
  return zones
    .map((zone) => ({
      ...zone,
      status: classifyZoneStatus(zone, bars),
    }))
    .filter((z) => z.status === "FRESH" || z.status === "TESTED");
}

export function trackMitigation(obs, fvgs, bars) {
  const bullOBs = (obs.bullOBs || []).map((ob) => ({ ...ob, zoneType: "OB", side: "bull" }));
  const bearOBs = (obs.bearOBs || []).map((ob) => ({ ...ob, zoneType: "OB", side: "bear" }));
  const bullFVGs = (fvgs.bullFVGs || []).map((f) => ({ ...f, zoneType: "FVG", side: "bull", timeEnd: f.time }));
  const bearFVGs = (fvgs.bearFVGs || []).map((f) => ({ ...f, zoneType: "FVG", side: "bear", timeEnd: f.time }));

  const allZones = [...bullOBs, ...bearOBs, ...bullFVGs, ...bearFVGs];

  const classified = allZones.map((zone) => ({
    ...zone,
    status: classifyZoneStatus(zone, bars),
  }));

  return {
    fresh: classified.filter((z) => z.status === "FRESH"),
    tested: classified.filter((z) => z.status === "TESTED"),
    mitigated: classified.filter((z) => z.status === "MITIGATED"),
    broken: classified.filter((z) => z.status === "BROKEN"),
    summary: {
      total: classified.length,
      tradeable: classified.filter((z) => z.status === "FRESH" || z.status === "TESTED").length,
      note: "Only trade FRESH or TESTED zones. Mitigated = weak. Broken = invalid.",
    },
  };
}
