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
  // Mobile: 01x-xxxxxxx (10-11 digit selepas 0)
  // Landline: 0x-xxxxxxxx

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

function validateEnrichment(data) {
  const errors = [];
  const cleaned = {};

  if (data.poskod !== undefined) {
    const r = validatePoskod(data.poskod);
    if (!r.valid) errors.push(r.error);
    else cleaned.poskod = r.value;
  }

  if (data.negeri !== undefined) {
    const r = validateNegeri(data.negeri);
    if (!r.valid) errors.push(r.error);
    else cleaned.negeri = r.value;
  }

  if (data.phone !== undefined) {
    const r = validatePhone(data.phone);
    if (!r.valid) errors.push(r.error);
    else cleaned.phone = r.value;
  }

  // Alamat — just trim, no special validation
  if (data.alamat !== undefined) {
    cleaned.alamat = String(data.alamat).trim();
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned,
  };
}

module.exports = {
  NEGERI_LIST,
  NEGERI_ALIASES,
  validatePoskod,
  validateNegeri,
  validatePhone,
  validateEnrichment,
};
