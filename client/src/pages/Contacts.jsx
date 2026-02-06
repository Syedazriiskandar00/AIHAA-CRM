import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';
import {
  COLUMNS,
  COLUMN_GROUPS,
  NEGERI_LIST,
  getFieldInputType,
  getVisibleColumns,
} from '../config/columns';

// ─── Frozen columns (always visible) ────────────────────────
const FROZEN_KEYS = ['firstname', 'lastname'];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [enabledGroups, setEnabledGroups] = useState({
    personal: true,
    company: true,
    location: true,
    billing: false,
    shipping: false,
    business: false,
  });
  const [showEmptyOnly, setShowEmptyOnly] = useState(false);
  const limit = 50;
  const toast = useToast();
  const confirm = useConfirm();
  const searchTimer = useRef(null);

  // Get query params from localStorage
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('aihaa_crm_sheet')) || {}; } catch { return {}; }
  })();
  const qp = saved.spreadsheetId
    ? `spreadsheetId=${saved.spreadsheetId}&sheetName=${encodeURIComponent(saved.sheetName || '')}`
    : '';

  const fetchContacts = useCallback((p, s) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit });
    if (s) params.set('search', s);
    axios
      .get(`/api/contacts?${params}${qp ? '&' + qp : ''}`)
      .then((res) => {
        if (res.data.success) {
          setContacts(res.data.data);
          setPagination(res.data.pagination);
        }
      })
      .catch(() => toast.error('Gagal memuatkan data contacts.'))
      .finally(() => setLoading(false));
  }, [toast, qp]);

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

  // ─── Visible columns based on toggles ─────────────────────
  const visibleColumns = getVisibleColumns(enabledGroups)
    .filter((col) => !FROZEN_KEYS.includes(col.key))
    .filter((col) => {
      if (!showEmptyOnly) return true;
      // Show column if ANY visible contact has it empty
      return contacts.some((c) => !c[col.key]);
    });

  const toggleGroup = (key) => {
    setEnabledGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Inline edit helpers ──────────────────────────────────
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

  const displayVal = (contact, field) => {
    const edit = edits[contact.id];
    if (edit && edit[field] !== undefined) return edit[field];
    return contact[field] || '';
  };

  // ─── Save single row ─────────────────────────────────────
  const saveRow = async (contact) => {
    const edit = edits[contact.id];
    if (!edit || Object.keys(edit).length === 0) return;

    setSaving((prev) => ({ ...prev, [contact.id]: true }));
    try {
      const res = await axios.put(`/api/contacts/${contact.id}?${qp}`, edit);
      if (res.data.success) {
        toast.success(`${contact.firstname || 'Contact'} dikemaskini.`);
        setEdits((prev) => {
          const copy = { ...prev };
          delete copy[contact.id];
          return copy;
        });
        fetchContacts(page, search);
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      toast.error(errors ? errors.join(', ') : 'Gagal menyimpan.');
    } finally {
      setSaving((prev) => ({ ...prev, [contact.id]: false }));
    }
  };

  // ─── Bulk update ──────────────────────────────────────────
  const handleBulkSave = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

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
      const res = await axios.put(`/api/contacts/bulk?${qp}`, { ids, updates });
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

  // ─── Select helpers ───────────────────────────────────────
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

  // ─── Group header spans for color band ────────────────────
  const groupSpans = [];
  let currentGroup = null;
  let spanCount = 0;
  for (const col of visibleColumns) {
    if (col.group !== currentGroup) {
      if (currentGroup) groupSpans.push({ group: currentGroup, count: spanCount });
      currentGroup = col.group;
      spanCount = 1;
    } else {
      spanCount++;
    }
  }
  if (currentGroup) groupSpans.push({ group: currentGroup, count: spanCount });

  const totalVisibleCols = FROZEN_KEYS.length + visibleColumns.length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Senarai Contacts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination.total.toLocaleString()} contacts dijumpai
            <span className="ml-2 text-gray-400">
              ({FROZEN_KEYS.length + visibleColumns.length} / {COLUMNS.length} columns)
            </span>
          </p>
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary/20 rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-primary">{selected.size} dipilih</span>
            <button
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {bulkSaving ? 'Menyimpan...' : 'Simpan Semua'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
              Batal
            </button>
          </div>
        )}
      </div>

      {/* Column group toggles */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {Object.entries(COLUMN_GROUPS).map(([key, group]) => {
          const count = COLUMNS.filter((c) => c.group === key).length;
          return (
            <button
              key={key}
              onClick={() => toggleGroup(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                enabledGroups[key]
                  ? `${group.bg} ${group.text} ${group.border}`
                  : 'bg-white text-gray-400 border-gray-200'
              }`}
            >
              {group.label} ({count})
            </button>
          );
        })}

        <div className="h-5 w-px bg-gray-200 mx-1" />

        <button
          onClick={() => setShowEmptyOnly(!showEmptyOnly)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            showEmptyOnly
              ? 'bg-warning-light text-warning border-warning/30'
              : 'bg-white text-gray-400 border-gray-200'
          }`}
        >
          {showEmptyOnly ? 'Kosong Sahaja' : 'Tunjuk Kosong'}
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, telefon, email, alamat..."
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
          <table className="w-max min-w-full text-sm">
            {/* Group color header row */}
            <thead>
              <tr className="border-b border-gray-100">
                {/* Frozen section placeholder */}
                <th colSpan={3} className="sticky left-0 z-20 bg-white px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase" />
                {groupSpans.map((span, idx) => {
                  const g = COLUMN_GROUPS[span.group];
                  return (
                    <th
                      key={idx}
                      colSpan={span.count}
                      className="px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: g.color + '15', color: g.color }}
                    >
                      {g.label}
                    </th>
                  );
                })}
                <th className="px-3 py-1.5" />
              </tr>

              {/* Column name header row */}
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-50 w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
                  />
                </th>
                <th className="sticky left-[40px] z-20 bg-gray-50 text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[130px] sticky-col-shadow"
                    style={{ borderRight: '1px solid #e5e7eb' }}>
                  Firstname
                </th>
                <th className="sticky left-[170px] z-20 bg-gray-50 text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[130px] sticky-col-shadow"
                    style={{ borderRight: '2px solid #e5e7eb' }}>
                  Lastname
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap min-w-[120px]"
                    style={{ backgroundColor: COLUMN_GROUPS[col.group].color + '08' }}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonTable rows={10} cols={totalVisibleCols + 4} />
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={totalVisibleCols + 4}>
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
                  const isComplete = contact.status === 'Lengkap';
                  const rowEdited = hasEdits(contact.id);
                  const isSaving = saving[contact.id];

                  return (
                    <tr
                      key={contact.id}
                      className={`border-b border-gray-100 transition-colors ${
                        isSelected
                          ? 'bg-primary-50/50'
                          : isComplete
                          ? 'bg-success-light/30 hover:bg-success-light/50'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Checkbox - frozen */}
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(contact.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
                        />
                      </td>

                      {/* Firstname - frozen */}
                      <td className="sticky left-[40px] z-10 bg-inherit px-3 py-2 sticky-col-shadow"
                          style={{ borderRight: '1px solid #f3f4f6' }}>
                        <input
                          type="text"
                          value={displayVal(contact, 'firstname')}
                          onChange={(e) => setField(contact.id, 'firstname', e.target.value)}
                          placeholder="Firstname"
                          className="w-full px-2 py-1 text-sm font-medium border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent"
                        />
                      </td>

                      {/* Lastname - frozen */}
                      <td className="sticky left-[170px] z-10 bg-inherit px-3 py-2 sticky-col-shadow"
                          style={{ borderRight: '2px solid #f3f4f6' }}>
                        <input
                          type="text"
                          value={displayVal(contact, 'lastname')}
                          onChange={(e) => setField(contact.id, 'lastname', e.target.value)}
                          placeholder="Lastname"
                          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent"
                        />
                      </td>

                      {/* Dynamic columns */}
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="px-3 py-2">
                          <EditableCell
                            value={displayVal(contact, col.key)}
                            column={col}
                            onChange={(val) => setField(contact.id, col.key, val)}
                          />
                        </td>
                      ))}

                      {/* Status badge */}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            isComplete
                              ? 'bg-success-light text-success'
                              : 'bg-warning-light text-warning'
                          }`}
                        >
                          {isComplete ? 'Lengkap' : 'Tidak Lengkap'}
                        </span>
                      </td>

                      {/* Save button */}
                      <td className="px-3 py-2">
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

// ─── Generic editable cell component ────────────────────────
function EditableCell({ value, column, onChange }) {
  const inputType = getFieldInputType(column.key);

  if (inputType === 'dropdown') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent cursor-pointer min-w-[140px]"
      >
        <option value="">-- Pilih --</option>
        {NEGERI_LIST.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
        {value && !NEGERI_LIST.includes(value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    );
  }

  if (inputType === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={value === 'true' || value === '1' || value === 'yes'}
        onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
      />
    );
  }

  return (
    <input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={column.label}
      className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none bg-transparent min-w-[100px]"
    />
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
