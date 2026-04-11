import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, PlusCircle, LayoutGrid, List, Package, CheckSquare, Square, Trash2, X } from 'lucide-react';
import { storageService } from '@/services/storage';
import { rebrickableService } from '@/services/rebrickable';
import type { ThemeResult } from '@/services/rebrickable';
import CollectionCard from '@/components/CollectionCard';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

type ViewMode = 'grid' | 'list';
type ItemFilter = 'all' | 'sets' | 'minifigs';
type SortOption = 'newest' | 'oldest' | 'name' | 'value';

export default function Collection() {
  const [sets, setSets] = useState<CollectionSet[]>([]);
  const [minifigs, setMinifigs] = useState<CollectionMinifigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('sets');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [retiredFilter, setRetiredFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [themeFilter, setThemeFilter] = useState<string>('');
  const [minYearFilter, setMinYearFilter] = useState<string>('');
  const [maxYearFilter, setMaxYearFilter] = useState<string>('');
  const [themes, setThemes] = useState<ThemeResult[]>([]);

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkValue, setBulkValue] = useState<string>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    rebrickableService.getThemes().then(setThemes).catch(() => {});
  }, []);

  async function loadData() {
    try {
      const [s, m] = await Promise.all([
        storageService.getCollectionSets(),
        storageService.getCollectionMinifigures(),
      ]);
      setSets(s);
      setMinifigs(m);
    } finally {
      setLoading(false);
    }
  }

  type TaggedItem = { item: CollectionSet | CollectionMinifigure; type: 'set' | 'minifig'; sortName: string; sortDate: string; sortValue: number };

  const filteredItems = useMemo(() => {
    let items: TaggedItem[] = [];

    if (filter !== 'minifigs') {
      items.push(
        ...sets.map(s => ({
          item: s,
          type: 'set' as const,
          sortName: s.set_data.name.toLowerCase(),
          sortDate: s.created_at,
          sortValue: s.current_value ?? 0,
        }))
      );
    }
    if (filter !== 'sets') {
      items.push(
        ...minifigs.map(m => ({
          item: m,
          type: 'minifig' as const,
          sortName: m.minifig_data.name.toLowerCase(),
          sortDate: m.created_at,
          sortValue: m.current_value ?? 0,
        }))
      );
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(({ item, type }) => {
        if (type === 'set') {
          const s = item as CollectionSet;
          return s.set_data.name.toLowerCase().includes(q) || s.set_num.toLowerCase().includes(q);
        }
        const m = item as CollectionMinifigure;
        return m.minifig_data.name.toLowerCase().includes(q) || m.fig_num.toLowerCase().includes(q);
      });
    }

    // Status filter — hide sold items by default unless explicitly filtered
    if (statusFilter) {
      items = items.filter(({ item }) => item.status === statusFilter);
    } else {
      items = items.filter(({ item }) => item.status !== 'SOLD');
    }

    // Retired filter
    if (retiredFilter === 'retired') {
      items = items.filter(({ item }) => ('retired' in item) && (item as CollectionSet).retired === true);
    } else if (retiredFilter === 'active') {
      items = items.filter(({ item }) => !('retired' in item) || (item as CollectionSet).retired !== true);
    }

    // Category filter (minifigs only)
    if (categoryFilter) {
      items = items.filter(({ item, type }) => {
        if (type !== 'minifig') return categoryFilter === '';
        return (item as CollectionMinifigure).category === categoryFilter;
      });
    }

    // Theme filter
    if (themeFilter) {
      items = items.filter(({ item, type }) => {
        if (type !== 'set') return false;
        return (item as CollectionSet).set_data.theme_id.toString() === themeFilter;
      });
    }

    // Year range filter
    if (minYearFilter || maxYearFilter) {
      items = items.filter(({ item, type }) => {
        if (type !== 'set') return !minYearFilter && !maxYearFilter;
        const year = (item as CollectionSet).set_data.year;
        if (minYearFilter && year < parseInt(minYearFilter)) return false;
        if (maxYearFilter && year > parseInt(maxYearFilter)) return false;
        return true;
      });
    }

    // Sort
    switch (sort) {
      case 'newest':
        items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
        break;
      case 'oldest':
        items.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());
        break;
      case 'name':
        items.sort((a, b) => a.sortName.localeCompare(b.sortName));
        break;
      case 'value':
        items.sort((a, b) => b.sortValue - a.sortValue);
        break;
    }

    return items;
  }, [sets, minifigs, searchQuery, filter, sort, statusFilter, retiredFilter, categoryFilter, themeFilter, minYearFilter, maxYearFilter]);

  const soldCount = sets.filter(s => s.status === 'SOLD').length + minifigs.filter(m => m.status === ('SOLD' as string)).length;

  // Bulk edit helpers
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredItems.map(({ item }) => item.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkAction('');
    setBulkValue('');
  }

  async function applyBulkAction() {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    try {
      for (const { item, type } of filteredItems) {
        if (!selectedIds.has(item.id)) continue;

        if (type === 'set') {
          const s = item as CollectionSet;
          let updated = { ...s };
          switch (bulkAction) {
            case 'status': updated.status = bulkValue as CollectionSet['status']; break;
            case 'retired_true': updated.retired = true; break;
            case 'retired_false': updated.retired = false; break;
            case 'storage': updated.storage_location = bulkValue || undefined; break;
          }
          await storageService.saveCollectionSet(updated);
        } else {
          const m = item as CollectionMinifigure;
          let updated = { ...m };
          switch (bulkAction) {
            case 'status': updated.status = bulkValue as CollectionMinifigure['status']; break;
            case 'retired_true': updated.retired = true; break;
            case 'retired_false': updated.retired = false; break;
            case 'category': updated.category = bulkValue as CollectionMinifigure['category']; break;
            case 'storage': updated.storage_location = bulkValue || undefined; break;
          }
          await storageService.saveCollectionMinifigure(updated);
        }
      }
      await loadData();
      exitBulkMode();
    } finally {
      setBulkApplying(false);
    }
  }

  async function bulkDelete() {
    setBulkApplying(true);
    try {
      for (const { item, type } of filteredItems) {
        if (!selectedIds.has(item.id)) continue;
        if (type === 'set') {
          await storageService.deleteCollectionSet(item.id);
        } else {
          await storageService.deleteCollectionMinifigure(item.id);
        }
      }
      await loadData();
      exitBulkMode();
      setConfirmBulkDelete(false);
    } finally {
      setBulkApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = sets.length === 0 && minifigs.length === 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collection</h1>
          <p className="text-sm text-gray-500">
            {sets.length} set{sets.length !== 1 ? 's' : ''}, {minifigs.length} minifigure{minifigs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEmpty && (
            <button
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                bulkMode
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {bulkMode ? 'Cancel' : 'Bulk Edit'}
            </button>
          )}
          <Link
            to="/add"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Item
          </Link>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-700">
                {selectedIds.size} selected
              </span>
              <button onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Select All ({filteredItems.length})
              </button>
              {selectedIds.size > 0 && (
                <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                  Deselect All
                </button>
              )}
            </div>
            <button onClick={exitBulkMode} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {/* Status change */}
              <div className="flex gap-1">
                <select
                  value={bulkAction === 'status' ? bulkValue : ''}
                  onChange={e => { setBulkAction('status'); setBulkValue(e.target.value); }}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">Set Status...</option>
                  <option value="NISB">NISB</option>
                  <option value="COMPLETE_WITH_BOX">Complete w/ Box</option>
                  <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                  <option value="SOLD">Sold</option>
                  <option value="COMPLETE">Complete (Fig)</option>
                </select>
              </div>

              {/* Category change */}
              <select
                value={bulkAction === 'category' ? bulkValue : ''}
                onChange={e => { setBulkAction('category'); setBulkValue(e.target.value); }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
              >
                <option value="">Set Category...</option>
                <option value="SET_FIGURE">Set Figure</option>
                <option value="CMF">CMF</option>
                <option value="LOOSE">Loose</option>
              </select>

              {/* Retired toggle */}
              <button
                onClick={() => { setBulkAction('retired_true'); setBulkValue(''); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  bulkAction === 'retired_true' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Mark Retired
              </button>
              <button
                onClick={() => { setBulkAction('retired_false'); setBulkValue(''); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  bulkAction === 'retired_false' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Mark Active
              </button>

              {/* Storage location */}
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Set storage..."
                  value={bulkAction === 'storage' ? bulkValue : ''}
                  onChange={e => { setBulkAction('storage'); setBulkValue(e.target.value); }}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-32"
                />
              </div>

              {/* Apply button */}
              {bulkAction && (
                <button
                  onClick={applyBulkAction}
                  disabled={bulkApplying}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {bulkApplying ? 'Applying...' : `Apply to ${selectedIds.size}`}
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="Your collection is empty"
          description="Search for LEGO sets and minifigures to start cataloging your collection."
          action={
            <Link
              to="/add"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Your First Item
            </Link>
          }
        />
      ) : (
        <>
          {/* Type tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: 'sets' as const, label: `Sets (${sets.length})`, icon: Package },
              { key: 'minifigs' as const, label: `Minifigures (${minifigs.length})`, icon: Package },
              { key: 'all' as const, label: 'All', icon: Package },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search & controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 border-l border-gray-300 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">All Statuses</option>
                  <option value="NISB">NISB</option>
                  <option value="COMPLETE_WITH_BOX">Complete w/ Box</option>
                  <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                  <option value="SOLD">Sold</option>
                  <option value="COMPLETE">Complete (Minifig)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Retired</label>
                <select value={retiredFilter} onChange={e => setRetiredFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">All</option>
                  <option value="retired">Retired Only</option>
                  <option value="active">Active Only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fig Category</label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">All</option>
                  <option value="SET_FIGURE">Set Figures</option>
                  <option value="CMF">CMF</option>
                  <option value="LOOSE">Loose</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Theme</label>
                <select value={themeFilter} onChange={e => setThemeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">All Themes</option>
                  {themes.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                    <option key={t.id} value={t.id.toString()}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="From" min="1949" value={minYearFilter} onChange={e => setMinYearFilter(e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="To" min="1949" value={maxYearFilter} onChange={e => setMaxYearFilter(e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
                <select value={sort} onChange={e => setSort(e.target.value as SortOption)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="value">Value (High-Low)</option>
                </select>
              </div>
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-gray-400 mb-3">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</p>
          {!statusFilter && soldCount > 0 && (
            <p className="text-xs text-gray-400 mb-3">Hiding {soldCount} sold item{soldCount !== 1 ? 's' : ''}</p>
          )}

          {/* Grid / List */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No items match your filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map(({ item, type }) => (
                <div key={item.id} className="relative">
                  {bulkMode && (
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className={`absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                        selectedIds.has(item.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/80 border border-gray-300 text-gray-400 hover:border-indigo-400'
                      }`}
                    >
                      {selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                  <CollectionCard item={item} type={type} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map(({ item, type }) => {
                const isSet = type === 'set';
                const name = isSet ? (item as CollectionSet).set_data.name : (item as CollectionMinifigure).minifig_data.name;
                const num = isSet ? (item as CollectionSet).set_num : (item as CollectionMinifigure).fig_num;
                const image = isSet ? (item as CollectionSet).set_data.set_img_url : (item as CollectionMinifigure).minifig_data.fig_img_url;

                return (
                  <div key={item.id} className="flex items-center gap-2">
                    {bulkMode && (
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedIds.has(item.id)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-400 hover:border-indigo-400'
                        }`}
                      >
                        {selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    <Link
                      to={`/collection/${item.id}?type=${type}`}
                      className="flex-1 flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="w-14 h-14 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        {image ? (
                          <img src={image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        ) : (
                          <div className="text-gray-300 text-xs">No img</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-400 font-mono">{num}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 ${
                          item.status === 'NISB' || item.status === 'COMPLETE' ? 'bg-emerald-100 text-emerald-700' :
                          item.status.includes('COMPLETE') ? 'bg-blue-100 text-blue-700' :
                          item.status === 'SOLD' ? 'bg-gray-200 text-gray-500' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Delete Selected Items"
        message={`Are you sure you want to permanently delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={bulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
