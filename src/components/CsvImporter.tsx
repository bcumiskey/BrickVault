import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { rebrickableService } from '@/services/rebrickable';
import { enrichSetWithBE } from '@/services/storage';
import { storageService } from '@/services/storage';
import type { CollectionSet } from '@/types/lego';

interface ParsedRow {
  number: string;
  owned: number;
  status: 'pending' | 'importing' | 'success' | 'error' | 'skipped' | 'exists';
  name?: string;
  errorMsg?: string;
}

export default function CsvImporter({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [defaultStatus, setDefaultStatus] = useState<CollectionSet['status']>('COMPLETE_WITH_BOX');
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState({ imported: 0, existed: 0, notFound: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function parseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function parseCsv(text: string): ParsedRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect delimiter
    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim().toLowerCase());

    const numIdx = headers.findIndex(h => h === 'number' || h === 'set number' || h === 'set_number' || h === 'item' || h === 'itemid' || h === 'set_num');
    const ownedIdx = headers.findIndex(h => h === 'owned' || h === 'qty' || h === 'quantity');

    if (numIdx === -1) {
      // Try treating first column as number
      return lines.slice(1).map(line => {
        const vals = line.split(delimiter).map(v => v.replace(/"/g, '').trim());
        return {
          number: normalizeSetNum(vals[0]),
          owned: parseInt(vals[1]) || 1,
          status: 'pending' as const,
        };
      }).filter(r => r.number);
    }

    return lines.slice(1).map(line => {
      const vals = line.split(delimiter).map(v => v.replace(/"/g, '').trim());
      const owned = ownedIdx >= 0 ? parseInt(vals[ownedIdx]) || 0 : 1;
      return {
        number: normalizeSetNum(vals[numIdx]),
        owned,
        status: 'pending' as const,
      };
    }).filter(r => r.number && r.owned > 0);
  }

  function normalizeSetNum(num: string): string {
    if (!num) return '';
    num = num.trim();
    // Add -1 suffix if missing (Rebrickable convention)
    if (!num.includes('-') && /^\d+$/.test(num)) {
      num = num + '-1';
    }
    return num;
  }

  async function startImport() {
    setStep('importing');
    const existingSets = await storageService.getCollectionSets();
    const existingNums = new Set(existingSets.map(s => s.set_num));

    let imported = 0;
    let existed = 0;
    let notFound = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Check if already in collection
      if (existingNums.has(row.number)) {
        rows[i] = { ...row, status: 'exists' };
        existed++;
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        setRows([...rows]);
        continue;
      }

      rows[i] = { ...row, status: 'importing' };
      setRows([...rows]);

      try {
        // Look up on Rebrickable
        const setData = await rebrickableService.getSet(row.number);
        const now = new Date().toISOString();
        const id = `set_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const collectionSet: CollectionSet = {
          id,
          set_num: setData.set_num,
          set_data: {
            set_num: setData.set_num,
            name: setData.name,
            year: setData.year,
            theme_id: setData.theme_id,
            num_parts: setData.num_parts,
            set_img_url: setData.set_img_url ?? undefined,
            set_url: setData.set_url,
          },
          status: defaultStatus,
          completeness_percentage: defaultStatus === 'NISB' || defaultStatus.startsWith('COMPLETE') ? 100 : 50,
          has_original_box: defaultStatus === 'NISB' || defaultStatus === 'COMPLETE_WITH_BOX',
          has_instructions: defaultStatus !== 'PARTS_ONLY',
          quantity: row.owned,
          acquisitions: Array.from({ length: row.owned }, (_, i) => ({
            id: `acq_csv_${Date.now()}_${i}`,
            date: new Date().toISOString().split('T')[0],
            price: undefined,
            source: 'OTHER' as const,
            source_detail: 'CSV Import',
          })),
          retired: false,
          created_at: now,
          updated_at: now,
        };

        const enriched = await enrichSetWithBE(collectionSet);
        await storageService.saveCollectionSet(enriched);
        rows[i] = { ...row, status: 'success', name: setData.name };
        imported++;
        existingNums.add(row.number);
      } catch {
        rows[i] = { ...row, status: 'error', errorMsg: 'Not found on Rebrickable' };
        notFound++;
      }

      setRows([...rows]);
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      // Rate limit: wait 500ms between requests
      if (i < rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setSummary({ imported, existed, notFound });
    setStep('done');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Import from BrickEconomy</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {/* Upload step */}
          {step === 'upload' && (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Upload your BrickEconomy CSV export file
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Expected columns: <code className="bg-gray-100 px-1 rounded">Number</code>, <code className="bg-gray-100 px-1 rounded">Owned</code>
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Choose CSV File
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={parseFile} className="hidden" />
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Found <span className="font-semibold">{rows.length}</span> items to import
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Status for All Items</label>
                <select
                  value={defaultStatus}
                  onChange={e => setDefaultStatus(e.target.value as CollectionSet['status'])}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="NISB">New In Sealed Box</option>
                  <option value="COMPLETE_WITH_BOX">Complete with Box</option>
                  <option value="COMPLETE_NO_BOX">Complete (No Box)</option>
                  <option value="INCOMPLETE">Incomplete</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                </select>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Set Number</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono text-xs">{row.number}</td>
                        <td className="px-3 py-1.5 text-xs">{row.owned}</td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-1.5 text-xs text-gray-400 text-center">
                          ...and {rows.length - 50} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                onClick={startImport}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Import {rows.length} Items
              </button>
            </>
          )}

          {/* Importing step */}
          {step === 'importing' && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                <p className="text-sm text-gray-600">
                  Importing... Looking up each set on Rebrickable
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">{progress}%</p>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div className="py-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Import Complete</h3>
              <div className="space-y-1 text-sm mb-6">
                <p className="text-emerald-600">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  {summary.imported} sets imported
                </p>
                {summary.existed > 0 && (
                  <p className="text-gray-500">{summary.existed} already in collection (skipped)</p>
                )}
                {summary.notFound > 0 && (
                  <p className="text-amber-600">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {summary.notFound} not found on Rebrickable
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
