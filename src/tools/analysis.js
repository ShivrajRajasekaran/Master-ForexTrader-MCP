import { z } from "zod";
import { analyzeTrend } from "../engine/kalman-filter.js";
import { detectSwings, classifyStructure, detectCISD, detectCRT } from "../engine/structure.js";
import { detectOrderBlocks, detectFVGs, computeOTE, detectRecentSweep } from "../engine/liquidity.js";

export function registerAnalysisTools(server) {
  server.tool(
    "trade_analyze",
    "Full institutional market analysis. Returns structure, OBs, FVGs, OTE, Kalman trend, liquidity levels, and AMD phase. Does NOT generate a signal — use trade_signal for that.",
    {
      bars: z
        .string()
        .describe("JSON array of OHLCV bars [{time, open, high, low, close, volume}, ...]. Minimum 50 bars."),
      htf_candle: z
        .string()
        .optional()
        .describe("JSON object of previous HTF candle {time, open, high, low, close} for CRT analysis"),
    },
    async ({ bars: barsJson, htf_candle: htfJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const htfCandle = htfJson ? JSON.parse(htfJson) : null;

        if (bars.length < 30) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Need minimum 30 bars" }) }] };
        }

        const price = bars[bars.length - 1].close;

        // Trend (Kalman)
        const trend = analyzeTrend(bars);

        // Structure
        const { highs, lows } = detectSwings(bars);
        const structure = classifyStructure(highs, lows);

        // CISD
        const cisd = detectCISD(bars);

        // CRT
        const crt = detectCRT(bars, htfCandle);

        // Liquidity
        const obs = detectOrderBlocks(bars);
        const fvgs = detectFVGs(bars);
        const sweep = detectRecentSweep(bars, highs, lows, 10);

        // Range & OTE
        const rangeH = Math.max(...bars.slice(-50).map((b) => b.high));
        const rangeL = Math.min(...bars.slice(-50).map((b) => b.low));
        const ote = computeOTE(rangeH, rangeL);

        // Premium/Discount
        const zone = price > ote.fib_50 ? "PREMIUM" : "DISCOUNT";

        // AMD Phase detection
        let amdPhase = "Unknown";
        const recentBars = bars.slice(-20);
        const avgBody = recentBars.reduce((s, b) => s + Math.abs(b.close - b.open), 0) / recentBars.length;
        const lastBody = Math.abs(bars[bars.length - 1].close - bars[bars.length - 1].open);

        if (lastBody < avgBody * 0.5 && !sweep.swept) {
          amdPhase = "Accumulation";
        } else if (sweep.swept && !cisd.bullCISD && !cisd.bearCISD) {
          amdPhase = "Manipulation";
        } else if (sweep.swept && (cisd.bullCISD || cisd.bearCISD)) {
          amdPhase = "Distribution";
        }

        const result = {
          price: price.toFixed(2),
          trend: {
            label: trend.label,
            kalmanLine: trend.kalmanLine?.toFixed(2),
            kalmanUpper: trend.kalmanUpper?.toFixed(2),
            kalmanLower: trend.kalmanLower?.toFixed(2),
            isRanging: trend.isRanging,
            canTrade: trend.canTrade,
          },
          structure: {
            bias: structure.bias,
            highType: structure.highType,
            lowType: structure.lowType,
            swingHighs: highs.slice(-3).map((h) => ({ price: h.price.toFixed(2), time: h.time })),
            swingLows: lows.slice(-3).map((l) => ({ price: l.price.toFixed(2), time: l.time })),
          },
          cisd: {
            bullCISD: cisd.bullCISD,
            bearCISD: cisd.bearCISD,
            price: cisd.cisd_price?.toFixed(2),
          },
          crt: crt.crtTriggered ? crt : { crtTriggered: false },
          liquidity: {
            recentSweep: sweep,
            orderBlocks: {
              bull: obs.bullOBs.map((ob) => ({ top: ob.top.toFixed(2), bottom: ob.bottom.toFixed(2) })),
              bear: obs.bearOBs.map((ob) => ({ top: ob.top.toFixed(2), bottom: ob.bottom.toFixed(2) })),
            },
            fvgs: {
              bull: fvgs.bullFVGs.map((f) => ({ top: f.top.toFixed(2), bottom: f.bottom.toFixed(2) })),
              bear: fvgs.bearFVGs.map((f) => ({ top: f.top.toFixed(2), bottom: f.bottom.toFixed(2) })),
            },
          },
          levels: {
            rangeHigh: rangeH.toFixed(2),
            rangeLow: rangeL.toFixed(2),
            fib50: ote.fib_50.toFixed(2),
            fib618: ote.fib_618.toFixed(2),
            fib786: ote.fib_786.toFixed(2),
            oteZone: `${ote.ote_top.toFixed(2)} - ${ote.ote_bottom.toFixed(2)}`,
          },
          zone,
          amdPhase,
          atr: trend.atr?.toFixed(2),
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_htf_bias",
    "Check Higher Timeframe bias using market structure (HH/HL = Bullish, LH/LL = Bearish). Pass 4H or Daily bars.",
    {
      bars: z
        .string()
        .describe("JSON array of HTF OHLCV bars (4H or Daily). Minimum 20 bars."),
    },
    async ({ bars: barsJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const { highs, lows } = detectSwings(bars, 3);
        const structure = classifyStructure(highs, lows);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              bias: structure.bias,
              highType: structure.highType,
              lowType: structure.lowType,
              lastHigh: structure.lastHigh?.toFixed(2),
              lastLow: structure.lastLow?.toFixed(2),
              verdict: structure.bias === "Bullish"
                ? "HTF BULLISH — only take LONG signals on LTF"
                : structure.bias === "Bearish"
                  ? "HTF BEARISH — only take SHORT signals on LTF"
                  : "HTF NEUTRAL — no clear direction, WAIT for alignment",
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
