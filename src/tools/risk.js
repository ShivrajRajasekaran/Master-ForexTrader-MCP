import { z } from "zod";
import { computeATR } from "../engine/kalman-filter.js";

export function registerRiskTools(server) {
  server.tool(
    "trade_risk_calc",
    "Calculate position size based on account balance, risk percentage, and SL distance. Returns lot size, dollar risk, pip value, and max position.",
    {
      balance: z.number().describe("Account balance in USD"),
      risk_percent: z.number().optional().describe("Risk per trade as % (default 1%)"),
      sl_pips: z.number().describe("Stop loss distance in pips"),
      pip_value: z.number().optional().describe("Pip value per 0.01 lot (default: 0.01 for gold, 0.10 for forex)"),
      instrument: z.enum(["xauusd", "forex_major", "forex_minor"]).optional().describe("Instrument type for pip value auto-detection"),
    },
    async ({ balance, risk_percent = 1, sl_pips, pip_value, instrument = "xauusd" }) => {
      const riskDollar = balance * (risk_percent / 100);

      // Auto pip value: XAUUSD = $0.01/pip for 0.01 lot, Forex = $0.10/pip for 0.01 lot
      const autoValue = instrument === "xauusd" ? 0.01 : 0.10;
      const pipVal = pip_value || autoValue;

      // Lot size = risk$ / (SL pips × pip value per 0.01 lot) × 0.01
      const lotSize = riskDollar / (sl_pips * pipVal);
      const roundedLot = Math.floor(lotSize * 100) / 100; // Round down to 0.01

      const result = {
        balance: `$${balance.toFixed(2)}`,
        riskPercent: `${risk_percent}%`,
        riskDollar: `$${riskDollar.toFixed(2)}`,
        slPips: sl_pips,
        pipValue: `$${pipVal} per pip per 0.01 lot`,
        calculatedLot: lotSize.toFixed(4),
        recommendedLot: Math.max(0.01, roundedLot),
        maxLoss: `$${(Math.max(0.01, roundedLot) * sl_pips * pipVal).toFixed(2)}`,
        instrument,
        warning: roundedLot < 0.01
          ? "RISK TOO HIGH for minimum lot. Either widen SL or skip this trade."
          : null,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "trade_partial_tp",
    "Calculate partial TP levels using the 30/40/30 institutional method. TP1=1.5R, TP2=2.5R, TP3=4R trail.",
    {
      entry: z.number().describe("Entry price"),
      sl: z.number().describe("Stop loss price"),
      direction: z.enum(["long", "short"]).describe("Trade direction"),
      lot_size: z.number().optional().describe("Total lot size (for partial calculations)"),
    },
    async ({ entry, sl, direction, lot_size = 0.01 }) => {
      const risk = Math.abs(entry - sl);

      let tp1, tp2, tp3, breakeven;

      if (direction === "long") {
        tp1 = entry + risk * 1.5;
        tp2 = entry + risk * 2.5;
        tp3 = entry + risk * 4.0;
        breakeven = entry;
      } else {
        tp1 = entry - risk * 1.5;
        tp2 = entry - risk * 2.5;
        tp3 = entry - risk * 4.0;
        breakeven = entry;
      }

      const result = {
        entry: entry.toFixed(2),
        sl: sl.toFixed(2),
        direction,
        riskPips: (risk / 0.1).toFixed(0) + " pips (gold) / " + (risk / 0.0001).toFixed(0) + " pips (forex)",
        partials: {
          tp1: {
            price: tp1.toFixed(2),
            rr: "1:1.5",
            closePercent: "30%",
            lots: (lot_size * 0.3).toFixed(2),
            action: "Close 30% → Move SL to breakeven",
          },
          tp2: {
            price: tp2.toFixed(2),
            rr: "1:2.5",
            closePercent: "40%",
            lots: (lot_size * 0.4).toFixed(2),
            action: "Close 40% → Lock profit (SL to TP1)",
          },
          tp3: {
            price: tp3.toFixed(2),
            rr: "1:4.0",
            closePercent: "30%",
            lots: (lot_size * 0.3).toFixed(2),
            action: "Trail remaining 30% with 1x ATR",
          },
        },
        breakeven_rule: "After TP1 hit → move SL to entry IMMEDIATELY. Trade becomes ZERO RISK.",
        total_if_all_hit: `RR ~1:2.5 weighted average`,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "trade_daily_limit",
    "Check daily risk limits. Returns whether trading should continue or stop.",
    {
      balance: z.number().describe("Starting balance today"),
      current_equity: z.number().describe("Current equity"),
      trades_taken: z.number().describe("Number of trades taken today"),
    },
    async ({ balance, current_equity, trades_taken }) => {
      const dailyPnl = current_equity - balance;
      const dailyPnlPercent = (dailyPnl / balance) * 100;

      const maxDailyLoss = -3; // 3% max daily loss
      const maxTrades = 3;

      const shouldStop = dailyPnlPercent <= maxDailyLoss || trades_taken >= maxTrades;

      const result = {
        startBalance: `$${balance.toFixed(2)}`,
        currentEquity: `$${current_equity.toFixed(2)}`,
        dailyPnl: `$${dailyPnl.toFixed(2)} (${dailyPnlPercent.toFixed(1)}%)`,
        tradesTaken: `${trades_taken}/${maxTrades}`,
        shouldStop,
        reason: shouldStop
          ? dailyPnlPercent <= maxDailyLoss
            ? `STOP: Daily loss ${dailyPnlPercent.toFixed(1)}% exceeds -3% limit. Walk away.`
            : `STOP: Max ${maxTrades} trades reached for today.`
          : `OK to continue. ${maxTrades - trades_taken} trades remaining.`,
        rules: {
          maxDailyLoss: "-3%",
          maxWeeklyLoss: "-5%",
          maxTradesPerDay: maxTrades,
          riskPerTrade: "1%",
          neverRevengeTrade: true,
        },
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
