/**
 * Alert Engine
 * Sends notifications when setups form. NEVER executes trades.
 * Rule: Only the user decides when to trade. This just notifies.
 */

export function formatAlertMessage(checklist, symbol = "XAUUSD") {
  const { score, direction, sizing, checklist: gates } = checklist;

  if (parseInt(score) < 6) return null; // No alert for weak setups

  const grade = parseInt(score) >= 9 ? "A+" : parseInt(score) >= 8 ? "A" : parseInt(score) >= 7 ? "B+" : "B";
  const emoji = direction === "LONG" ? "BUY" : "SELL";

  const message = [
    `=== MASTER TRADER ALERT ===`,
    ``,
    `${emoji} ${symbol} — ${direction}`,
    `Score: ${score} | Grade: ${grade} | Size: ${sizing}`,
    ``,
    `--- CHECKLIST ---`,
    gates,
    ``,
    `--- IMPORTANT ---`,
    `This is NOT an auto-trade.`,
    `Review the setup. YOU decide whether to enter.`,
    ``,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");

  return message;
}

export function shouldAlert(checklistResult) {
  const score = parseInt(checklistResult.score);
  return score >= 6;
}

export async function sendTelegramAlert(botToken, chatId, message) {
  /**
   * Sends alert to Telegram. Requires:
   * 1. Create bot via @BotFather on Telegram
   * 2. Get your chat ID via @userinfobot
   * 3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
   */
  if (!botToken || !chatId || !message) return { sent: false, reason: "Missing credentials" };

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const data = await response.json();
    return { sent: data.ok, messageId: data.result?.message_id };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export async function sendWebhookAlert(webhookUrl, payload) {
  /**
   * Generic webhook (Discord, Slack, custom server).
   */
  if (!webhookUrl) return { sent: false, reason: "No webhook URL" };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return { sent: response.ok, status: response.status };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}
