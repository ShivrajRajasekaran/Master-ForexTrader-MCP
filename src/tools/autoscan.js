import { z } from "zod";
import { getCurrentSession } from "../engine/kill-zones.js";
import { shouldAlert, formatAlertMessage } from "../engine/alerts.js";

export function registerAutoScanTools(server) {
  server.tool(
    "trade_auto_scan",
    "Auto-scan watchlist pairs using provided bar data. Runs 10-point checklist on each. Returns ranked opportunities. DOES NOT TRADE — only identifies setups for YOU to decide.",
    {
      pairs: z.string().describe("JSON object: { 'XAUUSD': { bars: [...], htf_bars: [...] }, 'EURUSD': {...} }"),
      min_score: z.number().optional().describe("Minimum checklist score to include (default 6)"),
    },
    async ({ pairs: pairsJson, min_score = 6 }) => {
      try {
        const session = getCurrentSession();
        if (!session.canTrade) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                scan: "SKIPPED",
                reason: `Not in Kill Zone — ${session.reason}`,
                nextAction: "Wait for next Kill Zone. Use trade_next_killzone for countdown.",
                rule: "NEVER scan outside Kill Zones — no valid entries exist.",
              }, null, 2),
            }],
          };
        }

        const pairsData = JSON.parse(pairsJson);
        const results = [];

        for (const [symbol, data] of Object.entries(pairsData)) {
          if (!data.bars || data.bars.length < 50) {
            results.push({ symbol, error: "Need 50+ bars", score: 0 });
            continue;
          }

          const { runChecklist } = await import("./checklist-runner.js");
          const checkResult = runChecklist(data.bars, data.htf_bars, data.itf_bars, data.dxy_bars, symbol, data.daily_bars);
          results.push({ symbol, ...checkResult });
        }

        results.sort((a, b) => (b.scoreNum || 0) - (a.scoreNum || 0));
        const qualified = results.filter((r) => (r.scoreNum || 0) >= min_score);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              session: session.reason,
              scanned: results.length,
              qualified: qualified.length,
              results: qualified.length > 0 ? qualified : results.slice(0, 3),
              topPick: qualified[0] || null,
              rule: "These are OPPORTUNITIES only. YOU decide whether to trade. No auto-execution.",
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_watchlist_status",
    "Quick status check: Are we in Kill Zone? How many open trades? Daily limit hit? Use this before scanning.",
    {},
    async () => {
      const session = getCurrentSession();
      const { getOpenTrades, getTodayTrades } = await import("../engine/persistent-journal.js");
      const open = getOpenTrades();
      const today = getTodayTrades();

      const status = {
        killZone: session.canTrade,
        session: session.reason,
        openTrades: open.length,
        todayTrades: today.length,
        canTrade: session.canTrade && today.length < 3,
        blockers: [],
      };

      if (!session.canTrade) status.blockers.push("Outside Kill Zone");
      if (today.length >= 3) status.blockers.push("Daily trade limit reached (3/3)");
      if (open.length >= 3) status.blockers.push("Max open trades reached");

      if (status.blockers.length === 0 && session.canTrade) {
        status.verdict = "READY TO SCAN — Kill Zone active, limits clear";
      } else {
        status.verdict = `WAIT — ${status.blockers.join(", ")}`;
      }

      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );
}
