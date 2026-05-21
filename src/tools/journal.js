import { z } from "zod";
import { logTrade, closeTrade, getJournalStats, getTodayTrades, getOpenTrades } from "../engine/persistent-journal.js";

export function registerJournalTools(server) {
  server.tool(
    "trade_journal_log",
    "Log a trade entry to the persistent journal (survives restarts). Records entry, SL, TP, direction, pair, gates passed, and notes.",
    {
      symbol: z.string().describe("Trading pair (e.g., XAUUSD, EURUSD)"),
      direction: z.enum(["long", "short"]).describe("Trade direction"),
      entry: z.number().describe("Entry price"),
      sl: z.number().describe("Stop loss price"),
      tp: z.number().describe("Take profit price"),
      lot_size: z.number().optional().describe("Position size in lots"),
      checklist_score: z.number().optional().describe("Checklist score (out of 10)"),
      gates_passed: z.number().optional().describe("Number of gates passed (out of 7)"),
      setup_type: z.string().optional().describe("Setup type (e.g., 'OB retest', 'FVG fill', 'Silver Bullet')"),
      kill_zone: z.string().optional().describe("Kill zone (London/NY AM/Silver Bullet/NY PM)"),
      notes: z.string().optional().describe("Additional notes about the trade"),
    },
    async ({ symbol, direction, entry, sl, tp, lot_size = 0.01, checklist_score, gates_passed, setup_type, kill_zone, notes }) => {
      const trade = logTrade({
        symbol,
        direction,
        entry,
        sl,
        tp,
        lotSize: lot_size,
        checklistScore: checklist_score,
        gatesPassed: gates_passed,
        setupType: setup_type,
        killZone: kill_zone,
        notes,
      });

      const todayTrades = getTodayTrades();
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp - entry);
      const rr = risk > 0 ? (reward / risk).toFixed(1) : "N/A";

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            logged: true,
            trade: { ...trade, rr },
            todayCount: todayTrades.length,
            warning: todayTrades.length >= 3 ? "MAX TRADES REACHED — STOP TRADING TODAY" : null,
            persistence: "Saved to trade_journal.json — survives restarts",
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "trade_journal_close",
    "Close a logged trade with result (win/loss/breakeven). Updates persistent journal.",
    {
      trade_id: z.number().describe("Trade ID from journal log"),
      exit_price: z.number().describe("Exit price"),
      result: z.enum(["win", "loss", "breakeven"]).describe("Trade outcome"),
      pnl: z.number().optional().describe("P&L in dollars"),
      notes: z.string().optional().describe("Post-trade notes / lessons"),
    },
    async ({ trade_id, exit_price, result, pnl, notes }) => {
      const trade = closeTrade(trade_id, exit_price, result, pnl, notes);

      if (trade.error) {
        return { content: [{ type: "text", text: JSON.stringify(trade) }] };
      }

      const stats = getJournalStats();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            closed: true,
            trade,
            sessionStats: stats,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "trade_journal_stats",
    "Get full trading statistics — win rate, P&L, streak, best sessions, edge analysis. Reads from persistent journal.",
    {},
    async () => {
      const stats = getJournalStats();
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }
  );

  server.tool(
    "trade_journal_open",
    "Get all currently open trades from the journal.",
    {},
    async () => {
      const open = getOpenTrades();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            openTrades: open,
            count: open.length,
            rule: open.length >= 3 ? "MAX 3 OPEN — close one before opening another" : `${3 - open.length} slots available`,
          }, null, 2),
        }],
      };
    }
  );
}
