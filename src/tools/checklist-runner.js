import { getCurrentSession } from "../engine/kill-zones.js";
import { analyzeTrend } from "../engine/kalman-filter.js";
import { detectSwings, classifyStructure, detectCHoCH, detectCISD } from "../engine/structure.js";
import { detectRecentSweep, detectOrderBlocks, detectFVGs, computeOTE, priceInZone, priceInOTE } from "../engine/liquidity.js";
import { detectAMDPhase } from "../engine/amd.js";
import { getConfirmationCandle } from "../engine/candles.js";
import { getIndicatorConfluence } from "../engine/indicators.js";
import { getMacroBias } from "../engine/correlation.js";
import { getMTFConfluence } from "../engine/mtf.js";
import { computePDH_PDL, detectEqualHighs, detectEqualLows } from "../engine/levels.js";

export function runChecklist(bars, htfBars = null, itfBars = null, dxyBars = null, symbol = "XAUUSD", dailyBars = null) {
  if (!bars || bars.length < 50) return { error: "Need 50+ bars", scoreNum: 0 };

  const price = bars[bars.length - 1].close;
  let score = 0;

  const macro = getMacroBias(symbol, dxyBars);
  if (macro.aligned && macro.macroBias !== "unknown") score++;

  const mtf = getMTFConfluence(bars, itfBars, htfBars);
  if (mtf.aligned) score++;

  const { highs, lows } = detectSwings(bars);
  const sweep = detectRecentSweep(bars, highs, lows, 15);
  if (sweep.swept) score++;

  const obs = detectOrderBlocks(bars);
  const fvgs = detectFVGs(bars);
  const rangeH = Math.max(...bars.slice(-50).map((b) => b.high));
  const rangeL = Math.min(...bars.slice(-50).map((b) => b.low));
  const ote = computeOTE(rangeH, rangeL);
  const allBullZones = [...obs.bullOBs, ...fvgs.bullFVGs];
  const allBearZones = [...obs.bearOBs, ...fvgs.bearFVGs];
  const atZone = priceInZone(price, allBullZones).inZone || priceInZone(price, allBearZones).inZone || priceInOTE(price, ote);
  if (atZone) score++;

  const amd = detectAMDPhase(bars);
  if (amd.phase === "Distribution" || amd.phase === "Manipulation") score++;

  const structure = classifyStructure(highs, lows);
  const choch = detectCHoCH(bars, structure);
  const cisd = detectCISD(bars);
  if (choch.bullCHoCH || choch.bearCHoCH || cisd.bullCISD || cisd.bearCISD) score++;

  const indicators = getIndicatorConfluence(bars);
  if (indicators.confluent) score++;

  const candle = getConfirmationCandle(bars);
  if (candle.confirmed) score++;

  const session = getCurrentSession();
  if (session.canTrade) score++;

  const eqh = detectEqualHighs(highs);
  const eql = detectEqualLows(lows);
  const pd = dailyBars ? computePDH_PDL(dailyBars) : null;
  let dol = null;
  if (sweep.type === "bullish" || structure.bias === "Bullish") {
    dol = eqh.length > 0 ? `EQH @ ${eqh[0].price.toFixed(2)}` : pd ? `PDH @ ${pd.pdh.toFixed(2)}` : null;
  } else {
    dol = eql.length > 0 ? `EQL @ ${eql[0].price.toFixed(2)}` : pd ? `PDL @ ${pd.pdl.toFixed(2)}` : null;
  }
  if (dol) score++;

  const direction = indicators.direction === "bullish" || structure.bias === "Bullish" || sweep.type === "bullish" ? "LONG" : "SHORT";

  let sizing = "NO TRADE";
  if (score >= 8) sizing = "MAXIMUM SIZE (A+)";
  else if (score >= 6) sizing = "STANDARD SIZE";

  return {
    score: `${score}/10`,
    scoreNum: score,
    direction: score >= 6 ? direction : null,
    sizing,
    verdict: score >= 6 ? `TRADE — ${direction}` : "NO TRADE",
    dol,
  };
}
