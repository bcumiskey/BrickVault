import type {
  CollectionSet,
  CollectionMinifigure,
  CollectionMoc,
  PartInventory,
  CollectionAnalytics,
} from '@/types/lego';
import { brickEconomyService } from '@/services/brickeconomy';

// API-backed storage service with localStorage cache for performance
// Falls back to localStorage-only if API is unavailable (local dev without DB)

const API_BASE = '/api/collection';

async function apiCall<T>(params: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}?${params}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

// Migration: apply default values for new fields on older data
function migrateSet(s: Partial<CollectionSet> & { id: string }): CollectionSet {
  return {
    ...s,
    quantity: s.quantity ?? 1,
    acquisitions: s.acquisitions ?? [],
    retired: s.retired ?? false,
  } as CollectionSet;
}

function migrateMinifig(m: Partial<CollectionMinifigure> & { id: string }): CollectionMinifigure {
  return {
    ...m,
    quantity: m.quantity ?? 1,
    acquisitions: m.acquisitions ?? [],
    category: m.category ?? 'LOOSE',
    retired: m.retired ?? false,
  } as CollectionMinifigure;
}

class StorageService {
  private useApi = true; // Set to false to use localStorage only

  // Helper: try API first, fall back to localStorage
  private getLocalItems<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private setLocalItems<T>(key: string, items: T[]): void {
    localStorage.setItem(key, JSON.stringify(items));
  }

  // ---------- Collection Sets ----------

