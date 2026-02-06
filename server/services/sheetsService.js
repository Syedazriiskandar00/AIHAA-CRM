const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { COLUMNS, ALL_HEADERS } = require('../config/columns');

// ─── Credentials ────────────────────────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');

// Parse credentials dari env var (base64) ATAU dari file
function getCredentials() {
  // 1. Cuba env var GOOGLE_CREDENTIALS (base64-encoded JSON)
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (e) {
      throw new Error('GOOGLE_CREDENTIALS env var bukan base64 JSON yang sah: ' + e.message);
    }
  }

  // 2. Fallback ke credentials.json file
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  }

  const err = new Error(
    'Google credentials tidak dijumpai. Set GOOGLE_CREDENTIALS env var (base64) ' +
      'atau simpan credentials.json di root folder projek.'
  );
  err.code = 'CREDENTIALS_NOT_FOUND';
  throw err;
}

// ─── Auth & Client ──────────────────────────────────────────
let sheetsClient = null;

async function getAuth() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function getClient() {
  if (!sheetsClient) {
    const auth = await getAuth();
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  }
  return sheetsClient;
}

function getServiceAccountEmail() {
  try {
    const creds = getCredentials();
    return creds.client_email || null;
  } catch {
    return null;
  }
}

function wrapError(error) {
  const msg = error.message || '';
  const code = error.code || error.status;

  if (code === 'CREDENTIALS_NOT_FOUND') {
    return error;
  }

  if (code === 404 || msg.includes('Requested entity was not found')) {
    const err = new Error(
      `Spreadsheet tidak dijumpai. Pastikan SPREADSHEET_ID betul di .env. ` +
        `ID sekarang: "${process.env.SPREADSHEET_ID || '(kosong)'}"`
    );
    err.code = 'SPREADSHEET_NOT_FOUND';
    return err;
  }

  if (code === 403 || msg.includes('does not have permission')) {
    const email = getServiceAccountEmail();
    const err = new Error(
      `Tiada kebenaran untuk akses spreadsheet ini. ` +
        `Sila share spreadsheet dengan service account email: ${email || '(baca credentials.json untuk dapatkan client_email)'}` +
        ` dan beri permission "Editor".`
    );
    err.code = 'PERMISSION_DENIED';
    return err;
  }

  return error;
}

// ─── Column helpers ─────────────────────────────────────────
// Legacy enrichment headers (kept for backward compatibility)
const ENRICHMENT_HEADERS = ALL_HEADERS;

function colIndexToLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// ─── readSheet ──────────────────────────────────────────────
// options.valueRenderOption: 'FORMATTED_VALUE' (default) | 'UNFORMATTED_VALUE'
// Use UNFORMATTED_VALUE for export to get raw numbers instead of "6.02E+10"
async function readSheet(spreadsheetId, sheetName, options = {}) {
  try {
    const sheets = await getClient();
    const apiParams = {
      spreadsheetId,
      range: sheetName,
    };
    if (options.valueRenderOption) {
      apiParams.valueRenderOption = options.valueRenderOption;
    }
    const response = await sheets.spreadsheets.values.get(apiParams);

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return { headers: [], data: [], totalRows: 0 };
    }

    const headers = rows[0].map((h) => (h != null ? String(h) : ''));
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((header, idx) => {
        const val = rows[i] ? rows[i][idx] : undefined;
        obj[header] = val != null && val !== '' ? String(val) : '';
      });
      obj._rowIndex = i + 1; // 1-based sheet row number
      data.push(obj);
    }

    return { headers, data, totalRows: data.length };
  } catch (error) {
    throw wrapError(error);
  }
}

