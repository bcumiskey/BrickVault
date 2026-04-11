// Shared logic for auto-adding minifigures from a set
import { rebrickableService } from '@/services/rebrickable';
import { storageService } from '@/services/storage';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

// Known CMF theme IDs on Rebrickable
const CMF_THEME_IDS = new Set([
  535, // Collectable Minifigures (parent)
  741, 742, 743, 744, 745, 746, 747, 748, 749, 750,
  751, 752, 753, 754, 755, 756, 757, 758, 759, 760,
  761, 762, 763, 764, 765,
  610, 612, 698, 700, 726, 727,
]);

function isCmfSet(set: CollectionSet): boolean {
  const themeId = set.set_data.theme_id;
  if (CMF_THEME_IDS.has(themeId)) return true;
  const name = set.set_data.name.toLowerCase();
  if (name.includes('minifigures series') || name.includes('collectible minifigure')) return true;
  if (set.set_data.num_parts <= 12 && /^71\d{3}-\d+$/.test(set.set_num)) return true;
  return false;
}

/**
 * Auto-add minifigures from a set to the collection.
 * - If a minifig already exists, increments its quantity instead of skipping
 * - Marks figures from NISB sets as SEALED_IN_SET
 * - Detects CMF sets and categorizes accordingly
 * - skipPartLookup=true skips the getMinifig call (faster for bulk backfill)
 */
export async function autoAddMinifigsFromSet(
  collectionSet: CollectionSet,
  options?: { skipPartLookup?: boolean }
): Promise<number> {
  try {
    const minifigResp = await rebrickableService.getSetMinifigs(collectionSet.set_num);
    if (!minifigResp.results || minifigResp.results.length === 0) return 0;

    const existingMinifigs = await storageService.getCollectionMinifigures();
    // Map by fig_num for quick lookup
    const existingByFigNum = new Map<string, CollectionMinifigure>();
    for (const m of existingMinifigs) {
      existingByFigNum.set(m.fig_num, m);
    }

    const isNisb = collectionSet.status === 'NISB';
    const isCmf = isCmfSet(collectionSet);
    const now = new Date().toISOString();
    let addedCount = 0;

    for (const mf of minifigResp.results) {
      const existing = existingByFigNum.get(mf.set_num);

      if (existing) {
        // Already have this minifig — increment quantity
        const updated: CollectionMinifigure = {
          ...existing,
          quantity: (existing.quantity || 1) + (mf.quantity || 1),
        };
        await storageService.saveCollectionMinifigure(updated);
        existingByFigNum.set(mf.set_num, updated);
        addedCount++;
        continue;
      }

      // New minifig — optionally look up part count
      let numParts = 0;
      if (!options?.skipPartLookup) {
        try {
          const details = await rebrickableService.getMinifig(mf.set_num) as { num_parts?: number };
          numParts = details?.num_parts ?? 0;
        } catch {
          // Not critical
        }
      }

      const minifig: CollectionMinifigure = {
        id: `fig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fig_num: mf.set_num,
        minifig_data: {
          fig_num: mf.set_num,
          name: mf.set_name,
          num_parts: numParts,
          fig_img_url: mf.set_img_url ?? undefined,
        },
        status: isNisb ? 'SEALED_IN_SET' : 'COMPLETE',
        completeness_percentage: 100,
        condition: isNisb ? 'NEW' : 'GOOD',
        source: 'REBRICKABLE',
        quantity: mf.quantity || 1,
        acquisitions: [],
        category: isCmf ? 'CMF' : 'SET_FIGURE',
        parent_set_id: collectionSet.id,
        parent_set_num: collectionSet.set_num,
        retired: collectionSet.retired ?? false,
        created_at: now,
        updated_at: now,
      };
      await storageService.saveCollectionMinifigure(minifig);
      existingByFigNum.set(mf.set_num, minifig);
      addedCount++;
    }

    return addedCount;
  } catch (e) {
    console.warn(`Could not auto-add minifigures from ${collectionSet.set_num}:`, e);
    return 0;
  }
}
