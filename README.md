# Master-ForexTrader-MCP

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tools](https://img.shields.io/badge/Tools-22-purple)]()
[![Engines](https://img.shields.io/badge/Engines-20-orange)]()

**Master-ForexTrader-MCP** — Institutional-grade forex & gold trading analysis server for [Claude Code](https://claude.ai/code). Full SMC/ICT framework with 7-gate entry system + 10-point institutional checklist. 20 analysis engines, 22 MCP tools, Python backtesting. Telegram alerts, persistent journal, auto-scan.

---

## One-Click Setup

### Windows (PowerShell)

```powershell
git clone https://github.com/ShivrajRajasekaran/Master-ForexTrader-MCP.git && cd Master-ForexTrader-MCP && npm install && claude mcp add master-forextrader -- node "%cd%\src\server.js"
```

### Mac / Linux

```bash
git clone https://github.com/ShivrajRajasekaran/Master-ForexTrader-MCP.git && cd Master-ForexTrader-MCP && npm install && claude mcp add master-forextrader -- node "$(pwd)/src/server.js"
```

### Verify Installation

```bash
npm test
```

> 24 tests, all passing. You're ready to trade.

### Python Data Science (Optional)

```bash
cd python && pip install -r requirements.txt
```

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                      CLAUDE CODE                             │
│                                                              │
│  "Should I trade XAUUSD right now?"                          │
│                       │                                      │
│                       ▼                                      │
│  ┌────────────────────────────────────────┐                  │
│  │     MASTER-FOREXTRADER-MCP             │                  │
│  │                                        │                  │
│  │  10-POINT CHECKLIST:                   │                  │
│  │  [PASS] 1. DXY Macro Bias             │                  │
│  │  [PASS] 2. 3 Timeframes Aligned       │                  │
│  │  [PASS] 3. Liquidity Sweep            │                  │
│  │  [PASS] 4. At OB/FVG/OTE Zone         │                  │
│  │  [PASS] 5. AMD Distribution           │                  │
│  │  [PASS] 6. CHoCH/CISD on LTF          │                  │
│  │  [PASS] 7. Indicator Confluence 7/8   │                  │
│  │  [PASS] 8. Bearish Engulfing          │                  │
│  │  [PASS] 9. Inside NY AM Kill Zone     │                  │
│  │  [PASS] 10. DOL = PDL @ 3218.40       │                  │
│  │                                        │                  │
│  │  SCORE: 10/10 → SELL SHORT            │                  │
│  │  Entry: 3242.50 | SL: 3248.20         │                  │
│  │  TP1: 3233.90 | TP2: 3228.30          │                  │
│  │  Size: MAXIMUM | Grade: A+            │                  │
│  └────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Tools (18 total)

### Signal & Validation

| Tool | Purpose |
|------|---------|
| `trade_signal` | 7-gate system → BUY / SELL / WAIT with grade (A+ to B) |
| `trade_checklist_10` | Full 10-point institutional checklist (min 6/10 to trade) |
| `trade_analyze` | Complete market breakdown (structure, OBs, FVGs, OTE, Kalman, AMD) |
| `trade_htf_bias` | Higher timeframe direction (4H / Daily) |
| `trade_scanner` | Score multiple pairs → ranked A+ to D |
| `trade_confirmation` | Candle patterns, zone status, divergence, Judas Swing, news filter |
| `trade_mtf_check` | Multi-timeframe alignment (HTF + ITF + LTF) |

### Session & Timing

| Tool | Purpose |
|------|---------|
| `trade_session_check` | Kill Zone status + macro window + quarterly phase |
| `trade_next_killzone` | Countdown to next tradeable window |

### Levels & Targets

| Tool | Purpose |
|------|---------|
| `trade_key_levels` | PDH/PDL, PWH/PWL, Asia/London/NY ranges, EQH/EQL, POC |
| `trade_dol` | Draw on Liquidity — most probable TP target |
| `trade_fib_extensions` | Fibonacci extension TP targets (-27%, -62%, -100%) |

### Risk & Management

| Tool | Purpose |
|------|---------|
| `trade_risk_calc` | Position size from balance + risk% + SL distance |
| `trade_partial_tp` | Partial TP levels (30% / 40% / 30% at 1.5R / 2.5R / 4R) |
| `trade_daily_limit` | Daily loss & trade count check |
| `trade_money_management` | Kelly Criterion, compounding, drawdown recovery plan |

### Journal (Persistent — survives restarts)

| Tool | Purpose |
|------|---------|
| `trade_journal_log` | Record trade entry (saved to JSON file) |
| `trade_journal_close` | Close with result (win/loss/BE) |
| `trade_journal_stats` | Win rate, streak, total P&L, edge analysis, session breakdown |
| `trade_journal_open` | View all currently open trades |

### Alerts & Automation

| Tool | Purpose |
|------|---------|
| `trade_alert_send` | Send Telegram/webhook alert when setup forms (NEVER trades) |
| `trade_alert_config` | Setup instructions for Telegram bot + Discord webhook |
| `trade_auto_scan` | Auto-scan watchlist with 10-point checklist (YOU decide to trade) |
| `trade_watchlist_status` | Quick check: Kill Zone? Limits? Ready to scan? |

---

## The 10-Point Institutional Checklist

The master validation — minimum **6/10** to enter any trade:

| # | Gate | What It Checks |
|---|------|----------------|
| 1 | **Macro Bias** | DXY direction aligns with trade (dollar weak = gold/EUR bullish) |
| 2 | **3 TF Aligned** | Daily + 4H/1H + 5M/15M all same direction |
| 3 | **Liquidity Sweep** | BSL or SSL swept within last 15 bars |
| 4 | **Institutional Zone** | Price at displacement-validated OB, FVG, or OTE (61.8-78.6%) |
| 5 | **AMD Confirmed** | Manipulation or Distribution phase detected |
| 6 | **CHoCH/CISD** | Character change or delivery shift on LTF |
| 7 | **Indicators 6+/8** | EMA stack, RSI, MACD, Bollinger, Stochastic, price action confluence |
| 8 | **Candle Confirmation** | Engulfing, Pin Bar, Hammer, Doji, or Morning/Evening Star at zone |
| 9 | **Kill Zone** | Inside London (2-5AM), NY AM (9:30-11AM), or Silver Bullet (10-11AM) |
| 10 | **DOL Identified** | Clear Draw on Liquidity target for TP (EQH/EQL, PDH/PDL, session H/L) |

**Scoring:** Below 6 = NO TRADE. 6-7 = Standard size. 8+ = Maximum size.

---

## The 7-Gate Entry System

Quick-fire validation (subset of the 10-point for fast signals):

| # | Gate | Logic |
|---|------|-------|
| 1 | **Kill Zone** | London 2-5AM, NY AM 9:30-11AM, Silver Bullet 10-11AM, NY PM 1:30-3PM EST |
| 2 | **Kalman Trend** | Kalman Filter + Supertrend confirms trending (rejects ranging) |
| 3 | **HTF Bias** | 4H/Daily structure agrees (HH/HL = Bullish, LH/LL = Bearish) |
| 4 | **Structure Event** | BOS, CHoCH, or CISD detected on LTF |
| 5 | **Liquidity Sweep** | BSL or SSL swept within last 10 bars |
| 6 | **Institutional Zone** | Price at OB, FVG, or inside OTE |
| 7 | **Trade Limits** | Under 3 trades/day + 20-bar cooldown clear |

**Modes:** Conservative (7/7) | Balanced (6/7) | Aggressive (5/7)

---

## Engines (20 total)

| Engine | Concepts |
|--------|----------|
| `kalman-filter.js` | Kalman Filter, Supertrend, ATR, WMA, trending vs ranging |
| `kill-zones.js` | ICT Kill Zones, session pivots, avoid zones |
| `structure.js` | Swing detection, BOS, CHoCH, CISD, CRT, HTF bias |
| `liquidity.js` | Order Blocks (displacement-validated), FVGs, OTE, sweeps |
| `amd.js` | AMD state machine — Accumulation/Manipulation/Distribution |
| `volume.js` | Volume profile, POC/VAH/VAL, exhaustion, displacement confirmation |
| `patterns.js` | Wyckoff Spring/UTAD, Breaker Blocks, Inducement |
| `levels.js` | PDH/PDL, PWH/PWL, session ranges, EQH/EQL |
| `time.js` | Quarterly Theory, Macro Windows (xx:50-xx:10), Silver Bullet |
| `candles.js` | Engulfing, Pin Bar, Hammer, Doji, Morning/Evening Star |
| `mitigation.js` | Zone lifecycle: FRESH → TESTED → MITIGATED → BROKEN |
| `blocks.js` | Rejection Blocks, Propulsion Blocks, Fib Extensions, Liquidity Voids |
| `mtf.js` | Multi-timeframe alignment (HTF + ITF + LTF) |
| `divergence.js` | Price/volume divergence, momentum divergence, hidden divergence |
| `sessions.js` | Session liquidity tracking, Asian Breakout, Judas Swing |
| `news.js` | High-impact event filter (NFP, FOMC, CPI, ECB, BOE) |
| `money.js` | Kelly Criterion, compounding, drawdown recovery, streak rules |
| `harmonics.js` | Gartley, Bat, Butterfly, Crab, Cypher + PRZ computation |
| `indicators.js` | EMA stack, RSI, MACD, Bollinger, Stochastic, 8-point confluence |
| `correlation.js` | DXY bias, pair correlation warnings, macro impact per symbol |

---

## Kill Zone Schedule

| Session | EST | IST | Role |
|---------|-----|-----|------|
| London KZ | 2:00 - 5:00 AM | 12:30 - 3:30 PM | Manipulation (sweeps Asia H/L) |
| NY AM KZ | 9:30 - 11:00 AM | 8:00 - 9:30 PM | Distribution (real move) |
| Silver Bullet | 10:00 - 11:00 AM | 8:30 - 9:30 PM | Single FVG sniper entry |
| NY PM KZ | 1:30 - 3:00 PM | 12:00 - 1:30 AM | Continuation |

**Avoid:** Asian (mark range only) | NY Lunch (11-1:30 PM) | Post-3 PM

---

## Safety: NO Auto-Trading

**This system will NEVER place a trade without your explicit permission.**

Even if conditions are perfect (10/10 checklist, A+ grade, inside Kill Zone) — the system only **alerts** you. YOU decide whether to enter. This is by design:

- Alerts notify, they don't execute
- Auto-scan identifies setups, doesn't place orders
- Journal records YOUR decisions, not automated ones
- No API connection to your broker for order placement

**You are the trader. The system is your analyst.**

---

## Risk Rules

| Rule | Value |
|------|-------|
| Risk per trade | 1% of balance |
| Max daily loss | -3% → stop trading |
| Max weekly loss | -5% |
| Max trades/day | 3 |
| Signal cooldown | 20 bars between signals |
| After TP1 | Move SL to breakeven immediately |
| Partial TP | 30% @ 1.5R, 40% @ 2.5R, 30% trail @ 4R |
| Loss streak | 3 consecutive → stop for the day, halve risk next day |
| Friday | No new positions after 3 PM EST |
| News | No trades 30 min before/after high-impact events |

---

## Python Data Science Layer

```bash
cd python && pip install -r requirements.txt

# Backtest the 7-gate system on historical data
python backtest.py --data ../data/XAUUSD_5M.csv --risk 1 --mode balanced --rr 2

# Monte Carlo simulation (10,000 iterations)
python statistics.py --monte-carlo --balance 25 --risk 1 --winrate 55 --rr 2

# Generate equity curve + drawdown charts
python equity_curve.py --data backtest_results.json --output charts/
```

| Script | What It Does |
|--------|-------------|
| `backtest.py` | Full 7-gate simulation → win rate, profit factor, Sharpe ratio, max DD |
| `statistics.py` | Monte Carlo survival, t-test edge validation, return distribution, correlation |
| `equity_curve.py` | Equity curve, drawdown overlay, monthly returns, P&L histogram |

---

## Architecture

```
src/
├── server.js              MCP server entry (stdio transport)
├── index.js               Library exports (all 20 engines)
├── engine/                Pure analysis engines (20 files, no I/O)
│   ├── kalman-filter.js   Trend detection (Kalman + Supertrend)
│   ├── kill-zones.js      Session timing gates
│   ├── structure.js       BOS, CHoCH, CISD, CRT, HTF bias
│   ├── liquidity.js       OBs, FVGs, OTE, sweeps
│   ├── amd.js             AMD state machine
│   ├── volume.js          Volume profile, POC, exhaustion
│   ├── patterns.js        Wyckoff, Breakers, Inducement
│   ├── levels.js          PDH/PDL, PWH/PWL, EQH/EQL
│   ├── time.js            Quarterly, Macro, Silver Bullet
│   ├── candles.js         Entry confirmation candles
│   ├── mitigation.js      Zone lifecycle (fresh/used)
│   ├── blocks.js          Rejection, Propulsion, Voids, Fib Extensions
│   ├── mtf.js             Multi-timeframe alignment
│   ├── divergence.js      Price/volume/momentum divergence
│   ├── sessions.js        Session liquidity, Judas Swing, Asian Breakout
│   ├── news.js            High-impact event filter
│   ├── money.js           Kelly, compounding, drawdown recovery
│   ├── harmonics.js       XABCD patterns (Gartley/Bat/Butterfly/Crab/Cypher)
│   ├── indicators.js      EMA, RSI, MACD, BB, Stoch — 8-point confluence
│   └── correlation.js     DXY bias, pair correlation, macro impact
├── gates/
│   └── entry-gates.js     7-gate orchestrator + confluence boosters
└── tools/                 MCP tool registrations (9 files, 18 tools)
    ├── analysis.js        trade_analyze, trade_htf_bias
    ├── signal.js          trade_signal
    ├── risk.js            trade_risk_calc, trade_partial_tp, trade_daily_limit
    ├── session.js         trade_session_check, trade_next_killzone
    ├── scanner.js         trade_scanner
    ├── journal.js         trade_journal_log/close/stats/open (persistent)
    ├── levels.js          trade_key_levels, trade_dol
    ├── confirmation.js    trade_confirmation, trade_mtf_check, trade_fib_extensions, trade_money_management
    ├── checklist.js       trade_checklist_10
    ├── alerts.js          trade_alert_send, trade_alert_config
    └── autoscan.js        trade_auto_scan, trade_watchlist_status
tests/
└── engines.test.js        24 tests
python/
├── backtest.py            7-gate backtester
├── statistics.py          Monte Carlo, edge validation
├── equity_curve.py        Chart generation
└── requirements.txt
```

---

## Works With

- **Claude Code** — AI layer that orchestrates all tools
- **TradingView Desktop** — via CDP (port 9222) for live chart data
- **Any broker** — connected through TradingView's trading panel
- **Python** — for backtesting, statistics, and visualization

---

## Concepts Covered (48+)

**Structure:** BOS, CHoCH, CISD, CRT, HH/HL/LH/LL, Swing H/L, Market Structure Shift

**Liquidity:** BSL/SSL Sweeps, Stop Hunts, Judas Swing, EQH/EQL, PDH/PDL, PWH/PWL, Inducement

**Zones:** Order Blocks, FVGs, OTE, Rejection Blocks, Propulsion Blocks, Breaker Blocks, Liquidity Voids, Harmonic PRZ

**Trend:** Kalman Filter, Supertrend, EMA Stack, Premium/Discount, MTF Alignment, DXY Correlation

**Timing:** Kill Zones, Quarterly Theory, Macro Windows, Silver Bullet, Asian Breakout, News Filter

**Patterns:** Wyckoff Spring/UTAD, AMD Cycle, Engulfing, Pin Bar, Hammer, Doji, Morning/Evening Star, Gartley, Bat, Butterfly, Crab, Cypher

**Volume:** POC/VAH/VAL, Exhaustion, Displacement Validation, Price/Volume Divergence

**Risk:** Kelly Criterion, Compounding, Drawdown Recovery, Partial TP, Streak Management, Correlation Warning

---

## License

MIT

---

Built by [ShivrajRajasekaran](https://github.com/ShivrajRajasekaran) — Full ICT/SMC institutional trading system with Kalman Filter from AlgoAlpha.
