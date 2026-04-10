import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

type ItemCategory = 'sets' | 'minifigs' | 'parts';

interface QuickAddFormProps {
  category: ItemCategory;
  onConfirm: (data: QuickAddData) => Promise<void>;
  onCancel: () => void;
}

export interface QuickAddData {
  status: string;
  condition: string;
  purchase_price: string;
  current_value: string;
}

const defaultData: QuickAddData = {
  status: 'COMPLETE_WITH_BOX',
  condition: 'GOOD',
  purchase_price: '',
  current_value: '',
};

export default function QuickAddForm({ category, onConfirm, onCancel }: QuickAddFormProps) {
  const [data, setData] = useState<QuickAddData>({
    ...defaultData,
    status: category === 'sets' ? 'COMPLETE_WITH_BOX' : 'COMPLETE',
  });
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-b-xl px-3 py-2.5 space-y-2 -mt-1">
      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-0.5">Status</label>
        {category === 'sets' ? (
          <select
            value={data.status}
            onChange={e => setData({ ...data, status: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            <option value="NISB">New In Sealed Box</option>
            <option value="COMPLETE_WITH_BOX">Complete w/ Box</option>
            <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="PARTS_ONLY">Parts Only</option>
          </select>
        ) : (
          <select
            value={data.status}
            onChange={e => setData({ ...data, status: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
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
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Condition</label>
          <select
            value={data.condition}
            onChange={e => setData({ ...data, condition: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            <option value="NEW">New</option>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
          </select>
        </div>
      )}

      {/* Prices */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Paid ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={data.purchase_price}
            onChange={e => setData({ ...data, purchase_price: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Value ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={data.current_value}
            onChange={e => setData({ ...data, current_value: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
