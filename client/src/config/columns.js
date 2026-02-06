// ─── Frontend Column Config (mirrors server/config/columns.js) ──

export const COLUMNS = [
  { key: 'firstname',         label: 'Firstname',            group: 'personal' },
  { key: 'lastname',          label: 'Lastname',             group: 'personal' },
  { key: 'email',             label: 'Email',                group: 'personal' },
  { key: 'contact_phone',     label: 'Contact phonenumber',  group: 'personal' },
  { key: 'position',          label: 'Position',             group: 'company' },
  { key: 'company_name',      label: 'Name',                 group: 'company' },
  { key: 'vat',               label: 'Vat',                  group: 'company' },
  { key: 'phonenumber',       label: 'Phonenumber',          group: 'company' },
  { key: 'country',           label: 'Country',              group: 'location' },
  { key: 'city',              label: 'City',                 group: 'location' },
  { key: 'zip',               label: 'Zip',                  group: 'location' },
  { key: 'state',             label: 'State',                group: 'location' },
  { key: 'address',           label: 'Address',              group: 'location' },
  { key: 'website',           label: 'Website',              group: 'online' },
  { key: 'billing_street',    label: 'Billing street',       group: 'billing' },
  { key: 'billing_city',      label: 'Billing city',         group: 'billing' },
  { key: 'billing_state',     label: 'Billing state',        group: 'billing' },
  { key: 'billing_zip',       label: 'Billing zip',          group: 'billing' },
  { key: 'billing_country',   label: 'Billing country',      group: 'billing' },
  { key: 'shipping_street',   label: 'Shipping street',      group: 'shipping' },
  { key: 'shipping_city',     label: 'Shipping city',        group: 'shipping' },
  { key: 'shipping_state',    label: 'Shipping state',       group: 'shipping' },
  { key: 'shipping_zip',      label: 'Shipping zip',         group: 'shipping' },
  { key: 'shipping_country',  label: 'Shipping country',     group: 'shipping' },
  { key: 'longitude',         label: 'Longitude',            group: 'online' },
  { key: 'latitude',          label: 'Latitude',             group: 'online' },
  { key: 'stripe_id',         label: 'Stripe id',            group: 'business' },
  { key: 'affiliate_code',    label: 'Affiliate code',       group: 'business' },
  { key: 'loy_point',         label: 'Loy point',            group: 'business' },
  { key: 'woo_customer',      label: 'Woo customer id',      group: 'business' },
  { key: 'woo_channel',       label: 'Woo channel id',       group: 'business' },
  { key: 'client_type',       label: 'Client type',          group: 'business' },
  { key: 'balance',           label: 'Balance',              group: 'business' },
  { key: 'balance_as',        label: 'Balance as of',        group: 'business' },
  { key: 'auto_invoice',      label: 'Auto invoice',         group: 'business' },
  { key: 'email_address',     label: 'Email address',        group: 'business' },
  { key: 'is_non_individual', label: 'Is non individual',    group: 'business' },
  { key: 'bukku_id',          label: 'Bukku id',             group: 'business' },
  { key: 'birthday',          label: 'Birthday',             group: 'business' },
  { key: 'terms_conditions',  label: 'Terms & Conditions',   group: 'business' },
  { key: 'identification',    label: 'Identification Type',  group: 'business' },
  { key: 'identification_no', label: 'Identification No',    group: 'business' },
];

export const COLUMN_GROUPS = {
  personal: {
    label: 'Personal Info',
    color: '#3B82F6',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    headerBg: 'bg-blue-100/60',
  },
  company: {
    label: 'Company Info',
    color: '#22C55E',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    headerBg: 'bg-green-100/60',
  },
  location: {
    label: 'Location',
    color: '#EAB308',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    headerBg: 'bg-yellow-100/60',
  },
  billing: {
    label: 'Billing',
    color: '#F97316',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    headerBg: 'bg-orange-100/60',
  },
  shipping: {
    label: 'Shipping',
    color: '#A855F7',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    headerBg: 'bg-purple-100/60',
  },
  online: {
    label: 'Online',
    color: '#06B6D4',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    headerBg: 'bg-cyan-100/60',
  },
  business: {
    label: 'Business',
    color: '#6B7280',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    headerBg: 'bg-gray-200/60',
  },
};

export const NEGERI_LIST = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu',
  'WP Kuala Lumpur', 'WP Putrajaya', 'WP Labuan',
];

// ─── Input type per field ────────────────────────────────────
const FIELD_INPUT_TYPES = {
  email: 'email',
  email_address: 'email',
  website: 'url',
  birthday: 'date',
  longitude: 'number',
  latitude: 'number',
  balance: 'number',
  balance_as: 'number',
  loy_point: 'number',
  state: 'dropdown',
  billing_state: 'dropdown',
  shipping_state: 'dropdown',
  is_non_individual: 'checkbox',
  auto_invoice: 'checkbox',
};

export function getFieldInputType(key) {
  return FIELD_INPUT_TYPES[key] || 'text';
}

// ─── Get visible columns based on toggled groups ─────────────
export function getVisibleColumns(enabledGroups) {
  return COLUMNS.filter((col) => enabledGroups[col.group]);
}

// ─── Count columns per group ─────────────────────────────────
export function getGroupColumnCounts() {
  const counts = {};
  for (const key of Object.keys(COLUMN_GROUPS)) {
    counts[key] = COLUMNS.filter((c) => c.group === key).length;
  }
  return counts;
}

// ─── OLD header name → new key mapping (for Import detection) ─
export const OLD_HEADER_MAP = {
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
  'Alamat':                { field: 'address' },
  'Negeri':                { field: 'state' },
  'Poskod':                { field: 'zip' },
  'Name (Company Name)':   { field: 'company_name' },
  'Name (Company)':        { field: 'company_name' },
};

// NEW_HEADER_MAP: label → key
export const NEW_HEADER_MAP = {};
COLUMNS.forEach((col) => {
  NEW_HEADER_MAP[col.label] = col.key;
});

// ─── Detect which columns are present in sheet headers ───────
export function detectColumns(sheetHeaders) {
  const detected = new Set();

  for (const header of sheetHeaders) {
    const trimmed = (header || '').trim();
    if (!trimmed) continue;

    // Check old format FIRST (has splitTo enrichment)
    const oldMapping = OLD_HEADER_MAP[trimmed];
    if (oldMapping) {
      if (oldMapping.splitTo) {
        oldMapping.splitTo.forEach((k) => detected.add(k));
      } else if (!oldMapping.meta) {
        detected.add(oldMapping.field);
      }
      continue;
    }

    // Check new format
    if (NEW_HEADER_MAP[trimmed]) {
      detected.add(NEW_HEADER_MAP[trimmed]);
      continue;
    }

    // Case-insensitive check
    const lower = trimmed.toLowerCase();
    const match = Object.entries(NEW_HEADER_MAP).find(([l]) => l.toLowerCase() === lower);
    if (match) detected.add(match[1]);
  }

  return {
    detected: Array.from(detected),
    missing: COLUMNS.filter((c) => !detected.has(c.key)).map((c) => c.key),
    total: COLUMNS.length,
    detectedCount: detected.size,
  };
}
