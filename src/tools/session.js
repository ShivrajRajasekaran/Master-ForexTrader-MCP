import { z } from "zod";
import { getCurrentSession, KILL_ZONES, SESSION_PIVOTS } from "../engine/kill-zones.js";

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

      const d = new Date(now);
      const utc = d.toISOString();
      const estHour = ((d.getUTCHours() - 5 + 24) % 24);
      const istHour = d.getUTCHours() + 5.5;

      const result = {
        ...session,
        time: {
          utc,
          est: `${Math.floor(estHour)}:${String(Math.round((estHour % 1) * 60)).padStart(2, "0")} EST`,
          ist: timezone_offset_ist
            ? `${Math.floor(istHour % 24)}:${String(Math.round((istHour % 1) * 60)).padStart(2, "0")} IST`
            : undefined,
        },
        killZones: KILL_ZONES,
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
      const now = new Date();
      const estHour = ((now.getUTCHours() - 5 + 24) % 24) + now.getUTCMinutes() / 60;

      const upcoming = [];
      for (const [key, kz] of Object.entries(KILL_ZONES)) {
        let hoursUntil = kz.start - estHour;
        if (hoursUntil < 0) hoursUntil += 24;
        upcoming.push({ ...kz, key, hoursUntil: hoursUntil.toFixed(1) });
      }

      upcoming.sort((a, b) => parseFloat(a.hoursUntil) - parseFloat(b.hoursUntil));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            currentEST: estHour.toFixed(2),
            nextKillZone: upcoming[0],
            allUpcoming: upcoming,
          }, null, 2),
        }],
      };
    }
  );
}
