// ─── School Configuration ─────────────────────────────────────────────────────
// Single source of truth for school identity used across screens
export const SCHOOL_CONFIG = {
  name:      'Maharishi Vidya Mandir',
  location:  'Hosur, Tamil Nadu',
  latitude:  12.770336,
  longitude: 77.801109,
};

// ─── OneLap API Configuration ───────────────────────────────────────────────
// No admin credentials here by design — OneLap admin auth happens only on the
// backend (see JMDSchoolDesk-Backend/src/services/oneLapService.js). Anything
// under EXPO_PUBLIC_* gets baked into the shipped client bundle, so the OneLap
// account password must never be read from env here.
export const ONELAP_CONFIG = {
  BASE_URL: 'https://web.onelap.in/api',
  TRACKING_BASE_URL: 'https://r.onelap.in/#/shared',

  // Fallback device ID — Bus No. 01, confirmed ONLINE with live GPS
  DEFAULT_DEVICE_ID: 97912,

  // Default tracking permission duration (hours)
  TRACKING_DURATION_HOURS: 12,
};
