import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';
import { COLUMNS, COLUMN_GROUPS, detectColumns } from '../config/columns';

const LS_KEY = 'aihaa_crm_sheet';

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}

function saveTo(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export default function Import() {
  const saved = getSaved();
  const [urlInput, setUrlInput] = useState(saved?.url || '');
  const [step, setStep] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState(saved?.spreadsheetId || '');
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [preview, setPreview] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [headers, setHeaders] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [serviceEmail, setServiceEmail] = useState('');
  const [columnDetection, setColumnDetection] = useState(null);
  const toast = useToast();

  // If we have saved data, auto-load on mount
  useEffect(() => {
    if (saved?.spreadsheetId && saved?.sheetName) {
      setSpreadsheetId(saved.spreadsheetId);
      setSelectedSheet({ title: saved.sheetName });
      handleAutoLoad(saved.spreadsheetId, saved.sheetName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoLoad = async (sid, sname) => {
    try {
      const res = await axios.post('/api/import/select-sheet', {
        spreadsheetId: sid,
        sheetName: sname,
      });
      if (res.data.success) {
        setPreview(res.data.preview);
        setTotalRows(res.data.totalRows);
        setHeaders(res.data.headers);
        setColumnDetection(detectColumns(res.data.headers));
        setStep(3);
        const statsRes = await axios.get(
          `/api/contacts/stats?spreadsheetId=${sid}&sheetName=${encodeURIComponent(sname)}`
        );
        if (statsRes.data.success) setImportStats(statsRes.data);
      }
    } catch {
      // Silently fail auto-load
    }
  };

  // ─── Step 1: Connect via URL ──────────────────────────────
  const handleConnect = async () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error('Sila paste URL Google Sheet.');
      return;
    }

    if (!url.startsWith('https://docs.google.com/spreadsheets/')) {
      if (url.includes('drive.google.com') || url.includes('.xlsx') || url.includes('.xls')) {
        toast.error('File ini adalah Excel. Sila buka dan klik File > Save as Google Sheets dulu.');
        return;
      }
      toast.error('Sila paste URL Google Sheets yang sah.');
      return;
    }

    setConnecting(true);
    setPreview(null);
    setImportStats(null);
    setColumnDetection(null);

    try {
      const res = await axios.post('/api/import/from-url', { url });

      if (res.data.success) {
        const { spreadsheetId: sid, sheets: sheetList, selectedSheet: sel, preview: prev, totalRows: total, headers: hdrs, serviceAccountEmail } = res.data;

        setSpreadsheetId(sid);
        setSheets(sheetList);
        setSelectedSheet(sel);
        setPreview(prev);
        setTotalRows(total);
        setHeaders(hdrs);
        setServiceEmail(serviceAccountEmail || '');
        setColumnDetection(detectColumns(hdrs));

        saveTo({ url, spreadsheetId: sid, sheetName: sel.title });

        if (sheetList.length > 1) {
          setStep(2);
          toast.success(`Berjaya connect! ${sheetList.length} sheets dijumpai. Pilih sheet.`);
        } else {
          setStep(3);
          toast.success(`Berjaya connect! ${total.toLocaleString()} baris dijumpai.`);
          const statsRes = await axios.get(
            `/api/contacts/stats?spreadsheetId=${sid}&sheetName=${encodeURIComponent(sel.title)}`
          );
          if (statsRes.data.success) setImportStats(statsRes.data);
        }
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'PERMISSION_DENIED') {
        setServiceEmail(data.serviceAccountEmail || '');
        toast.error(`Tiada kebenaran. Share spreadsheet dengan: ${data.serviceAccountEmail}`);
      } else {
        toast.error(data?.error || 'Gagal connect ke Google Sheet.');
      }
    } finally {
      setConnecting(false);
    }
  };

  // ─── Step 2: Select a different sheet ─────────────────────
  const handleSelectSheet = async (sheet) => {
    setLoadingSheet(true);
    setSelectedSheet(sheet);

    try {
      const res = await axios.post('/api/import/select-sheet', {
        spreadsheetId,
        sheetName: sheet.title,
      });

      if (res.data.success) {
        setPreview(res.data.preview);
        setTotalRows(res.data.totalRows);
        setHeaders(res.data.headers);
        setColumnDetection(detectColumns(res.data.headers));
        setStep(3);

        saveTo({ url: urlInput, spreadsheetId, sheetName: sheet.title });
        toast.success(`Sheet "${sheet.title}" — ${res.data.totalRows.toLocaleString()} baris.`);

        const statsRes = await axios.get(
          `/api/contacts/stats?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(sheet.title)}`
        );
        if (statsRes.data.success) setImportStats(statsRes.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membaca sheet.');
    } finally {
      setLoadingSheet(false);
    }
  };

  // ─── Disconnect / Reset ───────────────────────────────────
  const handleDisconnect = () => {
    setStep(1);
    setPreview(null);
    setImportStats(null);
    setSheets([]);
    setSelectedSheet(null);
    setSpreadsheetId('');
    setColumnDetection(null);
    localStorage.removeItem(LS_KEY);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Import Data</h2>
        <p className="text-sm text-gray-500 mt-1">Paste URL Google Sheet untuk import contacts</p>
      </div>

      {/* ─── Step 1: URL Input Card ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Sambung Google Sheet</h3>
            <p className="text-xs text-gray-400">Paste URL penuh dari browser anda</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !urlInput.trim()}
            className="px-6 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyambung...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect
              </>
            )}
          </button>
        </div>

        {/* Connected badge */}
        {step >= 2 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-xs font-medium rounded-full">
                <span className="w-2 h-2 rounded-full bg-success" />
                Connected
              </span>
              {selectedSheet && (
                <span className="text-xs text-gray-500">
                  Sheet: <strong>{selectedSheet.title}</strong>
                </span>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-gray-400 hover:text-danger transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Hint for permission */}
        {serviceEmail && step === 1 && (
          <div className="mt-3 p-3 bg-warning-light/50 rounded-lg">
            <p className="text-xs text-warning">
              <strong>Tip:</strong> Pastikan spreadsheet di-share dengan email service account:
            </p>
            <code className="text-xs text-gray-700 mt-1 block bg-white px-2 py-1 rounded border border-gray-200 select-all">
              {serviceEmail}
            </code>
          </div>
        )}
      </div>

      {/* ─── Step 2: Sheet Picker ────────────────────────────── */}
      {step === 2 && sheets.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-2xl">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Pilih Sheet</h3>
          <p className="text-xs text-gray-400 mb-4">Spreadsheet ini ada {sheets.length} sheets. Pilih yang mana satu:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sheets.map((sheet) => {
              const isSelected = selectedSheet?.sheetId === sheet.sheetId;
              return (
                <button
                  key={sheet.sheetId}
                  onClick={() => handleSelectSheet(sheet)}
                  disabled={loadingSheet}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'border-primary bg-primary-50 ring-1 ring-primary/20'
                      : 'border-gray-200 hover:border-primary/30 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {sheet.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-gray-800'}`}>
                      {sheet.title}
                    </p>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Column Detection Summary ────────────────────────── */}
      {columnDetection && step >= 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Column Coverage</h3>
            <span className="text-sm font-bold text-primary">
              {columnDetection.detectedCount} / {columnDetection.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((columnDetection.detectedCount / columnDetection.total) * 100)}%`,
                background: 'linear-gradient(90deg, #c8553a, #e8854a)',
              }}
            />
          </div>

          {/* Per-group coverage */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => {
              const groupCols = COLUMNS.filter((c) => c.group === groupKey);
              const detectedInGroup = groupCols.filter((c) => columnDetection.detected.includes(c.key)).length;
              const pct = Math.round((detectedInGroup / groupCols.length) * 100);
              return (
                <div key={groupKey} className="text-center p-2 rounded-lg" style={{ backgroundColor: group.color + '10' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: group.color }}>
                    {group.label}
                  </p>
                  <p className="text-lg font-bold text-gray-900">{detectedInGroup}/{groupCols.length}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: group.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Stats Summary ───────────────────────────────────── */}
      {importStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-2xl">
          <MiniStat label="Jumlah Baris" value={importStats.total?.toLocaleString()} />
          <MiniStat label="Lengkap" value={importStats.lengkap?.toLocaleString()} color="success" />
          <MiniStat label="Tidak Lengkap" value={importStats.tidakLengkap?.toLocaleString()} color="warning" />
          <MiniStat label="Completion" value={`${importStats.peratusan}%`} color="primary" />
        </div>
      )}

      {/* ─── Step 3: Preview Table ───────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Preview Data</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalRows.toLocaleString()} baris total — 10 baris pertama ditunjukkan
              </p>
            </div>
            <Link
              to="/contacts"
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark inline-flex items-center gap-1"
            >
              Lihat Semua
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                  {headers.slice(0, 10).map((h, idx) => (
                    <th key={idx} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  {headers.length > 10 && (
                    <th className="text-left px-4 py-2.5 text-xs text-gray-400">+{headers.length - 10} lagi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {!preview ? (
                  <SkeletonTable rows={5} cols={Math.min(headers.length, 10) + 1} />
                ) : preview.length === 0 ? (
                  <tr>
                    <td colSpan={Math.min(headers.length, 10) + 1}>
                      <EmptyState icon="📄" title="Sheet kosong" description="Tiada data dalam sheet ini." />
                    </td>
                  </tr>
                ) : (
                  preview.map((row, idx) => {
                    const id = row._rowIndex || idx + 2;
                    return (
                      <tr key={id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{id}</td>
                        {headers.slice(0, 10).map((h, hIdx) => (
                          <td key={hIdx} className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">
                            {row[h] || <span className="text-gray-300 italic">kosong</span>}
                          </td>
                        ))}
                        {headers.length > 10 && <td className="px-4 py-2.5 text-gray-300">...</td>}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Sheet tabs (if multiple) */}
          {sheets.length > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-gray-400 whitespace-nowrap mr-1">Sheets:</span>
              {sheets.map((sheet) => (
                <button
                  key={sheet.sheetId}
                  onClick={() => handleSelectSheet(sheet)}
                  className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                    selectedSheet?.sheetId === sheet.sheetId
                      ? 'bg-primary text-white font-medium'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30'
                  }`}
                >
                  {sheet.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Empty state when not connected ──────────────────── */}
      {step === 1 && !connecting && (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Belum ada data"
            description="Paste URL Google Sheet di atas untuk mula import."
          />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color = 'gray' }) {
  const colors = {
    gray: 'text-gray-900',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}
