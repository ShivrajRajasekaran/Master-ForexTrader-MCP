# Master Trader Skill

Trigger: `/master-trade`

## What this does

Runs the full institutional 7-gate trading analysis system on the current chart. Combines:

1. **Kill Zone Check** — Are we in London/NY AM session?
2. **Kalman Trend Filter** — Is the market trending or ranging?
3. **HTF Bias** — Does the higher timeframe agree?
4. **Structure** — BOS/CHoCH/CISD detected?
5. **Liquidity Sweep** — Has a sweep occurred in last 10 bars?
6. **Institutional Zone** — Price at OB/FVG/OTE?
7. **Trade Limits** — Under max trades for today?

## Output

Returns one of:
- **BUY LONG** — All gates pass, bullish setup
- **SELL SHORT** — All gates pass, bearish setup  
- **WAIT** — Not enough confirmation, stay flat

With: Entry, SL, TP, RR ratio, gate checklist, and confidence score.

## Usage

```
/master-trade
```

Or use the MCP tools individually:
- `trade_session_check` — Kill Zone status
- `trade_signal` — Full gate analysis
- `trade_analyze` — Market structure report
- `trade_risk_calc` — Position sizing
- `trade_partial_tp` — Partial TP levels
