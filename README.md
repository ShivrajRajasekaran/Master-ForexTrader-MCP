# Master Trader MCP

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Institutional-grade forex & gold trading analysis server for [Claude Code](https://claude.ai/code). Full SMC/ICT framework with a 7-gate entry system — no signal fires unless all conditions align.

---

## Quick Start

```bash
git clone https://github.com/ShivrajRajasekaran/Master-Trader-MCP.git
cd Master-Trader-MCP
npm install
```

**Add to Claude Code:**

```bash
claude mcp add master-trader node /absolute/path/to/Master-Trader-MCP/src/server.js
```

**Verify:**

```bash
npm test   # 24 tests, all passing
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE CODE                           │
│                                                         │
│   "Should I trade XAUUSD right now?"                    │
│                        │                                │
│                        ▼                                │
│   ┌─────────────────────────────────────┐               │
│   │       MASTER TRADER MCP             │               │
│   │                                     │               │
│   │   Gate 1: Kill Zone         [PASS]  │               │
│   │   Gate 2: Kalman Trend      [PASS]  │               │
│   │   Gate 3: HTF Bias          [PASS]  │               │
│   │   Gate 4: Structure (CISD)  [PASS]  │               │
│   │   Gate 5: Liquidity Sweep   [PASS]  │               │
│   │   Gate 6: OB/FVG/OTE Zone   [PASS]  │               │
│   │   Gate 7: Trade Limits      [PASS]  │               │
│   │                                     │               │
│   │   → SELL SHORT @ 3242.50           │               │
│   │     SL: 3248.20 | TP: 3231.10     │               │
│   │     Grade: A+ | RR: 1:2.0          │               │
│   └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Tools (13 total)

### Signal & Analysis

| Tool | Purpose |
|------|---------|
| `trade_signal` | Full 7-gate system → BUY / SELL / WAIT |
| `trade_analyze` | Complete market breakdown (structure, OBs, FVGs, OTE, Kalman, AMD) |
| `trade_htf_bias` | Higher timeframe direction (4H / Daily) |
| `trade_scanner` | Score multiple pairs → ranked A+ to D |

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

### Risk & Management

| Tool | Purpose |
|------|---------|
| `trade_risk_calc` | Position size from balance + risk% + SL distance |
| `trade_partial_tp` | Partial TP levels (30% / 40% / 30% at 1.5R / 2.5R / 4R) |
| `trade_daily_limit` | Daily loss & trade count check |

### Journal

| Tool | Purpose |
|------|---------|
| `trade_journal_log` | Record trade entry |
| `trade_journal_close` | Close with result (win/loss/BE) |
| `trade_journal_stats` | Win rate, streak, total P&L |

---

## The 7-Gate Entry System

Every signal must pass through these gates sequentially:

| # | Gate | Logic |
|---|------|-------|
| 1 | **Kill Zone** | London 2-5AM, NY AM 9:30-11AM, Silver Bullet 10-11AM, NY PM 1:30-3PM EST |
| 2 | **Kalman Trend** | Kalman Filter + Supertrend confirms trending (rejects ranging) |
| 3 | **HTF Bias** | 4H/Daily structure agrees (HH/HL = Bullish, LH/LL = Bearish) |
| 4 | **Structure Event** | BOS, CHoCH, or CISD detected on LTF |
| 5 | **Liquidity Sweep** | BSL or SSL swept within last 10 bars |
| 6 | **Institutional Zone** | Price at displacement-validated OB, FVG, or inside OTE (61.8-78.6%) |
| 7 | **Trade Limits** | Under 3 trades/day + 20-bar cooldown clear |

**Sensitivity modes:**
- Conservative — 7/7 gates required
- Balanced — 6/7 minimum
- Aggressive — 5/7 minimum

---

## Engines

| Engine | Concepts |
|--------|----------|
| `kalman-filter.js` | Kalman Filter, Supertrend, ATR, WMA, trending vs ranging |
| `kill-zones.js` | ICT Kill Zones, session pivots, avoid zones |
| `structure.js` | Swing detection, BOS, CHoCH, CISD, CRT, HTF bias |
| `liquidity.js` | Order Blocks (displacement-validated), FVGs, OTE, sweeps |
| `amd.js` | AMD state machine — detects accumulation/manipulation/distribution |
| `volume.js` | Volume profile, POC/VAH/VAL, exhaustion, displacement validation |
| `patterns.js` | Wyckoff Spring/UTAD, Breaker Blocks, Inducement |
| `levels.js` | PDH/PDL, PWH/PWL, session ranges, EQH/EQL |
| `time.js` | Quarterly Theory, Macro Windows (xx:50-xx:10), Silver Bullet |

---

## Kill Zone Schedule

| Session | EST | IST | Role |
|---------|-----|-----|------|
| London KZ | 2:00 - 5:00 AM | 12:30 - 3:30 PM | Manipulation (sweeps Asia) |
| NY AM KZ | 9:30 - 11:00 AM | 8:00 - 9:30 PM | Distribution (real move) |
| Silver Bullet | 10:00 - 11:00 AM | 8:30 - 9:30 PM | Single FVG sniper entry |
| NY PM KZ | 1:30 - 3:00 PM | 12:00 - 1:30 AM | Continuation |

**Avoid:** Asian session (mark range only), NY Lunch (12-1:30 PM), Post-3 PM.

---

## Risk Rules

| Rule | Value |
|------|-------|
| Risk per trade | 1% of balance |
| Max daily loss | -3% → stop |
| Max weekly loss | -5% |
| Max trades/day | 3 |
| Signal cooldown | 20 bars |
| After TP1 | Move SL to breakeven |
| Partial TP | 30% @ 1.5R, 40% @ 2.5R, 30% trail @ 4R |

---

## Architecture

```
src/
├── server.js              MCP server entry (stdio transport)
├── index.js               Library exports
├── engine/                Pure analysis engines (no I/O)
│   ├── kalman-filter.js
│   ├── kill-zones.js
│   ├── structure.js
│   ├── liquidity.js
│   ├── amd.js
│   ├── volume.js
│   ├── patterns.js
│   ├── levels.js
│   └── time.js
├── gates/
│   └── entry-gates.js     7-gate orchestrator
└── tools/                 MCP tool registrations
    ├── analysis.js
    ├── signal.js
    ├── risk.js
    ├── session.js
    ├── scanner.js
    ├── journal.js
    └── levels.js
tests/
└── engines.test.js        24 tests
```

---

## Works With

- **Claude Code** — as the AI layer that calls tools
- **TradingView Desktop** — via CDP (port 9222) for live chart data
- **Any broker** — that connects through TradingView's trading panel

---

## License

MIT

---

Built by [ShivrajRajasekaran](https://github.com/ShivrajRajasekaran) — based on ICT/SMC methodology with Kalman Filter trend detection from AlgoAlpha.
