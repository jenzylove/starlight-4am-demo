const DT_ENVIRONMENT = process.env.DT_ENVIRONMENT;
const DT_API_TOKEN = process.env.DT_API_TOKEN;

async function reportToDynatrace(error, req) {
  if (!DT_ENVIRONMENT || !DT_API_TOKEN) {
    console.warn('[Dynatrace] env vars missing — skipping report');
    return;
  }

  try {
    const payload = [{
      timestamp: new Date().toISOString(),
      content: `${error.name}: ${error.message}`,
      severity: 'ERROR',
      'service.name': 'starlight-api',
      'http.method': req.method,
      'http.route': '/api/swap',
      'http.status_code': 500,
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
      'log.source': 'api/swap.js',
    }];

    const liveUrl = DT_ENVIRONMENT.replace('.apps.', '.live.');
    const response = await fetch(`${liveUrl}/api/v2/logs/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Token ${DT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    console.log(`[Dynatrace] Logs ingest → ${response.status} ${body || '(empty)'}`);
  } catch (err) {
    console.error('[Dynatrace] Report failed:', err.message);
  }
}

async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const body = req.body || {};
    const { tokenIn, tokenOut, amountIn } = body;

    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Apply user's slippage tolerance to protect against price movement
    const slippageBps = body.slippage?.bps;

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

      return res.status(200).json({
        success: true,
        txHash: result?.txHash ?? result?.hash ?? "submitted"
      });

    } catch (error) {
      console.error("Swap error:", error);
      await reportToDynatrace(error, req);
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error("Unhandled error in /api/swap:", error);
    await reportToDynatrace(error, req);
    return res.status(500).json({ error: error.message });
  }
}

export default handler;