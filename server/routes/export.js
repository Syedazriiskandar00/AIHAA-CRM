const express = require('express');
const router = express.Router();
const { readSheet, listSheets } = require('../services/sheetsService');
const { COLUMNS, buildHeaderMap, isOldFormat, SMART_COPY_RULES, OLD_FORMAT_DEFAULTS } = require('../config/columns');

// Dynamic: guna query param jika ada, fallback ke env
const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

// ─── Fields that Excel may convert to scientific notation ────
// These fields will be wrapped as ="value" in CSV so Excel treats as text
const NUMERIC_TEXT_FIELDS = new Set([
  'contact_phone', 'phonenumber',
  'zip', 'billing_zip', 'shipping_zip',
  'vat', 'identification_no',
  'stripe_id', 'bukku_id',
  'woo_customer', 'woo_channel',
  'loy_point',
]);

// ─── Capitalize first letter of each word ────────────────────
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Smart name split: handles bin/binti for Malay names ─────
function splitMalayName(fullName) {
  if (!fullName || !fullName.trim()) return { firstname: '', lastname: '' };
  const name = fullName.trim();
  const words = name.split(/\s+/);
  if (words.length === 1) {
    return { firstname: capitalizeWords(words[0]), lastname: '' };
  }
  const binIndex = words.findIndex((w, i) => i > 0 && /^(bin|binti)$/i.test(w));
  if (binIndex > 0) {
    return {
      firstname: capitalizeWords(words.slice(0, binIndex).join(' ')),
      lastname: capitalizeWords(words.slice(binIndex).join(' ')),
    };
  }
  return {
    firstname: capitalizeWords(words[0]),
    lastname: capitalizeWords(words.slice(1).join(' ')),
  };
}

// ─── Row mapping (same logic as contacts.js) ─────────────────
function mapRow(rawRow, headerMapping, sheetHeaders) {
  const contact = {};
  COLUMNS.forEach((col) => { contact[col.key] = ''; });
  contact._meta = {};
  const oldFormat = sheetHeaders ? isOldFormat(sheetHeaders) : false;

  for (const [header, value] of Object.entries(rawRow)) {
    if (header === '_rowIndex') continue;
    const mapping = headerMapping[header];
    if (!mapping) continue;
    const val = (value || '').trim();

    if (mapping.splitTo) {
      const { firstname, lastname } = splitMalayName(val);
      contact[mapping.splitTo[0]] = firstname;
      contact[mapping.splitTo[1]] = lastname;
    } else if (mapping.meta) {
      contact._meta[mapping.field] = val;
    } else {
      if (mapping.fallback && contact[mapping.field]) continue;
      contact[mapping.field] = val;
    }
  }

  if (oldFormat) {
    for (const [key, defaultVal] of Object.entries(OLD_FORMAT_DEFAULTS)) {
      if (!contact[key]) contact[key] = defaultVal;
    }
  }

  for (const [sourceKey, targets] of Object.entries(SMART_COPY_RULES)) {
    const sourceVal = contact[sourceKey];
    if (!sourceVal) continue;
    for (const target of targets) {
      if (!contact[target]) contact[target] = sourceVal;
    }
  }

  contact.id = rawRow._rowIndex;
  return contact;
}

function isLengkap(contact) {
  return !!(contact.firstname && contact.contact_phone && contact.zip && contact.address && contact.state);
}

