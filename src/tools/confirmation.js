import { z } from "zod";
import { getConfirmationCandle } from "../engine/candles.js";
import { trackMitigation } from "../engine/mitigation.js";
import { detectRejectionBlock, detectPropulsionBlock, computeFibExtensions, detectLiquidityVoid } from "../engine/blocks.js";
import { detectOrderBlocks, detectFVGs } from "../engine/liquidity.js";
import { detectSwings } from "../engine/structure.js";
import { getMTFConfluence } from "../engine/mtf.js";
import { detectPriceDivergence, detectMomentumDivergence } from "../engine/divergence.js";
import { trackSessionLiquidity, detectAsianBreakout, detectJudasSwing } from "../engine/sessions.js";
import { getNewsFilter, shouldAvoidTrade } from "../engine/news.js";
import { getMoneyManagementPlan } from "../engine/money.js";

export function registerConfirmationTools(server) {
  server.tool(
    "trade_confirmation",
    "Check entry confirmation: candle patterns (engulfing, pin bar, hammer, doji), mitigation status (fresh/used zones), rejection/propulsion blocks, divergence, and Judas Swing.",
    {
      bars: z.string().describe("JSON array of OHLCV bars (50+ bars for full analysis)"),
      symbol: z.string().optional().describe("Trading pair (e.g., XAUUSD) for news filter"),
    },
    async ({ bars: barsJson, symbol = "XAUUSD" }) => {
      try {
        const bars = JSON.parse(barsJson);
        if (bars.length < 30) return { content: [{ type: "text", text: JSON.stringify({ error: "Need 30+ bars" }) }] };

        // Candle confirmation
        const candle = getConfirmationCandle(bars);

        // Mitigation (fresh vs used zones)
        const obs = detectOrderBlocks(bars);
        const fvgs = detectFVGs(bars);
        const mitigation = trackMitigation(obs, fvgs, bars);

        // Rejection & Propulsion blocks
        const rejections = detectRejectionBlock(bars);
        const propulsions = detectPropulsionBlock(bars);

        // Liquidity voids
        const voids = detectLiquidityVoid(bars);

        // Divergence
        const divergence = detectPriceDivergence(bars);
        const momentum = detectMomentumDivergence(bars);

        // Session liquidity
        const sessionLiq = trackSessionLiquidity(bars);

        // Asian breakout
        const asianBreakout = detectAsianBreakout(bars);

        // Judas Swing
        const judas = detectJudasSwing(bars);

        // News filter
        const news = shouldAvoidTrade(symbol);
        const newsEvents = getNewsFilter(symbol);

        const output = {
          confirmation: candle,
          zones: {
            fresh: mitigation.fresh.length,
            tested: mitigation.tested.length,
            mitigated: mitigation.mitigated.length,
            broken: mitigation.broken.length,
            tradeable: mitigation.summary.tradeable,
            note: mitigation.summary.note,
          },
          blocks: {
            rejections: rejections.slice(0, 3).map((r) => ({ type: r.type, top: r.top?.toFixed(2), bottom: r.bottom?.toFixed(2) })),
            propulsions: propulsions.slice(0, 3).map((p) => ({ type: p.type, top: p.top?.toFixed(2), bottom: p.bottom?.toFixed(2) })),
          },
          voids: voids.slice(0, 3).map((v) => ({ type: v.type, midpoint: v.midpoint })),
          divergence: {
            price: divergence.divergences.slice(0, 2),
            momentum: momentum.divergence ? momentum : { divergence: false },
          },
          sessionLiquidity: {
            untapped: sessionLiq.untapped.length,
            nextTarget: sessionLiq.nextTarget?.label,
            note: sessionLiq.note,
          },
          asianBreakout: asianBreakout.breakout ? asianBreakout : { breakout: false },
          judasSwing: judas.found ? judas : { found: false },
          newsFilter: {
            avoid: news.avoid,
            reason: news.reason,
            verdict: newsEvents.verdict,
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_mtf_check",
    "Multi-timeframe alignment check. Pass LTF (5M/15M), ITF (1H), and HTF (4H/Daily) bars. Returns alignment score and direction.",
    {
      ltf_bars: z.string().describe("JSON array of LTF bars (5M or 15M, 50+ bars)"),
      itf_bars: z.string().optional().describe("JSON array of ITF bars (1H, 20+ bars)"),
      htf_bars: z.string().optional().describe("JSON array of HTF bars (4H or Daily, 20+ bars)"),
    },
    async ({ ltf_bars: ltfJson, itf_bars: itfJson, htf_bars: htfJson }) => {
      try {
        const ltfBars = JSON.parse(ltfJson);
        const itfBars = itfJson ? JSON.parse(itfJson) : null;
        const htfBars = htfJson ? JSON.parse(htfJson) : null;

        const mtf = getMTFConfluence(ltfBars, itfBars, htfBars);

        return { content: [{ type: "text", text: JSON.stringify(mtf, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_fib_extensions",
    "Calculate Fibonacci extensions for TP targets beyond the range. Use when price breaks out of known structure.",
    {
      swing_high: z.number().describe("Recent swing high price"),
      swing_low: z.number().describe("Recent swing low price"),
      direction: z.enum(["bullish", "bearish"]).describe("Breakout direction"),
    },
    async ({ swing_high, swing_low, direction }) => {
      const extensions = computeFibExtensions(swing_high, swing_low, direction);
      return { content: [{ type: "text", text: JSON.stringify(extensions, null, 2) }] };
    }
  );

  server.tool(
    "trade_money_management",
    "Full money management plan: Kelly Criterion, compounding projection, drawdown recovery, and position sizing rules.",
    {
      balance: z.number().describe("Current account balance"),
      win_rate: z.number().optional().describe("Win rate as decimal (e.g., 0.55 for 55%)"),
      avg_rr: z.number().optional().describe("Average risk:reward (e.g., 2 for 1:2)"),
      current_streak: z.number().optional().describe("Current streak (positive = wins, negative = losses)"),
    },
    async ({ balance, win_rate = 0.55, avg_rr = 2, current_streak = 0 }) => {
      const plan = getMoneyManagementPlan(balance, {
        winRate: win_rate,
        avgRR: avg_rr,
        riskPercent: 1,
        currentStreak: current_streak,
      });
      return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
    }
  );
}
