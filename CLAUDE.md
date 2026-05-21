# Master-ForexTrader-MCP

Institutional-grade forex/gold trading analysis MCP server for Claude Code.

## Architecture

```
src/
  server.js          — MCP server entry point (StdioTransport)
  index.js           — Library exports for direct use
  engine/            — Pure analysis engines (no I/O, no side effects)
    kalman-filter.js — Kalman Filter + Supertrend trend detection
    kill-zones.js    — Session timing (London KZ, NY AM, Silver Bullet)
    structure.js     — Market structure (BOS, CHoCH, CISD, CRT, HTF bias)
    liquidity.js     — OBs, FVGs, OTE, sweeps (with displacement validation)
    amd.js           — AMD state machine (Accumulation/Manipulation/Distribution)
    volume.js        — Volume analysis, POC, exhaustion detection
    patterns.js      — Wyckoff Spring/UTAD, Breaker Blocks, Inducement
    levels.js        — PDH/PDL, PWH/PWL, session ranges, EQH/EQL
    time.js          — Quarterly theory, macro windows, Silver Bullet timing
  gates/
    entry-gates.js   — 7-gate orchestrator (all engines → single BUY/SELL/WAIT)
  tools/             — MCP tool registrations (parse JSON input, call engines, format output)
    analysis.js      — trade_analyze, trade_htf_bias
    signal.js        — trade_signal (7-gate)
    risk.js          — trade_risk_calc, trade_partial_tp, trade_daily_limit
    session.js       — trade_session_check, trade_next_killzone
    scanner.js       — trade_scanner (multi-pair scoring)
    journal.js       — trade_journal_log/close/stats/open (persistent file-based)
    levels.js        — trade_key_levels, trade_dol
    alerts.js        — trade_alert_send, trade_alert_config
    autoscan.js      — trade_auto_scan, trade_watchlist_status
tests/
  engines.test.js    — Node test runner tests for all engines
```

## Commands

- `npm start` — Run MCP server
- `npm test` — Run test suite
- `npm run dev` — Watch mode

## Rules

- NEVER auto-execute trades. System alerts only — user decides.
- Engines must be pure functions — no network I/O, no filesystem access (exception: alerts.js, persistent-journal.js).
- Tools parse JSON string inputs, call engines, return JSON text content.
- Never generate a BUY/SELL outside a Kill Zone.
- Never trade during RANGING conditions (Kalman).
- OBs require displacement validation (1.5x avg body minimum).
- Max 3 trades per day, 20-bar cooldown between signals.
- Risk: 1% per trade, 3% daily max, 5% weekly max.

## Adding a new engine

1. Create `src/engine/your-engine.js` with pure exported functions
2. Add exports to `src/index.js`
3. If it feeds the gate system, import in `src/gates/entry-gates.js`
4. If it needs a tool, create `src/tools/your-tool.js` and register in `server.js`
5. Add tests in `tests/`