// ─── CSV escape ──────────────────────────────────────────────
// For phone/zip fields: use ="value" format so Excel treats as text
// For other fields: standard CSV escaping with double quotes
function csvEscape(v, fieldKey) {
  const str = (v || '').toString();
  if (!str) return '';

  // Phone, zip, ID fields: force Excel text format with ="value"
  // This prevents Excel converting "60103625148" to "6.02E+10"
  if (fieldKey && NUMERIC_TEXT_FIELDS.has(fieldKey) && /^\d{3,}$/.test(str)) {
    return '="' + str + '"';
  }

  // Standard CSV: wrap in quotes if contains comma, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ═══════════════════════════════════════════════════════════
// GET /api/export/csv — Download ALL data as CSV file
// No pagination limit. Returns full dataset.
// ═══════════════════════════════════════════════════════════
router.get('/csv', async (req, res) => {
  try {
    const spreadsheetId = getSpreadsheetId(req);
    let sheetName = getSheetName(req);

    // ─── Auto-detect sheet name ──────────────────────────
    try {
      const sheets = await listSheets(spreadsheetId);
      const names = sheets.map((s) => s.title);
      console.log('[EXPORT] Available sheets:', JSON.stringify(names));

      // Check if requested sheet exists
      const match = names.find((n) => n.toLowerCase() === sheetName.toLowerCase());
      if (match) {
        sheetName = match; // Use exact casing from sheet
      } else if (names.length > 0) {
        console.log(`[EXPORT] Sheet "${sheetName}" not found, using first sheet: "${names[0]}"`);
        sheetName = names[0];
      }
    } catch (listErr) {
      console.log('[EXPORT] Could not list sheets, using provided name:', sheetName, listErr.message);
    }

    console.log(`[EXPORT] Reading ALL rows from sheet: "${sheetName}"`);

    // Read ALL rows — UNFORMATTED_VALUE to get raw numbers (not "6.02E+10")
    const { headers, data, totalRows } = await readSheet(spreadsheetId, sheetName, {
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    console.log(`[EXPORT] Sheet headers (${headers.length}):`, JSON.stringify(headers));
    console.log(`[EXPORT] Raw rows from Google Sheet: ${totalRows}`);

    if (data.length > 0) {
      const first = data[0];
      const last = data[data.length - 1];
      const sample = (row) => {
        const s = {};
        headers.slice(0, 5).forEach((h) => { if (row[h]) s[h] = row[h]; });
        return s;
      };
      console.log(`[EXPORT] First row (#${first._rowIndex}):`, JSON.stringify(sample(first)));
      console.log(`[EXPORT] Last row (#${last._rowIndex}):`, JSON.stringify(sample(last)));
    }

    const headerMapping = buildHeaderMap(headers);

    // Map all rows
    let contacts = data.map((row) => {
      const mapped = mapRow(row, headerMapping, headers);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    // Filter empty rows
    const beforeFilter = contacts.length;
    contacts = contacts.filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);
    console.log(`[EXPORT] After mapping: ${beforeFilter} rows, after filter: ${contacts.length} contacts`);

    if (contacts.length > 0) {
      const c1 = contacts[0];
      const cLast = contacts[contacts.length - 1];
      console.log(`[EXPORT] First contact: #${c1.id} ${c1.firstname} ${c1.lastname} phone=${c1.contact_phone} zip=${c1.zip}`);
      console.log(`[EXPORT] Last contact: #${cLast.id} ${cLast.firstname} ${cLast.lastname} phone=${cLast.contact_phone} zip=${cLast.zip}`);
    }

    // Build CSV: # + 42 column headers + Status = 44 columns
    const csvHeaders = ['#', ...COLUMNS.map((col) => col.label), 'Status'];
    const csvRows = contacts.map((c) => {
      return [
        c.id,
        ...COLUMNS.map((col) => csvEscape(c[col.key], col.key)),
        csvEscape(c.status, null),
      ].join(',');
    });

    // UTF-8 BOM + header + rows
    const bom = '\uFEFF';
    const csvContent = bom + [csvHeaders.join(','), ...csvRows].join('\r\n');

    console.log(`[EXPORT] CSV generated: ${contacts.length} rows, ${Buffer.byteLength(csvContent, 'utf-8')} bytes`);

    // Filename with today's date
    const today = new Date().toISOString().split('T')[0];
    const filename = `Aihaa_CRM_Export_${today}.csv`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf-8'));
    res.setHeader('X-Total-Rows', contacts.length);
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Rows');

    res.send(csvContent);
  } catch (error) {
    console.error('[EXPORT] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
