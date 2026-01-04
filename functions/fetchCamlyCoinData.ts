import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch from CoinGecko API (free, no API key needed)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/camly-coin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko');
    }

    const data = await response.json();

    // Extract the data we need
    const marketData = {
      price_usd: data.market_data?.current_price?.usd || 0.000022,
      market_cap_usd: data.market_data?.market_cap?.usd || null,
      volume_24h_usd: data.market_data?.total_volume?.usd || null,
      price_change_24h_percent: data.market_data?.price_change_percentage_24h || null,
      last_updated: data.market_data?.last_updated || new Date().toISOString()
    };

    return Response.json({
      success: true,
      data: marketData
    });

  } catch (error) {
    console.error('Error fetching Camly Coin data:', error);
    
    // Return fallback data if API fails
    return Response.json({
      success: false,
      error: error.message,
      data: {
        price_usd: 0.000022,
        market_cap_usd: null,
        volume_24h_usd: null,
        price_change_24h_percent: null,
        last_updated: new Date().toISOString()
      }
    });
  }
});