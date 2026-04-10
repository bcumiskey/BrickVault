// Rebrickable API service for LEGO catalog data
const REBRICKABLE_BASE_URL = 'https://rebrickable.com/api/v3';

function getApiKey(): string {
  // Check localStorage first (set via Settings page), then env var
  return localStorage.getItem('rebrickable_api_key') || import.meta.env.VITE_REBRICKABLE_API_KEY || '';
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SetResult {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string | null;
  set_url: string;
  last_modified_dt?: string;
}

export interface MinifigResult {
  set_num: string;
  name: string;
  num_parts: number;
  set_img_url: string | null;
  set_url: string;
}

export interface PartResult {
  part_num: string;
  name: string;
  part_cat_id: number;
  part_url: string;
  part_img_url: string | null;
}

export interface ThemeResult {
  id: number;
  parent_id: number | null;
  name: string;
}

export interface PartCategoryResult {
  id: number;
  name: string;
  part_count: number;
}

class RebrickableService {
  private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Rebrickable API key not configured. Please add it in Settings.');
    }

    const url = new URL(`${REBRICKABLE_BASE_URL}${endpoint}`);
    url.searchParams.append('key', apiKey);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid Rebrickable API key. Please check your key in Settings.');
      }
      throw new Error(`Rebrickable API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Search for sets
  async searchSets(query?: string, themeId?: string, year?: string, page: number = 1, pageSize: number = 24) {
    const params: Record<string, string> = {
      page: page.toString(),
      page_size: pageSize.toString(),
      ordering: '-year',
    };
    if (query) params.search = query;
    if (themeId) params.theme_id = themeId;
    if (year) params.min_year = year;
    if (year) params.max_year = year;

    return this.makeRequest<PaginatedResponse<SetResult>>('/lego/sets/', params);
  }

  // Browse sets with full filter panel
  async browseSets(filters: {
    search?: string;
    themeId?: string;
    minYear?: string;
    maxYear?: string;
    minParts?: string;
    maxParts?: string;
    ordering?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const params: Record<string, string> = {
      page: (filters.page ?? 1).toString(),
      page_size: (filters.pageSize ?? 24).toString(),
      ordering: filters.ordering ?? '-year',
    };
    if (filters.search) params.search = filters.search;
    if (filters.themeId) params.theme_id = filters.themeId;
    if (filters.minYear) params.min_year = filters.minYear;
    if (filters.maxYear) params.max_year = filters.maxYear;
    if (filters.minParts) params.min_parts = filters.minParts;
    if (filters.maxParts) params.max_parts = filters.maxParts;

    return this.makeRequest<PaginatedResponse<SetResult>>('/lego/sets/', params);
  }

  // Get specific set details
  async getSet(setNum: string) {
    return this.makeRequest<{
      set_num: string;
      name: string;
      year: number;
      theme_id: number;
      num_parts: number;
      set_img_url: string | null;
      set_url: string;
    }>(`/lego/sets/${setNum}/`);
  }

  // Get set parts inventory
  async getSetInventory(setNum: string) {
    return this.makeRequest(`/lego/sets/${setNum}/parts/`);
  }

  // Get minifigures included in a set
  async getSetMinifigs(setNum: string) {
    return this.makeRequest<PaginatedResponse<{
      id: number;
      set_num: string;
      set_name: string;
      quantity: number;
      set_img_url: string | null;
    }>>(`/lego/sets/${setNum}/minifigs/`);
  }

  // Search for minifigures
  async searchMinifigs(query?: string, page: number = 1, pageSize: number = 24) {
    const params: Record<string, string> = {
      page: page.toString(),
      page_size: pageSize.toString(),
    };
    if (query) params.search = query;

    return this.makeRequest<PaginatedResponse<MinifigResult>>('/lego/minifigs/', params);
  }

  // Browse minifigures with full filters
  async browseMinifigs(filters: {
    search?: string;
    minParts?: string;
    maxParts?: string;
    ordering?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const params: Record<string, string> = {
      page: (filters.page ?? 1).toString(),
      page_size: (filters.pageSize ?? 24).toString(),
    };
    if (filters.search) params.search = filters.search;
    if (filters.minParts) params.min_parts = filters.minParts;
    if (filters.maxParts) params.max_parts = filters.maxParts;
    if (filters.ordering) params.ordering = filters.ordering;

    return this.makeRequest<PaginatedResponse<MinifigResult>>('/lego/minifigs/', params);
  }

  // Get specific minifigure
  async getMinifig(figNum: string) {
    return this.makeRequest(`/lego/minifigs/${figNum}/`);
  }

  // Search for parts
  async searchParts(query?: string, category?: string) {
    const params: Record<string, string> = {};
    if (query) params.search = query;
    if (category) params.part_cat_id = category;

    return this.makeRequest<PaginatedResponse<PartResult>>('/lego/parts/', params);
  }

  // Browse parts with full filters
  async browseParts(filters: {
    search?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const params: Record<string, string> = {
      page: (filters.page ?? 1).toString(),
      page_size: (filters.pageSize ?? 24).toString(),
    };
    if (filters.search) params.search = filters.search;
    if (filters.categoryId) params.part_cat_id = filters.categoryId;

    return this.makeRequest<PaginatedResponse<PartResult>>('/lego/parts/', params);
  }

  // Get part categories
  async getPartCategories() {
    return this.makeRequest<PaginatedResponse<PartCategoryResult>>('/lego/part_categories/', { page_size: '1000' });
  }

  // Get themes list (cached)
  private _themesCache: ThemeResult[] | null = null;
  async getThemes(): Promise<ThemeResult[]> {
    if (this._themesCache) return this._themesCache;
    const resp = await this.makeRequest<PaginatedResponse<ThemeResult>>('/lego/themes/', { page_size: '1000' });
    this._themesCache = resp.results;
    return resp.results;
  }

  // Check if API key is valid
  async testApiKey(): Promise<boolean> {
    try {
      await this.makeRequest('/lego/sets/', { page_size: '1' });
      return true;
    } catch {
      return false;
    }
  }
}

export const rebrickableService = new RebrickableService();
