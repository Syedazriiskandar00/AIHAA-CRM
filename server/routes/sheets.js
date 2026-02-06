const express = require('express');
const router = express.Router();
const { readSheet, writeSheet } = require('../services/sheetsService');

const getSpreadsheetId = (req) => req.query.spreadsheetId || process.env.SPREADSHEET_ID;
const getSheetName = (req) => req.query.sheetName || process.env.SHEET_NAME || 'Worksheet';

// GET /api/sheets/data - Read data from Google Sheet
router.get('/data', async (req, res) => {
  try {
    const result = await readSheet(getSpreadsheetId(req), getSheetName(req));
    res.json({ success: true, data: result.data, rowCount: result.totalRows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sheets/write - Write enrichment data back to Google Sheet
// Body: { data: [contact objects] }
router.post('/write', async (req, res) => {
  try {
    const { data } = req.body;
    const result = await writeSheet(getSpreadsheetId(req), getSheetName(req), data);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
