# Master Trader MCP

Institutional-grade forex trading analysis plugin for Claude Code. Built on the SMC/ICT framework used by 15+ year professional traders.

## What This Is

An MCP (Model Context Protocol) server that provides professional trading analysis tools to Claude Code. Instead of amateur EMA/RSI signals, it implements the full institutional system:

- **7-Gate Entry System** — Every signal must pass 7 validation gates
- **Kill Zone Sessions** — Only trade London (2-5AM EST) and NY AM (9:30-11AM EST)
- **Kalman Filter** — Detect trending vs ranging (no trades during chop)
- **AMD Model** — Accumulation → Manipulation → Distribution
- **Liquidity Sweeps** — BSL/SSL detection and sweep confirmation
- **CRT (Candle Range Theory)** — HTF candle H/L as liquidity targets
- **CISD (Change in State of Delivery)** — Precise order flow shift detection
- **OTE Zone** — Fibonacci 61.8-78.6% entry zone
- **Order Blocks** — Last opposite candle before displacement
- **Fair Value Gaps** — 3-candle imbalance entry zones
- **Partial TP Management** — 30/40/30 split at 1.5R/2.5R/4R
- **Risk Management** — 1% per trade, 3% daily max, max 3 trades/day

## Install

```bash
# Clone the repo
git clone https://github.com/shivraj-prajapati/master-trader-mcp.git
cd master-trader-mcp

# Install dependencies
npm install

# Add to Claude Code
claude mcp add master-trader node /path/to/master-trader-mcp/src/server.js
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `trade_session_check` | Kill Zone gate — current session status |
| `trade_next_killzone` | Time until next tradeable session |
| `trade_signal` | Full 7-gate analysis → BUY/SELL/WAIT |
| `trade_analyze` | Complete market structure report |
| `trade_htf_bias` | Higher timeframe bias check |
| `trade_risk_calc` | Position sizing calculator |
| `trade_partial_tp` | Partial TP levels (30/40/30) |
| `trade_daily_limit` | Daily risk limit checker |

## The 7-Gate System

```
GATE 1: Kill Zone          → Is it London or NY AM session?
GATE 2: Kalman Trend       → Is market trending (not ranging)?
GATE 3: HTF Bias           → Does 4H/Daily structure agree?
GATE 4: Structure Event    → BOS, CHoCH, or CISD detected?
GATE 5: Liquidity Sweep    → Has BSL/SSL been swept recently?
GATE 6: Institutional Zone → Price at OB, FVG, or OTE?
GATE 7: Trade Limits       → Under max trades + cooldown clear?
```

**Conservative mode**: ALL 7 gates must pass.
**Balanced mode**: 6/7 gates minimum.
**Aggressive mode**: 5/7 gates minimum.

## Kill Zone Schedule (EST → IST)

| Session | EST | IST | Action |
|---------|-----|-----|--------|
| London KZ | 2:00-5:00 AM | 12:30-3:30 PM | TRADE (manipulation) |
| NY AM KZ | 9:30-11:00 AM | 7:00-8:30 PM | TRADE (distribution) |
| Silver Bullet | 10:00-11:00 AM | 7:30-8:30 PM | Backup entry |
| Asian | 8:00 PM-2:00 AM | 6:30 AM-12:30 PM | WAIT (mark range) |
| NY Lunch | 12:00-1:00 PM | 9:30-10:30 PM | AVOID |

## Risk Rules

- 1% risk per trade (NEVER more)
- 3% daily max loss → stop trading
- 5% weekly max loss
- Max 3 trades per day
- 20-bar cooldown between signals
- Never move SL against trade direction
- After TP1 → move SL to breakeven (zero risk)

## Works With

- **TradingView Desktop** via CDP (port 9222) for live chart data
- **Any broker** that shows in TradingView's trading panel
- **Claude Code** as the intelligence layer

## Architecture

```
Claude Code ←→ Master Trader MCP (analysis) ←→ TradingView MCP (chart data/drawing)
```

This plugin provides the BRAIN (analysis logic). It works alongside the TradingView MCP which provides the EYES (chart reading) and HANDS (drawing/execution).

## License

MIT

## Credits

Based on ICT (Inner Circle Trader) and SMC (Smart Money Concepts) methodology, with Kalman Filter trend detection from AlgoAlpha.
