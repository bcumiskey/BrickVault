import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Users, Loader2, ChevronLeft, Plus } from 'lucide-react';
import { rebrickableService } from '@/services/rebrickable';
import { storageService, enrichSetWithBE } from '@/services/storage';
import { autoAddMinifigsFromSet } from '@/services/minifigHelper';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

type Category = 'sets' | 'minifigs';
type SearchResult = {
  id: string;
  name: string;
  num: string;
  image: string | null;
  year?: number;
  numParts: number;
  raw: unknown;
};

type AddFormData = {
  status: CollectionSet['status'] | CollectionMinifigure['status'];
  condition: CollectionMinifigure['condition'];
  completeness_percentage: number;
  has_original_box: boolean;
  has_instructions: boolean;
  purchase_price: string;
  current_value: string;
  storage_location: string;
  notes: string;
};

const defaultForm: AddFormData = {
  status: 'COMPLETE_WITH_BOX',
  condition: 'GOOD',
  completeness_percentage: 100,
  has_original_box: true,
  has_instructions: true,
  purchase_price: '',
  current_value: '',
  storage_location: '',
  notes: '',
};

export default function AddItem() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('sets');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [form, setForm] = useState<AddFormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    try {
      if (category === 'sets') {
        const resp = await rebrickableService.searchSets(query.trim());
        setResults(
          resp.results.map(s => ({
            id: s.set_num,
            name: s.name,
            num: s.set_num,
            image: s.set_img_url,
            year: s.year,
            numParts: s.num_parts,
            raw: s,
          }))
        );
      } else {
        const resp = await rebrickableService.searchMinifigs(query.trim());
        setResults(
          resp.results.map(m => ({
            id: m.set_num,
            name: m.name,
            num: m.set_num,
            image: m.set_img_url,
            numParts: m.num_parts,
            raw: m,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, category]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const selectItem = (item: SearchResult) => {
    setSelectedItem(item);
    setForm({
      ...defaultForm,
      status: category === 'sets' ? 'COMPLETE_WITH_BOX' : 'COMPLETE',
    });
  };

  const saveItem = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id = `${category === 'sets' ? 'set' : 'fig'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (category === 'sets') {
        const raw = selectedItem.raw as {
          set_num: string; name: string; year: number; theme_id: number;
          num_parts: number; set_img_url: string | null; set_url: string;
        };
        const collectionSet: CollectionSet = {
          id,
          set_num: raw.set_num,
          set_data: {
            set_num: raw.set_num,
            name: raw.name,
            year: raw.year,
            theme_id: raw.theme_id,
            num_parts: raw.num_parts,
            set_img_url: raw.set_img_url ?? undefined,
            set_url: raw.set_url,
          },
          status: form.status as CollectionSet['status'],
          completeness_percentage: form.completeness_percentage,
          has_original_box: form.has_original_box,
          has_instructions: form.has_instructions,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
          current_value: form.current_value ? parseFloat(form.current_value) : undefined,
          quantity: 1,
          acquisitions: form.purchase_price
            ? [{
                id: `acq_${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                price: parseFloat(form.purchase_price),
                source: 'RETAIL' as const,
              }]
            : [],
          retired: false,
          storage_location: form.storage_location || undefined,
          notes: form.notes || undefined,
          created_at: now,
          updated_at: now,
        };
        const enrichedSet = await enrichSetWithBE(collectionSet);
        await storageService.saveCollectionSet(enrichedSet);

        // Auto-add minifigures from this set
        await autoAddMinifigsFromSet(enrichedSet);
      } else {
        const raw = selectedItem.raw as {
          set_num: string; name: string; num_parts: number;
          set_img_url: string | null; set_url: string;
        };
        const collectionMinifig: CollectionMinifigure = {
          id,
          fig_num: raw.set_num,
          minifig_data: {
            fig_num: raw.set_num,
            name: raw.name,
            num_parts: raw.num_parts,
            fig_img_url: raw.set_img_url ?? undefined,
            fig_url: raw.set_url,
          },
          status: form.status as CollectionMinifigure['status'],
          completeness_percentage: form.completeness_percentage,
          condition: form.condition,
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
          current_value: form.current_value ? parseFloat(form.current_value) : undefined,
          storage_location: form.storage_location || undefined,
          notes: form.notes || undefined,
          source: 'REBRICKABLE',
          quantity: 1,
          acquisitions: form.purchase_price
            ? [{
                id: `acq_${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                price: parseFloat(form.purchase_price),
                source: 'RETAIL' as const,
              }]
            : [],
          category: 'LOOSE' as const,
          retired: false,
          created_at: now,
          updated_at: now,
        };
        await storageService.saveCollectionMinifigure(collectionMinifig);
      }

      navigate('/collection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // --- Add form view ---
  if (selectedItem) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl">
        <button
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to results
        </button>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Selected item header */}
          <div className="flex gap-4 p-5 border-b border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
              {selectedItem.image ? (
                <img src={selectedItem.image} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="text-gray-300 text-xs">No image</div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-mono">{selectedItem.num}</p>
              <h2 className="text-lg font-semibold text-gray-900">{selectedItem.name}</h2>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                {selectedItem.year && <span>{selectedItem.year}</span>}
                <span>{selectedItem.numParts} pieces</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {category === 'sets' ? (
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as CollectionSet['status'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="NISB">New In Sealed Box</option>
                  <option value="COMPLETE_WITH_BOX">Complete with Box</option>
                  <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                </select>
              ) : (
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as CollectionMinifigure['status'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="COMPLETE">Complete</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                </select>
              )}
            </div>

            {/* Condition (minifigs) */}
            {category === 'minifigs' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={form.condition}
                  onChange={e => setForm({ ...form, condition: e.target.value as CollectionMinifigure['condition'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="NEW">New</option>
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>
            )}

            {/* Completeness */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completeness: {form.completeness_percentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.completeness_percentage}
                onChange={e => setForm({ ...form, completeness_percentage: parseInt(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            {/* Box & Instructions (sets only) */}
            {category === 'sets' && (
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.has_original_box}
                    onChange={e => setForm({ ...form, has_original_box: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Has original box
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.has_instructions}
                    onChange={e => setForm({ ...form, has_instructions: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Has instructions
                </label>
              </div>
            )}

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.purchase_price}
                  onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Value ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.current_value}
                  onChange={e => setForm({ ...form, current_value: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Storage Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
              <input
                type="text"
                placeholder="e.g. Shelf A, Bin 3"
                value={form.storage_location}
                onChange={e => setForm({ ...form, storage_location: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={saveItem}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to Collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Search view ---
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Add to Collection</h1>
      <p className="text-sm text-gray-500 mb-6">Search the Rebrickable catalog and add items to your collection</p>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'sets' as const, label: 'Sets', icon: Package },
          { key: 'minifigs' as const, label: 'Minifigures', icon: Users },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setCategory(key); setResults([]); setError(''); }}
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

      {/* Search input */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={category === 'sets' ? 'Search sets by name or number...' : 'Search minifigures by name...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{results.length} results</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(item => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all text-left"
              >
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="text-gray-300 text-xs">No image</div>
                  )}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className="text-xs text-gray-400 font-mono">{item.num}</p>
                    {item.year && <p className="text-xs text-gray-400">{item.year}</p>}
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.numParts} pieces</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results state */}
      {!searching && results.length === 0 && query && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No results found. Try a different search term.
        </div>
      )}
    </div>
  );
}
