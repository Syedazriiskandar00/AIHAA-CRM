import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonCard } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Export() {
  const [stats, setStats] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const spreadsheetId = import.meta.env?.VITE_SPREADSHEET_ID || '';

  useEffect(() => {
    Promise.all([
      axios.get('/api/stats'),
      axios.get('/api/contacts?page=1&limit=5'),
    ])
      .then(([statsRes, previewRes]) => {
        if (statsRes.data.success) setStats(statsRes.data);
        if (previewRes.data.success) setPreview(previewRes.data.data);
      })
      .catch(() => toast.error('Gagal memuatkan data.'))
      .finally(() => setLoading(false));
  }, []);

  // Sync back to Google Sheet
  const handleSync = async () => {
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
      const res = await axios.get('/api/contacts?page=1&limit=50000');
      if (!res.data.success || res.data.data.length === 0) {
        toast.error('Tiada data untuk di-sync.');
        return;
      }

      // Write enrichment columns to the sheet
      const contacts = res.data.data;
      const enrichmentData = contacts.map((c) => ({
        poskod: c.poskod || '',
        alamat: c.alamat || '',
        negeri: c.negeri || '',
        status: c.status || '',
      }));

      const result = await axios.post('/api/sheets/write', {
        values: [
          ['Poskod', 'Alamat', 'Negeri', 'Status', 'Last_Updated'],
          ...enrichmentData.map((d) => [
            d.poskod, d.alamat, d.negeri, d.status, new Date().toISOString(),
          ]),
        ],
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

  // Download as Excel-compatible CSV (with BOM for UTF-8)
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.get('/api/contacts?page=1&limit=50000');
      if (!res.data.success || res.data.data.length === 0) {
        toast.error('Tiada data untuk dimuat turun.');
        return;
      }

      const contacts = res.data.data;
      const headers = ['#', 'Nama', 'Telefon', 'Alamat', 'City', 'Negeri', 'Poskod', 'Status'];
      const rows = contacts.map((c) => [
        c.id,
        `"${(c.nama || '').replace(/"/g, '""')}"`,
        `"${(c.telefon || '').replace(/"/g, '""')}"`,
        `"${(c.alamat || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`,
        `"${(c.city || '').replace(/"/g, '""')}"`,
        `"${(c.negeri || '').replace(/"/g, '""')}"`,
        `"${c.poskod || ''}"`,
        `"${c.status || ''}"`,
      ]);

      // BOM + CSV content (Excel will open with correct encoding)
      const bom = '\uFEFF';
      const csv = bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aihaa-crm-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${contacts.length} contacts dimuat turun.`);
    } catch {
      toast.error('Gagal muat turun.');
    } finally {
      setDownloading(false);
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

  if (!stats || stats.total === 0) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon="📤"
            title="Tiada data untuk export"
            description="Import data terlebih dahulu sebelum export."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
        <p className="text-sm text-gray-500 mt-1">Sync ke Google Sheet atau muat turun sebagai fail</p>
      </div>

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
            Data enrichment (Poskod, Alamat, Negeri, Status) akan ditambah sebagai kolum baru. Data asal tidak diubah.
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
              <a
                href={`https://docs.google.com/spreadsheets/d/${import.meta.env?.VITE_SPREADSHEET_ID || '10XQICyn6Co7Vvlz6_RUKpk4sPZc8BLbOmyLMdGJhf8c'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-success hover:underline"
              >
                Buka Google Sheet
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
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
              <h3 className="text-sm font-semibold text-gray-800">Download Excel</h3>
              <p className="text-xs text-gray-400">Muat turun sebagai fail CSV</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Fail CSV serasi dengan Excel dan Google Sheets. Mengandungi semua data contacts dan status enrichment.
          </p>
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
                Memuat turun...
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
                  return (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.nama}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.telefon}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.negeri || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.poskod || '-'}</td>
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
