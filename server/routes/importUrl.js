const express = require('express');
const router = express.Router();
const { readSheet, listSheets, getServiceAccountEmail } = require('../services/sheetsService');
const { COLUMNS, buildHeaderMap, isOldFormat, SMART_COPY_RULES, OLD_FORMAT_DEFAULTS } = require('../config/columns');
const { geocodeWithCache, buildFullAddress, clearCache } = require('../services/geocodingService');

// ─── URL parsing helpers ─────────────────────────────────────
function parseGoogleSheetsUrl(url) {
  const trimmed = (url || '').trim();

  // Validate domain
  if (!trimmed.startsWith('https://docs.google.com/spreadsheets/')) {
    // Check if it's an Excel file on Google Drive
    if (trimmed.includes('drive.google.com') || trimmed.includes('.xlsx') || trimmed.includes('.xls')) {
      return {
        valid: false,
        error: 'File ini adalah Excel. Sila buka di Google Drive dan klik File > Save as Google Sheets dulu.',
        code: 'EXCEL_FILE',
      };
    }
    return {
      valid: false,
      error: 'Sila paste URL Google Sheets yang sah. Contoh: https://docs.google.com/spreadsheets/d/xxx/edit',
      code: 'INVALID_URL',
    };
  }

  // Extract spreadsheet ID — between /d/ and next /
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    return {
      valid: false,
      error: 'Tidak dapat extract Spreadsheet ID dari URL ini.',
      code: 'NO_ID',
    };
  }

  const spreadsheetId = idMatch[1];

  // Extract gid if present
  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? parseInt(gidMatch[1]) : null;

  return { valid: true, spreadsheetId, gid };
}

