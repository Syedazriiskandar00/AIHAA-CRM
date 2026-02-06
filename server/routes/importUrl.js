const express = require('express');
const router = express.Router();
const { readSheet, listSheets, getServiceAccountEmail } = require('../services/sheetsService');

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

module.exports = router;
