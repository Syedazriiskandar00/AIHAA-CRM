import { useState } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Import() {
  const [sheetInput, setSheetInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importStats, setImportStats] = useState(null);
  const toast = useToast();

  // Extract spreadsheet ID from URL or raw ID
  const extractId = (input) => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return input.trim();
  };

  const handleConnect = async () => {
    const id = extractId(sheetInput);
    if (!id) {
      toast.error('Sila masukkan Google Sheet URL atau Spreadsheet ID.');
      return;
    }

    setConnecting(true);
    setPreview(null);
    setImportStats(null);
    setConnected(false);

    try {
      // Test connection
      const testRes = await axios.get(`/api/test-connection?spreadsheetId=${id}`);
      if (!testRes.data.success) {
        toast.error(testRes.data.error || 'Gagal connect ke spreadsheet.');
        return;
      }

      // Fetch preview data
      const dataRes = await axios.get('/api/contacts?page=1&limit=10');
      if (dataRes.data.success) {
        setConnected(true);
        setPreview(dataRes.data.data);

        // Fetch stats
        const statsRes = await axios.get('/api/stats');
        if (statsRes.data.success) {
          setImportStats(statsRes.data);
        }

        toast.success(`Berjaya connect! ${testRes.data.totalRows.toLocaleString()} baris dijumpai.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal connect ke Google Sheet.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Import Data</h2>
        <p className="text-sm text-gray-500 mt-1">Sambung ke Google Sheet untuk import contacts</p>
      </div>

      {/* Connect Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Sambung Google Sheet</h3>
            <p className="text-xs text-gray-400">Paste URL penuh atau Spreadsheet ID sahaja</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/... atau ID"
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !sheetInput.trim()}
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
                Connect &amp; Import
              </>
            )}
          </button>
        </div>

        {connected && (
          <div className="mt-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-xs font-medium rounded-full">
              <span className="w-2 h-2 rounded-full bg-success" />
              Connected
            </span>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {importStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-2xl">
          <MiniStat label="Jumlah Baris" value={importStats.total?.toLocaleString()} />
          <MiniStat label="Lengkap" value={importStats.lengkap?.toLocaleString()} color="success" />
          <MiniStat label="Tidak Lengkap" value={importStats.tidakLengkap?.toLocaleString()} color="warning" />
          <MiniStat label="Completion" value={`${importStats.peratusan}%`} color="primary" />
        </div>
      )}

      {/* Preview Table */}
      {connected && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Preview Data</h3>
              <p className="text-xs text-gray-400 mt-0.5">10 baris pertama ditunjukkan</p>
            </div>
            <a
              href="/contacts"
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark inline-flex items-center gap-1"
            >
              Lihat Semua
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Telefon</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Alamat</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Negeri</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Poskod</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {!preview ? (
                  <SkeletonTable rows={5} cols={7} />
                ) : preview.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon="📄" title="Sheet kosong" description="Tiada data dalam sheet ini." />
                    </td>
                  </tr>
                ) : (
                  preview.map((c) => {
                    const isLengkap = c.status === 'Lengkap';
                    return (
                      <tr key={c.id} className={`border-b border-gray-100 ${isLengkap ? 'bg-success-light/20' : 'bg-warning-light/15'}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{c.id}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{c.nama}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.telefon}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{c.alamat}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.negeri || <span className="text-gray-300 italic">kosong</span>}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.poskod || <span className="text-gray-300 italic">kosong</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isLengkap ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
                            {isLengkap ? 'Lengkap' : 'Tidak Lengkap'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when not connected */}
      {!connected && !connecting && (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Belum ada data"
            description="Masukkan URL Google Sheet atau Spreadsheet ID di atas untuk mula import."
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
