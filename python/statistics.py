"""
Master Trader Statistics & Analytics Engine
Advanced statistical analysis that JavaScript can't easily do.

Features:
- Monte Carlo simulation (account survival probability)
- Distribution analysis (are your returns normal?)
- Optimal position sizing (beyond Kelly)
- Correlation matrix between pairs
- Statistical edge validation (is your system real or lucky?)

Usage:
    python python/statistics.py --trades journal.json
    python python/statistics.py --monte-carlo --balance 25 --risk 1 --winrate 55 --rr 2
"""

import json
import sys
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


def monte_carlo_simulation(balance, risk_percent, win_rate, avg_rr, n_simulations=10000, n_trades=100):
    """
    Monte Carlo: simulate N different sequences of trades.
    Answers: "What's the probability my account survives 100 trades?"
    """
    survival_count = 0
    final_balances = []
    max_drawdowns = []
    ruin_count = 0

    for _ in range(n_simulations):
        current = balance
        peak = balance
        max_dd = 0

        for _ in range(n_trades):
            risk = current * (risk_percent / 100)
            if np.random.random() < win_rate:
                current += risk * avg_rr
            else:
                current -= risk

            if current <= 0:
                ruin_count += 1
                break

            peak = max(peak, current)
            dd = (peak - current) / peak * 100
            max_dd = max(max_dd, dd)

        if current > 0:
            survival_count += 1
            final_balances.append(current)
            max_drawdowns.append(max_dd)

    final_arr = np.array(final_balances) if final_balances else np.array([0])
    dd_arr = np.array(max_drawdowns) if max_drawdowns else np.array([0])

    return {
        "simulations": n_simulations,
        "trades_per_sim": n_trades,
        "survival_rate": f"{(survival_count / n_simulations) * 100:.1f}%",
        "ruin_probability": f"{(ruin_count / n_simulations) * 100:.2f}%",
        "median_final_balance": f"${np.median(final_arr):.2f}",
        "mean_final_balance": f"${np.mean(final_arr):.2f}",
        "worst_case_5th_pct": f"${np.percentile(final_arr, 5):.2f}",
        "best_case_95th_pct": f"${np.percentile(final_arr, 95):.2f}",
        "median_max_drawdown": f"{np.median(dd_arr):.1f}%",
        "worst_drawdown_95th": f"{np.percentile(dd_arr, 95):.1f}%",
        "verdict": "SYSTEM VIABLE" if survival_count / n_simulations > 0.95 else "HIGH RISK — improve stats before trading live",
    }


def validate_edge(trades_pnl, confidence_level=0.95):
    """
    Statistical test: Is your trading edge REAL or just luck?
    Uses t-test to determine if mean return is significantly > 0.
    """
    if len(trades_pnl) < 30:
        return {"valid": False, "reason": "Need 30+ trades for statistical significance"}

    arr = np.array(trades_pnl)
    mean_return = np.mean(arr)
    std_return = np.std(arr, ddof=1)
    n = len(arr)

    # One-sample t-test: is mean significantly different from 0?
    t_stat = mean_return / (std_return / np.sqrt(n))
    p_value = 1 - scipy_stats.t.cdf(t_stat, df=n - 1)

    # Confidence interval
    margin = scipy_stats.t.ppf(confidence_level, df=n - 1) * (std_return / np.sqrt(n))
    ci_lower = mean_return - margin
    ci_upper = mean_return + margin

    return {
        "sample_size": n,
        "mean_pnl": f"${mean_return:.2f}",
        "std_pnl": f"${std_return:.2f}",
        "t_statistic": round(t_stat, 3),
        "p_value": round(p_value, 4),
        "confidence_interval": f"[${ci_lower:.2f}, ${ci_upper:.2f}]",
        "statistically_significant": p_value < (1 - confidence_level),
        "verdict": "EDGE CONFIRMED — statistically significant positive returns"
        if p_value < 0.05 and mean_return > 0
        else "NOT SIGNIFICANT — could be random. Need more trades or better system.",
    }


def distribution_analysis(trades_pnl):
    """
    Analyze return distribution.
    Normal = predictable. Fat tails = big outliers (common in trading).
    """
    arr = np.array(trades_pnl)
    if len(arr) < 10:
        return {"error": "Need 10+ trades"}

    skewness = scipy_stats.skew(arr)
    kurtosis = scipy_stats.kurtosis(arr)
    _, normality_p = scipy_stats.shapiro(arr[:5000])  # Shapiro limited to 5000

    return {
        "count": len(arr),
        "mean": f"${np.mean(arr):.2f}",
        "median": f"${np.median(arr):.2f}",
        "std": f"${np.std(arr):.2f}",
        "skewness": round(skewness, 3),
        "kurtosis": round(kurtosis, 3),
        "is_normal": normality_p > 0.05,
        "normality_p_value": round(normality_p, 4),
        "interpretation": {
            "skew": "Positive (more big wins)" if skewness > 0.5 else "Negative (more big losses)" if skewness < -0.5 else "Symmetric",
            "tails": "Fat tails (outlier risk)" if kurtosis > 3 else "Thin tails (predictable)" if kurtosis < 0 else "Normal tails",
            "normality": "Returns are normally distributed" if normality_p > 0.05 else "Returns are NOT normal — use non-parametric methods",
        },
    }


