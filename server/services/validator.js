// ─── Senarai Negeri Malaysia ────────────────────────────────
const NEGERI_LIST = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'WP Kuala Lumpur',
  'WP Putrajaya',
  'WP Labuan',
];

// Alias mapping — terima variasi biasa dan map ke bentuk rasmi
const NEGERI_ALIASES = {
  'kl': 'WP Kuala Lumpur',
  'kuala lumpur': 'WP Kuala Lumpur',
  'wp kl': 'WP Kuala Lumpur',
  'wilayah persekutuan kuala lumpur': 'WP Kuala Lumpur',
  'putrajaya': 'WP Putrajaya',
  'wp putrajaya': 'WP Putrajaya',
  'labuan': 'WP Labuan',
  'wp labuan': 'WP Labuan',
  'penang': 'Pulau Pinang',
  'pulau pinang': 'Pulau Pinang',
  'pinang': 'Pulau Pinang',
  'n. sembilan': 'Negeri Sembilan',
  'n.sembilan': 'Negeri Sembilan',
  'ns': 'Negeri Sembilan',
  'negeri sembilan': 'Negeri Sembilan',
  'malacca': 'Melaka',
  'melaka': 'Melaka',
  'johor': 'Johor',
  'johor bahru': 'Johor',
  'jb': 'Johor',
  'kedah': 'Kedah',
  'kelantan': 'Kelantan',
  'pahang': 'Pahang',
  'perak': 'Perak',
  'perlis': 'Perlis',
  'sabah': 'Sabah',
  'sarawak': 'Sarawak',
  'selangor': 'Selangor',
  'terengganu': 'Terengganu',
  'trengganu': 'Terengganu',
};

function validatePoskod(poskod) {
  if (!poskod && poskod !== 0) {
    return { valid: false, error: 'Poskod diperlukan.' };
  }
  const cleaned = String(poskod).trim();
  if (!/^\d{5}$/.test(cleaned)) {
    return { valid: false, error: `Poskod mesti 5 digit angka. Diterima: "${cleaned}"` };
  }
  return { valid: true, value: cleaned };
}

function validateNegeri(negeri) {
  if (!negeri) {
    return { valid: false, error: 'Negeri diperlukan.' };
  }
  const cleaned = String(negeri).trim();

  // Cek exact match dulu (case-insensitive)
  const exactMatch = NEGERI_LIST.find(
    (n) => n.toLowerCase() === cleaned.toLowerCase()
  );
  if (exactMatch) {
    return { valid: true, value: exactMatch };
  }

  // Cek alias
  const alias = NEGERI_ALIASES[cleaned.toLowerCase()];
  if (alias) {
    return { valid: true, value: alias };
  }

  return {
    valid: false,
    error: `"${cleaned}" bukan negeri Malaysia yang sah. Senarai: ${NEGERI_LIST.join(', ')}`,
  };
}

function validatePhone(phone) {
  if (!phone) {
    return { valid: false, error: 'Nombor telefon diperlukan.' };
  }
  const cleaned = String(phone).trim().replace(/[\s\-().]/g, '');

  // Format: +60xxxxxxxxx atau 60xxxxxxxxx atau 01xxxxxxxxx
  if (/^(\+?60)([0-9]{9,11})$/.test(cleaned)) {
    return { valid: true, value: cleaned };
  }

  if (/^(0[0-9])([0-9]{7,9})$/.test(cleaned)) {
    return { valid: true, value: cleaned };
  }

  return {
    valid: false,
    error: `Format telefon tidak sah: "${phone}". Format yang diterima: +60xxxxxxxxx, 60xxxxxxxxx, 01xxxxxxxxx`,
  };
}

// ─── New validators for 42-column format ─────────────────────

function validateEmail(email) {
  if (!email) {
    return { valid: false, error: 'Email diperlukan.' };
  }
  const cleaned = String(email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return { valid: false, error: `Format email tidak sah: "${cleaned}"` };
  }
  return { valid: true, value: cleaned.toLowerCase() };
}

