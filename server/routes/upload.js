const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { importContacts } = require('../services/enrichment');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/upload - Upload and import a file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let contacts = [];

    if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      contacts = JSON.parse(raw);
      if (!Array.isArray(contacts)) contacts = [contacts];
    } else if (ext === '.csv') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        return res.status(400).json({ success: false, error: 'CSV file is empty or has no data rows' });
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const contact = {};
        headers.forEach((h, idx) => {
          contact[h] = values[idx] || '';
        });
        contacts.push(contact);
      }
    }

    const results = importContacts(contacts);
    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported: contacts.length,
      message: `${contacts.length} contacts imported successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
