// Shared logic for auto-adding minifigures from a set
import { rebrickableService } from '@/services/rebrickable';
import { storageService } from '@/services/storage';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

// Known CMF theme IDs on Rebrickable
// Theme 535 = "Collectable Minifigures" and its sub-themes
const CMF_THEME_IDS = new Set([
  535, // Collectable Minifigures (parent)
  741, 742, 743, 744, 745, 746, 747, 748, 749, 750, // Series 1-10
  751, 752, 753, 754, 755, 756, 757, 758, 759, 760, // Series 11-20
  761, 762, 763, 764, 765, // Series 21-25
  // Disney, Simpsons, Harry Potter CMF series etc.
  610, 612, 698, 700, 726, 727,
]);

// Detect if a set is likely a CMF pack based on theme or naming
function isCmfSet(set: CollectionSet): boolean {
  const themeId = set.set_data.theme_id;
  if (CMF_THEME_IDS.has(themeId)) return true;
  // Heuristic: set name contains "Minifigures Series" or similar patterns
  const name = set.set_data.name.toLowerCase();
  if (name.includes('minifigures series') || name.includes('collectible minifigure')) return true;
  // CMF packs are typically small sets (1-12 pieces) with set numbers like 71XXX-Y
  if (set.set_data.num_parts <= 12 && /^71\d{3}-\d+$/.test(set.set_num)) return true;
  return false;
}

/**
 * Auto-add minifigures from a set to the collection.
 * Handles NISB status (marks as SEALED_IN_SET) and CMF detection.
 * Returns the number of minifigures added.
 */
export async function autoAddMinifigsFromSet(
  collectionSet: CollectionSet
): Promise<number> {
  try {
    const minifigResp = await rebrickableService.getSetMinifigs(collectionSet.set_num);
    if (!minifigResp.results || minifigResp.results.length === 0) return 0;

    const existingMinifigs = await storageService.getCollectionMinifigures();
    const existingFigNums = new Set(existingMinifigs.map(m => m.fig_num));

    const isNisb = collectionSet.status === 'NISB';
    const isCmf = isCmfSet(collectionSet);
    const now = new Date().toISOString();
    let addedCount = 0;

    for (const mf of minifigResp.results) {
      if (existingFigNums.has(mf.set_num)) continue;

      // Try to get actual part count from Rebrickable minifig endpoint
      let numParts = 0;
      try {
        const details = await rebrickableService.getMinifig(mf.set_num) as { num_parts?: number };
        numParts = details?.num_parts ?? 0;
      } catch {
        // Not critical — default to 0
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
        quantity: mf.quantity,
        acquisitions: [],
        category: isCmf ? 'CMF' : 'SET_FIGURE',
        parent_set_id: collectionSet.id,
        parent_set_num: collectionSet.set_num,
        retired: collectionSet.retired ?? false,
        created_at: now,
        updated_at: now,
      };
      await storageService.saveCollectionMinifigure(minifig);
      existingFigNums.add(mf.set_num);
      addedCount++;

      // Small delay to avoid hammering localStorage/API
      if (addedCount % 10 === 0) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return addedCount;
  } catch (e) {
    console.warn(`Could not auto-add minifigures from ${collectionSet.set_num}:`, e);
    return 0;
  }
}
