# Forex Session — Kill Zone Status & Timing

Check current Kill Zone, session info, and countdown to next tradeable window.

## What To Do

1. Run `trade_session_check`
2. Display:
   - **Current Session:** Which Kill Zone (or dead zone)
   - **Can Trade:** YES / NO
   - **Time (IST/EST/UTC):** Current time in all zones
   - **Reason:** Why you can/can't trade
3. If outside Kill Zone, run `trade_next_killzone`:
   - Show countdown to next window
   - Which session it is
   - What to expect (London = sweeps of the Asian range, NY = real move of the day)

## Kill Zone Schedule (matches CLAUDE.md — only these two windows are tradeable)

| Session | New York time | IST (winter) | Role |
|---------|---------------|--------------|------|
| London KZ | 2:00-5:00 AM | 12:30-3:30 PM | Manipulation (sweeps Asia) |
| NY KZ | 7:00-10:00 AM | 5:30-8:30 PM | Distribution (real move) |

IST times shift 1 hour earlier while the US/UK are on summer time; the server computes this itself.

## Rules
- Asian session = mark range only, don't trade
- Outside the two kill zones = no new trades (this includes the old Silver Bullet 10-11 AM and NY PM 1:30-3 PM windows)
- Friday after 3 PM New York = flat, no new trades
