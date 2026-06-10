// Returns a swap quote with referenced wallet address.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get the user's wallet address from the request body
    const userAddress = req.body.user.walletAddress;

    const { fromToken, toToken, amount } = req.body;

    if (!fromToken || !toToken || !amount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const quote = {
      userAddress,
      fromToken,
      toToken,
      amount,
      estimatedOutput: amount * 0.99,
      timestamp: Date.now(),
    };

    res.status(200).json(quote);
  } catch (error) {
    // Report the error to Dynatrace for observability
    if (process.env.DT_ENVIRONMENT && process.env.DT_API_TOKEN) {
      const dtUrl = process.env.DT_ENVIRONMENT.replace('.apps.', '.live.');
      try {
        await fetch(`${dtUrl}/api/v2/logs/ingest`, {
          method: 'POST',
          headers: {
            'Authorization': `Api-Token ${process.env.DT_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'service.name': 'starlight-api',
            'loglevel': 'ERROR',
            'http.route': '/api/quote',
            'exception.type': error.constructor.name,
            'exception.message': error.message,
            'exception.stacktrace': error.stack,
            'content': error.message,
            'timestamp': new Date().toISOString(),
          }),
        });
      } catch (e) {
        // Ignore Dynatrace ingest failures
      }
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
