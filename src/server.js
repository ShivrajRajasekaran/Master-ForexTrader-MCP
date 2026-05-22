#!/usr/bin/env node
/**
 * Master-ForexTrader-MCP Server
 * Institutional-grade forex trading analysis for Claude Code.
 *
 * Install: claude mcp add master-forextrader node /path/to/Master-ForexTrader-MCP/src/server.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerSignalTools } from "./tools/signal.js";
import { registerRiskTools } from "./tools/risk.js";
import { registerSessionTools } from "./tools/session.js";
import { registerScannerTools } from "./tools/scanner.js";
import { registerJournalTools } from "./tools/journal.js";
import { registerLevelsTools } from "./tools/levels.js";
import { registerConfirmationTools } from "./tools/confirmation.js";
import { registerChecklistTools } from "./tools/checklist.js";
import { registerAlertTools } from "./tools/alerts.js";
import { registerAutoScanTools } from "./tools/autoscan.js";
import { registerOrderFlowTools } from "./tools/orderflow.js";
import { registerC4Tools } from "./tools/c4.js";
import { registerCoreStrategyTools } from "./tools/core-strategies.js";
import { registerElliottTools } from "./tools/elliott.js";

const server = new McpServer(
  {
    name: "master-forextrader",
    version: "1.0.0",
    description: "Master-ForexTrader-MCP — Institutional forex trading analysis with SMC/ICT framework, 7-gate entry system, 10-point checklist",
  },
  {
    instructions: `Master-ForexTrader-MCP — Professional institutional trading analysis.

TOOL SELECTION GUIDE:

Checking if you should trade RIGHT NOW:
- trade_session_check → Kill Zone gate + current session info + IST/EST/UTC time
- trade_signal → Full 7-gate analysis with BUY/SELL/WAIT decision

Full market analysis:
- trade_analyze → Complete institutional analysis (structure, OBs, FVGs, OTE, liquidity, Kalman trend)
- trade_htf_bias → Higher timeframe bias check (pass 4H or Daily bars)

Risk & position sizing:
- trade_risk_calc → Calculate lot size, SL, TP based on account balance and risk %
- trade_partial_tp → Get partial TP levels (30/40/30 split)

RULES:
1. NEVER generate a BUY/SELL signal outside Kill Zones
2. NEVER trade during RANGING conditions (Kalman filter)
3. MINIMUM 6/7 gates must pass for Conservative mode
4. Maximum 3 trades per day
5. Always show the gate checklist to the user
6. If signal is WAIT — say WAIT. Patience IS the edge.
`,
  }
);

registerAnalysisTools(server);
registerSignalTools(server);
registerRiskTools(server);
registerSessionTools(server);
registerScannerTools(server);
registerJournalTools(server);
registerLevelsTools(server);
registerConfirmationTools(server);
registerChecklistTools(server);
registerAlertTools(server);
registerAutoScanTools(server);
registerOrderFlowTools(server);
registerC4Tools(server);
registerCoreStrategyTools(server);
registerElliottTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
