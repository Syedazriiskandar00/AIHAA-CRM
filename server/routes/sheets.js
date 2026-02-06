const express = require('express');
const router = express.Router();
const { readSheet, writeSheet, appendSheet } = require('../services/googleSheets');

const getSpreadsheetId = () => process.env.SPREADSHEET_ID;
const getSheetName = () => process.env.SHEET_NAME || 'Sheet1';

// GET /api/sheets/data - Read data from Google Sheet
router.get('/data', async (req, res) => {
  try {
    const range = req.query.range || getSheetName();
    const data = await readSheet(getSpreadsheetId(), range);
    res.json({ success: true, data, rowCount: data.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sheets/write - Write data to Google Sheet
router.post('/write', async (req, res) => {
  try {
    const { range, values } = req.body;
    const sheetRange = range || getSheetName();
    const result = await writeSheet(getSpreadsheetId(), sheetRange, values);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sheets/append - Append data to Google Sheet
router.post('/append', async (req, res) => {
  try {
    const { values } = req.body;
    const range = getSheetName();
    const result = await appendSheet(getSpreadsheetId(), range, values);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
