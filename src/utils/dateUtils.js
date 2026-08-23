// ─── Indian Standard Time (IST) Utilities ───────────────────────────────────
// IST = UTC + 5 hours 30 minutes (no daylight saving in India)

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 330 minutes in ms

/**
 * Returns a Date shifted so its UTC-getters (getUTCHours, getUTCDate, ...)
 * report the correct IST wall-clock fields, regardless of the device's own
 * timezone. Never read this with the LOCAL getters (getHours, getDate, ...)
 * — those additionally apply the device's own offset on top of this shift,
 * which only cancels out correctly on a device set to exactly UTC+0 and can
 * be off by several hours (even landing on the wrong calendar day) on a
 * device actually set to IST, which is the common case for this app's users.
 */
export function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Returns full ISO string with +05:30 suffix for API calls */
export function isoIST(date = new Date()) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().replace('Z', '+05:30');
}

/** Returns ISO string N hours from now in IST */
export function isoISTAfterHours(h) {
  const future = new Date(Date.now() + h * 60 * 60 * 1000);
  return isoIST(future);
}

// These three pass an explicit IANA timeZone to the Intl formatter, which
// already converts the true UTC instant to Asia/Kolkata correctly on its
// own — they take a plain `new Date()`, NOT nowIST()'s pre-shifted value
// (stacking both would double-apply the IST offset).

/** "23 May 2026" */
export function formatDateLong(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/** "Mon, 23 May" */
export function formatDateShort(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/** "10:45 AM" */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/** Returns greeting based on IST hour */
export function getGreeting() {
  const hour = nowIST().getUTCHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

/** Academic year string: "2025-26" or "2026-27" based on IST date
 *  Indian academic year starts in June */
export function getAcademicYear() {
  const now = nowIST();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  if (month >= 6) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}
