const express = require('express');
const router = express.Router();
const { readSheet, listSheets, getClient } = require('../services/sheetsService');
const { COLUMNS, buildHeaderMap, isOldFormat, SMART_COPY_RULES, OLD_FORMAT_DEFAULTS } = require('../config/columns');

// Dynamic: guna query param jika ada, fallback ke env
const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

// ─── Fields that Excel may convert to scientific notation ────
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
function csvEscape(v, fieldKey) {
  const str = (v || '').toString();
  if (!str) return '';

  // Phone, zip, ID fields: force Excel text format with ="value"
  if (fieldKey && NUMERIC_TEXT_FIELDS.has(fieldKey) && /^\d{3,}$/.test(str)) {
    return '="' + str + '"';
  }

  // Standard CSV: wrap in quotes if contains comma, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── Resolve actual sheet name from spreadsheet ──────────────
async function resolveSheetName(spreadsheetId, requestedName) {
  const sheets = await listSheets(spreadsheetId);
  const names = sheets.map((s) => s.title);
  console.log('[EXPORT] Available sheets in spreadsheet:', JSON.stringify(names));

  // Exact match (case-insensitive)
  const match = names.find((n) => n.toLowerCase() === requestedName.toLowerCase());
  if (match) return match;

  // Not found — use first sheet
  if (names.length > 0) {
    console.log(`[EXPORT] WARNING: Sheet "${requestedName}" NOT FOUND. Using first sheet: "${names[0]}"`);
    return names[0];
  }

  return requestedName;
}

// ═══════════════════════════════════════════════════════════
// GET /api/export/debug — Diagnostic: check Google Sheet data
// Shows row counts, sheet names, first/last rows
// ═══════════════════════════════════════════════════════════
router.get('/debug', async (req, res) => {
  const report = { timestamp: new Date().toISOString(), steps: [] };

  try {
    const spreadsheetId = getSpreadsheetId(req);
    report.spreadsheetId = spreadsheetId;

    if (!spreadsheetId) {
      report.error = 'No spreadsheetId provided (query param or env var)';
      return res.json(report);
    }

    // Step 1: List all sheets
    report.steps.push('1. Listing all sheets...');
    const sheets = await listSheets(spreadsheetId);
    report.sheets = sheets.map((s) => s.title);
    report.steps.push(`   Found ${sheets.length} sheet(s): ${JSON.stringify(report.sheets)}`);

    // Step 2: For each sheet, get row count
    report.sheetDetails = [];
    for (const sheet of sheets) {
      report.steps.push(`2. Reading sheet "${sheet.title}"...`);

      try {
        // Use raw API call to get all values
        const client = await getClient();
        const response = await client.spreadsheets.values.get({
          spreadsheetId,
          range: sheet.title,
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.data.values || [];
        const headers = rows.length > 0 ? rows[0] : [];
        const dataRows = rows.length > 1 ? rows.length - 1 : 0;

        const detail = {
          name: sheet.title,
          totalRowsIncludingHeader: rows.length,
          dataRows,
          headerCount: headers.length,
          headers: headers.map(String),
        };

        // First data row
        if (rows.length > 1) {
          const firstRow = {};
          headers.forEach((h, i) => {
            if (rows[1][i] != null && rows[1][i] !== '') firstRow[String(h)] = String(rows[1][i]);
          });
          detail.firstRow = firstRow;
        }

        // Last data row
        if (rows.length > 2) {
          const lastRow = {};
          const last = rows[rows.length - 1];
          headers.forEach((h, i) => {
            if (last[i] != null && last[i] !== '') lastRow[String(h)] = String(last[i]);
          });
          detail.lastRow = lastRow;
          detail.lastRowIndex = rows.length;
        }

        report.sheetDetails.push(detail);
        report.steps.push(`   "${sheet.title}": ${dataRows} data rows, ${headers.length} columns`);
      } catch (sheetErr) {
        report.sheetDetails.push({ name: sheet.title, error: sheetErr.message });
        report.steps.push(`   ERROR reading "${sheet.title}": ${sheetErr.message}`);
      }
    }

    // Step 3: Test readSheet function with resolved name
    const requestedName = getSheetName(req);
    const resolvedName = await resolveSheetName(spreadsheetId, requestedName);
    report.steps.push(`3. Testing readSheet("${resolvedName}")...`);

    const { headers, data, totalRows } = await readSheet(spreadsheetId, resolvedName, {
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    report.readSheetResult = {
      requestedSheetName: requestedName,
      resolvedSheetName: resolvedName,
      headersFound: headers.length,
      totalRowsReturned: totalRows,
      dataArrayLength: data.length,
    };

    report.steps.push(`   readSheet returned: ${totalRows} rows, ${headers.length} headers`);

    // Step 4: Map rows and check filter
    const headerMapping = buildHeaderMap(headers);
    let contacts = data.map((row) => {
      const mapped = mapRow(row, headerMapping, headers);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    const beforeFilter = contacts.length;
    contacts = contacts.filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);
    const afterFilter = contacts.length;

    report.mappingResult = {
      beforeFilter,
      afterFilter,
      filteredOut: beforeFilter - afterFilter,
    };

    if (contacts.length > 0) {
      report.mappingResult.firstContact = {
        id: contacts[0].id,
        firstname: contacts[0].firstname,
        lastname: contacts[0].lastname,
        phone: contacts[0].contact_phone,
        zip: contacts[0].zip,
      };
      report.mappingResult.lastContact = {
        id: contacts[contacts.length - 1].id,
        firstname: contacts[contacts.length - 1].firstname,
        lastname: contacts[contacts.length - 1].lastname,
        phone: contacts[contacts.length - 1].contact_phone,
        zip: contacts[contacts.length - 1].zip,
      };
    }

    report.steps.push(`4. Mapping: ${beforeFilter} → filter → ${afterFilter} contacts`);
    report.steps.push('DONE. All steps completed.');
    report.success = true;

    console.log('[EXPORT DEBUG]', JSON.stringify(report, null, 2));
    res.json(report);
  } catch (error) {
    report.error = error.message;
    report.stack = error.stack;
    console.error('[EXPORT DEBUG] Error:', error);
    res.status(500).json(report);
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/export/csv — Download ALL data as CSV file
// Reads directly from Google Sheet. NO limit. NO pagination.
// ═══════════════════════════════════════════════════════════
router.get('/csv', async (req, res) => {
  try {
    // Set timeout on this specific response — 5 minutes
    res.setTimeout(300000);

    const spreadsheetId = getSpreadsheetId(req);
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'No spreadsheetId provided.' });
    }

    // ─── Resolve correct sheet name ──────────────────────
    const requestedName = getSheetName(req);
    let sheetName;
    try {
      sheetName = await resolveSheetName(spreadsheetId, requestedName);
    } catch (e) {
      console.log('[EXPORT] listSheets failed, using requested name:', requestedName);
      sheetName = requestedName;
    }

    console.log(`[EXPORT CSV] spreadsheetId=${spreadsheetId}`);
    console.log(`[EXPORT CSV] sheetName="${sheetName}" (requested="${requestedName}")`);

    // ─── Read ALL rows directly from Google Sheet ────────
    // UNFORMATTED_VALUE: raw numbers, no "6.02E+10"
    // range = sheetName → reads ENTIRE sheet, NO row limit
    const { headers, data, totalRows } = await readSheet(spreadsheetId, sheetName, {
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    console.log(`[EXPORT CSV] Google Sheet returned: ${totalRows} data rows, ${headers.length} columns`);
    console.log(`[EXPORT CSV] Headers: ${JSON.stringify(headers.slice(0, 10))}${headers.length > 10 ? '...' : ''}`);

    if (data.length === 0) {
      return res.status(404).json({ success: false, error: 'Sheet kosong — tiada data rows.' });
    }

    // Log first and last raw row
    const sampleRow = (row) => {
      const s = {};
      for (const h of headers.slice(0, 6)) {
        if (row[h]) s[h] = row[h];
      }
      return s;
    };
    console.log(`[EXPORT CSV] First raw row (#${data[0]._rowIndex}):`, JSON.stringify(sampleRow(data[0])));
    console.log(`[EXPORT CSV] Last raw row (#${data[data.length - 1]._rowIndex}):`, JSON.stringify(sampleRow(data[data.length - 1])));

    // ─── Map all rows to 42-column contacts ──────────────
    const headerMapping = buildHeaderMap(headers);

    let contacts = data.map((row) => {
      const mapped = mapRow(row, headerMapping, headers);
      mapped.status = isLengkap(mapped) ? 'Lengkap' : 'Tidak Lengkap';
      return mapped;
    });

    // Filter out completely empty rows
    const beforeFilter = contacts.length;
    contacts = contacts.filter((c) => c.firstname || c.lastname || c.contact_phone || c.email);

    console.log(`[EXPORT CSV] Mapped: ${beforeFilter} → filtered → ${contacts.length} contacts`);
    console.log(`[EXPORT CSV] Total rows to export: ${contacts.length}`);

    if (contacts.length > 0) {
      const c1 = contacts[0];
      const cL = contacts[contacts.length - 1];
      console.log(`[EXPORT CSV] First contact: #${c1.id} ${c1.firstname} ${c1.lastname} phone=${c1.contact_phone} zip=${c1.zip}`);
      console.log(`[EXPORT CSV] Last contact:  #${cL.id} ${cL.firstname} ${cL.lastname} phone=${cL.contact_phone} zip=${cL.zip}`);
    }

    // ─── Build CSV ───────────────────────────────────────
    const csvHeaders = ['#', ...COLUMNS.map((col) => col.label), 'Status'];
    const csvRows = contacts.map((c) => {
      return [
        c.id,
        ...COLUMNS.map((col) => csvEscape(c[col.key], col.key)),
        csvEscape(c.status, null),
      ].join(',');
    });

    // UTF-8 BOM + header row + data rows
    const bom = '\uFEFF';
    const csvContent = bom + [csvHeaders.join(','), ...csvRows].join('\r\n');
    const csvBytes = Buffer.byteLength(csvContent, 'utf-8');

    console.log(`[EXPORT CSV] CSV complete: ${contacts.length} rows, ${csvBytes} bytes (${(csvBytes / 1024 / 1024).toFixed(2)} MB)`);

    // ─── Send file download ──────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const filename = `Aihaa_CRM_Export_${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', csvBytes);
    res.setHeader('X-Total-Rows', String(contacts.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Rows');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    res.send(csvContent);
  } catch (error) {
    console.error('[EXPORT CSV] FATAL ERROR:', error.message);
    console.error('[EXPORT CSV] Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