def pair_correlation(pair_data):
    """
    Correlation matrix between pairs.
    High correlation = don't trade both (same risk exposure).

    pair_data: dict of {symbol: [close_prices]}
    """
    df = pd.DataFrame(pair_data)
    returns = df.pct_change().dropna()
    corr_matrix = returns.corr()

    # Find highly correlated pairs (>0.7)
    warnings = []
    symbols = list(corr_matrix.columns)
    for i in range(len(symbols)):
        for j in range(i + 1, len(symbols)):
            corr = corr_matrix.iloc[i, j]
            if abs(corr) > 0.7:
                warnings.append({
                    "pair1": symbols[i],
                    "pair2": symbols[j],
                    "correlation": round(corr, 3),
                    "warning": f"HIGH correlation — trading both = doubled risk exposure",
                })

    return {
        "correlation_matrix": corr_matrix.round(3).to_dict(),
        "warnings": warnings,
        "rule": "Never trade 2 pairs with correlation > 0.7 in same direction simultaneously.",
    }


def optimal_trades_per_day(win_rate, avg_rr, max_daily_loss_percent=3.0, risk_per_trade=1.0):
    """
    Calculate optimal number of trades per day based on statistics.
    Too many = over-trading. Too few = leaving money on table.
    """
    expected_loss_per_trade = (1 - win_rate) * risk_per_trade
    max_trades_before_limit = max_daily_loss_percent / expected_loss_per_trade

    # Account for variance
    safe_max = int(max_trades_before_limit * 0.7)  # 70% safety buffer

    ev_per_trade = win_rate * avg_rr * risk_per_trade - (1 - win_rate) * risk_per_trade
    optimal = min(safe_max, 3)  # Cap at 3 (institutional standard)

    return {
        "expected_value_per_trade": f"{ev_per_trade:.3f}%",
        "max_before_daily_limit": int(max_trades_before_limit),
        "safe_maximum": safe_max,
        "recommended": optimal,
        "reason": f"At {win_rate*100:.0f}% win rate with 1:{avg_rr} RR, {optimal} trades optimizes return while protecting capital.",
    }


def main():
    parser = argparse.ArgumentParser(description="Master Trader Statistics Engine")
    parser.add_argument("--trades", help="Path to trades JSON (from backtest or journal)")
    parser.add_argument("--monte-carlo", action="store_true", help="Run Monte Carlo simulation")
    parser.add_argument("--balance", type=float, default=25.0)
    parser.add_argument("--risk", type=float, default=1.0)
    parser.add_argument("--winrate", type=float, default=55.0)
    parser.add_argument("--rr", type=float, default=2.0)

    args = parser.parse_args()

    if args.monte_carlo:
        print("Running Monte Carlo simulation (10,000 iterations)...")
        result = monte_carlo_simulation(
            args.balance, args.risk, args.winrate / 100, args.rr
        )
        print("\n" + "=" * 50)
        print("  MONTE CARLO RESULTS")
        print("=" * 50)
        for k, v in result.items():
            print(f"  {k:30s}: {v}")

        optimal = optimal_trades_per_day(args.winrate / 100, args.rr)
        print("\n  OPTIMAL TRADING FREQUENCY")
        for k, v in optimal.items():
            print(f"  {k:30s}: {v}")
        return

    if args.trades:
        data = json.loads(Path(args.trades).read_text())
        trades = data.get("trades", data) if isinstance(data, dict) else data
        pnls = [t["pnl"] for t in trades if "pnl" in t]

        print("=" * 50)
        print("  STATISTICAL ANALYSIS")
        print("=" * 50)

        edge = validate_edge(pnls)
        print("\n  EDGE VALIDATION:")
        for k, v in edge.items():
            print(f"    {k}: {v}")

        dist = distribution_analysis(pnls)
        print("\n  DISTRIBUTION:")
        for k, v in dist.items():
            if isinstance(v, dict):
                for kk, vv in v.items():
                    print(f"    {kk}: {vv}")
            else:
                print(f"    {k}: {v}")
    else:
        print("Usage:")
        print("  python statistics.py --monte-carlo --balance 25 --risk 1 --winrate 55 --rr 2")
        print("  python statistics.py --trades backtest_results.json")


if __name__ == "__main__":
    main()
