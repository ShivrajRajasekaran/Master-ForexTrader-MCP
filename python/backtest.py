"""
Master Trader Backtesting Engine
Tests the 7-gate system against historical data.
Outputs: win rate, profit factor, max drawdown, Sharpe ratio, equity curve.

Usage:
    python python/backtest.py --data data/XAUUSD_5M.csv --risk 1 --mode balanced
"""

import json
import sys
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def load_data(filepath):
    """Load OHLCV CSV data (columns: time, open, high, low, close, volume)."""
    df = pd.read_csv(filepath, parse_dates=["time"] if "time" in pd.read_csv(filepath, nrows=1).columns else False)
    required = ["open", "high", "low", "close"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")
    if "volume" not in df.columns:
        df["volume"] = 0
    return df


def compute_atr(df, period=14):
    """Average True Range."""
    high = df["high"]
    low = df["low"]
    close = df["close"].shift(1)
    tr = pd.concat([high - low, (high - close).abs(), (low - close).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def detect_swing_highs(df, period=5):
    """Pivot highs."""
    highs = []
    for i in range(period, len(df) - period):
        if all(df["high"].iloc[i] > df["high"].iloc[i - j] for j in range(1, period + 1)) and \
           all(df["high"].iloc[i] > df["high"].iloc[i + j] for j in range(1, period + 1)):
            highs.append({"index": i, "price": df["high"].iloc[i]})
    return highs


def detect_swing_lows(df, period=5):
    """Pivot lows."""
    lows = []
    for i in range(period, len(df) - period):
        if all(df["low"].iloc[i] < df["low"].iloc[i - j] for j in range(1, period + 1)) and \
           all(df["low"].iloc[i] < df["low"].iloc[i + j] for j in range(1, period + 1)):
            lows.append({"index": i, "price": df["low"].iloc[i]})
    return lows


def classify_structure(highs, lows):
    """HH/HL = Bullish, LH/LL = Bearish."""
    if len(highs) < 2 or len(lows) < 2:
        return "Neutral"
    hh = highs[-1]["price"] > highs[-2]["price"]
    hl = lows[-1]["price"] > lows[-2]["price"]
    lh = highs[-1]["price"] < highs[-2]["price"]
    ll = lows[-1]["price"] < lows[-2]["price"]
    if hh and hl:
        return "Bullish"
    if lh and ll:
        return "Bearish"
    return "Neutral"


def detect_sweep(df, idx, highs, lows, lookback=10):
    """Check if a sweep occurred within lookback bars."""
    start = max(0, idx - lookback)
    window = df.iloc[start:idx + 1]

    for sh in highs:
        if sh["index"] < start:
            continue
        if sh["index"] >= idx:
            break
        # Bearish sweep: wick above swing high, close below
        swept_bars = window[(window["high"] > sh["price"]) & (window["close"] < sh["price"])]
        if not swept_bars.empty:
            return {"swept": True, "type": "bearish", "price": sh["price"]}

    for sl in lows:
        if sl["index"] < start:
            continue
        if sl["index"] >= idx:
            break
        # Bullish sweep: wick below swing low, close above
        swept_bars = window[(window["low"] < sl["price"]) & (window["close"] > sl["price"])]
        if not swept_bars.empty:
            return {"swept": True, "type": "bullish", "price": sl["price"]}

    return {"swept": False}


def run_backtest(df, risk_percent=1.0, min_gates=6, rr_target=2.0):
    """
    Run the 7-gate backtest simulation.
    Returns trade list and performance metrics.
    """
    trades = []
    equity = [10000.0]  # Starting balance
    balance = 10000.0
    max_balance = balance
    max_drawdown = 0
    trades_today = 0
    last_trade_idx = -20

    atr = compute_atr(df)
    highs = detect_swing_highs(df)
    lows = detect_swing_lows(df)

    # Need at least 60 bars for analysis
    for i in range(60, len(df) - 5):
        # Cooldown
        if i - last_trade_idx < 20:
            continue

        # Daily trade limit (simplified: max 3 per 288 bars on 5M = 1 day)
        recent_trades = [t for t in trades if t["entry_idx"] > i - 288]
        if len(recent_trades) >= 3:
            continue

        # Get current state
        current_atr = atr.iloc[i]
        if pd.isna(current_atr) or current_atr == 0:
            continue

        price = df["close"].iloc[i]

        # Get relevant swings up to this point
        rel_highs = [h for h in highs if h["index"] < i]
        rel_lows = [l for l in lows if l["index"] < i]

        if len(rel_highs) < 2 or len(rel_lows) < 2:
            continue

        # GATE 1: Kill Zone (skip — need timestamp; assume passed for backtest)
        gate1 = True

        # GATE 2: Trend (simple: 20-bar EMA direction)
        ema20 = df["close"].iloc[i - 20:i].mean()
        ema50 = df["close"].iloc[i - 50:i].mean()
        trending = abs(ema20 - ema50) > current_atr * 0.3
        gate2 = trending

        # GATE 3: Structure
        structure = classify_structure(rel_highs[-5:], rel_lows[-5:])
        gate3 = structure != "Neutral"

        # GATE 4: BOS/CHoCH (simplified)
        last_high = rel_highs[-1]["price"]
        last_low = rel_lows[-1]["price"]
        bos_bull = price > last_high and structure == "Bullish"
        bos_bear = price < last_low and structure == "Bearish"
        gate4 = bos_bull or bos_bear

        # GATE 5: Sweep
        sweep = detect_sweep(df, i, rel_highs, rel_lows)
        gate5 = sweep["swept"]

        # GATE 6: OTE zone (simplified: price between 61.8% and 78.6% of last swing)
        range_h = max(h["price"] for h in rel_highs[-3:])
        range_l = min(l["price"] for l in rel_lows[-3:])
        fib_618 = range_h - (range_h - range_l) * 0.618
        fib_786 = range_h - (range_h - range_l) * 0.786
        in_ote = fib_786 <= price <= fib_618
        gate6 = in_ote or (price <= range_l + current_atr) or (price >= range_h - current_atr)

        # GATE 7: Limits (already checked above)
        gate7 = True

        gates_passed = sum([gate1, gate2, gate3, gate4, gate5, gate6, gate7])

        if gates_passed < min_gates:
            continue

        # Determine direction
        direction = "long" if (bos_bull or sweep.get("type") == "bullish" or structure == "Bullish") else "short"

        # Entry, SL, TP
        entry = price
        if direction == "long":
            sl = entry - current_atr * 1.5
            tp = entry + (entry - sl) * rr_target
        else:
            sl = entry + current_atr * 1.5
            tp = entry - (sl - entry) * rr_target

        # Simulate trade outcome
        risk_amount = balance * (risk_percent / 100)
        hit_tp = False
        hit_sl = False

        for j in range(i + 1, min(i + 50, len(df))):
            if direction == "long":
                if df["low"].iloc[j] <= sl:
                    hit_sl = True
                    break
                if df["high"].iloc[j] >= tp:
                    hit_tp = True
                    break
            else:
                if df["high"].iloc[j] >= sl:
                    hit_sl = True
                    break
                if df["low"].iloc[j] <= tp:
                    hit_tp = True
                    break

        # Record trade
        pnl = risk_amount * rr_target if hit_tp else -risk_amount if hit_sl else 0
        balance += pnl
        max_balance = max(max_balance, balance)
        drawdown = (max_balance - balance) / max_balance * 100
        max_drawdown = max(max_drawdown, drawdown)
        last_trade_idx = i

        trades.append({
            "entry_idx": i,
            "direction": direction,
            "entry": round(entry, 2),
            "sl": round(sl, 2),
            "tp": round(tp, 2),
            "result": "win" if hit_tp else "loss" if hit_sl else "timeout",
            "pnl": round(pnl, 2),
            "balance": round(balance, 2),
            "gates": gates_passed,
        })

        equity.append(balance)

    return trades, equity, max_drawdown


def compute_stats(trades):
    """Compute performance metrics."""
    if not trades:
        return {"error": "No trades generated"}

    wins = [t for t in trades if t["result"] == "win"]
    losses = [t for t in trades if t["result"] == "loss"]

    total = len(trades)
    win_count = len(wins)
    loss_count = len(losses)
    win_rate = win_count / total if total > 0 else 0

    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    net_pnl = sum(t["pnl"] for t in trades)
    avg_win = gross_profit / win_count if win_count > 0 else 0
    avg_loss = gross_loss / loss_count if loss_count > 0 else 0

    # Sharpe ratio (simplified)
    returns = [t["pnl"] for t in trades]
    if len(returns) > 1:
        sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(252) if np.std(returns) > 0 else 0
    else:
        sharpe = 0

    # Max consecutive losses
    max_consec_loss = 0
    current_streak = 0
    for t in trades:
        if t["result"] == "loss":
            current_streak += 1
            max_consec_loss = max(max_consec_loss, current_streak)
        else:
            current_streak = 0

    return {
        "total_trades": total,
        "wins": win_count,
        "losses": loss_count,
        "win_rate": f"{win_rate * 100:.1f}%",
        "profit_factor": round(profit_factor, 2),
        "net_pnl": f"${net_pnl:.2f}",
        "avg_win": f"${avg_win:.2f}",
        "avg_loss": f"${avg_loss:.2f}",
        "sharpe_ratio": round(sharpe, 2),
        "max_consecutive_losses": max_consec_loss,
        "expectancy": f"${(win_rate * avg_win - (1 - win_rate) * avg_loss):.2f} per trade",
    }


def main():
    parser = argparse.ArgumentParser(description="Master Trader Backtest Engine")
    parser.add_argument("--data", required=True, help="Path to OHLCV CSV file")
    parser.add_argument("--risk", type=float, default=1.0, help="Risk per trade (%)")
    parser.add_argument("--mode", choices=["conservative", "balanced", "aggressive"], default="balanced")
    parser.add_argument("--rr", type=float, default=2.0, help="Risk:Reward target")
    parser.add_argument("--output", default=None, help="Output JSON path")

    args = parser.parse_args()

    min_gates = {"conservative": 7, "balanced": 6, "aggressive": 5}[args.mode]

    print(f"Loading data from {args.data}...")
    df = load_data(args.data)
    print(f"Loaded {len(df)} bars")

    print(f"Running backtest (mode={args.mode}, risk={args.risk}%, RR=1:{args.rr})...")
    trades, equity, max_dd = run_backtest(df, args.risk, min_gates, args.rr)

    stats = compute_stats(trades)
    stats["max_drawdown"] = f"{max_dd:.2f}%"
    stats["final_balance"] = f"${equity[-1]:.2f}" if equity else "$10000.00"

    print("\n" + "=" * 50)
    print("  BACKTEST RESULTS")
    print("=" * 50)
    for key, val in stats.items():
        print(f"  {key:30s}: {val}")
    print("=" * 50)

    if args.output:
        output = {"stats": stats, "trades": trades}
        Path(args.output).write_text(json.dumps(output, indent=2))
        print(f"\nFull results saved to {args.output}")


if __name__ == "__main__":
    main()
