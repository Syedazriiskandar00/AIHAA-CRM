const express = require('express');
const router = express.Router();
const { geocodeAddress, getCacheStats } = require('../services/geocodingService');

// ═══════════════════════════════════════════════════════════════
// POST /api/geocode
// Body: { address: "No 2-0, Jln Jed 4, Bandar Parklands, 41200 Klang, Selangor" }
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, error: 'Address diperlukan.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_MAPS_API_KEY tidak dikonfigurasi.' });
    }

    const result = await geocodeAddress(address, apiKey);

    if (!result) {
      return res.json({
        success: false,
        error: 'Tiada hasil geocoding untuk alamat ini.',
        address,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/geocode/cache-stats
// ═══════════════════════════════════════════════════════════════
router.get('/cache-stats', (req, res) => {
  res.json({ success: true, ...getCacheStats() });
});

module.exports = router;