  async saveCollectionSet(set: CollectionSet): Promise<void> {
    const updated = { ...set, updated_at: new Date().toISOString() };

    // Update localStorage cache
    const existing = this.getLocalItems<CollectionSet>('collection_sets');
    const filtered = existing.filter(s => s.id !== set.id);
    filtered.push(updated);
    this.setLocalItems('collection_sets', filtered);

    // Persist to API
    if (this.useApi) {
      try {
        await apiCall('type=sets&action=save', {
          method: 'POST',
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.warn('API save failed, data saved locally:', e);
      }
    }
  }

  async getCollectionSets(): Promise<CollectionSet[]> {
    if (this.useApi) {
      try {
        const data = await apiCall<CollectionSet[]>('type=sets&action=list');
        const migrated = data.map(migrateSet);
        // Update local cache
        this.setLocalItems('collection_sets', migrated);
        return migrated;
      } catch (e) {
        console.warn('API fetch failed, using local cache:', e);
      }
    }
    return this.getLocalItems<CollectionSet>('collection_sets').map(migrateSet);
  }

  async getCollectionSet(id: string): Promise<CollectionSet | null> {
    if (this.useApi) {
      try {
        const data = await apiCall<CollectionSet | null>(`type=sets&action=get&id=${id}`);
        return data ? migrateSet(data) : null;
      } catch (e) {
        console.warn('API fetch failed, using local cache:', e);
      }
    }
    const sets = this.getLocalItems<CollectionSet>('collection_sets');
    const found = sets.find(s => s.id === id);
    return found ? migrateSet(found) : null;
  }

  async deleteCollectionSet(id: string): Promise<void> {
    // Update localStorage
    const existing = this.getLocalItems<CollectionSet>('collection_sets');
    this.setLocalItems('collection_sets', existing.filter(s => s.id !== id));

    if (this.useApi) {
      try {
        await apiCall(`type=sets&action=delete&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('API delete failed:', e);
      }
    }
  }

  // ---------- Collection Minifigures ----------

  async saveCollectionMinifigure(minifigure: CollectionMinifigure): Promise<void> {
    const updated = { ...minifigure, updated_at: new Date().toISOString() };

    const existing = this.getLocalItems<CollectionMinifigure>('collection_minifigures');
    const filtered = existing.filter(m => m.id !== minifigure.id);
    filtered.push(updated);
    this.setLocalItems('collection_minifigures', filtered);

    if (this.useApi) {
      try {
        await apiCall('type=minifigures&action=save', {
          method: 'POST',
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.warn('API save failed, data saved locally:', e);
      }
    }
  }

  async getCollectionMinifigures(): Promise<CollectionMinifigure[]> {
    if (this.useApi) {
      try {
        const data = await apiCall<CollectionMinifigure[]>('type=minifigures&action=list');
        const migrated = data.map(migrateMinifig);
        this.setLocalItems('collection_minifigures', migrated);
        return migrated;
      } catch (e) {
        console.warn('API fetch failed, using local cache:', e);
      }
    }
    return this.getLocalItems<CollectionMinifigure>('collection_minifigures').map(migrateMinifig);
  }

  async getCollectionMinifigure(id: string): Promise<CollectionMinifigure | null> {
    if (this.useApi) {
      try {
        const data = await apiCall<CollectionMinifigure | null>(`type=minifigures&action=get&id=${id}`);
        return data ? migrateMinifig(data) : null;
      } catch (e) {
        console.warn('API fetch failed, using local cache:', e);
      }
    }
    const items = this.getLocalItems<CollectionMinifigure>('collection_minifigures');
    const found = items.find(m => m.id === id);
    return found ? migrateMinifig(found) : null;
  }

  async deleteCollectionMinifigure(id: string): Promise<void> {
    const existing = this.getLocalItems<CollectionMinifigure>('collection_minifigures');
    this.setLocalItems('collection_minifigures', existing.filter(m => m.id !== id));

    if (this.useApi) {
      try {
        await apiCall(`type=minifigures&action=delete&id=${id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('API delete failed:', e);
      }
    }
  }

  // ---------- Collection MOCs (localStorage only for now) ----------

  async saveCollectionMoc(moc: CollectionMoc): Promise<void> {
    const existing = this.getLocalItems<CollectionMoc>('collection_mocs');
    const updated = existing.filter(m => m.id !== moc.id);
    updated.push({ ...moc, updated_at: new Date().toISOString() });
    this.setLocalItems('collection_mocs', updated);
  }

  async getCollectionMocs(): Promise<CollectionMoc[]> {
    return this.getLocalItems<CollectionMoc>('collection_mocs');
  }

  async deleteCollectionMoc(id: string): Promise<void> {
    const existing = this.getLocalItems<CollectionMoc>('collection_mocs');
    this.setLocalItems('collection_mocs', existing.filter(m => m.id !== id));
  }

  // ---------- Part Inventory (localStorage only for now) ----------

  async savePartInventory(part: PartInventory): Promise<void> {
    const existing = this.getLocalItems<PartInventory>('part_inventory');
    const updated = existing.filter(p => p.id !== part.id);
    updated.push(part);
    this.setLocalItems('part_inventory', updated);
  }

  async getPartInventory(): Promise<PartInventory[]> {
    return this.getLocalItems<PartInventory>('part_inventory');
  }

  // ---------- Cache ----------

  cacheData(key: string, data: unknown): void {
    localStorage.setItem(`cache_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  }

  getCachedData<T>(key: string, maxAgeMs: number = 24 * 60 * 60 * 1000): T | null {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > maxAgeMs) return null;
    return data as T;
  }

  // ---------- Analytics ----------

  async getCollectionAnalytics(): Promise<CollectionAnalytics> {
    const sets = await this.getCollectionSets();
    const mocs = await this.getCollectionMocs();
    const minifigs = await this.getCollectionMinifigures();
    const parts = await this.getPartInventory();

    // Exclude sold items from value calculations
    const activeSets = sets.filter(s => s.status !== 'SOLD');
    const activeMinifigs = minifigs.filter(m => m.status !== 'SOLD' as string);

    const setTotalValue = activeSets.reduce((sum, s) => sum + (s.current_value || 0) * (s.quantity || 1), 0);
    const setTotalCost = activeSets.reduce((sum, s) => {
      if (s.acquisitions?.length) {
        return sum + s.acquisitions.reduce((a, acq) => a + (acq.price || 0), 0);
      }
      return sum + (s.purchase_price || 0);
    }, 0);

    const figTotalValue = activeMinifigs.reduce((sum, m) => sum + (m.current_value || 0) * (m.quantity || 1), 0);
    const figTotalCost = activeMinifigs.reduce((sum, m) => {
      if (m.acquisitions?.length) {
        return sum + m.acquisitions.reduce((a, acq) => a + (acq.price || 0), 0);
      }
      return sum + (m.purchase_price || 0);
    }, 0);

    const totalValue = setTotalValue + figTotalValue;
    const totalCost = setTotalCost + figTotalCost;

    return {
      total_sets: sets.length,
      total_set_copies: sets.reduce((sum, s) => sum + (s.quantity || 1), 0),
      total_minifigures: minifigs.length,
      total_minifig_copies: minifigs.reduce((sum, m) => sum + (m.quantity || 1), 0),
      total_mocs: mocs.length,
      total_parts: parts.reduce((sum, part) => sum + part.quantity, 0),
      total_value: totalValue,
      total_cost: totalCost,
      profit_loss: totalValue - totalCost,
      retired_sets: sets.filter(s => s.retired).length,
      active_sets: sets.filter(s => !s.retired).length,
      set_fig_count: minifigs.filter(m => m.category === 'SET_FIGURE').length,
      cmf_count: minifigs.filter(m => m.category === 'CMF').length,
      loose_fig_count: minifigs.filter(m => m.category === 'LOOSE').length,
      completion_stats: {
        complete: sets.filter(s => s.completeness_percentage === 100).length,
        incomplete: sets.filter(s => s.completeness_percentage < 100).length,
        nisb: sets.filter(s => s.status === 'NISB').length,
      },
    };
  }

  // ---------- Data Management ----------

  exportAllData(): string {
    const data: Record<string, unknown> = {};
    const keys = [
      'collection_sets', 'collection_minifigures', 'collection_mocs',
      'part_inventory',
    ];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) data[key] = JSON.parse(raw);
    }
    return JSON.stringify(data, null, 2);
  }

  importAllData(json: string): void {
    const data = JSON.parse(json) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async clearAllData(): Promise<void> {
    // Clear localStorage
    const keys = [
      'collection_sets', 'collection_minifigures', 'collection_mocs',
      'part_inventory',
    ];
    for (const key of keys) {
      localStorage.removeItem(key);
    }

    // Clear database
    if (this.useApi) {
      try {
        await apiCall('type=sets&action=clear', { method: 'DELETE' });
        await apiCall('type=minifigures&action=clear', { method: 'DELETE' });
      } catch (e) {
        console.warn('API clear failed:', e);
      }
    }
  }

  // ---------- Settings (API keys, preferences — stored in DB) ----------

  async saveSetting(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    if (this.useApi) {
      try {
        await apiCall('type=settings&action=save', {
          method: 'POST',
          body: JSON.stringify({ key, value }),
        });
      } catch (e) {
        console.warn('API setting save failed:', e);
      }
    }
  }

  async getSetting(key: string): Promise<string | null> {
    // Check localStorage first (fastest)
    const local = localStorage.getItem(key);
    if (local) return local;

    // Try API
    if (this.useApi) {
      try {
        const resp = await apiCall<{ value: string | null }>(`type=settings&action=get&id=${key}`);
        if (resp.value) {
          localStorage.setItem(key, resp.value);
          return resp.value;
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }

  // Sync local data to the database (for migration from localStorage-only)
  async syncToDatabase(): Promise<{ sets: number; minifigs: number }> {
    const localSets = this.getLocalItems<CollectionSet>('collection_sets');
    const localMinifigs = this.getLocalItems<CollectionMinifigure>('collection_minifigures');

    let setCount = 0;
    let figCount = 0;

    if (localSets.length > 0) {
      try {
        await apiCall('type=sets&action=bulk_save', {
          method: 'POST',
          body: JSON.stringify(localSets),
        });
        setCount = localSets.length;
      } catch (e) {
        console.error('Failed to sync sets:', e);
      }
    }

    if (localMinifigs.length > 0) {
      try {
        await apiCall('type=minifigures&action=bulk_save', {
          method: 'POST',
          body: JSON.stringify(localMinifigs),
        });
        figCount = localMinifigs.length;
      } catch (e) {
        console.error('Failed to sync minifigs:', e);
      }
    }

    // Sync API keys
    for (const key of ['rebrickable_api_key', 'brickeconomy_api_key']) {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          await apiCall('type=settings&action=save', {
            method: 'POST',
            body: JSON.stringify({ key, value: val }),
          });
        } catch {
          // ignore
        }
      }
    }

    return { sets: setCount, minifigs: figCount };
  }
}

export const storageService = new StorageService();

// Enrich a CollectionSet with BrickEconomy market data
export async function enrichSetWithBE(set: CollectionSet): Promise<CollectionSet> {
  if (!brickEconomyService.isConfigured()) return set;
  try {
    const beData = await brickEconomyService.getSet(set.set_num);
    return {
      ...set,
      retired: beData.retired ?? set.retired,
      retirement_year: beData.retired_date ? parseInt(beData.retired_date.split('-')[0]) : set.retirement_year,
      retail_price: beData.retail_price_us ?? set.retail_price,
      current_value: beData.current_value_new ?? beData.current_value_used ?? set.current_value,
    };
  } catch (e) {
    console.warn(`BrickEconomy enrichment failed for ${set.set_num}:`, e);
    return set;
  }
}
