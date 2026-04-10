import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, DollarSign, TrendingUp, Users, PlusCircle, Library } from 'lucide-react';
import { storageService } from '@/services/storage';
import EmptyState from '@/components/EmptyState';
import type { CollectionSet, CollectionMinifigure, CollectionAnalytics } from '@/types/lego';

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<CollectionAnalytics | null>(null);
  const [recentSets, setRecentSets] = useState<CollectionSet[]>([]);
  const [recentMinifigs, setRecentMinifigs] = useState<CollectionMinifigure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [stats, sets, minifigs] = await Promise.all([
        storageService.getCollectionAnalytics(),
        storageService.getCollectionSets(),
        storageService.getCollectionMinifigures(),
      ]);
      setAnalytics(stats);
      setRecentSets(
        [...sets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
      );
      setRecentMinifigs(
        [...minifigs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = (analytics?.total_sets ?? 0) === 0 && (analytics?.total_minifigures ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to BrickVault</h1>
        <p className="text-gray-500 mb-8">Your personal LEGO collection manager</p>
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No items yet"
          description="Start building your catalog by searching for LEGO sets and adding them to your collection."
          action={
            <Link
              to="/add"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Your First Set
            </Link>
          }
        />
      </div>
    );
  }

  const statCards = [
    { label: 'Sets', value: `${analytics!.total_sets}`, sub: `${analytics!.total_set_copies} copies`, icon: Package, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Minifigures', value: `${analytics!.total_minifigures}`, sub: `${analytics!.total_minifig_copies} copies`, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Collection Value', value: `$${analytics!.total_value.toFixed(0)}`, sub: undefined, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Cost', value: `$${analytics!.total_cost.toFixed(0)}`, sub: undefined, icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { label: 'Profit / Loss', value: `${analytics!.profit_loss >= 0 ? '+' : ''}$${analytics!.profit_loss.toFixed(0)}`, sub: undefined, icon: TrendingUp, color: analytics!.profit_loss >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600' },
    { label: 'Retired Sets', value: `${analytics!.retired_sets}`, sub: analytics!.total_sets > 0 ? `${Math.round((analytics!.retired_sets / analytics!.total_sets) * 100)}% of collection` : undefined, icon: Package, color: 'bg-gray-50 text-gray-600' },
  ];

  const recentItems = [
    ...recentSets.map(s => ({
      id: s.id,
      name: s.set_data.name,
      num: s.set_num,
      image: s.set_data.set_img_url,
      type: 'set' as const,
      date: s.created_at,
    })),
    ...recentMinifigs.map(m => ({
      id: m.id,
      name: m.minifig_data.name,
      num: m.fig_num,
      image: m.minifig_data.fig_img_url,
      type: 'minifig' as const,
      date: m.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Your LEGO collection at a glance</p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Add Item
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Completion & Category Stats */}
      {analytics && analytics.total_sets > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Set Completion</h2>
            <div className="flex gap-6 text-sm">
              <div><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-2" /><span className="text-gray-600">Complete: {analytics.completion_stats.complete}</span></div>
              <div><span className="inline-block w-3 h-3 rounded-full bg-amber-500 mr-2" /><span className="text-gray-600">Incomplete: {analytics.completion_stats.incomplete}</span></div>
              <div><span className="inline-block w-3 h-3 rounded-full bg-indigo-500 mr-2" /><span className="text-gray-600">NISB: {analytics.completion_stats.nisb}</span></div>
            </div>
          </div>
          {analytics.total_minifigures > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Minifigure Categories</h2>
              <div className="flex gap-6 text-sm">
                <div><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" /><span className="text-gray-600">Set Figures: {analytics.set_fig_count}</span></div>
                <div><span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-2" /><span className="text-gray-600">CMF: {analytics.cmf_count}</span></div>
                <div><span className="inline-block w-3 h-3 rounded-full bg-gray-500 mr-2" /><span className="text-gray-600">Loose: {analytics.loose_fig_count}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Additions */}
      {recentItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Additions</h2>
            <Link to="/collection" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <Library className="w-4 h-4" />
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentItems.map(item => (
              <Link
                key={item.id}
                to={`/collection/${item.id}?type=${item.type}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="text-gray-300 text-xs">No image</div>
                  )}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-mono mb-0.5">{item.num}</p>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
