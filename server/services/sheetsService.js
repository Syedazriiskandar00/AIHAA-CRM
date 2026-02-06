const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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
const ENRICHMENT_HEADERS = ['Poskod', 'Alamat', 'Negeri', 'Status', 'Last_Updated'];

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
async function readSheet(spreadsheetId, sheetName) {
  try {
    const sheets = await getClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return { headers: [], data: [], totalRows: 0 };
    }

    const headers = rows[0];
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = rows[i][idx] || '';
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
// Tulis enrichment columns BARU di sebelah kanan data sedia ada.
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

    // Filter enrichment headers — hanya tambah yang belum wujud
    const newHeaders = ENRICHMENT_HEADERS.filter(
      (h) => !existingHeaders.includes(h)
    );

    if (newHeaders.length === 0) {
      // Semua header sudah wujud, return info sahaja
      return {
        message: 'Semua enrichment columns sudah wujud dalam sheet.',
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
      const rows = data.map((row) => {
        return newHeaders.map((h) => {
          if (h === 'Last_Updated') {
            return new Date().toISOString();
          }
          const key = h.toLowerCase();
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
      message: `${newHeaders.length} enrichment columns ditambah.`,
      addedHeaders: newHeaders,
      startColumn: headerStartCol,
      rowsWritten: data ? data.length : 0,
    };
  } catch (error) {
    throw wrapError(error);
  }
}

// ─── updateRows ─────────────────────────────────────────────
// updates = [{ row: 2, poskod: "50000", alamat: "...", negeri: "Selangor", status: "..." }, ...]
// Update specific cells sahaja berdasarkan row number. Tambah timestamp.
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

    // Pastikan enrichment headers wujud; jika tak, tambah dulu
    const missingHeaders = ENRICHMENT_HEADERS.filter((h) => !(h in headerMap));
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
    const timestamp = new Date().toISOString();

    const fieldMapping = {
      poskod: 'Poskod',
      alamat: 'Alamat',
      negeri: 'Negeri',
      status: 'Status',
    };

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

      // Tambah timestamp di Last_Updated
      if (headerMap['Last_Updated'] !== undefined) {
        const col = colIndexToLetter(headerMap['Last_Updated']);
        batchData.push({
          range: `${sheetName}!${col}${row}`,
          values: [[timestamp]],
        });
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
      timestamp,
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

module.exports = {
  readSheet,
  writeSheet,
  updateRows,
  testConnection,
  getClient,
  getServiceAccountEmail,
  ENRICHMENT_HEADERS,
};
