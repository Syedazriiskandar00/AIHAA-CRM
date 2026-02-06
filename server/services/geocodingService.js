const https = require('https');

// ─── In-memory cache: postcode → geocode result ──────────────
const postcodeCache = new Map();

// ─── Rate limiter: max 10 requests per second ────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY = 100; // 100ms = max 10/sec

// ─── Parse Google Maps address_components ────────────────────
function parseAddressComponents(components) {
  const result = {
    city: '',
    state: '',
    zip: '',
    country: '',
  };

  for (const comp of components) {
    const types = comp.types || [];

    if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      if (!result.city) result.city = comp.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      result.state = comp.long_name;
    }
    if (types.includes('postal_code')) {
      result.zip = comp.long_name;
    }
    if (types.includes('country')) {
      result.country = comp.long_name;
    }
  }

  return result;
}

// ─── Call Google Maps Geocoding API ──────────────────────────
function callGeocodingAPI(address, apiKey) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}&region=my`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse geocoding response: ' + e.message));
        }
      });
    }).on('error', (e) => {
      reject(new Error('Geocoding API request failed: ' + e.message));
    });
  });
}

// ─── Main geocode function ───────────────────────────────────
// Returns: { city, state, zip, country, lat, lng, formatted } or null
async function geocodeAddress(address, apiKey) {
  if (!address || !address.trim()) return null;
  if (!apiKey) {
    console.warn('[GEOCODE] No API key provided');
    return null;
  }

  try {
    const response = await callGeocodingAPI(address, apiKey);

    if (response.status !== 'OK' || !response.results || response.results.length === 0) {
      console.warn(`[GEOCODE] No results for: "${address}" — status: ${response.status}`);
      return null;
    }

    const result = response.results[0];
    const parsed = parseAddressComponents(result.address_components || []);
    const location = result.geometry?.location || {};

    return {
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      country: parsed.country || 'Malaysia',
      lat: location.lat ? String(location.lat) : '',
      lng: location.lng ? String(location.lng) : '',
      formatted: result.formatted_address || '',
    };
  } catch (err) {
    console.warn(`[GEOCODE] Error for "${address}":`, err.message);
    return null;
  }
}

// ─── Geocode with postcode caching ───────────────────────────
// If postcode is provided and cached, return cached result
// Otherwise, geocode and cache by postcode
async function geocodeWithCache(address, postcode, apiKey) {
  // Check cache first
  if (postcode && postcodeCache.has(postcode)) {
    return { ...postcodeCache.get(postcode), fromCache: true };
  }

  // Rate limit
  await sleep(RATE_LIMIT_DELAY);

  const result = await geocodeAddress(address, apiKey);
  if (!result) return null;

  // Cache by postcode
  if (postcode) {
    postcodeCache.set(postcode, result);
  }

  return { ...result, fromCache: false };
}

// ─── Build full address string from contact fields ───────────
function buildFullAddress(contact) {
  const parts = [
    contact.address,
    contact.city,
    contact.state,
    contact.zip,
    'Malaysia',
  ].filter(Boolean);

  return parts.length > 1 ? parts.join(', ') : '';
}

// ─── Get cache stats ─────────────────────────────────────────
function getCacheStats() {
  return {
    size: postcodeCache.size,
    postcodes: Array.from(postcodeCache.keys()),
  };
}

// ─── Clear cache ─────────────────────────────────────────────
function clearCache() {
  postcodeCache.clear();
}

module.exports = {
  geocodeAddress,
  geocodeWithCache,
  buildFullAddress,
  getCacheStats,
  clearCache,
};
