import { z } from "zod";
import { getCurrentSession, getNextKillZone, KILL_ZONES, SESSION_PIVOTS } from "../engine/kill-zones.js";
import { getQuarterlyPhase, getMacroWindow, isSilverBulletWindow, getOptimalEntryTiming } from "../engine/time.js";
import { sessionClock } from "../engine/tz.js";

export function registerSessionTools(server) {
  server.tool(
    "trade_session_check",
    "Check if current time is inside a Kill Zone. Returns session status, IST/EST/UTC time, and whether trading is allowed. Call this FIRST before any analysis.",
    {
      timezone_offset_ist: z
        .boolean()
        .optional()
        .describe("If true, also show IST time (default true for Indian traders)"),
    },
    async ({ timezone_offset_ist = true } = {}) => {
      const now = Date.now();
      const session = getCurrentSession(now);

      const clock = sessionClock(now);

      const timing = getOptimalEntryTiming(now);
      const macro = getMacroWindow(now);

      const result = {
        ...session,
        time: {
          utc: clock.utc,
          est: clock.est,
          newYorkZone: clock.newYorkZone,
          london: clock.london,
          ist: timezone_offset_ist ? clock.ist : undefined,
        },
        killZones: KILL_ZONES,
        timing: {
          quarterly: timing.quarterly.quarter,
          macro: macro.inMacro ? macro.activeMacro.note : macro.nextMacro ? `Next: ${macro.nextMacro.start} ${clock.newYorkZone}` : "None",
          silverBullet: timing.silverBullet.inWindow,
          score: `${timing.score}/3`,
          recommendation: timing.recommendation,
        },
        verdict: session.canTrade
          ? `GO — Inside ${session.activeKillZone.label}. Trading ALLOWED.`
          : `NO TRADE — ${session.reason}. Wait for next Kill Zone.`,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "trade_next_killzone",
    "Get the next upcoming Kill Zone time from current moment.",
    {},
    async () => {
      return {
        content: [{
          type: "text",
          text: JSON.stringify(getNextKillZone(Date.now()), null, 2),
        }],
      };
    }
  );
}
