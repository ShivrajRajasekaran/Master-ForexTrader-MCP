import { z } from "zod";
import { formatAlertMessage, shouldAlert, sendTelegramAlert, sendWebhookAlert } from "../engine/alerts.js";

export function registerAlertTools(server) {
  server.tool(
    "trade_alert_send",
    "Send a trade alert via Telegram or webhook. NEVER executes a trade — only notifies YOU. You decide whether to trade.",
    {
      checklist_result: z.string().describe("JSON string of checklist/signal result"),
      symbol: z.string().optional().describe("Trading pair (default XAUUSD)"),
      telegram_token: z.string().optional().describe("Telegram bot token (from @BotFather)"),
      telegram_chat_id: z.string().optional().describe("Telegram chat ID"),
      webhook_url: z.string().optional().describe("Discord/Slack/custom webhook URL"),
    },
    async ({ checklist_result, symbol = "XAUUSD", telegram_token, telegram_chat_id, webhook_url }) => {
      try {
        const result = JSON.parse(checklist_result);

        if (!shouldAlert(result)) {
          return { content: [{ type: "text", text: JSON.stringify({ sent: false, reason: "Score below 6 — no alert sent" }) }] };
        }

        const message = formatAlertMessage(result, symbol);
        if (!message) {
          return { content: [{ type: "text", text: JSON.stringify({ sent: false, reason: "Could not format alert" }) }] };
        }

        const results = { message, deliveries: [] };

        if (telegram_token && telegram_chat_id) {
          const tg = await sendTelegramAlert(telegram_token, telegram_chat_id, message);
          results.deliveries.push({ channel: "telegram", ...tg });
        }

        if (webhook_url) {
          const wh = await sendWebhookAlert(webhook_url, { content: message, symbol, score: result.score, direction: result.direction });
          results.deliveries.push({ channel: "webhook", ...wh });
        }

        if (results.deliveries.length === 0) {
          results.note = "No delivery channel configured. Set telegram_token+telegram_chat_id or webhook_url.";
          results.messagePreview = message;
        }

        results.reminder = "This is an ALERT only. NO trade was placed. YOU decide whether to enter.";

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_alert_config",
    "Show alert configuration instructions for Telegram and webhook setup.",
    {},
    async () => {
      const config = {
        telegram: {
          step1: "Message @BotFather on Telegram → /newbot → get your bot token",
          step2: "Message @userinfobot → get your chat ID",
          step3: "Pass telegram_token and telegram_chat_id to trade_alert_send",
        },
        discord: {
          step1: "Server Settings → Integrations → Webhooks → New Webhook",
          step2: "Copy webhook URL",
          step3: "Pass webhook_url to trade_alert_send",
        },
        rules: [
          "Alerts NEVER place trades — they only notify you",
          "Only score 6+ triggers an alert",
          "You must explicitly decide to enter after receiving alert",
          "System will NEVER auto-execute without your permission",
        ],
      };
      return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
    }
  );
}
