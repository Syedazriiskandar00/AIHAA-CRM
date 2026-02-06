// Resolve googleapis from server/node_modules
const path = require('path');
module.paths.unshift(path.join(__dirname, 'server', 'node_modules'));
const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  // Try credentials from env var (base64) or file
  let authOptions;
  if (process.env.GOOGLE_CREDENTIALS) {
    const creds = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf-8'));
    authOptions = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    console.log('Using GOOGLE_CREDENTIALS env var');
  } else if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
    authOptions = { keyFile: path.join(__dirname, 'credentials.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    console.log('Using credentials.json');
  } else {
    console.error('ERROR: No credentials found!');
    console.error('Either set GOOGLE_CREDENTIALS env var (base64 JSON) or place credentials.json in project root.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '10XQICyn6Co7Vvlz6_RUKpk4sPZc8BLbOmyLMdGJhf8c';

  // Get sheet info
  console.log('\n=== STEP 1: List all sheets ===');
  const info = await sheets.spreadsheets.get({ spreadsheetId });
  console.log('Sheets found:');
  info.data.sheets.forEach(s => {
    console.log(`  - "${s.properties.title}" (gridProperties.rowCount=${s.properties.gridProperties.rowCount})`);
  });

  // Read ALL data from first sheet using range A:AP
  const sheetName = info.data.sheets[0].properties.title;
  console.log(`\n=== STEP 2: Read ALL data from "${sheetName}" range A:AP ===`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:AP`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = res.data.values || [];
  console.log(`Total rows returned by API: ${rows.length}`);
  console.log(`Data rows (minus header): ${rows.length - 1}`);

  if (rows.length > 0) {
    console.log(`\n=== STEP 3: Header row ===`);
    console.log(`Columns: ${rows[0].length}`);
    console.log(`Header: ${rows[0].join(' | ')}`);
  }

  if (rows.length > 1) {
    console.log(`\n=== STEP 4: First data row (row 2) ===`);
    console.log(rows[1].join(' | '));
  }

  if (rows.length > 2) {
    console.log(`\n=== STEP 5: Last data row (row ${rows.length}) ===`);
    console.log(rows[rows.length - 1].join(' | '));
  }

  // Write CSV
  console.log(`\n=== STEP 6: Writing CSV ===`);
  const bom = '\ufeff';
  const csv = rows.map(r => r.map(c => `"${String(c != null ? c : '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  fs.writeFileSync(path.join(__dirname, 'test-output.csv'), bom + csv, 'utf8');
  const fileSize = fs.statSync(path.join(__dirname, 'test-output.csv')).size;
  console.log(`CSV written: test-output.csv`);
  console.log(`  Rows: ${rows.length}`);
  console.log(`  File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n=== DONE ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  if (err.code === 403) console.error('Permission denied — share the spreadsheet with the service account email.');
  if (err.code === 404) console.error('Spreadsheet not found — check the spreadsheetId.');
  process.exit(1);
});
