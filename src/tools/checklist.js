import { z } from "zod";
import { getCurrentSession } from "../engine/kill-zones.js";
import { analyzeTrend } from "../engine/kalman-filter.js";
import { detectSwings, classifyStructure, detectCHoCH, detectCISD, getHTFBias } from "../engine/structure.js";
import { detectRecentSweep, detectOrderBlocks, detectFVGs, computeOTE, priceInZone, priceInOTE } from "../engine/liquidity.js";
import { detectAMDPhase } from "../engine/amd.js";
import { getConfirmationCandle } from "../engine/candles.js";
import { getIndicatorConfluence } from "../engine/indicators.js";
import { getMacroBias } from "../engine/correlation.js";
import { getMTFConfluence } from "../engine/mtf.js";
import { computePDH_PDL, detectEqualHighs, detectEqualLows } from "../engine/levels.js";

export function registerChecklistTools(server) {
  server.tool(
    "trade_checklist_10",
    "The FULL 10-point institutional entry checklist from Grandmaster memory. Returns score out of 10. Minimum 6/10 to trade. This is the MASTER validation.",
    {
      bars: z.string().describe("JSON array of LTF OHLCV bars (5M/15M, 50+ bars)"),
      htf_bars: z.string().optional().describe("JSON array of HTF bars (4H/Daily, 20+ bars)"),
      itf_bars: z.string().optional().describe("JSON array of ITF bars (1H, 20+ bars)"),
      dxy_bars: z.string().optional().describe("JSON array of DXY bars (for macro bias)"),
      symbol: z.string().optional().describe("Trading pair (default XAUUSD)"),
      daily_bars: z.string().optional().describe("JSON array of daily bars (for PDH/PDL DOL)"),
    },
    async ({ bars: barsJson, htf_bars: htfJson, itf_bars: itfJson, dxy_bars: dxyJson, symbol = "XAUUSD", daily_bars: dailyJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const htfBars = htfJson ? JSON.parse(htfJson) : null;
        const itfBars = itfJson ? JSON.parse(itfJson) : null;
        const dxyBars = dxyJson ? JSON.parse(dxyJson) : null;
        const dailyBars = dailyJson ? JSON.parse(dailyJson) : null;

        if (bars.length < 50) return { content: [{ type: "text", text: JSON.stringify({ error: "Need 50+ LTF bars" }) }] };

        const price = bars[bars.length - 1].close;
        const checklist = [];
        let score = 0;

        // 1. MACRO BIAS (DXY + sentiment)
        const macro = getMacroBias(symbol, dxyBars);
        const macroPass = macro.aligned && macro.macroBias !== "unknown";
        checklist.push({ gate: 1, name: "Macro Bias (DXY)", passed: macroPass, detail: macro.macroBias || "No DXY data" });
        if (macroPass) score++;

        // 2. THREE TIMEFRAMES ALIGNED
        const mtf = getMTFConfluence(bars, itfBars, htfBars);
        const mtfPass = mtf.aligned;
        checklist.push({ gate: 2, name: "3 TF Aligned (HTF+ITF+LTF)", passed: mtfPass, detail: mtf.strength || "Misaligned" });
        if (mtfPass) score++;

        // 3. LIQUIDITY SWEEP
        const { highs, lows } = detectSwings(bars);
        const sweep = detectRecentSweep(bars, highs, lows, 15);
        checklist.push({ gate: 3, name: "Liquidity Sweep (BSL/SSL)", passed: sweep.swept, detail: sweep.swept ? `${sweep.type} sweep at ${sweep.price?.toFixed(2)}` : "No recent sweep" });
        if (sweep.swept) score++;

        // 4. PRICE AT INSTITUTIONAL ZONE (OB/FVG/OTE)
        const obs = detectOrderBlocks(bars);
        const fvgs = detectFVGs(bars);
        const rangeH = Math.max(...bars.slice(-50).map((b) => b.high));
        const rangeL = Math.min(...bars.slice(-50).map((b) => b.low));
        const ote = computeOTE(rangeH, rangeL);
        const allBullZones = [...obs.bullOBs, ...fvgs.bullFVGs];
        const allBearZones = [...obs.bearOBs, ...fvgs.bearFVGs];
        const atZone = priceInZone(price, allBullZones).inZone || priceInZone(price, allBearZones).inZone || priceInOTE(price, ote);
        checklist.push({ gate: 4, name: "At Institutional Zone (OB/FVG/OTE)", passed: atZone, detail: atZone ? "Price at institutional zone" : "Not at any zone" });
        if (atZone) score++;

        // 5. AMD MODEL CONFIRMED
        const amd = detectAMDPhase(bars);
        const amdPass = amd.phase === "Distribution" || amd.phase === "Manipulation";
        checklist.push({ gate: 5, name: "AMD Model (Manipulation/Distribution)", passed: amdPass, detail: `${amd.phase} (${amd.confidence}%)` });
        if (amdPass) score++;

        // 6. CHoCH or MSS on LTF
        const structure = classifyStructure(highs, lows);
        const choch = detectCHoCH(bars, structure);
        const cisd = detectCISD(bars);
        const structurePass = choch.bullCHoCH || choch.bearCHoCH || cisd.bullCISD || cisd.bearCISD;
        checklist.push({ gate: 6, name: "CHoCH/CISD on LTF", passed: structurePass, detail: choch.bullCHoCH ? "Bullish CHoCH" : choch.bearCHoCH ? "Bearish CHoCH" : cisd.bullCISD ? "Bullish CISD" : cisd.bearCISD ? "Bearish CISD" : "No structure shift" });
        if (structurePass) score++;

        // 7. INDICATOR CONFLUENCE 6+/8
        const indicators = getIndicatorConfluence(bars);
        const indicatorPass = indicators.confluent;
        checklist.push({ gate: 7, name: "Indicator Confluence (6+/8)", passed: indicatorPass, detail: `${indicators.score}/8 ${indicators.direction}` });
        if (indicatorPass) score++;

        // 8. CANDLESTICK CONFIRMATION
        const candle = getConfirmationCandle(bars);
        checklist.push({ gate: 8, name: "Candlestick Confirmation", passed: candle.confirmed, detail: candle.confirmed ? candle.patterns.join(", ") : "No confirmation candle" });
        if (candle.confirmed) score++;

        // 9. INSIDE KILL ZONE
        const session = getCurrentSession();
        checklist.push({ gate: 9, name: "Inside Kill Zone", passed: session.canTrade, detail: session.reason });
        if (session.canTrade) score++;

        // 10. DOL CLEARLY IDENTIFIED
        const eqh = detectEqualHighs(highs);
        const eql = detectEqualLows(lows);
        const pd = dailyBars ? computePDH_PDL(dailyBars) : null;
        let dol = null;
        if (sweep.type === "bullish" || structure.bias === "Bullish") {
          dol = eqh.length > 0 ? `EQH @ ${eqh[0].price.toFixed(2)}` : pd ? `PDH @ ${pd.pdh.toFixed(2)}` : null;
        } else {
          dol = eql.length > 0 ? `EQL @ ${eql[0].price.toFixed(2)}` : pd ? `PDL @ ${pd.pdl.toFixed(2)}` : null;
        }
        const dolPass = dol !== null;
        checklist.push({ gate: 10, name: "DOL Identified (TP Target)", passed: dolPass, detail: dol || "No clear DOL" });
        if (dolPass) score++;

        // VERDICT
        const direction = indicators.direction === "bullish" || structure.bias === "Bullish" || sweep.type === "bullish" ? "LONG" : "SHORT";
        let sizing = "NO TRADE";
        if (score >= 8) sizing = "MAXIMUM SIZE (A+ setup)";
        else if (score >= 6) sizing = "STANDARD SIZE";
        else sizing = "NO TRADE — below 6/10 minimum";

        const output = {
          score: `${score}/10`,
          verdict: score >= 6 ? `TRADE — ${direction}` : "NO TRADE",
          sizing,
          direction: score >= 6 ? direction : null,
          checklist: checklist.map((c) => `${c.passed ? "[PASS]" : "[FAIL]"} Gate ${c.gate}: ${c.name} — ${c.detail}`).join("\n"),
          raw: checklist,
          rule: "Below 6 = NO TRADE. 6-7 = standard size. 8+ = maximum size.",
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
