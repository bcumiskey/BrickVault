import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

interface CollectionCardProps {
  item: CollectionSet | CollectionMinifigure;
  type: 'set' | 'minifig';
}

export default function CollectionCard({ item, type }: CollectionCardProps) {
  const isSet = type === 'set';
  const set = isSet ? (item as CollectionSet) : null;
  const minifig = !isSet ? (item as CollectionMinifigure) : null;

  const name = set?.set_data.name ?? minifig?.minifig_data.name ?? 'Unknown';
  const itemNum = set?.set_num ?? minifig?.fig_num ?? '';
  const imageUrl = set?.set_data.set_img_url ?? minifig?.minifig_data.fig_img_url;
  const year = set?.set_data.year;
  const numParts = set?.set_data.num_parts ?? minifig?.minifig_data.num_parts;
  const status = item.status;
  const purchasePrice = set?.purchase_price ?? minifig?.purchase_price;
  const currentValue = set?.current_value ?? minifig?.current_value;
  const isRetired = ('retired' in item) ? (item as any).retired : false;
  const quantity = ('quantity' in item) ? (item as any).quantity ?? 1 : 1;
  const minifigCategory = !isSet && minifig ? minifig.category : undefined;
  const parentSetNum = !isSet && minifig ? minifig.parent_set_num : undefined;
  const isBulkLot = ('acquisitions' in item) && Array.isArray((item as any).acquisitions) && (item as any).acquisitions.some((a: any) => a.source === 'BULK_LOT');
  const isSold = item.status === 'SOLD';

  return (
    <Link
      to={`/collection/${item.id}?type=${type}`}
      className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group ${isSold ? 'opacity-60' : ''}`}
    >
      {/* Image */}
      <div className="aspect-square bg-gray-50 flex items-center justify-center p-4 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="text-gray-300 text-sm">No image</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs text-gray-500 font-mono">{itemNum}</p>
          {year && <p className="text-xs text-gray-400">{year}</p>}
        </div>
        <h3 className={`text-sm font-semibold line-clamp-2 mb-2 leading-snug ${isSold ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {name}
        </h3>
        <div className="flex items-center flex-wrap gap-1.5 mb-1">
          <StatusBadge status={status} />
          {isRetired && (
            <span className="inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 bg-red-50 text-red-600">
              Retired
            </span>
          )}
          {!isSet && minifigCategory && (
            <span className={`inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 ${
              minifigCategory === 'SET_FIGURE' ? 'bg-blue-50 text-blue-600' :
              minifigCategory === 'CMF' ? 'bg-purple-50 text-purple-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {minifigCategory === 'SET_FIGURE' ? 'Set Figure' : minifigCategory === 'CMF' ? 'CMF' : 'Loose'}
            </span>
          )}
          {quantity > 1 && (
            <span className="inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600">
              ×{quantity}
            </span>
          )}
          {isBulkLot && (
            <span className="inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 bg-amber-50 text-amber-600">
              Bulk Lot
            </span>
          )}
        </div>
        {numParts != null && (
          <span className="text-xs text-gray-400">{numParts} pcs</span>
        )}
        {/* Parent set link for SET_FIGURE */}
        {!isSet && parentSetNum && (
          <p className="text-xs text-gray-400 mt-1">from {parentSetNum}</p>
        )}
        {(purchasePrice != null || currentValue != null) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
            {purchasePrice != null && (
              <span className="text-xs text-gray-500">Paid ${purchasePrice.toFixed(2)}</span>
            )}
            {currentValue != null && (
              <span className="text-xs font-medium text-emerald-600">${currentValue.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
