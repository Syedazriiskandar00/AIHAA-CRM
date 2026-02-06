# Aihaa CRM

Aplikasi CRM untuk data enrichment contacts, bersambung dengan Google Sheets.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Data:** Google Sheets API (Service Account)

## Setup Local

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Google Service Account

1. Pergi ke [Google Cloud Console](https://console.cloud.google.com/)
2. Buat Service Account dan download JSON key
3. Simpan sebagai `credentials.json` di root folder
4. Enable Google Sheets API
5. Share spreadsheet anda dengan email service account (Editor)

### 3. Environment variables

Buat fail `.env` di root:

```env
SPREADSHEET_ID=your_spreadsheet_id_here
SHEET_NAME=Worksheet
PORT=3001
```

### 4. Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Deploy ke Render.com

### 1. Encode credentials

```bash
npm run encode-creds
```

Salin output base64 string.

### 2. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/aihaa-crm.git
git push -u origin main
```

### 3. Setup di Render

1. Buat **New Web Service** di [Render Dashboard](https://dashboard.render.com/)
2. Sambung ke GitHub repo
3. Settings:
   - **Build Command:** `npm install && cd server && npm install && cd ../client && npm install && npm run build`
   - **Start Command:** `node server/index.js`
4. Environment Variables:
   - `SPREADSHEET_ID` = ID spreadsheet anda
   - `SHEET_NAME` = `Worksheet`
   - `GOOGLE_CREDENTIALS` = base64 string dari langkah 1

Atau guna `render.yaml` — Render akan auto-detect config.

## Scripts

| Script | Fungsi |
|--------|--------|
| `npm run dev` | Run server + client (development) |
| `npm run build` | Build React frontend |
| `npm start` | Run production server |
| `npm run encode-creds` | Encode credentials.json ke base64 |
| `npm run install:all` | Install semua dependencies |
