import { useState, useEffect, useRef } from 'react';
import { Key, Download, Upload, Trash2, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, RefreshCw, CloudDownload, Database } from 'lucide-react';
import { rebrickableService } from '@/services/rebrickable';
import { brickEconomyService } from '@/services/brickeconomy';
import { storageService } from '@/services/storage';
import ConfirmDialog from '@/components/ConfirmDialog';
import CsvImporter from '@/components/CsvImporter';
import type { CollectionSet } from '@/types/lego';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [beApiKey, setBeApiKey] = useState('');
  const [beApiKeyStatus, setBeApiKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [beQuota, setBeQuota] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rebrickable_api_key') || '';
    setApiKey(saved);
    if (saved) setApiKeyStatus('valid');

    const savedBe = localStorage.getItem('brickeconomy_api_key') || '';
    setBeApiKey(savedBe);
    if (savedBe) {
      setBeApiKeyStatus('valid');
      setBeQuota(brickEconomyService.getRemainingQuota());
    }
  }, []);

  async function saveBeApiKey() {
    if (!beApiKey.trim()) {
      localStorage.removeItem('brickeconomy_api_key');
      setBeApiKeyStatus('idle');
      showMessage('success', 'BrickEconomy API key removed');
      return;
    }
    localStorage.setItem('brickeconomy_api_key', beApiKey.trim());
    setBeApiKeyStatus('testing');
    const valid = await brickEconomyService.testApiKey();
    if (valid) {
      setBeApiKeyStatus('valid');
      setBeQuota(brickEconomyService.getRemainingQuota());
      showMessage('success', 'BrickEconomy API key saved and verified!');
    } else {
      setBeApiKeyStatus('invalid');
      showMessage('error', 'BrickEconomy API key is invalid.');
    }
  }

  async function enrichCollection() {
    setEnriching(true);
    setEnrichProgress('Loading collection...');
    try {
      const sets = await storageService.getCollectionSets();
      let enriched = 0;
      let errors = 0;
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        setEnrichProgress(`Enriching ${i + 1}/${sets.length}: ${s.set_data.name}...`);
        try {
          const beData = await brickEconomyService.getSet(s.set_num);
          const updated: CollectionSet = {
            ...s,
            retired: beData.retired ?? s.retired,
            retirement_year: beData.retired_date ? parseInt(beData.retired_date.split('-')[0]) : s.retirement_year,
            retail_price: beData.retail_price_us ?? s.retail_price,
            current_value: beData.current_value_new ?? beData.current_value_used ?? s.current_value,
          };
          await storageService.saveCollectionSet(updated);
          enriched++;
        } catch {
          errors++;
        }
        // Rate limit: 500ms between requests
        if (i < sets.length - 1) await new Promise(r => setTimeout(r, 500));
      }
      setBeQuota(brickEconomyService.getRemainingQuota());
      showMessage('success', `Enriched ${enriched} sets with BrickEconomy data. ${errors > 0 ? `${errors} errors.` : ''}`);
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
      setEnrichProgress('');
    }
  }

  async function importBeCollection() {
    setImporting(true);
    setImportProgress('Fetching BrickEconomy collection...');
    try {
      const beCollection = await brickEconomyService.getMySetCollection();
      const existingSets = await storageService.getCollectionSets();
      // Map set_num -> existing CollectionSet for duplicate handling
      const existingByNum = new Map(existingSets.map(s => [s.set_num, s]));
      let imported = 0;
      let dupes = 0;

      const conditionMap: Record<string, CollectionSet['status']> = {
        'new': 'NISB',
        'used_as_new': 'COMPLETE_WITH_BOX',
        'used_complete': 'COMPLETE_NO_BOX',
        'used_incomplete': 'INCOMPLETE',
      };

      for (let i = 0; i < beCollection.sets.length; i++) {
        const beSet = beCollection.sets[i];
        const setNum = beSet.set_number;

        setImportProgress(`Importing ${i + 1}/${beCollection.sets.length}: ${beSet.name}...`);

        const existing = existingByNum.get(setNum);
        if (existing) {
          // Duplicate — increment quantity and add acquisition
          const updated: CollectionSet = {
            ...existing,
            quantity: (existing.quantity || 1) + 1,
            acquisitions: [
              ...(existing.acquisitions || []),
              ...(beSet.paid_price ? [{
                id: `acq_be_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
                date: beSet.aquired_date,
                price: beSet.paid_price,
                source: 'RETAIL' as const,
                source_detail: 'Imported from BrickEconomy (additional copy)',
              }] : []),
            ],
          };
          await storageService.saveCollectionSet(updated);
          existingByNum.set(setNum, updated);
          dupes++;
          continue;
        }

        const now = new Date().toISOString();
        const collectionSet: CollectionSet = {
          id: `set_be_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          set_num: setNum,
          set_data: {
            set_num: setNum,
            name: beSet.name,
            year: beSet.year ?? 0,
            theme_id: 0,
            num_parts: beSet.pieces_count ?? 0,
          },
          status: conditionMap[beSet.condition || 'new'] || 'COMPLETE_WITH_BOX',
          completeness_percentage: beSet.condition?.includes('incomplete') ? 50 : 100,
          has_original_box: beSet.condition === 'new' || beSet.condition === 'used_as_new',
          has_instructions: beSet.condition !== 'used_incomplete',
          purchase_price: beSet.paid_price,
          current_value: beSet.current_value,
          retail_price: beSet.retail_price,
          retired: beSet.retired ?? false,
          retirement_year: beSet.retired_date ? parseInt(beSet.retired_date.split('-')[0]) : undefined,
          quantity: 1,
          acquisitions: beSet.paid_price ? [{
            id: `acq_be_${Date.now()}`,
            date: beSet.aquired_date,
            price: beSet.paid_price,
            source: 'RETAIL' as const,
            source_detail: 'Imported from BrickEconomy',
          }] : [],
          created_at: now,
          updated_at: now,
        };
        await storageService.saveCollectionSet(collectionSet);
        existingByNum.set(setNum, collectionSet);
        imported++;
      }

      // Phase 2: Fetch images from Rebrickable (no daily limit, just rate-limited)
      setImportProgress('Fetching images from Rebrickable...');
      const allSets = await storageService.getCollectionSets();
      const setsNeedingImages = allSets.filter(s => !s.set_data.set_img_url);
      let imagesFound = 0;

      for (let i = 0; i < setsNeedingImages.length; i++) {
        const s = setsNeedingImages[i];
        if (i % 10 === 0) {
          setImportProgress(`Fetching images ${i + 1}/${setsNeedingImages.length}...`);
        }
        try {
          const rbData = await rebrickableService.getSet(s.set_num);
          if (rbData.set_img_url || rbData.set_url) {
            const updated: CollectionSet = {
              ...s,
              set_data: {
                ...s.set_data,
                set_img_url: rbData.set_img_url ?? undefined,
                set_url: rbData.set_url,
                theme_id: rbData.theme_id || s.set_data.theme_id,
              },
            };
            await storageService.saveCollectionSet(updated);
            imagesFound++;
          }
        } catch {
          // Set not found on Rebrickable — skip silently
        }
        // Small delay to respect rate limits
        if (i < setsNeedingImages.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      setBeQuota(brickEconomyService.getRemainingQuota());
      showMessage('success', `Imported ${imported} sets (${dupes} additional copies merged). ${imagesFound} images loaded from Rebrickable.`);
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim()) {
      localStorage.removeItem('rebrickable_api_key');
      setApiKeyStatus('idle');
      showMessage('success', 'API key removed');
      return;
    }
    localStorage.setItem('rebrickable_api_key', apiKey.trim());
    setApiKeyStatus('testing');
    const valid = await rebrickableService.testApiKey();
    if (valid) {
      setApiKeyStatus('valid');
      showMessage('success', 'API key saved and verified!');
    } else {
      setApiKeyStatus('invalid');
      showMessage('error', 'API key appears to be invalid. Please check it and try again.');
    }
  }

  function exportData() {
    const json = storageService.exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brickvault-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('success', 'Collection exported successfully!');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        storageService.importAllData(reader.result as string);
        showMessage('success', 'Collection imported successfully! Refresh to see changes.');
      } catch {
        showMessage('error', 'Failed to import. Make sure the file is a valid BrickVault export.');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }

  function clearAllData() {
    storageService.clearAllData();
    setConfirmClear(false);
    showMessage('success', 'All collection data has been cleared.');
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Configure your API keys and manage your data</p>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm mb-6 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* API Key */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Key className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Rebrickable API Key</h2>
            <p className="text-xs text-gray-500">
              Get a free key at{' '}
              <a href="https://rebrickable.com/api/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                rebrickable.com/api
              </a>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setApiKeyStatus('idle'); }}
            placeholder="Enter your Rebrickable API key"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={saveApiKey}
            disabled={apiKeyStatus === 'testing'}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {apiKeyStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </button>
        </div>
        {apiKeyStatus === 'valid' && (
          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> API key is valid
          </p>
        )}
        {apiKeyStatus === 'invalid' && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> API key is invalid
          </p>
        )}
      </section>

      {/* BrickEconomy API Key */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Key className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">BrickEconomy API Key</h2>
            <p className="text-xs text-gray-500">
              Requires{' '}
              <a href="https://www.brickeconomy.com/premium" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                Premium ($5/mo)
              </a>
              {' '}&middot; Retirement dates, market values, price history
            </p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="password"
            value={beApiKey}
            onChange={e => { setBeApiKey(e.target.value); setBeApiKeyStatus('idle'); }}
            placeholder="Enter your BrickEconomy API key"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
          <button
            onClick={saveBeApiKey}
            disabled={beApiKeyStatus === 'testing'}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {beApiKeyStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save
          </button>
        </div>
        {beApiKeyStatus === 'valid' && (
          <p className="text-xs text-emerald-600 mb-3 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> API key valid &middot; {beQuota ?? '?'} requests remaining today
          </p>
        )}
        {beApiKeyStatus === 'invalid' && (
          <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> API key is invalid
          </p>
        )}

        {/* BrickEconomy Actions */}
        {beApiKeyStatus === 'valid' && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {/* Enrich Collection */}
            <button
              onClick={enrichCollection}
              disabled={enriching || importing}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-amber-500 ${enriching ? 'animate-spin' : ''}`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Enrich Collection</p>
                <p className="text-xs text-gray-500">
                  {enriching ? enrichProgress : 'Update all sets with market values, retirement dates, and retail prices'}
                </p>
              </div>
            </button>

            {/* Import from BrickEconomy */}
            <button
              onClick={importBeCollection}
              disabled={enriching || importing}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <CloudDownload className={`w-5 h-5 text-amber-500 ${importing ? 'animate-pulse' : ''}`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Import BrickEconomy Collection</p>
                <p className="text-xs text-gray-500">
                  {importing ? importProgress : 'Sync your BrickEconomy set collection into BrickVault'}
                </p>
              </div>
            </button>
          </div>
        )}
      </section>

      {/* Data Management */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Data Management</h2>
        <div className="space-y-3">
          {/* Sync to Database */}
          <button
            onClick={async () => {
              setSyncing(true);
              try {
                // Run migration first
                await fetch('/api/migrate');
                const result = await storageService.syncToDatabase();
                showMessage('success', `Synced to database: ${result.sets} sets, ${result.minifigs} minifigures`);
              } catch (err) {
                showMessage('error', err instanceof Error ? err.message : 'Sync failed');
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="w-full flex items-center gap-3 px-4 py-3 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-left disabled:opacity-50"
          >
            <Database className={`w-5 h-5 text-indigo-500 ${syncing ? 'animate-pulse' : ''}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{syncing ? 'Syncing...' : 'Sync to Database'}</p>
              <p className="text-xs text-gray-500">Push local data to Neon Postgres for cross-browser persistence</p>
            </div>
          </button>

          {/* Export */}
          <button
            onClick={exportData}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Download className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Export Collection</p>
              <p className="text-xs text-gray-500">Download all your data as a JSON file</p>
            </div>
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Upload className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Import Collection</p>
              <p className="text-xs text-gray-500">Restore data from a BrickVault export file</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          {/* BrickEconomy CSV Import */}
          <button
            onClick={() => setShowCsvImporter(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Import from BrickEconomy</p>
              <p className="text-xs text-gray-500">Import sets from a BrickEconomy CSV export</p>
            </div>
          </button>

          {/* Clear */}
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-700">Clear All Data</p>
              <p className="text-xs text-red-400">Permanently delete all collection data</p>
            </div>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear All Data"
        message="This will permanently delete all your collection data including sets, minifigures, and custom fields. This action cannot be undone. Consider exporting first."
        confirmLabel="Clear Everything"
        variant="danger"
        onConfirm={clearAllData}
        onCancel={() => setConfirmClear(false)}
      />

      {showCsvImporter && (
        <CsvImporter onClose={() => { setShowCsvImporter(false); showMessage('success', 'Import complete. Visit your Collection to see imported items.'); }} />
      )}
    </div>
  );
}
