import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const LS_KEY = 'aihaa_crm_sheet';

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}

export default function Export() {
  const saved = getSaved();
  const spreadsheetId = saved?.spreadsheetId || '';
  const sheetName = saved?.sheetName || '';
  const sheetUrl = saved?.url || '';

  const [stats, setStats] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ phase: '', percent: 0 });
  const toast = useToast();
  const confirm = useConfirm();

  const qp = spreadsheetId ? `spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(sheetName)}` : '';

  useEffect(() => {
    if (!spreadsheetId) {
      setLoading(false);
      return;
    }
    Promise.all([
      axios.get(`/api/contacts/stats?${qp}`),
      axios.get(`/api/contacts?page=1&limit=5&${qp}`),
    ])
      .then(([statsRes, previewRes]) => {
        if (statsRes.data.success) setStats(statsRes.data);
        if (previewRes.data.success) setPreview(previewRes.data.data);
      })
      .catch(() => toast.error('Gagal memuatkan data.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync back to Google Sheet
  const handleSync = async () => {
    if (!spreadsheetId) {
      toast.error('Tiada spreadsheet yang disambungkan. Sila import dulu.');
      return;
    }

    const ok = await confirm({
      title: 'Sync ke Google Sheet?',
      message: 'Data enrichment akan ditulis ke Google Sheet yang sama. Data asal tidak akan ditimpa — hanya kolum enrichment baru akan ditambah.',
      confirmText: 'Ya, Sync',
    });
    if (!ok) return;

    setSyncing(true);
    setSyncResult(null);
    try {
      // Fetch all contacts
      const res = await axios.get(`/api/contacts?page=1&limit=50000&${qp}`);
      if (!res.data.success || res.data.data.length === 0) {
        toast.error('Tiada data untuk di-sync.');
        return;
      }

      // Write enrichment data back to Google Sheet
      const contacts = res.data.data;

      const result = await axios.post(`/api/sheets/write?${qp}`, {
        data: contacts,
      });

      if (result.data.success) {
        setSyncResult({
          success: true,
          rows: contacts.length,
          timestamp: new Date().toLocaleString('ms-MY'),
        });
        toast.success(`Berjaya sync ${contacts.length} baris ke Google Sheet!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal sync ke Google Sheet.');
    } finally {
      setSyncing(false);
    }
  };

  // Download ALL data as CSV via dedicated export endpoint
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress({ phase: 'Sedang menyediakan fail...', percent: 0 });
    try {
      const totalRows = stats?.total || 0;

      // Simulate preparation phase while server fetches from Google Sheet
      let simPercent = 0;
      const simTimer = setInterval(() => {
        simPercent = Math.min(simPercent + 2, 80);
        setDownloadProgress({
          phase: simPercent < 40
            ? `Memproses ${Math.round((simPercent / 80) * totalRows).toLocaleString()}/${totalRows.toLocaleString()} rows...`
            : `Menjana fail CSV...`,
          percent: simPercent,
        });
      }, 300);

      const res = await axios.get(`/api/export/csv?${qp}`, {
        responseType: 'blob',
        timeout: 300000, // 5 minit
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setDownloadProgress({ phase: 'Memuat turun fail...', percent: 80 + Math.round(pct * 0.2) });
          }
        },
      });

      clearInterval(simTimer);
      setDownloadProgress({ phase: 'Selesai!', percent: 100 });

      // Get total rows from response header
      const rowCount = res.headers['x-total-rows'] || totalRows;

      // Trigger file download
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `Aihaa_CRM_Export_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${Number(rowCount).toLocaleString()} contacts berjaya dimuat turun.`);
    } catch {
      toast.error('Gagal muat turun. Sila cuba lagi.');
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress({ phase: '', percent: 0 });
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
          <p className="text-sm text-gray-500 mt-1">Sync atau muat turun data anda</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!spreadsheetId || !stats || stats.total === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon="📤"
            title="Tiada data untuk export"
            description={!spreadsheetId ? 'Sila import data terlebih dahulu dari halaman Import.' : 'Import data terlebih dahulu sebelum export.'}
          />
        </div>
      </div>
    );
  }

  const googleSheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    : sheetUrl;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
        <p className="text-sm text-gray-500 mt-1">Sync ke Google Sheet atau muat turun sebagai fail</p>
      </div>

      {/* Connected info */}
      {spreadsheetId && (
        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-xs font-medium rounded-full">
            <span className="w-2 h-2 rounded-full bg-success" />
            Connected
          </span>
          <span className="text-xs text-gray-500">Sheet: <strong>{sheetName}</strong></span>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MiniStat label="Jumlah Contacts" value={stats.total?.toLocaleString()} />
        <MiniStat label="Lengkap" value={stats.lengkap?.toLocaleString()} color="success" />
        <MiniStat label="Tidak Lengkap" value={stats.tidakLengkap?.toLocaleString()} color="warning" />
        <MiniStat label="Completion" value={`${stats.peratusan}%`} color="primary" />
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-3xl">
        {/* Sync to Google Sheet */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center">
              <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Sync ke Google Sheet</h3>
              <p className="text-xs text-gray-400">Tulis data enrichment ke sheet asal</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Kolum enrichment yang belum wujud akan ditambah ke sheet. Data asal tidak diubah.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full px-4 py-2.5 text-sm font-medium bg-success text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sedang sync...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync ke Google Sheet
              </>
            )}
          </button>

          {/* Sync result */}
          {syncResult?.success && (
            <div className="mt-4 p-3 bg-success-light rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-success">Berjaya di-sync!</span>
              </div>
              <p className="text-xs text-green-700">{syncResult.rows} baris pada {syncResult.timestamp}</p>
              {googleSheetUrl && (
                <a
                  href={googleSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-success hover:underline"
                >
                  Buka Google Sheet
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Download Excel/CSV */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Download Excel (.csv)</h3>
              <p className="text-xs text-gray-400">Muat turun SEMUA {stats?.total?.toLocaleString()} rows dalam satu fail</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Fail CSV (UTF-8 BOM) serasi dengan Excel dan Google Sheets. Mengandungi semua {stats?.total?.toLocaleString()} contacts dengan 42 columns + status.
          </p>

          {/* Progress bar — shown during download */}
          {downloading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-primary">{downloadProgress.phase}</span>
                <span className="text-xs font-bold text-primary">{downloadProgress.percent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full px-4 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sedang memproses...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Excel (.csv)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-3xl">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Preview Data (5 baris pertama)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Telefon</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Negeri</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Poskod</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c) => {
                  const isLengkap = c.status === 'Lengkap';
                  const nama = [c.firstname, c.lastname].filter(Boolean).join(' ') || '-';
                  return (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{nama}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.contact_phone || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.state || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.zip || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isLengkap ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
                          {isLengkap ? 'Lengkap' : 'Tidak Lengkap'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
