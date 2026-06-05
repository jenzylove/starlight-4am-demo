import { getTracer, flushTelemetry } from '../lib/otel.js';
import { SpanStatusCode } from '@opentelemetry/api';

async function handler(req, res) {
  const tracer = getTracer();
  const span = tracer.startSpan('POST /api/swap');
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.route', '/api/swap');

  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { tokenIn, tokenOut, amountIn } = req.body;

    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Apply user's slippage tolerance to protect against price movement
    const slippageBps = req.body.slippage.bps;

    try {
      const { AppKit } = await import("@circle-fin/app-kit");
      const kit = new AppKit();

      const result = await kit.swap({
        from: { chain: "Arc_Testnet" },
        tokenIn,
        tokenOut,
        amountIn: String(amountIn),
        slippageBps,
        config: {
          kitKey: process.env.VITE_CIRCLE_KIT_KEY,
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return res.status(200).json({
        success: true,
        txHash: result?.txHash ?? result?.hash ?? "submitted"
      });

    } catch (error) {
      console.error("Swap error:", error);
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    // Catches the planted slippage TypeError (fires outside inner try/catch)
    console.error("Unhandled error in /api/swap:", error);
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    return res.status(500).json({ error: error.message });
  } finally {
    span.end();
    await flushTelemetry();
  }
}

export default handler;