async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

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

    return res.status(200).json({
      success: true,
      txHash: result?.txHash ?? result?.hash ?? "submitted"
    });

  } catch (error) {
    console.error("Swap error:", error);
    return res.status(500).json({ error: error.message });
  }
}

export default handler;