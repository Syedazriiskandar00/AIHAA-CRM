// ─── Single Source of Truth: 42-Column CRM Definition ────────
// EXACT labels matching Google Sheet headers. DO NOT change order or names.

const COLUMNS = [
  { key: 'firstname',         label: 'Firstname',            group: 'personal',  colLetter: 'A' },
  { key: 'lastname',          label: 'Lastname',             group: 'personal',  colLetter: 'B' },
  { key: 'email',             label: 'Email',                group: 'personal',  colLetter: 'C' },
  { key: 'contact_phone',     label: 'Contact phonenumber',  group: 'personal',  colLetter: 'D' },
  { key: 'position',          label: 'Position',             group: 'company',   colLetter: 'E' },
  { key: 'company_name',      label: 'Name',                 group: 'company',   colLetter: 'F' },
  { key: 'vat',               label: 'Vat',                  group: 'company',   colLetter: 'G' },
  { key: 'phonenumber',       label: 'Phonenumber',          group: 'company',   colLetter: 'H' },
  { key: 'country',           label: 'Country',              group: 'location',  colLetter: 'I' },
  { key: 'city',              label: 'City',                 group: 'location',  colLetter: 'J' },
  { key: 'zip',               label: 'Zip',                  group: 'location',  colLetter: 'K' },
  { key: 'state',             label: 'State',                group: 'location',  colLetter: 'L' },
  { key: 'address',           label: 'Address',              group: 'location',  colLetter: 'M' },
  { key: 'website',           label: 'Website',              group: 'online',    colLetter: 'N' },
  { key: 'billing_street',    label: 'Billing street',       group: 'billing',   colLetter: 'O' },
  { key: 'billing_city',      label: 'Billing city',         group: 'billing',   colLetter: 'P' },
  { key: 'billing_state',     label: 'Billing state',        group: 'billing',   colLetter: 'Q' },
  { key: 'billing_zip',       label: 'Billing zip',          group: 'billing',   colLetter: 'R' },
  { key: 'billing_country',   label: 'Billing country',      group: 'billing',   colLetter: 'S' },
  { key: 'shipping_street',   label: 'Shipping street',      group: 'shipping',  colLetter: 'T' },
  { key: 'shipping_city',     label: 'Shipping city',        group: 'shipping',  colLetter: 'U' },
  { key: 'shipping_state',    label: 'Shipping state',       group: 'shipping',  colLetter: 'V' },
  { key: 'shipping_zip',      label: 'Shipping zip',         group: 'shipping',  colLetter: 'W' },
  { key: 'shipping_country',  label: 'Shipping country',     group: 'shipping',  colLetter: 'X' },
  { key: 'longitude',         label: 'Longitude',            group: 'online',    colLetter: 'Y' },
  { key: 'latitude',          label: 'Latitude',             group: 'online',    colLetter: 'Z' },
  { key: 'stripe_id',         label: 'Stripe id',            group: 'business',  colLetter: 'AA' },
  { key: 'affiliate_code',    label: 'Affiliate code',       group: 'business',  colLetter: 'AB' },
  { key: 'loy_point',         label: 'Loy point',            group: 'business',  colLetter: 'AC' },
  { key: 'woo_customer',      label: 'Woo customer id',      group: 'business',  colLetter: 'AD' },
  { key: 'woo_channel',       label: 'Woo channel id',       group: 'business',  colLetter: 'AE' },
  { key: 'client_type',       label: 'Client type',          group: 'business',  colLetter: 'AF' },
  { key: 'balance',           label: 'Balance',              group: 'business',  colLetter: 'AG' },
  { key: 'balance_as',        label: 'Balance as of',        group: 'business',  colLetter: 'AH' },
  { key: 'auto_invoice',      label: 'Auto invoice',         group: 'business',  colLetter: 'AI' },
  { key: 'email_address',     label: 'Email address',        group: 'business',  colLetter: 'AJ' },
  { key: 'is_non_individual', label: 'Is non individual',    group: 'business',  colLetter: 'AK' },
  { key: 'bukku_id',          label: 'Bukku id',             group: 'business',  colLetter: 'AL' },
  { key: 'birthday',          label: 'Birthday',             group: 'business',  colLetter: 'AM' },
  { key: 'terms_conditions',  label: 'Terms & Conditions',   group: 'business',  colLetter: 'AN' },
  { key: 'identification',    label: 'Identification Type',  group: 'business',  colLetter: 'AO' },
  { key: 'identification_no', label: 'Identification No',    group: 'business',  colLetter: 'AP' },
];

