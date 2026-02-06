const express = require('express');
const router = express.Router();
const { getAllContacts, enrichContact, getStats } = require('../services/enrichment');

// GET /api/enrichment/contacts - Get all contacts with pagination
router.get('/contacts', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = getAllContacts(page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/enrichment/contacts/:id - Enrich a contact
router.put('/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const result = enrichContact(parseInt(id), data);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/enrichment/stats - Get dashboard stats
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
