import { z } from "zod";
import { analyzeElliottWave } from "../engine/elliott-wave.js";

export function registerElliottTools(server) {
  server.tool(
    "trade_elliott_wave",
    "Elliott Wave analysis — counts 5-wave impulse structures and ABC corrections. Identifies current wave position for entry/exit timing. Uses Fibonacci ratios for wave validation.",
    {
      bars: z.string().describe("JSON array of OHLCV bars. Minimum 30 bars, 100+ recommended for accuracy."),
      config: z.string().optional().describe("JSON config: {minSwingSize (default 0.005), lookback (default 100)}"),
    },
    async ({ bars: barsJson, config: configJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const config = configJson ? JSON.parse(configJson) : {};
        const result = analyzeElliottWave(bars, config);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
