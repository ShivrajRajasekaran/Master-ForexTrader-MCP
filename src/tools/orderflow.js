import { z } from "zod";
import { getVWAPAnalysis, vwapConfluence } from "../engine/vwap.js";
import { getOrderFlowAnalysis } from "../engine/orderflow.js";
import { detectSwings } from "../engine/structure.js";

export function registerOrderFlowTools(server) {
  server.tool(
    "trade_orderflow",
    "Full order flow analysis — delta, cumulative delta, imbalance, absorption, exhaustion. Shows who is in control (buyers vs sellers).",
    {
      bars: z.string().describe("JSON array of OHLCV bars (20+ bars, volume required for accuracy)"),
    },
    async ({ bars: barsJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        if (bars.length < 20) return { content: [{ type: "text", text: JSON.stringify({ error: "Need 20+ bars" }) }] };

        const analysis = getOrderFlowAnalysis(bars);

        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_vwap",
    "Anchored VWAP analysis — session VWAP, bands, price position, and confluence with swing anchors. Institutional dynamic S/R.",
    {
      bars: z.string().describe("JSON array of OHLCV bars (include full session for accurate VWAP)"),
      anchor_swing_high: z.number().optional().describe("Bar index of swing high to anchor VWAP from"),
      anchor_swing_low: z.number().optional().describe("Bar index of swing low to anchor VWAP from"),
    },
    async ({ bars: barsJson, anchor_swing_high, anchor_swing_low }) => {
      try {
        const bars = JSON.parse(barsJson);
        if (bars.length < 10) return { content: [{ type: "text", text: JSON.stringify({ error: "Need 10+ bars" }) }] };

        const price = bars[bars.length - 1].close;
        const anchors = {};

        if (anchor_swing_high !== undefined) {
          anchors.swingHigh = anchor_swing_high;
        } else {
          const { highs } = detectSwings(bars);
          if (highs.length > 0) anchors.swingHigh = highs[highs.length - 1].index;
        }

        if (anchor_swing_low !== undefined) {
          anchors.swingLow = anchor_swing_low;
        } else {
          const { lows } = detectSwings(bars);
          if (lows.length > 0) anchors.swingLow = lows[lows.length - 1].index;
        }

        const vwap = getVWAPAnalysis(bars, anchors);
        const confluence = vwapConfluence(price, vwap);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              price: price.toFixed(2),
              ...vwap,
              confluence,
              usage: "VWAP acts as dynamic S/R. Buy near lower band/VWAP in uptrend. Sell near upper band/VWAP in downtrend.",
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
