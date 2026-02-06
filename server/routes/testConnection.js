const express = require('express');
const router = express.Router();
const { testConnection } = require('../services/sheetsService');

// GET /api/test-connection
router.get('/', async (req, res) => {
  const spreadsheetId = req.query.spreadsheetId || process.env.SPREADSHEET_ID;
  const sheetName = req.query.sheetName || process.env.SHEET_NAME || 'Sheet1';

  if (!spreadsheetId || spreadsheetId === 'your_google_spreadsheet_id_here') {
    return res.status(400).json({
      success: false,
      connected: false,
      error:
        'SPREADSHEET_ID belum dikonfigurasi. ' +
        'Sila set SPREADSHEET_ID di .env file dengan ID spreadsheet Google anda.',
    });
  }

  const result = await testConnection(spreadsheetId, sheetName);

  if (result.connected) {
    res.json({
      success: true,
      ...result,
      message: `Berjaya connect! ${result.totalRows} baris data dijumpai.`,
    });
  } else {
    res.status(500).json({
      success: false,
      ...result,
    });
  }
});

module.exports = router;
