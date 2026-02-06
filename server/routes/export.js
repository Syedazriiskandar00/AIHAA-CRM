const express = require('express');
const router = express.Router();
const { readSheet } = require('../services/sheetsService');
const { COLUMNS, buildHeaderMap, isOldFormat, SMART_COPY_RULES, OLD_FORMAT_DEFAULTS } = require('../config/columns');

// Dynamic: guna query param jika ada, fallback ke env
const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

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
function csvEscape(v) {
  const str = (v || '').toString();
  // Wrap in quotes if contains comma, quotes, newlines
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
    // Read ALL rows from Google Sheet
    const { headers, data } = await readSheet(getSpreadsheetId(req), getSheetName(req));
    const headerMapping = buildHeaderMap(headers);

    // Map all rows
    let contacts = data.map((row) => {
      const mapped = mapRow(row, headerMapping, headers);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    // Filter empty rows
    contacts = contacts.filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);

    // Build CSV: 42 column headers + # + Status = 44 columns
    const csvHeaders = ['#', ...COLUMNS.map((col) => col.label), 'Status'];
    const csvRows = contacts.map((c) => {
      return [
        c.id,
        ...COLUMNS.map((col) => csvEscape(c[col.key])),
        csvEscape(c.status),
      ].join(',');
    });

    // UTF-8 BOM + header + rows
    const bom = '\uFEFF';
    const csvContent = bom + [csvHeaders.join(','), ...csvRows].join('\r\n');

    // Filename with today's date
    const today = new Date().toISOString().split('T')[0];
    const filename = `Aihaa_CRM_Export_${today}.csv`;

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf-8'));
    res.setHeader('X-Total-Rows', contacts.length);

    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