// ─── writeSheet ─────────────────────────────────────────────
// Tulis columns ke sebelah kanan data sedia ada.
// Tidak akan overwrite kolum yang sudah wujud.
async function writeSheet(spreadsheetId, sheetName, data, startColumn) {
  try {
    const sheets = await getClient();

    // Baca header row sedia ada untuk tahu kolum mana sudah wujud
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    const existingHeaders = (headerRes.data.values && headerRes.data.values[0]) || [];

    // Tentukan startColumn — guna yang diberi, atau kolum selepas data terakhir
    let startColIndex;
    if (startColumn) {
      startColIndex = startColumn.toUpperCase().charCodeAt(0) - 65;
    } else {
      startColIndex = existingHeaders.length;
    }

    // Filter headers — hanya tambah yang belum wujud
    const newHeaders = ALL_HEADERS.filter(
      (h) => !existingHeaders.includes(h)
    );

    if (newHeaders.length === 0) {
      // Semua header sudah wujud, return info sahaja
      return {
        message: 'Semua columns sudah wujud dalam sheet.',
        existingHeaders,
        startColumn: colIndexToLetter(startColIndex),
      };
    }

    // Tulis header baru di row 1
    const headerStartCol = colIndexToLetter(startColIndex);
    const headerEndCol = colIndexToLetter(startColIndex + newHeaders.length - 1);
    const headerRange = `${sheetName}!${headerStartCol}1:${headerEndCol}1`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newHeaders] },
    });

    // Tulis data rows jika ada
    if (data && data.length > 0) {
      // Build field key for each new header
      const headerToKey = {};
      COLUMNS.forEach((col) => {
        headerToKey[col.label] = col.key;
      });

      const rows = data.map((row) => {
        return newHeaders.map((h) => {
          const key = headerToKey[h];
          if (!key) return '';
          return row[key] || row[h] || '';
        });
      });

      const dataRange = `${sheetName}!${headerStartCol}2:${headerEndCol}${data.length + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: dataRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
    }

    return {
      message: `${newHeaders.length} columns ditambah.`,
      addedHeaders: newHeaders,
      startColumn: headerStartCol,
      rowsWritten: data ? data.length : 0,
    };
  } catch (error) {
    throw wrapError(error);
  }
}

// ─── updateRows ─────────────────────────────────────────────
// updates = [{ row: 2, firstname: "Ali", lastname: "Bin Abu", ... }, ...]
// Update specific cells sahaja berdasarkan row number.
async function updateRows(spreadsheetId, sheetName, updates) {
  try {
    const sheets = await getClient();

    // Baca header row untuk mapping nama kolum → column letter
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];

    // Bina map: header name → column index
    const headerMap = {};
    headers.forEach((h, idx) => {
      headerMap[h] = idx;
    });

    // Build dynamic field mapping from column config
    // Maps field key → sheet header label
    const fieldMapping = {};
    COLUMNS.forEach((col) => {
      fieldMapping[col.key] = col.label;
    });
    // Legacy aliases
    fieldMapping['poskod'] = 'Zip';
    fieldMapping['alamat'] = 'Address';
    fieldMapping['negeri'] = 'State';
    fieldMapping['status'] = 'Client type';

    // Pastikan all 42 headers wujud; jika tak, tambah yang missing
    const missingHeaders = ALL_HEADERS.filter((h) => !(h in headerMap));
    if (missingHeaders.length > 0) {
      const startIdx = headers.length;
      const startCol = colIndexToLetter(startIdx);
      const endCol = colIndexToLetter(startIdx + missingHeaders.length - 1);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${startCol}1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [missingHeaders] },
      });

      // Update local header map
      missingHeaders.forEach((h, i) => {
        headerMap[h] = startIdx + i;
      });
    }

    // Bina batch update data
    const batchData = [];

    for (const update of updates) {
      const row = update.row;
      if (!row || row < 2) continue; // Skip invalid rows (row 1 = headers)

      // Map setiap field ke cell yang betul
      for (const [inputKey, headerName] of Object.entries(fieldMapping)) {
        if (update[inputKey] !== undefined && headerMap[headerName] !== undefined) {
          const col = colIndexToLetter(headerMap[headerName]);
          batchData.push({
            range: `${sheetName}!${col}${row}`,
            values: [[update[inputKey]]],
          });
        }
      }
    }

    if (batchData.length === 0) {
      return { message: 'Tiada data untuk dikemaskini.', updatedRows: 0 };
    }

    // Guna batchUpdate untuk tulis semua sekaligus (lebih efficient)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });

    return {
      message: `${updates.length} baris dikemaskini.`,
      updatedRows: updates.length,
      cellsUpdated: batchData.length,
    };
  } catch (error) {
    throw wrapError(error);
  }
}

// ─── testConnection ─────────────────────────────────────────
async function testConnection(spreadsheetId, sheetName) {
  try {
    const { headers, totalRows } = await readSheet(spreadsheetId, sheetName);
    const email = getServiceAccountEmail();

    return {
      connected: true,
      spreadsheetId,
      sheetName,
      serviceAccountEmail: email,
      headers,
      totalRows,
    };
  } catch (error) {
    const wrapped = wrapError(error);
    return {
      connected: false,
      error: wrapped.message,
      code: wrapped.code || 'UNKNOWN',
      serviceAccountEmail: getServiceAccountEmail(),
    };
  }
}

// ─── listSheets ──────────────────────────────────────────────
// Return semua sheet names dalam spreadsheet
async function listSheets(spreadsheetId) {
  try {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });
    return (res.data.sheets || []).map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    }));
  } catch (error) {
    throw wrapError(error);
  }
}

module.exports = {
  readSheet,
  writeSheet,
  updateRows,
  testConnection,
  listSheets,
  getClient,
  getServiceAccountEmail,
  ENRICHMENT_HEADERS,
  ALL_HEADERS,
};
