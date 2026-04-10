import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, PlusCircle, LayoutGrid, List, Package } from 'lucide-react';
import { storageService } from '@/services/storage';
import CollectionCard from '@/components/CollectionCard';
import EmptyState from '@/components/EmptyState';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

type ViewMode = 'grid' | 'list';
type ItemFilter = 'all' | 'sets' | 'minifigs';
type SortOption = 'newest' | 'oldest' | 'name' | 'value';

export default function Collection() {
  const [sets, setSets] = useState<CollectionSet[]>([]);
  const [minifigs, setMinifigs] = useState<CollectionMinifigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [retiredFilter, setRetiredFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    loadData();
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

  const filteredItems = useMemo(() => {
    type TaggedItem = { item: CollectionSet | CollectionMinifigure; type: 'set' | 'minifig'; sortName: string; sortDate: string; sortValue: number };

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
      items = items.filter(({ item }) => ('retired' in item) && (item as any).retired === true);
    } else if (retiredFilter === 'active') {
      items = items.filter(({ item }) => !('retired' in item) || (item as any).retired !== true);
    }

    // Category filter (minifigs only)
    if (categoryFilter) {
      items = items.filter(({ item, type }) => {
        if (type !== 'minifig') return categoryFilter === ''; // hide sets when filtering by category
        return (item as CollectionMinifigure).category === categoryFilter;
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
  }, [sets, minifigs, searchQuery, filter, sort, statusFilter, retiredFilter, categoryFilter]);

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
        <Link
          to="/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Add Item
        </Link>
      </div>

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
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value as ItemFilter)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All</option>
                  <option value="sets">Sets</option>
                  <option value="minifigs">Minifigures</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortOption)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
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

          {/* Grid / List */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No items match your filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map(({ item, type }) => (
                <CollectionCard key={item.id} item={item} type={type} />
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
                  <Link
                    key={item.id}
                    to={`/collection/${item.id}?type=${type}`}
                    className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
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
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