const COLUMN_GROUPS = {
  personal: { label: 'Personal Info',  color: '#3B82F6' },
  company:  { label: 'Company Info',   color: '#22C55E' },
  location: { label: 'Location',       color: '#EAB308' },
  billing:  { label: 'Billing',        color: '#F97316' },
  shipping: { label: 'Shipping',       color: '#A855F7' },
  online:   { label: 'Online',         color: '#06B6D4' },
  business: { label: 'Business',       color: '#6B7280' },
};

// ─── Header label → key (new 42-col format) ──────────────────
const NEW_HEADER_MAP = {};
COLUMNS.forEach((col) => {
  NEW_HEADER_MAP[col.label] = col.key;
});

// ─── Old header → key mapping (legacy Bukku/CRM sheets) ──────
// PRIMARY fields: always written
// FALLBACK fields (fallback: true): only written if target field is still empty
const OLD_HEADER_MAP = {
  '$':                     { field: 'id_asal', meta: true },
  'Legal Name (1) *':      { splitTo: ['firstname', 'lastname'] },
  'Contact No. (14)':      { field: 'contact_phone' },
  'Street +':              { field: 'address' },
  'City':                  { field: 'city' },
  'State (17)':            { field: 'state' },
  'Postcode':              { field: 'zip' },
  'Tags (21)':             { field: 'tags', meta: true },
  'Myinvois Action (22)':  { field: 'myinvois_action', meta: true },
  'Status':                { field: 'client_type' },
  'Last_Updated':          { field: 'last_updated', meta: true },
  'Poskod':                { field: 'zip',     fallback: true },
  'Alamat':                { field: 'address', fallback: true },
  'Negeri':                { field: 'state',   fallback: true },
  'Name (Company Name)':   { field: 'company_name' },
  'Name (Company)':        { field: 'company_name' },
};

// Headers unique to old format (for auto-detection)
const OLD_ONLY_MARKERS = [
  '$', 'Legal Name (1) *', 'Contact No. (14)', 'Street +',
  'State (17)', 'Tags (21)', 'Myinvois Action (22)',
];

// All 42 column labels for Google Sheets header row
const ALL_HEADERS = COLUMNS.map((c) => c.label);

// ─── Smart Mapping Rules (old format → duplicate to related) ─
// Key = source field, Value = fields to copy into if empty
const SMART_COPY_RULES = {
  contact_phone: ['phonenumber'],
  phonenumber:   ['contact_phone'],
  city:          ['billing_city', 'shipping_city'],
  state:         ['billing_state', 'shipping_state'],
  zip:           ['billing_zip', 'shipping_zip'],
  country:       ['billing_country', 'shipping_country'],
  address:       ['billing_street', 'shipping_street'],
  email:         ['email_address'],
};

// ─── Default values for old-format sheets ─────────────────────
// Applied after mapping when sheet is old format
const OLD_FORMAT_DEFAULTS = {
  country: 'Malaysia',
};

// ─── Detect sheet format ─────────────────────────────────────
function isOldFormat(sheetHeaders) {
  const headerSet = new Set(sheetHeaders.map((h) => (h || '').trim()));
  return OLD_ONLY_MARKERS.some((marker) => headerSet.has(marker));
}

// ─── Build header map from actual sheet headers ──────────────
function buildHeaderMap(sheetHeaders) {
  const useOld = isOldFormat(sheetHeaders);
  const map = {};

  for (const header of sheetHeaders) {
    const trimmed = (header || '').trim();
    if (!trimmed) continue;

    // Old-format sheet: check OLD_HEADER_MAP
    if (useOld && OLD_HEADER_MAP[trimmed]) {
      map[trimmed] = OLD_HEADER_MAP[trimmed];
      continue;
    }

    // New-format: exact match against COLUMNS labels
    if (NEW_HEADER_MAP[trimmed]) {
      map[trimmed] = { field: NEW_HEADER_MAP[trimmed] };
      continue;
    }

    // Case-insensitive match
    const lowerTrimmed = trimmed.toLowerCase();
    const newMatch = Object.entries(NEW_HEADER_MAP).find(
      ([label]) => label.toLowerCase() === lowerTrimmed
    );
    if (newMatch) {
      map[trimmed] = { field: newMatch[1] };
      continue;
    }

    // Fallback: check OLD_HEADER_MAP for aliases
    if (OLD_HEADER_MAP[trimmed]) {
      map[trimmed] = OLD_HEADER_MAP[trimmed];
      continue;
    }

    // Unknown — metadata
    map[trimmed] = { field: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_'), meta: true };
  }
  return map;
}

module.exports = {
  COLUMNS,
  COLUMN_GROUPS,
  NEW_HEADER_MAP,
  OLD_HEADER_MAP,
  ALL_HEADERS,
  SMART_COPY_RULES,
  OLD_FORMAT_DEFAULTS,
  buildHeaderMap,
  isOldFormat,
};