// ═══════════════════════════════════════════════════════════════
// POST /api/import/from-url
// Body: { url: "https://docs.google.com/spreadsheets/d/xxx/edit?gid=123" }
// ═══════════════════════════════════════════════════════════════
router.post('/from-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL diperlukan.' });
    }

    // Parse URL
    const parsed = parseGoogleSheetsUrl(url);
    if (!parsed.valid) {
      return res.status(400).json({
        success: false,
        error: parsed.error,
        code: parsed.code,
      });
    }

    // Get all sheet names
    let sheets;
    try {
      sheets = await listSheets(parsed.spreadsheetId);
    } catch (err) {
      const msg = err.message || '';
      const email = getServiceAccountEmail();

      if (err.code === 'PERMISSION_DENIED' || msg.includes('does not have permission')) {
        return res.status(403).json({
          success: false,
          error: `Tiada kebenaran. Sila share spreadsheet dengan: ${email}`,
          code: 'PERMISSION_DENIED',
          serviceAccountEmail: email,
        });
      }

      if (err.code === 'SPREADSHEET_NOT_FOUND' || msg.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Spreadsheet tidak dijumpai. Pastikan URL betul.',
          code: 'NOT_FOUND',
        });
      }

      throw err;
    }

    if (!sheets || sheets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Spreadsheet ini tiada sheet.',
      });
    }

    // Auto-select sheet by gid, or default to first sheet
    let selectedSheet = sheets[0];
    if (parsed.gid !== null) {
      const matchByGid = sheets.find((s) => s.sheetId === parsed.gid);
      if (matchByGid) selectedSheet = matchByGid;
    }

    // Read preview data (first 10 rows)
    const { headers, data, totalRows } = await readSheet(parsed.spreadsheetId, selectedSheet.title);
    const preview = data.slice(0, 10);

    res.json({
      success: true,
      spreadsheetId: parsed.spreadsheetId,
      sheets,
      selectedSheet,
      headers,
      totalRows,
      preview,
      serviceAccountEmail: getServiceAccountEmail(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/import/select-sheet
// Body: { spreadsheetId: "xxx", sheetName: "Sheet2" }
// ═══════════════════════════════════════════════════════════════
router.post('/select-sheet', async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;

    if (!spreadsheetId || !sheetName) {
      return res.status(400).json({ success: false, error: 'spreadsheetId dan sheetName diperlukan.' });
    }

    const { headers, data, totalRows } = await readSheet(spreadsheetId, sheetName);
    const preview = data.slice(0, 10);

    res.json({
      success: true,
      spreadsheetId,
      sheetName,
      headers,
      totalRows,
      preview,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Helper: Capitalize words ─────────────────────────────────
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Helper: Smart Malay name split ───────────────────────────
function splitMalayName(fullName) {
  if (!fullName || !fullName.trim()) return { firstname: '', lastname: '' };
  const name = fullName.trim();
  const words = name.split(/\s+/);
  if (words.length === 1) return { firstname: capitalizeWords(words[0]), lastname: '' };

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

// ─── Helper: Map single row (same logic as contacts.js) ───────
function mapRowForAutoDetect(rawRow, headerMapping, oldFormat) {
  const contact = {};
  COLUMNS.forEach((col) => { contact[col.key] = ''; });

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
      // Skip metadata fields
    } else {
      // Fallback fields: only write if target field is still empty
      if (mapping.fallback && contact[mapping.field]) continue;
      contact[mapping.field] = val;
    }
  }

  // Apply old format defaults
  if (oldFormat) {
    for (const [key, defaultVal] of Object.entries(OLD_FORMAT_DEFAULTS)) {
      if (!contact[key]) contact[key] = defaultVal;
    }
  }

  // Apply smart copy rules
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

// ─── Helper: Check completeness ───────────────────────────────
function isLengkap(contact) {
  return !!(contact.firstname && contact.contact_phone && contact.zip && contact.address && contact.state);
}

// ═══════════════════════════════════════════════════════════════
// POST /api/import/auto-detect
// Body: { spreadsheetId, sheetName }
// SSE response — streams progress events
// ═══════════════════════════════════════════════════════════════
router.post('/auto-detect', async (req, res) => {
  const { spreadsheetId, sheetName } = req.body;

  if (!spreadsheetId || !sheetName) {
    return res.status(400).json({ success: false, error: 'spreadsheetId dan sheetName diperlukan.' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Read entire sheet
    sendEvent({ type: 'status', message: 'Membaca Google Sheet...' });
    const { headers, data } = await readSheet(spreadsheetId, sheetName);
    const headerMapping = buildHeaderMap(headers);
    const oldFormat = isOldFormat(headers);

    const total = data.length;
    sendEvent({ type: 'start', total, oldFormat, headers: headers.length });

    // 2. Map all rows + geocode
    clearCache(); // Fresh cache for each run
    const enrichedContacts = [];
    let geocodedCount = 0;
    let cacheHits = 0;
    let geocodeErrors = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const contact = mapRowForAutoDetect(row, headerMapping, oldFormat);

      // Geocode if we have an address and API key
      if (apiKey) {
        const fullAddress = buildFullAddress(contact);
        if (fullAddress) {
          const geoResult = await geocodeWithCache(fullAddress, contact.zip, apiKey);
          if (geoResult) {
            // Fill in lat/lng
            contact.latitude = geoResult.lat || contact.latitude;
            contact.longitude = geoResult.lng || contact.longitude;

            // Enrich missing location fields from geocoding
            if (!contact.city && geoResult.city) contact.city = geoResult.city;
            if (!contact.state && geoResult.state) contact.state = geoResult.state;
            if (!contact.zip && geoResult.zip) contact.zip = geoResult.zip;

            // Re-apply smart copy after geocoding enrichment
            for (const [sourceKey, targets] of Object.entries(SMART_COPY_RULES)) {
              const sourceVal = contact[sourceKey];
              if (!sourceVal) continue;
              for (const target of targets) {
                if (!contact[target]) contact[target] = sourceVal;
              }
            }

            if (geoResult.fromCache) {
              cacheHits++;
            } else {
              geocodedCount++;
            }
          } else {
            geocodeErrors++;
          }
        }
      }

      contact.status = isLengkap(contact) ? 'Lengkap' : 'Tidak Lengkap';
      enrichedContacts.push(contact);

      // Send progress every 10 rows or on last row
      if ((i + 1) % 10 === 0 || i === data.length - 1) {
        sendEvent({
          type: 'progress',
          current: i + 1,
          total,
          geocoded: geocodedCount,
          cacheHits,
          errors: geocodeErrors,
        });
      }
    }

    // 3. Filter out empty rows
    const validContacts = enrichedContacts.filter(
      (c) => c.firstname || c.lastname || c.contact_phone || c.email
    );

    const lengkap = validContacts.filter((c) => c.status === 'Lengkap').length;

    // 4. Send complete event with all enriched data
    sendEvent({
      type: 'complete',
      total: validContacts.length,
      lengkap,
      tidakLengkap: validContacts.length - lengkap,
      geocoded: geocodedCount,
      cacheHits,
      errors: geocodeErrors,
      data: validContacts,
    });
  } catch (error) {
    sendEvent({ type: 'error', message: error.message });
  } finally {
    res.end();
  }
});

module.exports = router;
