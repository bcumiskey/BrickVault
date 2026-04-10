import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2, Save, X, ExternalLink } from 'lucide-react';
import { storageService } from '@/services/storage';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { CollectionSet, CollectionMinifigure } from '@/types/lego';

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = (searchParams.get('type') || 'set') as 'set' | 'minifig';

  const [set, setSet] = useState<CollectionSet | null>(null);
  const [minifig, setMinifig] = useState<CollectionMinifigure | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit form state
  const [editStatus, setEditStatus] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editCompleteness, setEditCompleteness] = useState(100);
  const [editBox, setEditBox] = useState(false);
  const [editInstructions, setEditInstructions] = useState(false);
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editCurrentValue, setEditCurrentValue] = useState('');
  const [editStorage, setEditStorage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRetired, setEditRetired] = useState(false);
  const [editRetirementYear, setEditRetirementYear] = useState('');

  useEffect(() => {
    loadItem();
  }, [id, type]);

  async function loadItem() {
    if (!id) return;
    setLoading(true);
    try {
      if (type === 'set') {
        const s = await storageService.getCollectionSet(id);
        setSet(s);
        if (s) initEditForm(s, 'set');
      } else {
        const m = await storageService.getCollectionMinifigure(id);
        setMinifig(m);
        if (m) initEditForm(m, 'minifig');
      }
    } finally {
      setLoading(false);
    }
  }

  function initEditForm(item: CollectionSet | CollectionMinifigure, t: 'set' | 'minifig') {
    setEditStatus(item.status);
    setEditCompleteness(item.completeness_percentage);
    setEditNotes(item.notes || '');
    if (t === 'set') {
      const s = item as CollectionSet;
      setEditBox(s.has_original_box);
      setEditInstructions(s.has_instructions);
      setEditPurchasePrice(s.purchase_price?.toString() || '');
      setEditCurrentValue(s.current_value?.toString() || '');
      setEditStorage(s.storage_location || '');
    } else {
      const m = item as CollectionMinifigure;
      setEditCondition(m.condition);
      setEditPurchasePrice(m.purchase_price?.toString() || '');
      setEditCurrentValue(m.current_value?.toString() || '');
      setEditStorage(m.storage_location || '');
    }
    setEditRetired(item.retired ?? false);
    setEditRetirementYear((item as any).retirement_year?.toString() || '');
  }

  async function saveChanges() {
    if (type === 'set' && set) {
      const updated: CollectionSet = {
        ...set,
        status: editStatus as CollectionSet['status'],
        completeness_percentage: editCompleteness,
        has_original_box: editBox,
        has_instructions: editInstructions,
        purchase_price: editPurchasePrice ? parseFloat(editPurchasePrice) : undefined,
        current_value: editCurrentValue ? parseFloat(editCurrentValue) : undefined,
        storage_location: editStorage || undefined,
        notes: editNotes || undefined,
        retired: editRetired,
        retirement_year: editRetirementYear ? parseInt(editRetirementYear) : undefined,
      };
      await storageService.saveCollectionSet(updated);
      setSet(updated);
    } else if (type === 'minifig' && minifig) {
      const updated: CollectionMinifigure = {
        ...minifig,
        status: editStatus as CollectionMinifigure['status'],
        completeness_percentage: editCompleteness,
        condition: editCondition as CollectionMinifigure['condition'],
        purchase_price: editPurchasePrice ? parseFloat(editPurchasePrice) : undefined,
        current_value: editCurrentValue ? parseFloat(editCurrentValue) : undefined,
        storage_location: editStorage || undefined,
        notes: editNotes || undefined,
        retired: editRetired,
      };
      await storageService.saveCollectionMinifigure(updated);
      setMinifig(updated);
    }
    setEditing(false);
  }

  async function deleteItem() {
    if (type === 'set' && id) {
      await storageService.deleteCollectionSet(id);
    } else if (type === 'minifig' && id) {
      await storageService.deleteCollectionMinifigure(id);
    }
    navigate('/collection');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const item = set || minifig;
  if (!item) {
    return (
      <div className="p-6 lg:p-8">
        <button onClick={() => navigate('/collection')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-gray-500">Item not found.</p>
      </div>
    );
  }

  const name = type === 'set' ? set!.set_data.name : minifig!.minifig_data.name;
  const itemNum = type === 'set' ? set!.set_num : minifig!.fig_num;
  const imageUrl = type === 'set' ? set!.set_data.set_img_url : minifig!.minifig_data.fig_img_url;
  const year = type === 'set' ? set!.set_data.year : undefined;
  const numParts = type === 'set' ? set!.set_data.num_parts : minifig!.minifig_data.num_parts;
  const externalUrl = type === 'set' ? set!.set_data.set_url : minifig!.minifig_data.fig_url;
  const purchasePrice = type === 'set' ? set!.purchase_price : minifig!.purchase_price;
  const currentValue = type === 'set' ? set!.current_value : minifig!.current_value;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button onClick={() => navigate('/collection')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Collection
      </button>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header with image */}
        <div className="flex flex-col sm:flex-row gap-6 p-6 border-b border-gray-100">
          <div className="w-48 h-48 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-gray-300 text-sm">No image</div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 font-mono mb-1">{itemNum}</p>
                <h1 className="text-xl font-bold text-gray-900 mb-2">{name}</h1>
                <div className="flex items-center gap-3 mb-3">
                  <StatusBadge status={item.status} size="md" />
                  {type === 'minifig' && <StatusBadge status={minifig!.condition} size="md" />}
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  {year && <span>{year}</span>}
                  <span>{numParts} pieces</span>
                  <span>{item.completeness_percentage}% complete</span>
                </div>
              </div>
            </div>

            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-3"
              >
                View on Rebrickable <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100">
          {editing ? (
            <>
              <button
                onClick={saveChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4" /> Save
              </button>
              <button
                onClick={() => { setEditing(false); if (item) initEditForm(item, type); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>

        {/* Details */}
        <div className="p-6 space-y-5">
          {editing ? (
            /* Edit Mode */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                {type === 'set' ? (
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="NISB">New In Sealed Box</option>
                    <option value="COMPLETE_WITH_BOX">Complete with Box</option>
                    <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
                    <option value="INCOMPLETE">Incomplete</option>
                    <option value="PARTS_ONLY">Parts Only</option>
                    <option value="SOLD">Sold</option>
                  </select>
                ) : (
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="COMPLETE">Complete</option>
                    <option value="INCOMPLETE">Incomplete</option>
                    <option value="PARTS_ONLY">Parts Only</option>
                    <option value="SOLD">Sold</option>
                  </select>
                )}
              </div>
              {type === 'minifig' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={editCondition} onChange={e => setEditCondition(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="NEW">New</option>
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completeness: {editCompleteness}%</label>
                <input type="range" min="0" max="100" step="5" value={editCompleteness} onChange={e => setEditCompleteness(parseInt(e.target.value))} className="w-full accent-indigo-600" />
              </div>
              {/* Retired */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={editRetired} onChange={e => setEditRetired(e.target.checked)} className="rounded border-gray-300 text-red-600" />
                  Retired
                </label>
                {editRetired && type === 'set' && (
                  <input
                    type="number"
                    placeholder="Year retired"
                    min="1949"
                    max="2030"
                    value={editRetirementYear}
                    onChange={e => setEditRetirementYear(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-32"
                  />
                )}
              </div>
              {type === 'set' && (
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editBox} onChange={e => setEditBox(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
                    Has original box
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editInstructions} onChange={e => setEditInstructions(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
                    Has instructions
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
                  <input type="number" step="0.01" value={editPurchasePrice} onChange={e => setEditPurchasePrice(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Value ($)</label>
                  <input type="number" step="0.01" value={editCurrentValue} onChange={e => setEditCurrentValue(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
                <input type="text" value={editStorage} onChange={e => setEditStorage(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              <div className="grid grid-cols-2 gap-4">
                {type === 'set' && (
                  <>
                    <InfoRow label="Box" value={set!.has_original_box ? 'Yes' : 'No'} />
                    <InfoRow label="Instructions" value={set!.has_instructions ? 'Yes' : 'No'} />
                  </>
                )}
                {type === 'minifig' && (
                  <InfoRow label="Condition" value={minifig!.condition} />
                )}
                <InfoRow label="Completeness" value={`${item.completeness_percentage}%`} />
                {purchasePrice != null && (
                  <InfoRow label="Purchase Price" value={`$${purchasePrice.toFixed(2)}`} />
                )}
                {currentValue != null && (
                  <InfoRow label="Current Value" value={`$${currentValue.toFixed(2)}`} highlight />
                )}
                {purchasePrice != null && currentValue != null && (
                  <InfoRow
                    label="Profit / Loss"
                    value={`${currentValue - purchasePrice >= 0 ? '+' : ''}$${(currentValue - purchasePrice).toFixed(2)}`}
                    highlight={currentValue - purchasePrice >= 0}
                    warn={currentValue - purchasePrice < 0}
                  />
                )}
              </div>
              {(type === 'set' ? set!.storage_location : minifig!.storage_location) && (
                <InfoRow label="Storage Location" value={(type === 'set' ? set!.storage_location : minifig!.storage_location)!} />
              )}
              {item.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
              {/* Category (minifigs) */}
              {type === 'minifig' && minifig && (
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Category</p>
                    <span className={`inline-flex items-center rounded-full text-xs font-medium px-2.5 py-1 ${
                      minifig.category === 'SET_FIGURE' ? 'bg-blue-100 text-blue-700' :
                      minifig.category === 'CMF' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {minifig.category === 'SET_FIGURE' ? 'Set Figure' : minifig.category === 'CMF' ? 'CMF' : 'Loose'}
                    </span>
                  </div>
                  {minifig.parent_set_num && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-0.5">From Set</p>
                      <p className="text-sm text-indigo-600 font-mono">{minifig.parent_set_num}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Quantity */}
              {(('quantity' in item) && (item as any).quantity > 1) && (
                <InfoRow label="Quantity" value={`${(item as any).quantity} copies`} />
              )}
              {/* Retired badge */}
              {item.retired && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full text-xs font-medium px-2.5 py-1 bg-red-100 text-red-700">Retired</span>
                  {type === 'set' && set?.retirement_year && (
                    <span className="text-xs text-gray-500">since {set.retirement_year}</span>
                  )}
                </div>
              )}
              {/* Acquisitions */}
              {item.acquisitions && item.acquisitions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Acquisitions</p>
                  <div className="space-y-2">
                    {item.acquisitions.map((acq: any) => (
                      <div key={acq.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">{acq.source?.replace(/_/g, ' ')}</span>
                          {acq.source_detail && <span className="text-gray-400 ml-1">({acq.source_detail})</span>}
                          {acq.date && <span className="text-gray-400 ml-2">{acq.date}</span>}
                        </div>
                        {acq.price != null && <span className="text-sm font-medium text-gray-900">${acq.price.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Added {new Date(item.created_at).toLocaleDateString()} &middot; Updated {new Date(item.updated_at).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Item"
        message={`Are you sure you want to remove "${name}" from your collection? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={deleteItem}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function InfoRow({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${warn ? 'text-red-600' : highlight ? 'text-emerald-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