function validateUrl(url) {
  if (!url) {
    return { valid: false, error: 'URL diperlukan.' };
  }
  const cleaned = String(url).trim();
  if (!/^(https?:\/\/)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(cleaned)) {
    return { valid: false, error: `Format URL tidak sah: "${cleaned}"` };
  }
  return { valid: true, value: cleaned };
}

function validateDate(date) {
  if (!date) {
    return { valid: false, error: 'Tarikh diperlukan.' };
  }
  const cleaned = String(date).trim();
  // Accept ISO (YYYY-MM-DD) or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return { valid: true, value: cleaned };
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split('/');
    return { valid: true, value: `${y}-${m}-${d}` };
  }
  return { valid: false, error: `Format tarikh tidak sah: "${cleaned}". Guna YYYY-MM-DD atau DD/MM/YYYY.` };
}

function validateCoordinate(val, type) {
  if (!val && val !== 0) {
    return { valid: false, error: `${type} diperlukan.` };
  }
  const num = parseFloat(val);
  if (isNaN(num)) {
    return { valid: false, error: `${type} mesti nombor. Diterima: "${val}"` };
  }
  if (type === 'Longitude' && (num < -180 || num > 180)) {
    return { valid: false, error: `Longitude mesti antara -180 dan 180. Diterima: ${num}` };
  }
  if (type === 'Latitude' && (num < -90 || num > 90)) {
    return { valid: false, error: `Latitude mesti antara -90 dan 90. Diterima: ${num}` };
  }
  return { valid: true, value: String(num) };
}

// ─── Field-level validator mapping ───────────────────────────
const FIELD_VALIDATORS = {
  email: (v) => validateEmail(v),
  email_address: (v) => validateEmail(v),
  zip: (v) => validatePoskod(v),
  billing_zip: (v) => validatePoskod(v),
  shipping_zip: (v) => validatePoskod(v),
  state: (v) => validateNegeri(v),
  billing_state: (v) => validateNegeri(v),
  shipping_state: (v) => validateNegeri(v),
  contact_phone: (v) => validatePhone(v),
  phonenumber: (v) => validatePhone(v),
  website: (v) => validateUrl(v),
  birthday: (v) => validateDate(v),
  longitude: (v) => validateCoordinate(v, 'Longitude'),
  latitude: (v) => validateCoordinate(v, 'Latitude'),
};

// ─── Generic contact validator (handles any of 42 fields) ────
function validateContact(data) {
  const errors = [];
  const cleaned = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const validator = FIELD_VALIDATORS[key];
    if (validator) {
      // Only validate non-empty values — empty is allowed (optional fields)
      if (String(value).trim() !== '') {
        const result = validator(value);
        if (!result.valid) {
          errors.push(result.error);
        } else {
          cleaned[key] = result.value;
        }
      } else {
        cleaned[key] = '';
      }
    } else {
      // No specific validator — just trim
      cleaned[key] = String(value).trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned,
  };
}

// ─── Legacy backward-compatible wrapper ──────────────────────
function validateEnrichment(data) {
  const mapped = {};
  if (data.poskod !== undefined) mapped.zip = data.poskod;
  if (data.negeri !== undefined) mapped.state = data.negeri;
  if (data.phone !== undefined) mapped.contact_phone = data.phone;
  if (data.alamat !== undefined) mapped.address = data.alamat;

  const result = validateContact(mapped);

  // Remap cleaned keys back to old names for backward compat
  const oldCleaned = {};
  if (result.cleaned.zip !== undefined) oldCleaned.poskod = result.cleaned.zip;
  if (result.cleaned.state !== undefined) oldCleaned.negeri = result.cleaned.state;
  if (result.cleaned.contact_phone !== undefined) oldCleaned.phone = result.cleaned.contact_phone;
  if (result.cleaned.address !== undefined) oldCleaned.alamat = result.cleaned.address;

  return {
    valid: result.valid,
    errors: result.errors,
    cleaned: oldCleaned,
  };
}

module.exports = {
  NEGERI_LIST,
  NEGERI_ALIASES,
  validatePoskod,
  validateNegeri,
  validatePhone,
  validateEmail,
  validateUrl,
  validateDate,
  validateCoordinate,
  validateContact,
  validateEnrichment,
};
