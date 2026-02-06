const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const sheetsRoutes = require('./routes/sheets');
const testConnectionRoute = require('./routes/testConnection');
const contactsRoutes = require('./routes/contacts');
const importUrlRoutes = require('./routes/importUrl');
const geocodeRoutes = require('./routes/geocode');

app.use('/api/sheets', sheetsRoutes);
app.use('/api/test-connection', testConnectionRoute);
app.use('/api/contacts', contactsRoutes);
app.use('/api/import', importUrlRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/stats', (req, res, next) => {
  // Proxy /api/stats ke contacts router /stats
  req.url = '/stats';
  contactsRoutes(req, res, next);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Production: serve React static files ────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — semua route bukan /api akan serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
