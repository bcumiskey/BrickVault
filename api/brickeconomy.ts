// Vercel serverless function — proxies BrickEconomy API calls
// This exists because BrickEconomy requires a User-Agent header that browsers strip from fetch requests

import type { VercelRequest, VercelResponse } from '@vercel/node';

const BE_BASE = 'https://www.brickeconomy.com/api/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-apikey'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-apikey header' });
  }

  // The "path" query param tells us which BE endpoint to call
  const { path, ...queryParams } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  // Build the BrickEconomy URL
  const url = new URL(`${BE_BASE}/${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value === 'string') {
      url.searchParams.append(key, value);
    }
  }

  try {
    const beResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-apikey': apiKey,
        'User-Agent': 'BrickVault/1.0',
      },
    });

    const body = await beResponse.text();

    // Forward status and body
    res.status(beResponse.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach BrickEconomy API' });
  }
}
