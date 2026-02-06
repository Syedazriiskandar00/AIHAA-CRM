const express = require('express');
const router = express.Router();
const { readSheet, updateRows, getClient } = require('../services/sheetsService');
const { validateEnrichment, NEGERI_LIST } = require('../services/validator');

// Dynamic: guna query param jika ada, fallback ke env
const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

// ─── Column mapping ────────────────────────────────────────
// Map header spreadsheet → field name yang konsisten
const HEADER_MAP = {
  '$': 'id_asal',
  'Legal Name (1) *': 'nama',
  'Contact No. (14)': 'telefon',
  'Street +': 'alamat',
  'City': 'city',
  'State (17)': 'negeri',
  'Postcode': 'poskod',
  'Tags (21)': 'tags',
  'Myinvois Action (22)': 'myinvois_action',
  'Status': 'status',
  'Last_Updated': 'last_updated',
};

// Reverse map: field name → header name in sheet
const FIELD_TO_HEADER = {};
for (const [header, field] of Object.entries(HEADER_MAP)) {
  FIELD_TO_HEADER[field] = header;
}

function mapRow(rawRow) {
  const mapped = {};
  for (const [header, field] of Object.entries(HEADER_MAP)) {
    mapped[field] = rawRow[header] || '';
  }
  // Juga salin field yang tak ada dalam HEADER_MAP
  for (const key of Object.keys(rawRow)) {
    if (!HEADER_MAP[key] && key !== '_rowIndex') {
      mapped[key] = rawRow[key];
    }
  }
  mapped.id = rawRow._rowIndex; // row number in sheet = contact id
  return mapped;
}

function isLengkap(contact) {
  return !!(contact.nama && contact.telefon && contact.poskod && contact.alamat && contact.negeri);
}

// ═══════════════════════════════════════════════════════════
// GET /api/contacts?page=1&limit=50&search=ali
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search = (req.query.search || '').trim().toLowerCase();

    const { data } = await readSheet(getSpreadsheetId(req), getSheetName(req));

    // Map semua rows
    let contacts = data.map((row) => {
      const mapped = mapRow(row);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    // Filter: skip row kosong (tiada nama langsung)
    contacts = contacts.filter((c) => c.nama);

    // Search
    if (search) {
      contacts = contacts.filter((c) => {
        return (
          c.nama.toLowerCase().includes(search) ||
          c.telefon.toLowerCase().includes(search) ||
          c.alamat.toLowerCase().includes(search) ||
          c.city.toLowerCase().includes(search) ||
          c.negeri.toLowerCase().includes(search) ||
          c.poskod.toLowerCase().includes(search)
        );
      });
    }

    const total = contacts.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paged = contacts.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/contacts/bulk  (MESTI sebelum /:id supaya tak clash)
// Body: { ids: [2,3,5], updates: { negeri: "Selangor" } }
// ═══════════════════════════════════════════════════════════
router.put('/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids mesti array dan tidak boleh kosong.' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'updates diperlukan.' });
    }

    // Validate enrichment fields
    const validation = validateEnrichment(updates);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    // Baca data semasa untuk determine status
    const { data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const timestamp = new Date().toISOString();

    const batchUpdates = ids.map((id) => {
      const rowNum = parseInt(id);
      // Cari row data semasa untuk check completeness
      const currentRow = data.find((r) => r._rowIndex === rowNum);
      const merged = currentRow ? { ...mapRow(currentRow) } : {};

      // Apply updates
      if (validation.cleaned.poskod) merged.poskod = validation.cleaned.poskod;
      if (validation.cleaned.alamat) merged.alamat = validation.cleaned.alamat;
      if (validation.cleaned.negeri) merged.negeri = validation.cleaned.negeri;

      const status = isLengkap(merged) ? 'Lengkap' : 'Tidak Lengkap';

      return {
        row: rowNum,
        poskod: validation.cleaned.poskod,
        alamat: validation.cleaned.alamat,
        negeri: validation.cleaned.negeri,
        status,
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
// Body: { poskod, alamat, negeri }
// ═══════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const rowNum = parseInt(req.params.id);
    if (isNaN(rowNum) || rowNum < 2) {
      return res.status(400).json({ success: false, error: 'ID tidak sah. Mesti >= 2 (row 1 = header).' });
    }

    const { poskod, alamat, negeri } = req.body;

    // Validate
    const validation = validateEnrichment({ poskod, alamat, negeri });
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    // Baca data row semasa untuk determine status
    const { data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const currentRow = data.find((r) => r._rowIndex === rowNum);
    if (!currentRow) {
      return res.status(404).json({ success: false, error: `Row ${rowNum} tidak dijumpai dalam sheet.` });
    }

    // Merge existing + new data untuk check completeness
    const merged = mapRow(currentRow);
    if (validation.cleaned.poskod) merged.poskod = validation.cleaned.poskod;
    if (validation.cleaned.alamat) merged.alamat = validation.cleaned.alamat;
    if (validation.cleaned.negeri) merged.negeri = validation.cleaned.negeri;

    const status = isLengkap(merged) ? 'Lengkap' : 'Tidak Lengkap';

    const result = await updateRows(getSpreadsheetId(req), getSheetName(req), [
      {
        row: rowNum,
        poskod: validation.cleaned.poskod,
        alamat: validation.cleaned.alamat,
        negeri: validation.cleaned.negeri,
        status,
      },
    ]);

    res.json({
      success: true,
      message: `Contact row ${rowNum} dikemaskini.`,
      contact: merged,
      status,
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
    const { data } = await readSheet(getSpreadsheetId(req), getSheetName(req));

    const contacts = data
      .map((row) => {
        const mapped = mapRow(row);
        mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
        return mapped;
      })
      .filter((c) => c.nama); // skip empty rows

    const total = contacts.length;
    const lengkap = contacts.filter((c) => c.status === 'Lengkap').length;
    const tidakLengkap = total - lengkap;
    const peratusan = total > 0 ? Math.round((lengkap / total) * 10000) / 100 : 0;

    // Breakdown by negeri
    const byNegeri = {};
    for (const c of contacts) {
      const neg = c.negeri || '(Tiada)';
      if (!byNegeri[neg]) {
        byNegeri[neg] = { total: 0, lengkap: 0, tidakLengkap: 0 };
      }
      byNegeri[neg].total++;
      if (c.status === 'Lengkap') byNegeri[neg].lengkap++;
      else byNegeri[neg].tidakLengkap++;
    }

    // Sort by total descending
    const negeriBreakdown = Object.entries(byNegeri)
      .map(([negeri, counts]) => ({ negeri, ...counts }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      total,
      lengkap,
      tidakLengkap,
      peratusan,
      byNegeri: negeriBreakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
