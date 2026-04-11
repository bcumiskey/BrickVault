import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, CheckCircle2, Package, Users, Puzzle, RotateCcw } from 'lucide-react';
import { rebrickableService } from '@/services/rebrickable';
import { storageService, enrichSetWithBE } from '@/services/storage';
import { autoAddMinifigsFromSet } from '@/services/minifigHelper';
import QuickAddForm from '@/components/QuickAddForm';
import ImageModal from '@/components/ImageModal';
import type { QuickAddData } from '@/components/QuickAddForm';
import type { SetResult, MinifigResult, ThemeResult } from '@/services/rebrickable';
import type { CollectionSet, CollectionMinifigure, Acquisition } from '@/types/lego';

type Category = 'sets' | 'minifigs' | 'parts';

interface CatalogFilters {
  search: string;
  themeId: string;
  minYear: string;
  maxYear: string;
  minParts: string;
  maxParts: string;
  ordering: string;
  categoryId: string;
}

const defaultFilters: CatalogFilters = {
  search: '',
  themeId: '',
  minYear: '',
  maxYear: '',
  minParts: '',
  maxParts: '',
  ordering: '-year',
  categoryId: '',
};

export default function Catalog() {
  const [category, setCategory] = useState<Category>('sets');
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [pendingFilters, setPendingFilters] = useState<CatalogFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [totalCount, setTotalCount] = useState(0);
  const [results, setResults] = useState<(SetResult | MinifigResult)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Themes & part categories for dropdowns
  const [themes, setThemes] = useState<ThemeResult[]>([]);
  const [partCategories, setPartCategories] = useState<Array<{ id: number; name: string; part_count: number }>>([]);
  // Quick-add state
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [ownedSetNums, setOwnedSetNums] = useState<Set<string>>(new Set());

  // Image modal state
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    imageUrl: string | null;
    title: string;
    itemNum: string;
    year?: number;
    numParts?: number;
    externalUrl?: string;
  }>({ open: false, imageUrl: null, title: '', itemNum: '' });

  // Load themes
  useEffect(() => {
    rebrickableService.getThemes()
      .then(t => setThemes(t))
      .catch(() => {});
    rebrickableService.getPartCategories()
      .then(r => setPartCategories(r.results))
      .catch(() => {});
  }, []);

  // Load owned items for cross-referencing
  useEffect(() => {
    loadOwnedItems();
  }, []);

  async function loadOwnedItems() {
    const [sets, minifigs] = await Promise.all([
      storageService.getCollectionSets(),
      storageService.getCollectionMinifigures(),
    ]);
    const nums = new Set<string>();
    sets.forEach(s => nums.add(s.set_num));
    minifigs.forEach(m => nums.add(m.fig_num));
    setOwnedSetNums(nums);
  }

  // Fetch results
  const fetchResults = useCallback(async (f: CatalogFilters, p: number, ps: number, cat: Category) => {
    setLoading(true);
    setError('');
    try {
      if (cat === 'sets') {
        const resp = await rebrickableService.browseSets({
          search: f.search || undefined,
          themeId: f.themeId || undefined,
          minYear: f.minYear || undefined,
          maxYear: f.maxYear || undefined,
          minParts: f.minParts || undefined,
          maxParts: f.maxParts || undefined,
          ordering: f.ordering,
          page: p,
          pageSize: ps,
        });
        setResults(resp.results);
        setTotalCount(resp.count);
      } else if (cat === 'minifigs') {
        const resp = await rebrickableService.browseMinifigs({
          search: f.search || undefined,
          minParts: f.minParts || undefined,
          maxParts: f.maxParts || undefined,
          page: p,
          pageSize: ps,
        });
        setResults(resp.results);
        setTotalCount(resp.count);
      } else {
        const resp = await rebrickableService.browseParts({
          search: f.search || undefined,
          categoryId: f.categoryId || undefined,
          page: p,
          pageSize: ps,
        });
        setResults(resp.results as unknown as SetResult[]);
        setTotalCount(resp.count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply filters
  function applyFilters() {
    setFilters(pendingFilters);
    setPage(1);
    setExpandedItem(null);
    fetchResults(pendingFilters, 1, pageSize, category);
  }

  function resetFilters() {
    setPendingFilters(defaultFilters);
    setFilters(defaultFilters);
    setPage(1);
    setExpandedItem(null);
    setResults([]);
    setTotalCount(0);
  }

  function changePage(newPage: number) {
    setPage(newPage);
    setExpandedItem(null);
    fetchResults(filters, newPage, pageSize, category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changePageSize(newSize: number) {
    setPageSize(newSize);
    setPage(1);
    setExpandedItem(null);
    fetchResults(filters, 1, newSize, category);
  }

  function changeCategory(cat: Category) {
    setCategory(cat);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setExpandedItem(null);
    setPendingFilters(defaultFilters);
    setFilters(defaultFilters);
  }

  // Quick-add handler
  async function handleQuickAdd(item: SetResult | MinifigResult, data: QuickAddData) {
    const now = new Date().toISOString();
    const id = `${category === 'sets' ? 'set' : 'fig'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const setNum = 'set_num' in item ? item.set_num : '';

    if (category === 'sets') {
      const s = item as SetResult;
      const collectionSet: CollectionSet = {
        id,
        set_num: s.set_num,
        set_data: {
          set_num: s.set_num,
          name: s.name,
          year: s.year,
          theme_id: s.theme_id,
          num_parts: s.num_parts,
          set_img_url: s.set_img_url ?? undefined,
          set_url: s.set_url,
        },
        status: data.status as CollectionSet['status'],
        completeness_percentage: data.status === 'NISB' || data.status.startsWith('COMPLETE') ? 100 : 50,
        has_original_box: data.status === 'NISB' || data.status === 'COMPLETE_WITH_BOX',
        has_instructions: data.status !== 'PARTS_ONLY',
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
        current_value: data.current_value ? parseFloat(data.current_value) : undefined,
        quantity: 1,
        acquisitions: data.purchase_price ? [{ id: 'acq_' + Date.now(), date: new Date().toISOString().split('T')[0], price: parseFloat(data.purchase_price), source: data.source as Acquisition['source'] }] : [],
        retired: false,
        created_at: now,
        updated_at: now,
      };
      const enrichedSet = await enrichSetWithBE(collectionSet);
      await storageService.saveCollectionSet(enrichedSet);

      // Auto-add minifigures from this set
      await autoAddMinifigsFromSet(enrichedSet);
    } else {
      const m = item as MinifigResult;
      const collectionMinifig: CollectionMinifigure = {
        id,
        fig_num: m.set_num,
        minifig_data: {
          fig_num: m.set_num,
          name: m.name,
          num_parts: m.num_parts,
          fig_img_url: m.set_img_url ?? undefined,
          fig_url: m.set_url,
        },
        status: data.status as CollectionMinifigure['status'],
        completeness_percentage: data.status === 'COMPLETE' ? 100 : 50,
        condition: (data.condition || 'GOOD') as CollectionMinifigure['condition'],
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
        current_value: data.current_value ? parseFloat(data.current_value) : undefined,
        source: 'REBRICKABLE',
        quantity: 1,
        acquisitions: data.purchase_price ? [{ id: 'acq_' + Date.now(), date: new Date().toISOString().split('T')[0], price: parseFloat(data.purchase_price), source: data.source as Acquisition['source'] }] : [],
        category: 'LOOSE' as const,
        retired: false,
        created_at: now,
        updated_at: now,
      };
      await storageService.saveCollectionMinifigure(collectionMinifig);
    }

    setOwnedSetNums(prev => new Set([...prev, setNum]));
    setExpandedItem(null);
  }

  // Build theme options (hierarchical)
  const themeOptions = buildThemeTree(themes);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <p className="text-sm text-gray-500">Browse the LEGO catalog and add items to your collection</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'sets' as const, label: 'Sets', icon: Package },
          { key: 'minifigs' as const, label: 'Minifigures', icon: Users },
          { key: 'parts' as const, label: 'Parts', icon: Puzzle },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => changeCategory(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filter panel */}
      <div className="mb-5">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>

        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search — all categories */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={category === 'parts' ? 'Part name or number...' : 'Name or number...'}
                    value={pendingFilters.search}
                    onChange={e => setPendingFilters({ ...pendingFilters, search: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Theme — sets only */}
              {category === 'sets' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Theme</label>
                  <select
                    value={pendingFilters.themeId}
                    onChange={e => setPendingFilters({ ...pendingFilters, themeId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">All Themes</option>
                    {themeOptions.map(opt => (
                      <option key={opt.id} value={opt.id.toString()}>
                        {opt.prefix}{opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Part Category — parts only */}
              {category === 'parts' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={pendingFilters.categoryId}
                    onChange={e => setPendingFilters({ ...pendingFilters, categoryId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">All Categories</option>
                    {partCategories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.name} ({cat.part_count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Year range — sets only */}
              {category === 'sets' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Year Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="From"
                      min="1949"
                      max="2030"
                      value={pendingFilters.minYear}
                      onChange={e => setPendingFilters({ ...pendingFilters, minYear: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="To"
                      min="1949"
                      max="2030"
                      value={pendingFilters.maxYear}
                      onChange={e => setPendingFilters({ ...pendingFilters, maxYear: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Parts range — sets and minifigs */}
              {category !== 'parts' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {category === 'minifigs' ? 'Piece Count' : 'Parts Range'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={pendingFilters.minParts}
                      onChange={e => setPendingFilters({ ...pendingFilters, minParts: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={pendingFilters.maxParts}
                      onChange={e => setPendingFilters({ ...pendingFilters, maxParts: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Sort — sets and minifigs */}
              {category !== 'parts' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
                  <select
                    value={pendingFilters.ordering}
                    onChange={e => setPendingFilters({ ...pendingFilters, ordering: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {category === 'sets' && (
                      <>
                        <option value="-year">Year (Newest)</option>
                        <option value="year">Year (Oldest)</option>
                      </>
                    )}
                    <option value="name">Name (A-Z)</option>
                    <option value="-name">Name (Z-A)</option>
                    <option value="-num_parts">Most Pieces</option>
                    <option value="num_parts">Fewest Pieces</option>
                  </select>
                </div>
              )}
            </div>

            {/* Apply / Reset */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={applyFilters}
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {/* Results info */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{totalCount.toLocaleString()}</span> results &middot; Page <span className="font-semibold">{page}</span> of {totalPages}
            {pageSize < totalCount && (
              <span className="text-gray-400"> &middot; Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Per page:</label>
            <select
              value={pageSize}
              onChange={e => changePageSize(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
            >
              <option value="24">24</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          {results.map(item => {
            const itemNum = 'set_num' in item ? item.set_num : ('part_num' in item ? (item as { part_num: string }).part_num : '');
            const name = item.name;
            const image = 'set_img_url' in item ? item.set_img_url : ('part_img_url' in item ? (item as { part_img_url: string | null }).part_img_url : null);
            const year = 'year' in item ? (item as SetResult).year : undefined;
            const numParts = 'num_parts' in item ? item.num_parts : undefined;
            const isOwned = ownedSetNums.has(itemNum);
            const isExpanded = expandedItem === itemNum;

            return (
              <div key={itemNum} className="flex flex-col">
                <div className={`bg-white rounded-xl border overflow-hidden relative ${
                  isOwned ? 'border-emerald-300 ring-1 ring-emerald-200' :
                  isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200 rounded-b-none' :
                  'border-gray-200'
                }`}>
                  {/* Owned / Add checkbox */}
                  <button
                    onClick={() => {
                      if (isOwned) return;
                      setExpandedItem(isExpanded ? null : itemNum);
                    }}
                    disabled={isOwned}
                    className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isOwned
                        ? 'bg-emerald-500 text-white cursor-default'
                        : isExpanded
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/80 border border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500'
                    }`}
                    title={isOwned ? 'In your collection' : 'Add to collection'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  {/* Image (clickable to zoom) */}
                  <button
                    onClick={() => setImageModal({
                      open: true,
                      imageUrl: image,
                      title: name,
                      itemNum,
                      year,
                      numParts,
                      externalUrl: 'set_url' in item ? (item as SetResult).set_url : undefined,
                    })}
                    className="aspect-square bg-gray-50 flex items-center justify-center p-3 w-full cursor-zoom-in hover:bg-gray-100 transition-colors"
                  >
                    {image ? (
                      <img src={image} alt={name} className="max-h-full max-w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="text-gray-300 text-xs">No image</div>
                    )}
                  </button>

                  {/* Info */}
                  <div className="p-2.5 border-t border-gray-100">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <p className="text-xs text-gray-400 font-mono">{itemNum}</p>
                      {year && <p className="text-xs text-gray-400">{year}</p>}
                    </div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{name}</p>
                    {numParts != null && (
                      <p className="text-xs text-gray-400 mt-0.5">{numParts} pcs</p>
                    )}
                  </div>
                </div>

                {/* Quick-add form */}
                {isExpanded && !isOwned && category !== 'parts' && (
                  <QuickAddForm
                    category={category}
                    onConfirm={data => handleQuickAdd(item, data)}
                    onCancel={() => setExpandedItem(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && totalCount === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">No results yet</p>
          <p className="text-xs">Use the filters above and click "Apply Filters" to browse the catalog</p>
        </div>
      )}

      {/* Image zoom modal */}
      <ImageModal
        open={imageModal.open}
        imageUrl={imageModal.imageUrl}
        title={imageModal.title}
        itemNum={imageModal.itemNum}
        year={imageModal.year}
        numParts={imageModal.numParts}
        externalUrl={imageModal.externalUrl}
        onClose={() => setImageModal({ ...imageModal, open: false })}
      />

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">...</span>
            ) : (
              <button
                key={p}
                onClick={() => changePage(p as number)}
                className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                  p === page
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Build hierarchical theme tree for dropdown
function buildThemeTree(themes: ThemeResult[]): { id: number; name: string; prefix: string }[] {
  const result: { id: number; name: string; prefix: string }[] = [];
  const roots = themes.filter(t => t.parent_id === null).sort((a, b) => a.name.localeCompare(b.name));

  function addChildren(parentId: number, depth: number) {
    const children = themes.filter(t => t.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      result.push({ id: child.id, name: child.name, prefix: '\u00A0\u00A0'.repeat(depth) + '└ ' });
      addChildren(child.id, depth + 1);
    }
  }

  for (const root of roots) {
    result.push({ id: root.id, name: root.name, prefix: '' });
    addChildren(root.id, 1);
  }

  return result;
}

// Generate smart page number array
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}
