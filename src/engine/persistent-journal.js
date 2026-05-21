/**
 * Persistent Trade Journal
 * Saves trades to a JSON file — survives restarts.
 * Tracks: entries, exits, P&L, win rate, best/worst sessions, edge analysis.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DEFAULT_PATH = join(process.cwd(), "trade_journal.json");

function loadJournal(path = DEFAULT_PATH) {
  if (!existsSync(path)) {
    return { trades: [], metadata: { created: new Date().toISOString(), version: 1 } };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { trades: [], metadata: { created: new Date().toISOString(), version: 1 } };
  }
}

function saveJournal(journal, path = DEFAULT_PATH) {
  journal.metadata.lastUpdated = new Date().toISOString();
  writeFileSync(path, JSON.stringify(journal, null, 2));
}

export function logTrade(trade, path = DEFAULT_PATH) {
  const journal = loadJournal(path);

  const entry = {
    id: journal.trades.length + 1,
    timestamp: new Date().toISOString(),
    symbol: trade.symbol,
    direction: trade.direction,
    entry: trade.entry,
    sl: trade.sl,
    tp: trade.tp,
    lotSize: trade.lotSize || 0.01,
    checklistScore: trade.checklistScore || null,
    gatesPassed: trade.gatesPassed || null,
    setupType: trade.setupType || null,
    killZone: trade.killZone || null,
    notes: trade.notes || null,
    status: "OPEN",
    result: null,
    exitPrice: null,
    pnl: null,
    closedAt: null,
  };

  journal.trades.push(entry);
  saveJournal(journal, path);

  return entry;
}

export function closeTrade(tradeId, exitPrice, result, pnl = null, notes = null, path = DEFAULT_PATH) {
  const journal = loadJournal(path);
  const trade = journal.trades.find((t) => t.id === tradeId);

  if (!trade) return { error: `Trade #${tradeId} not found` };

  trade.status = "CLOSED";
  trade.result = result;
  trade.exitPrice = exitPrice;
  trade.pnl = pnl;
  trade.closeNotes = notes;
  trade.closedAt = new Date().toISOString();

  saveJournal(journal, path);
  return trade;
}

export function getJournalStats(path = DEFAULT_PATH) {
  const journal = loadJournal(path);
  const trades = journal.trades;
  const closed = trades.filter((t) => t.status === "CLOSED");

  if (closed.length === 0) {
    return { totalTrades: trades.length, closedTrades: 0, openTrades: trades.filter((t) => t.status === "OPEN").length, note: "No closed trades yet" };
  }

  const wins = closed.filter((t) => t.result === "win");
  const losses = closed.filter((t) => t.result === "loss");
  const be = closed.filter((t) => t.result === "breakeven");

  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length) : 0;

  // Best/worst by session
  const bySession = {};
  for (const t of closed) {
    const kz = t.killZone || "unknown";
    if (!bySession[kz]) bySession[kz] = { wins: 0, losses: 0, pnl: 0 };
    if (t.result === "win") bySession[kz].wins++;
    else if (t.result === "loss") bySession[kz].losses++;
    bySession[kz].pnl += t.pnl || 0;
  }

  // By symbol
  const bySymbol = {};
  for (const t of closed) {
    const sym = t.symbol || "unknown";
    if (!bySymbol[sym]) bySymbol[sym] = { wins: 0, losses: 0, pnl: 0 };
    if (t.result === "win") bySymbol[sym].wins++;
    else if (t.result === "loss") bySymbol[sym].losses++;
    bySymbol[sym].pnl += t.pnl || 0;
  }

  // Streak
  let streak = 0;
  let streakType = null;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (streakType === null) streakType = closed[i].result;
    if (closed[i].result === streakType) streak++;
    else break;
  }

  // Weekly stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = closed.filter((t) => new Date(t.closedAt) >= weekStart);
  const weeklyPnl = thisWeek.reduce((s, t) => s + (t.pnl || 0), 0);

  return {
    totalTrades: trades.length,
    openTrades: trades.filter((t) => t.status === "OPEN").length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    winRate: `${((wins.length / closed.length) * 100).toFixed(1)}%`,
    totalPnl: `$${totalPnl.toFixed(2)}`,
    avgWin: `$${avgWin.toFixed(2)}`,
    avgLoss: `$${avgLoss.toFixed(2)}`,
    profitFactor: avgLoss > 0 ? (avgWin * wins.length / (avgLoss * losses.length)).toFixed(2) : "Inf",
    currentStreak: `${streak} ${streakType || "—"}`,
    weeklyPnl: `$${weeklyPnl.toFixed(2)}`,
    weeklyTrades: thisWeek.length,
    bySession,
    bySymbol,
    edge: wins.length > 0 && losses.length > 0
      ? `Your edge: ${avgWin > avgLoss * 1.5 ? "GOOD RR" : avgWin > avgLoss ? "POSITIVE" : "NEEDS IMPROVEMENT"}. Best session: ${Object.entries(bySession).sort((a, b) => b[1].pnl - a[1].pnl)[0]?.[0] || "N/A"}`
      : "Need more trades to calculate edge",
  };
}

export function getTodayTrades(path = DEFAULT_PATH) {
  const journal = loadJournal(path);
  const today = new Date().toDateString();
  return journal.trades.filter((t) => new Date(t.timestamp).toDateString() === today);
}

export function getOpenTrades(path = DEFAULT_PATH) {
  const journal = loadJournal(path);
  return journal.trades.filter((t) => t.status === "OPEN");
}
