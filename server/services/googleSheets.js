const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');

let sheetsClient = null;

function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  }
  throw new Error('Google credentials tidak dijumpai.');
}

async function getAuthClient() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

async function getSheetsClient() {
  if (!sheetsClient) {
    const authClient = await getAuthClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  }
  return sheetsClient;
}

async function readSheet(spreadsheetId, range) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
}

async function writeSheet(spreadsheetId, range, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return response.data;
}

async function appendSheet(spreadsheetId, range, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return response.data;
}

module.exports = {
  getSheetsClient,
  readSheet,
  writeSheet,
  appendSheet,
};
