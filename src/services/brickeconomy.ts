// BrickEconomy API v1 service
// Docs: https://www.brickeconomy.com/api-reference
// Auth: x-apikey header
// Rate limit: 100 requests/day (resets 00:00 UTC)

// In production (Vercel), calls go through /api/brickeconomy proxy
// This avoids CORS issues since BrickEconomy requires User-Agent header that browsers strip
const PROXY_URL = '/api/brickeconomy';

function getApiKey(): string {
  return localStorage.getItem('brickeconomy_api_key') || '';
}

// Track daily usage to avoid hitting the 100/day limit
function trackUsage(): void {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('be_usage');
  if (stored) {
    const { date, count } = JSON.parse(stored);
    if (date === today) {
      localStorage.setItem('be_usage', JSON.stringify({ date, count: count + 1 }));
      return;
    }
  }
  localStorage.setItem('be_usage', JSON.stringify({ date: today, count: 1 }));
}

function getUsageToday(): number {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('be_usage');
  if (!stored) return 0;
  const { date, count } = JSON.parse(stored);
  return date === today ? count : 0;
}

// --- Types ---

export interface BESetData {
  retired?: boolean;
  set_number: string;
  name: string;
  theme?: string;
  subtheme?: string;
  year?: number;
  pieces_count?: number;
  minifigs_count?: number;
  minifigs?: string[];
  availability?: string;
  retail_price_us?: number;
  retail_price_uk?: number;
  retail_price_ca?: number;
  retail_price_eu?: number;
  retail_price_au?: number;
  ean?: string;
  upc?: string;
  released_date?: string;
  retired_date?: string;
  current_value_new?: number;
  current_value_used?: number;
  current_value_used_low?: number;
  current_value_used_high?: number;
  forecast_value_new_2_years?: number;
  forecast_value_new_5_years?: number;
  rolling_growth_lastyear?: number;
  rolling_growth_12months?: number;
  price_events_new?: Array<{ date: string; value: number }>;
  price_events_used?: Array<{ date: string; value: number }>;
  currency?: string;
}

export interface BEMinifigData {
  minifig_number: string;
  name: string;
  description?: string;
  theme?: string;
  subtheme?: string;
  year?: number;
  set_count?: number;
  sets?: string[];
  released_date?: string;
  current_value_new?: number;
  price_events_new?: Array<{ date: string; value: number }>;
  currency?: string;
}

export interface BECollectionSets {
  sets_count: number;
  sets_unique_count: number;
  sets_new_count: number;
  sets_used_count: number;
  sets_pieces_count: number;
  sets_minifigs_count: number;
  current_value: number;
  currency: string;
  sets: Array<{
    retired?: boolean;
    set_number: string;
    name: string;
    theme?: string;
    subtheme?: string;
    year?: number;
    pieces_count?: number;
    minifigs_count?: number;
    retail_price?: number;
    released_date?: string;
    retired_date?: string;
    aquired_date?: string;
    collection?: string;
    condition?: string;
    paid_price?: number;
    current_value?: number;
    growth?: number;
  }>;
}

export interface BECollectionMinifigs {
  minifigs_count: number;
  minifigs_unique_count: number;
  current_value: number;
  currency: string;
  minifigs: Array<{
    minifig_number: string;
    name: string;
    aquired_date?: string;
    collection?: string;
    paid_price?: number;
    current_value?: number;
    growth?: number;
  }>;
}

// --- Service ---

class BrickEconomyService {
  private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('BrickEconomy API key not configured. Add it in Settings.');
    }

    const usage = getUsageToday();
    if (usage >= 95) {
      throw new Error(`Approaching daily API limit (${usage}/100). Try again tomorrow.`);
    }

    // Route through Vercel serverless proxy to avoid CORS
    // The proxy path strips the leading slash: "/set/10236-1" -> "set/10236-1"
    const proxyPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.append('path', proxyPath);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        'x-apikey': apiKey,
      },
    });

    trackUsage();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid BrickEconomy API key. Check your key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('BrickEconomy daily rate limit exceeded. Try again tomorrow.');
      }
      const body = await response.json().catch(() => ({}));
      throw new Error(`BrickEconomy API error: ${response.status} ${(body as { error?: string }).error || response.statusText}`);
    }

    const json = await response.json();
    return json.data as T;
  }

  // Get set details with pricing, retirement, and market data
  async getSet(setNumber: string, currency: string = 'USD'): Promise<BESetData> {
    // Normalize: accept "75192-1" or "75192"
    const num = setNumber.replace(/-\d+$/, '');
    return this.makeRequest<BESetData>(`/set/${num}`, { currency });
  }

  // Get minifig details with pricing
  async getMinifig(minifigNumber: string, currency: string = 'USD'): Promise<BEMinifigData> {
    return this.makeRequest<BEMinifigData>(`/minifig/${minifigNumber}`, { currency });
  }

  // Get user's full set collection from BrickEconomy
  async getMySetCollection(currency: string = 'USD'): Promise<BECollectionSets> {
    return this.makeRequest<BECollectionSets>('/collection/sets', { currency });
  }

  // Get user's full minifig collection from BrickEconomy
  async getMyMinifigCollection(currency: string = 'USD'): Promise<BECollectionMinifigs> {
    return this.makeRequest<BECollectionMinifigs>('/collection/minifigs', { currency });
  }

  // Test if API key is valid
  async testApiKey(): Promise<boolean> {
    try {
      await this.makeRequest('/collection/sets');
      return true;
    } catch {
      return false;
    }
  }

  // Check remaining daily quota
  getRemainingQuota(): number {
    return Math.max(0, 100 - getUsageToday());
  }

  // Check if API key is configured
  isConfigured(): boolean {
    return !!getApiKey();
  }
}

export const brickEconomyService = new BrickEconomyService();
