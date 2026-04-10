import type {
  CollectionSet,
  CollectionMinifigure,
  CollectionMoc,
  PartInventory,
  StorageLocation,
  WishlistItem,
  CustomFieldDefinition,
  CollectionAnalytics,
} from '@/types/lego';

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
  private getItems<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private setItems<T>(key: string, items: T[]): void {
    localStorage.setItem(key, JSON.stringify(items));
  }

  // Collection Sets
  async saveCollectionSet(set: CollectionSet): Promise<void> {
    const existing = this.getItems<CollectionSet>('collection_sets');
    const updated = existing.filter(s => s.id !== set.id);
    updated.push({ ...set, updated_at: new Date().toISOString() });
    this.setItems('collection_sets', updated);
  }

  async getCollectionSets(): Promise<CollectionSet[]> {
    return this.getItems<CollectionSet>('collection_sets').map(migrateSet);
  }

  async getCollectionSet(id: string): Promise<CollectionSet | null> {
    const sets = await this.getCollectionSets();
    return sets.find(s => s.id === id) ?? null;
  }

  async deleteCollectionSet(id: string): Promise<void> {
    const existing = this.getItems<CollectionSet>('collection_sets');
    this.setItems('collection_sets', existing.filter(s => s.id !== id));
  }

  // Collection Minifigures
  async saveCollectionMinifigure(minifigure: CollectionMinifigure): Promise<void> {
    const existing = this.getItems<CollectionMinifigure>('collection_minifigures');
    const updated = existing.filter(m => m.id !== minifigure.id);
    updated.push({ ...minifigure, updated_at: new Date().toISOString() });
    this.setItems('collection_minifigures', updated);
  }

  async getCollectionMinifigures(): Promise<CollectionMinifigure[]> {
    return this.getItems<CollectionMinifigure>('collection_minifigures').map(migrateMinifig);
  }

  async getCollectionMinifigure(id: string): Promise<CollectionMinifigure | null> {
    const items = await this.getCollectionMinifigures();
    return items.find(m => m.id === id) ?? null;
  }

  async deleteCollectionMinifigure(id: string): Promise<void> {
    const existing = this.getItems<CollectionMinifigure>('collection_minifigures');
    this.setItems('collection_minifigures', existing.filter(m => m.id !== id));
  }

  // Collection MOCs
  async saveCollectionMoc(moc: CollectionMoc): Promise<void> {
    const existing = this.getItems<CollectionMoc>('collection_mocs');
    const updated = existing.filter(m => m.id !== moc.id);
    updated.push({ ...moc, updated_at: new Date().toISOString() });
    this.setItems('collection_mocs', updated);
  }

  async getCollectionMocs(): Promise<CollectionMoc[]> {
    return this.getItems<CollectionMoc>('collection_mocs');
  }

  async deleteCollectionMoc(id: string): Promise<void> {
    const existing = this.getItems<CollectionMoc>('collection_mocs');
    this.setItems('collection_mocs', existing.filter(m => m.id !== id));
  }

  // Part Inventory
  async savePartInventory(part: PartInventory): Promise<void> {
    const existing = this.getItems<PartInventory>('part_inventory');
    const updated = existing.filter(p => p.id !== part.id);
    updated.push(part);
    this.setItems('part_inventory', updated);
  }

  async getPartInventory(): Promise<PartInventory[]> {
    return this.getItems<PartInventory>('part_inventory');
  }

  // Storage Locations
  async saveStorageLocation(location: StorageLocation): Promise<void> {
    const existing = this.getItems<StorageLocation>('storage_locations');
    const updated = existing.filter(l => l.id !== location.id);
    updated.push(location);
    this.setItems('storage_locations', updated);
  }

  async getStorageLocations(): Promise<StorageLocation[]> {
    return this.getItems<StorageLocation>('storage_locations');
  }

  // Wishlist
  async saveWishlistItem(item: WishlistItem): Promise<void> {
    const existing = this.getItems<WishlistItem>('wishlist');
    const updated = existing.filter(w => w.id !== item.id);
    updated.push(item);
    this.setItems('wishlist', updated);
  }

  async getWishlist(): Promise<WishlistItem[]> {
    return this.getItems<WishlistItem>('wishlist');
  }

  async deleteWishlistItem(id: string): Promise<void> {
    const existing = this.getItems<WishlistItem>('wishlist');
    this.setItems('wishlist', existing.filter(w => w.id !== id));
  }

  // Custom Field Definitions
  async saveCustomFieldDefinition(field: CustomFieldDefinition): Promise<void> {
    const existing = this.getItems<CustomFieldDefinition>('custom_field_definitions');
    const updated = existing.filter(f => f.id !== field.id);
    updated.push(field);
    this.setItems('custom_field_definitions', updated);
  }

  async getCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
    return this.getItems<CustomFieldDefinition>('custom_field_definitions');
  }

  // Cache for API data
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

  // Analytics helper — expanded with quantities, categories, retired
  async getCollectionAnalytics(): Promise<CollectionAnalytics> {
    const sets = await this.getCollectionSets();
    const mocs = await this.getCollectionMocs();
    const minifigs = await this.getCollectionMinifigures();
    const parts = await this.getPartInventory();

    // Exclude sold items from value calculations
    const activeSets = sets.filter(s => s.status !== 'SOLD');
    const activeMinifigs = minifigs.filter(m => m.status !== 'SOLD' as string);

    // Set values (include acquisition costs if no purchase_price)
    const setTotalValue = activeSets.reduce((sum, s) => sum + (s.current_value || 0) * (s.quantity || 1), 0);
    const setTotalCost = activeSets.reduce((sum, s) => {
      if (s.acquisitions?.length) {
        return sum + s.acquisitions.reduce((a, acq) => a + (acq.price || 0), 0);
      }
      return sum + (s.purchase_price || 0);
    }, 0);

    // Minifig values
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

  // Export all data as JSON
  exportAllData(): string {
    const data: Record<string, unknown> = {};
    const keys = [
      'collection_sets', 'collection_minifigures', 'collection_mocs',
      'part_inventory', 'storage_locations', 'wishlist', 'custom_field_definitions',
    ];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) data[key] = JSON.parse(raw);
    }
    return JSON.stringify(data, null, 2);
  }

  // Import data from JSON
  importAllData(json: string): void {
    const data = JSON.parse(json) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  // Clear all collection data
  clearAllData(): void {
    const keys = [
      'collection_sets', 'collection_minifigures', 'collection_mocs',
      'part_inventory', 'storage_locations', 'wishlist', 'custom_field_definitions',
    ];
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }
}

export const storageService = new StorageService();
