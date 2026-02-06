const express = require('express');
const router = express.Router();
const { readSheet, updateRows } = require('../services/sheetsService');
const { validateContact } = require('../services/validator');
const { COLUMNS, COLUMN_GROUPS, buildHeaderMap } = require('../config/columns');

// Dynamic: guna query param jika ada, fallback ke env
const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

// ─── Row mapping with dual old/new header support ───────────
function mapRow(rawRow, headerMapping) {
  const contact = {};
  // Initialize all 42 fields to ''
  COLUMNS.forEach((col) => {
    contact[col.key] = '';
  });
  // Metadata fields
  contact._meta = {};

  for (const [header, value] of Object.entries(rawRow)) {
    if (header === '_rowIndex') continue;
    const mapping = headerMapping[header];
    if (!mapping) continue;

    const val = (value || '').trim();

    if (mapping.splitTo) {
      // "Legal Name (1) *" → split firstname + lastname at first space
      const parts = val.split(/\s+/);
      contact[mapping.splitTo[0]] = parts[0] || '';
      contact[mapping.splitTo[1]] = parts.slice(1).join(' ') || '';
    } else if (mapping.meta) {
      // Metadata — not one of 42 columns
      contact._meta[mapping.field] = val;
    } else {
      contact[mapping.field] = val;
      // Copy to linked fields
      if (mapping.copyTo) {
        mapping.copyTo.forEach((target) => {
          if (!contact[target]) contact[target] = val;
        });
      }
    }
  }

  contact.id = rawRow._rowIndex;
  return contact;
}

// ─── Completeness check ─────────────────────────────────────
function isLengkap(contact) {
  return !!(
    contact.firstname &&
    contact.contact_phone &&
    contact.zip &&
    contact.address &&
    contact.state
  );
}

