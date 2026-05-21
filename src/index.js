/**
 * Master Trader MCP — Library Exports
 * Use these directly if integrating the engines into your own code.
 */

// Core Engines
export { KalmanFilter, computeATR, computeWMA, computeSupertrend, analyzeTrend } from "./engine/kalman-filter.js";
export { getCurrentSession, getSessionRange, KILL_ZONES, AVOID_ZONES, SESSION_PIVOTS } from "./engine/kill-zones.js";
export { detectSwings, classifyStructure, detectBOS, detectCHoCH, detectCISD, detectCRT, getHTFBias } from "./engine/structure.js";
export { detectLiquiditySweep, detectRecentSweep, detectOrderBlocks, detectFVGs, computeOTE, priceInZone, priceInOTE } from "./engine/liquidity.js";
export { detectAMDPhase, getAMDModel } from "./engine/amd.js";
export { analyzeVolume, validateDisplacementWithVolume, detectExhaustion, computePOC } from "./engine/volume.js";
export { detectDisplacement, detectWyckoffSpring, detectWyckoffUTAD, detectBreakerBlock, detectInducement, validateOrderBlock } from "./engine/patterns.js";
export { computePDH_PDL, computePWH_PWL, getAsiaRange, getLondonRange, getNYRange, detectEqualHighs, detectEqualLows, getAllKeyLevels } from "./engine/levels.js";
export { getQuarterlyPhase, getMacroWindow, isSilverBulletWindow, getOptimalEntryTiming, QUARTERLY_THEORY, MACRO_WINDOWS, SILVER_BULLET, POWER_OF_3 } from "./engine/time.js";

// New Engines
export { detectEngulfing, detectPinBar, detectHammer, detectDoji, detectMorningStar, getConfirmationCandle } from "./engine/candles.js";
export { classifyZoneStatus, filterFreshZones, trackMitigation } from "./engine/mitigation.js";
export { detectRejectionBlock, detectPropulsionBlock, computeFibExtensions, detectLiquidityVoid } from "./engine/blocks.js";
export { analyzeMTF, getMTFConfluence } from "./engine/mtf.js";
export { detectPriceDivergence, detectMomentumDivergence } from "./engine/divergence.js";
export { trackSessionLiquidity, detectAsianBreakout, detectJudasSwing } from "./engine/sessions.js";
export { getNewsFilter, shouldAvoidTrade } from "./engine/news.js";
export { calculateKellyCriterion, compoundingPlan, drawdownRecovery, getMoneyManagementPlan } from "./engine/money.js";

// Additional Engines
export { detectHarmonicPattern, computePRZ, HARMONIC_RATIOS } from "./engine/harmonics.js";
export { computeEMA, computeEMAStack, computeRSI, computeMACD, computeStochastic, computeBollingerBands, getIndicatorConfluence } from "./engine/indicators.js";
export { getDXYBias, checkCorrelation, getMacroBias, CORRELATION_MAP } from "./engine/correlation.js";

// Alerts & Journal
export { formatAlertMessage, shouldAlert, sendTelegramAlert, sendWebhookAlert } from "./engine/alerts.js";
export { logTrade, closeTrade, getJournalStats, getTodayTrades, getOpenTrades } from "./engine/persistent-journal.js";

// Gate System
export { runGates } from "./gates/entry-gates.js";
