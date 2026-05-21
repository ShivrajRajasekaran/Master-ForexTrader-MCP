import { z } from "zod";
import { runGates } from "../gates/entry-gates.js";

export function registerSignalTools(server) {
  server.tool(
    "trade_signal",
    "Run the full 7-gate institutional entry system. Returns BUY/SELL/WAIT with checklist of all gates passed/failed. Requires OHLCV bar data.",
    {
      bars: z
        .string()
        .describe("JSON array of OHLCV bars [{time, open, high, low, close, volume}, ...]. Minimum 50 bars."),
      htf_bars: z
        .string()
        .optional()
        .describe("JSON array of higher-timeframe bars for HTF bias. If not provided, Gate 3 uses LTF structure."),
      trades_today: z
        .number()
        .optional()
        .describe("Number of trades already taken today (default 0)"),
      sensitivity: z
        .enum(["conservative", "balanced", "aggressive"])
        .optional()
        .describe("Signal sensitivity: conservative=7/7 gates, balanced=6/7, aggressive=5/7. Default: conservative"),
    },
    async ({ bars: barsJson, htf_bars: htfJson, trades_today = 0, sensitivity = "conservative" }) => {
      try {
        const bars = JSON.parse(barsJson);
        const htfBars = htfJson ? JSON.parse(htfJson) : null;

        if (bars.length < 50) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Need minimum 50 bars for analysis" }) }],
          };
        }

        const result = runGates({
          bars,
          htfBars,
          currentTime: Date.now(),
          tradesToday: trades_today,
          sensitivity,
          currentBarIndex: bars.length - 1,
        });

        // Format gate checklist
        const checklist = result.gates.map((g, i) => {
          const icon = g.passed ? "PASS" : "FAIL";
          return `Gate ${i + 1}: [${icon}] ${g.name} — ${g.detail}`;
        }).join("\n");

        const output = {
          signal: result.signal,
          direction: result.direction,
          gatesPassed: `${result.passed}/${result.total}`,
          sensitivity,
          entry: result.entry?.toFixed(2),
          sl: result.sl?.toFixed(2),
          tp: result.tp?.toFixed(2),
          rr: result.rr,
          confidence: result.confidence,
          checklist,
          reason: result.reason || null,
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