// ─── Per-group completeness ─────────────────────────────────
function getGroupCompleteness(contact) {
  const result = {};
  for (const [groupKey] of Object.entries(COLUMN_GROUPS)) {
    const groupCols = COLUMNS.filter((c) => c.group === groupKey);
    const filled = groupCols.filter((c) => !!contact[c.key]).length;
    result[groupKey] = {
      filled,
      total: groupCols.length,
      pct: Math.round((filled / groupCols.length) * 100),
    };
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// GET /api/contacts?page=1&limit=50&search=ali
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search = (req.query.search || '').trim().toLowerCase();

    const { headers, data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const headerMapping = buildHeaderMap(headers);

    // Debug: log headers and first 3 rows on first page request
    if (page === 1) {
      console.log('[DEBUG] Sheet headers:', JSON.stringify(headers));
      console.log('[DEBUG] Header mapping:', JSON.stringify(headerMapping));
      for (let i = 0; i < Math.min(3, data.length); i++) {
        const raw = {};
        headers.forEach((h) => { if (data[i][h]) raw[h] = data[i][h]; });
        console.log('[DEBUG] Raw row ' + data[i]._rowIndex + ':', JSON.stringify(raw));
      }
    }

    // Map semua rows
    let contacts = data.map((row) => {
      const mapped = mapRow(row, headerMapping);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    // Debug: log first 3 mapped contacts
    if (page === 1) {
      for (let i = 0; i < Math.min(3, contacts.length); i++) {
        const c = contacts[i];
        const filled = {};
        COLUMNS.forEach((col) => { if (c[col.key]) filled[col.key] = c[col.key]; });
        console.log('[DEBUG] Mapped contact #' + c.id + ':', JSON.stringify(filled));
      }
    }

    // Filter empty rows (no firstname)
    contacts = contacts.filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);

    // Search
    if (search) {
      contacts = contacts.filter((c) => {
        const searchFields = [
          c.firstname, c.lastname, c.email, c.contact_phone,
          c.address, c.city, c.state, c.zip, c.company_name,
          c.phonenumber, c.email_address,
        ];
        return searchFields.some((f) => f && f.toLowerCase().includes(search));
      });
    }

    // Pagination
    const total = contacts.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paged = contacts.slice(start, start + limit);

    res.json({
      success: true,
      data: paged,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/contacts/bulk
// Body: { ids: [2,3,5], updates: { field: value, ... } }
// ═══════════════════════════════════════════════════════════
router.put('/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids[] diperlukan.' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'updates diperlukan.' });
    }

    // Validate all fields
    const validation = validateContact(updates);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    // Baca data semasa untuk determine status
    const { headers, data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const headerMapping = buildHeaderMap(headers);

    const batchUpdates = ids.map((id) => {
      const rowNum = parseInt(id);
      const currentRow = data.find((r) => r._rowIndex === rowNum);
      const merged = currentRow ? mapRow(currentRow, headerMapping) : {};

      // Apply updates
      for (const [k, v] of Object.entries(validation.cleaned)) {
        merged[k] = v;
      }

      const status = isLengkap(merged) ? 'Lengkap' : 'Tidak Lengkap';

      return {
        row: rowNum,
        ...validation.cleaned,
        client_type: status,
      };
    });

    const result = await updateRows(getSpreadsheetId(req), getSheetName(req), batchUpdates);

    res.json({
      success: true,
      message: `${ids.length} contacts dikemaskini.`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/contacts/:id
// Body: { field: value, ... } — any of 42 fields
// ═══════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const rowNum = parseInt(req.params.id);
    if (isNaN(rowNum) || rowNum < 2) {
      return res.status(400).json({ success: false, error: 'ID tidak sah.' });
    }

    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ success: false, error: 'Tiada data untuk dikemaskini.' });
    }

    // Validate
    const validation = validateContact(body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    // Baca data row semasa untuk determine status
    const { headers, data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const headerMapping = buildHeaderMap(headers);
    const currentRow = data.find((r) => r._rowIndex === rowNum);
    if (!currentRow) {
      return res.status(404).json({ success: false, error: `Row ${rowNum} tidak dijumpai dalam sheet.` });
    }

    // Merge existing + new data untuk check completeness
    const merged = mapRow(currentRow, headerMapping);
    for (const [k, v] of Object.entries(validation.cleaned)) {
      merged[k] = v;
    }

    const status = isLengkap(merged) ? 'Lengkap' : 'Tidak Lengkap';

    const result = await updateRows(getSpreadsheetId(req), getSheetName(req), [
      {
        row: rowNum,
        ...validation.cleaned,
        client_type: status,
      },
    ]);

    res.json({
      success: true,
      message: `Contact row ${rowNum} dikemaskini.`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/stats
// ═══════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const { headers, data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const headerMapping = buildHeaderMap(headers);

    const contacts = data
      .map((row) => {
        const mapped = mapRow(row, headerMapping);
        mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
        return mapped;
      })
      .filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);

    const total = contacts.length;
    const lengkap = contacts.filter((c) => c.status === 'Lengkap').length;
    const tidakLengkap = total - lengkap;
    const peratusan = total > 0 ? Math.round((lengkap / total) * 100) : 0;

    // ─── Per-group average completion ────────────────────
    const groupTotals = {};
    for (const gk of Object.keys(COLUMN_GROUPS)) {
      groupTotals[gk] = { sumPct: 0, count: 0 };
    }

    // ─── Per-field fill rate ─────────────────────────────
    const fieldFill = {};
    COLUMNS.forEach((col) => {
      fieldFill[col.key] = { label: col.label, group: col.group, filled: 0 };
    });

    contacts.forEach((c) => {
      const gc = getGroupCompleteness(c);
      for (const [gk, gv] of Object.entries(gc)) {
        groupTotals[gk].sumPct += gv.pct;
        groupTotals[gk].count += 1;
      }
      COLUMNS.forEach((col) => {
        if (c[col.key]) fieldFill[col.key].filled += 1;
      });
    });

    const byGroup = {};
    for (const [gk, gt] of Object.entries(groupTotals)) {
      byGroup[gk] = {
        label: COLUMN_GROUPS[gk].label,
        avgCompletion: gt.count > 0 ? Math.round(gt.sumPct / gt.count) : 0,
      };
    }

    const byField = COLUMNS.map((col) => ({
      key: col.key,
      label: col.label,
      group: col.group,
      fillRate: total > 0 ? Math.round((fieldFill[col.key].filled / total) * 100) : 0,
      filled: fieldFill[col.key].filled,
      total,
    }));

    // ─── By negeri (state) breakdown ─────────────────────
    const negeriMap = {};
    contacts.forEach((c) => {
      const negeri = c.state || 'Tidak Diketahui';
      negeriMap[negeri] = (negeriMap[negeri] || 0) + 1;
    });
    const byNegeri = Object.entries(negeriMap)
      .map(([negeri, count]) => ({ negeri, total: count }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      total,
      lengkap,
      tidakLengkap,
      peratusan,
      byGroup,
      byField,
      byNegeri: negeriMap ? byNegeri : [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
