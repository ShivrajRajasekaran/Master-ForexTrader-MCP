"""
Equity Curve Visualization
Generates professional charts from backtest results.

Usage:
    python python/equity_curve.py --data backtest_results.json --output equity.png
"""

import json
import sys
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates


def plot_equity_curve(trades, output_path="equity_curve.png"):
    """Plot equity curve with drawdown overlay."""
    if not trades:
        print("No trades to plot")
        return

    balances = [10000.0] + [t["balance"] for t in trades]
    indices = list(range(len(balances)))

    # Calculate drawdown
    peak = np.maximum.accumulate(balances)
    drawdown = (np.array(peak) - np.array(balances)) / np.array(peak) * 100

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), height_ratios=[3, 1], sharex=True)
    fig.suptitle("Master Trader — Equity Curve & Drawdown", fontsize=14, fontweight="bold")

    # Equity curve
    ax1.plot(indices, balances, color="#2196F3", linewidth=1.5, label="Equity")
    ax1.axhline(y=10000, color="gray", linestyle="--", alpha=0.5, label="Starting Balance")
    ax1.fill_between(indices, 10000, balances, where=[b >= 10000 for b in balances], alpha=0.1, color="green")
    ax1.fill_between(indices, 10000, balances, where=[b < 10000 for b in balances], alpha=0.1, color="red")

    # Mark wins/losses
    for i, t in enumerate(trades):
        color = "green" if t["result"] == "win" else "red" if t["result"] == "loss" else "gray"
        ax1.scatter(i + 1, t["balance"], color=color, s=15, alpha=0.6, zorder=5)

    ax1.set_ylabel("Balance ($)")
    ax1.legend(loc="upper left")
    ax1.grid(True, alpha=0.3)

    # Drawdown
    ax2.fill_between(indices, 0, -drawdown, color="red", alpha=0.3)
    ax2.plot(indices, -drawdown, color="darkred", linewidth=0.8)
    ax2.set_ylabel("Drawdown (%)")
    ax2.set_xlabel("Trade #")
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(bottom=-max(drawdown) * 1.2 if max(drawdown) > 0 else -5)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"Equity curve saved to {output_path}")
    plt.close()


def plot_monthly_returns(trades, output_path="monthly_returns.png"):
    """Plot monthly returns heatmap."""
    if not trades:
        return

    # Group by trade index (proxy for time)
    monthly_pnl = {}
    trades_per_month = 20  # Approximate trades per month

    for i, t in enumerate(trades):
        month = i // trades_per_month
        if month not in monthly_pnl:
            monthly_pnl[month] = 0
        monthly_pnl[month] += t["pnl"]

    months = sorted(monthly_pnl.keys())
    returns = [monthly_pnl[m] for m in months]

    fig, ax = plt.subplots(figsize=(12, 4))
    colors = ["green" if r > 0 else "red" for r in returns]
    ax.bar(months, returns, color=colors, alpha=0.7)
    ax.axhline(y=0, color="black", linewidth=0.5)
    ax.set_xlabel("Month")
    ax.set_ylabel("P&L ($)")
    ax.set_title("Monthly Returns")
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"Monthly returns saved to {output_path}")
    plt.close()


def plot_win_distribution(trades, output_path="win_distribution.png"):
    """Plot win/loss distribution histogram."""
    if not trades:
        return

    pnls = [t["pnl"] for t in trades]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(pnls, bins=30, color="#2196F3", alpha=0.7, edgecolor="black", linewidth=0.5)
    ax.axvline(x=0, color="red", linestyle="--", linewidth=1)
    ax.axvline(x=np.mean(pnls), color="green", linestyle="-", linewidth=1.5, label=f"Mean: ${np.mean(pnls):.2f}")
    ax.set_xlabel("P&L ($)")
    ax.set_ylabel("Frequency")
    ax.set_title("Trade P&L Distribution")
    ax.legend()
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"Distribution chart saved to {output_path}")
    plt.close()


def main():
    parser = argparse.ArgumentParser(description="Equity Curve Generator")
    parser.add_argument("--data", required=True, help="Backtest results JSON")
    parser.add_argument("--output", default="equity_curve.png", help="Output image path")

    args = parser.parse_args()

    data = json.loads(Path(args.data).read_text())
    trades = data.get("trades", [])

    if not trades:
        print("No trades found in data file")
        return

    base = Path(args.output).stem
    output_dir = Path(args.output).parent

    plot_equity_curve(trades, str(output_dir / f"{base}_equity.png"))
    plot_monthly_returns(trades, str(output_dir / f"{base}_monthly.png"))
    plot_win_distribution(trades, str(output_dir / f"{base}_distribution.png"))

    print(f"\nAll charts generated in {output_dir}/")


if __name__ == "__main__":
    main()
