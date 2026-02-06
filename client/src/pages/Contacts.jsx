import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';

const NEGERI_LIST = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu',
  'WP Kuala Lumpur', 'WP Putrajaya', 'WP Labuan',
];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [edits, setEdits] = useState({}); // { [id]: { poskod, alamat, negeri } }
  const [saving, setSaving] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const limit = 50;
  const toast = useToast();
  const confirm = useConfirm();
  const searchTimer = useRef(null);

  const fetchContacts = useCallback((p, s) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit });
    if (s) params.set('search', s);
    axios
      .get(`/api/contacts?${params}`)
      .then((res) => {
        if (res.data.success) {
          setContacts(res.data.data);
          setPagination(res.data.pagination);
        }
      })
      .catch(() => toast.error('Gagal memuatkan data contacts.'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchContacts(page, search);
  }, [page, search, fetchContacts]);

  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
      setSelected(new Set());
    }, 400);
  };

  // ─── Inline edit helpers ────────────────────────────────
  const getEdit = (id) => edits[id] || {};

  const setField = (id, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const hasEdits = (id) => {
    const e = edits[id];
    return e && Object.keys(e).length > 0;
  };

  // ─── Save single row ───────────────────────────────────
  const saveRow = async (contact) => {
    const edit = edits[contact.id];
    if (!edit || Object.keys(edit).length === 0) return;

    setSaving((prev) => ({ ...prev, [contact.id]: true }));
    try {
      const body = {};
      if (edit.poskod !== undefined) body.poskod = edit.poskod;
      if (edit.alamat !== undefined) body.alamat = edit.alamat;
      if (edit.negeri !== undefined) body.negeri = edit.negeri;

      const res = await axios.put(`/api/contacts/${contact.id}`, body);
      if (res.data.success) {
        toast.success(`${contact.nama} dikemaskini.`);
        setEdits((prev) => {
          const copy = { ...prev };
          delete copy[contact.id];
          return copy;
        });
        fetchContacts(page, search);
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        toast.error(errors.join(', '));
      } else {
        toast.error('Gagal menyimpan.');
      }
    } finally {
      setSaving((prev) => ({ ...prev, [contact.id]: false }));
    }
  };

  // ─── Bulk update ────────────────────────────────────────
  const handleBulkSave = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    // Collect edits for selected rows
    const updates = {};
    let hasAnyEdit = false;
    for (const id of ids) {
      const e = edits[id];
      if (e) {
        Object.assign(updates, e);
        hasAnyEdit = true;
      }
    }

    if (!hasAnyEdit) {
      toast.warning('Tiada perubahan untuk disimpan.');
      return;
    }

    const ok = await confirm({
      title: 'Simpan Bulk Update?',
      message: `Anda akan mengemaskini ${ids.length} contacts. Teruskan?`,
      confirmText: 'Ya, Simpan',
    });
    if (!ok) return;

    setBulkSaving(true);
    try {
      const res = await axios.put('/api/contacts/bulk', { ids, updates });
      if (res.data.success) {
        toast.success(res.data.message);
        setEdits({});
        setSelected(new Set());
        fetchContacts(page, search);
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      toast.error(errors ? errors.join(', ') : 'Gagal bulk update.');
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── Select helpers ─────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  };

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  // ─── Render helpers ─────────────────────────────────────
  const displayVal = (contact, field) => {
    const edit = edits[contact.id];
    if (edit && edit[field] !== undefined) return edit[field];
    return contact[field] || '';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Senarai Contacts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination.total.toLocaleString()} contacts dijumpai
          </p>
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary/20 rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-primary">
              {selected.size} dipilih
            </span>
            <button
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {bulkSaving ? 'Menyimpan...' : 'Simpan Semua'}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, telefon, alamat, negeri..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
                  />
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Telefon</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[140px]">Poskod</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[200px]">Alamat</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[160px]">Negeri</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">City</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="w-20 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTable rows={10} cols={10} />
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      icon="📋"
                      title="Tiada contacts dijumpai"
                      description={search ? `Tiada hasil untuk "${search}"` : 'Import data untuk memulakan.'}
                      action={
                        !search && (
                          <Link to="/import" className="text-sm font-medium text-primary hover:underline">
                            Import Data
                          </Link>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const isSelected = selected.has(contact.id);
                  const isLengkap = contact.status === 'Lengkap';
                  const rowEdited = hasEdits(contact.id);
                  const isSaving = saving[contact.id];

                  return (
                    <tr
                      key={contact.id}
                      className={`border-b border-gray-100 transition-colors ${
                        isSelected
                          ? 'bg-primary-50/50'
                          : isLengkap
                          ? 'bg-success-light/30 hover:bg-success-light/50'
                          : 'bg-warning-light/20 hover:bg-warning-light/40'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(contact.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">{contact.id}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{contact.nama}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{contact.telefon}</td>

                      {/* Editable: Poskod */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={displayVal(contact, 'poskod')}
                          onChange={(e) => setField(contact.id, 'poskod', e.target.value)}
                          maxLength={5}
                          placeholder="00000"
                          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent"
                        />
                      </td>

                      {/* Editable: Alamat */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={displayVal(contact, 'alamat')}
                          onChange={(e) => setField(contact.id, 'alamat', e.target.value)}
                          placeholder="Alamat..."
                          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent"
                        />
                      </td>

                      {/* Editable: Negeri dropdown */}
                      <td className="px-3 py-2.5">
                        <select
                          value={displayVal(contact, 'negeri')}
                          onChange={(e) => setField(contact.id, 'negeri', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent cursor-pointer"
                        >
                          <option value="">-- Pilih --</option>
                          {NEGERI_LIST.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                          {/* Show current value if not in standard list */}
                          {contact.negeri && !NEGERI_LIST.includes(contact.negeri) && !NEGERI_LIST.includes(displayVal(contact, 'negeri')) && (
                            <option value={contact.negeri}>{contact.negeri}</option>
                          )}
                        </select>
                      </td>

                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{contact.city}</td>

                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isLengkap
                              ? 'bg-success-light text-success'
                              : 'bg-warning-light text-warning'
                          }`}
                        >
                          {isLengkap ? 'Lengkap' : 'Tidak Lengkap'}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        {rowEdited && (
                          <button
                            onClick={() => saveRow(contact)}
                            disabled={isSaving}
                            className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 whitespace-nowrap"
                          >
                            {isSaving ? '...' : 'Simpan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Muka {page} daripada {pagination.totalPages} ({pagination.total.toLocaleString()} jumlah)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &laquo;
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sebelum
              </button>

              {/* Page numbers */}
              {generatePageNumbers(page, pagination.totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 text-xs border rounded ${
                      p === page
                        ? 'bg-primary text-white border-primary'
                        : 'border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Seterus
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page === pagination.totalPages}
                className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}
