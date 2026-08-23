import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ERR_SESSION_EXPIRED } from '../constants/errors';

// ─── Environment Config ───────────────────────────────────────────────────────
// Endpoints live in app.config.js `extra` (runtime config), not hardcoded
// here — see apiUrl/apiUrlLocal there.
const LOCAL_URL = Constants.expoConfig?.extra?.apiUrlLocal; // local PC (same WiFi)
const PROD_URL  = Constants.expoConfig?.extra?.apiUrl;      // AWS EC2 production

// FORCE_PRODUCTION = true  → always use AWS (even during expo start)
// FORCE_PRODUCTION = false → use AWS in production builds, local in dev
const FORCE_PRODUCTION = false;

export const BASE_URL = (FORCE_PRODUCTION || !__DEV__) ? PROD_URL : LOCAL_URL;

// ─── Token storage keys ───────────────────────────────────────────────────────
const KEY_ACCESS  = '@jmd_access_token';
const KEY_REFRESH = '@jmd_refresh_token';
const KEY_USER    = '@jmd_user';

// ─── Token helpers ────────────────────────────────────────────────────────────
export async function saveTokens(accessToken, refreshToken) {
  await AsyncStorage.multiSet([
    [KEY_ACCESS,  accessToken],
    [KEY_REFRESH, refreshToken],
  ]);
}

export async function getAccessToken()  { return AsyncStorage.getItem(KEY_ACCESS); }
export async function getRefreshToken() { return AsyncStorage.getItem(KEY_REFRESH); }

export async function saveUser(user) {
  await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
}
export async function getUser() {
  const raw = await AsyncStorage.getItem(KEY_USER);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession() {
  await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_USER]);
}

// ─── Timeout fetch (AbortController — works in all RN/Hermes versions) ────────
function fetchWithTimeout(url, options, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
function extractError(data) {
  if (data && data.errors && data.errors[0]?.message) return data.errors[0].message;
  return (data && data.message) || 'Request failed';
}

// Single place that turns fetch's network/abort failures into friendly,
// throwable messages — used for both the initial call and the post-refresh
// retry so neither can surface a raw AbortError.
async function doFetch(url, opts) {
  try {
    return await fetchWithTimeout(url, opts);
  } catch (err) {
    // Not __DEV__-gated on purpose — a standalone release APK has __DEV__
    // false, and that's exactly where this is hardest to diagnose without
    // a debugger attached. Visible via `adb logcat *:S ReactNativeJS:V`.
    // Distinguishes the app's own 15s AbortController firing from every
    // other failure (DNS, connection refused, connection timed out/dropped
    // by a firewall, TLS error, etc.) — those all show up as different
    // err.name/err.message values from React Native's fetch, but the
    // user-facing message stays generic on purpose (no raw network jargon).
    console.warn(`[apiService] fetch failed: ${url}\n  name: ${err.name}\n  message: ${err.message}\n  stack: ${err.stack}`);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw new Error('Cannot connect to server. Please check your internet connection and try again.');
  }
}

async function request(endpoint, options = {}) {
  const accessToken = await getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

  let response = await doFetch(BASE_URL + endpoint, { ...options, headers, body: bodyStr });

  // Auto-refresh on 401, then retry the original request once.
  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      await clearSession();
      throw new Error(ERR_SESSION_EXPIRED);
    }
    const newToken = await getAccessToken();
    response = await doFetch(BASE_URL + endpoint, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
      body: bodyStr,
    });
    // A fresh token still rejected → the session is genuinely gone. Bounce to
    // login rather than trying to parse an auth-error body as a real result.
    if (response.status === 401) {
      await clearSession();
      throw new Error(ERR_SESSION_EXPIRED);
    }
  }

  const data = await safeJson(response);
  if (!data.success) throw new Error(extractError(data));
  return data;
}

// Parse a response body as JSON without ever letting a non-JSON body surface
// as a raw "Unexpected token" crash. This is the fix for the mark-read bug:
// while the API restarts (pm2/nginx), a 401/502 can come back as an HTML error
// page or empty body, and calling .json() on that throws a parser error the
// UI then showed verbatim. We read the body as text, gate on response.ok +
// content-type, and only JSON.parse when it's actually JSON.
async function safeJson(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');

  // Empty body: trust the status line instead of parsing nothing.
  if (!text) {
    if (response.ok) return { success: true };
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  // Non-JSON body (HTML 502 from nginx, proxy/plain-text error): never parse it.
  if (!isJson) {
    throw new Error(`Server error (${response.status}). Please try again.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server error (${response.status}). Please try again.`);
  }
}

let _refreshPromise = null;

async function tryRefresh() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function _doRefresh() {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    // Only a JSON 2xx counts as a successful refresh. A non-JSON body (e.g. an
    // HTML 502 while the API restarts) or a 401 must be treated as "refresh
    // failed" — never JSON.parsed — so it can't throw an Unexpected-token error.
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (!res.ok || !isJson) return false;

    const data = await res.json();
    if (data.success) {
      await saveTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  async login(identifier, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    await saveTokens(data.data.accessToken, data.data.refreshToken);
    await saveUser(data.data.user);
    return data.data;
  },

  async register(name, phone, password, busStop, attendanceEnabled, busTrackingEnabled) {
    return request('/auth/register', {
      method: 'POST',
      body: {
        name, phone, password, bus_stop: busStop,
        attendance_enabled: attendanceEnabled,
        bus_tracking_enabled: busTrackingEnabled,
      },
    });
  },

  async me() {
    const data = await request('/auth/me');
    return data.data;
  },

  async logout() {
    const refreshToken = await getRefreshToken();
    await request('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }).catch(() => {});
    await clearSession();
  },

  async savePushToken(token) {
    // Errors propagate to the caller — LoginScreen/RegisterScreen decide
    // whether to swallow them (currently: best-effort, fire-and-forget).
    return request('/auth/push-token', {
      method: 'POST',
      body: { token },
    });
  },

  // POST, not PATCH — this Android build's networking stack silently drops
  // PATCH requests before they ever leave the device (confirmed via server
  // logs: zero trace of the request server-side, while GET/POST/DELETE all
  // reach Node fine through the same path).
  async updateProfile(name, busStop) {
    const data = await request('/auth/profile', {
      method: 'POST',
      body: { name, busStop },
    });
    return data.data;
  },

  // Accepts a partial patch, e.g. { notify_attendance: true } or
  // { notify_bus: false } — each type toggles independently server-side.
  async updateNotificationSettings(patch) {
    const data = await request('/auth/notification-settings', {
      method: 'POST',
      body: patch,
    });
    return data.data;
  },
};

// ─── Bus API ──────────────────────────────────────────────────────────────────
async function publicBusGet(path) {
  let res;
  try {
    res = await fetchWithTimeout(`${BASE_URL}${path}`);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw new Error('Cannot connect to server. Please check your internet connection and try again.');
  }
  const json = await safeJson(res);
  if (!json.success) throw new Error(json.message || 'Bus API error');
  return json.data;
}

export const busAPI = {
  async getBusList() {
    return publicBusGet('/bus/list');
  },

  async getInfo(deviceId) {
    try {
      return await publicBusGet(`/bus/info/${deviceId}`);
    } catch {
      return null;
    }
  },

  async getStops(deviceId) {
    try {
      return await publicBusGet(`/bus/stops/${deviceId}`);
    } catch {
      return [];
    }
  },

  async getTrackingUrl(deviceId) {
    const d = await publicBusGet(`/bus/tracking-url/${deviceId}`);
    return d.url;
  },

  async getPosition(deviceId) {
    try {
      return await publicBusGet(`/bus/position/${deviceId}`);
    } catch {
      return null;
    }
  },

  async getAssigned() {
    const data = await request('/bus/assigned');
    return data.data;
  },

  async getDefaultBus() {
    try {
      const data = await request('/bus/default');
      return data.data;
    } catch {
      return null;
    }
  },

  // POST, not PATCH — see note on updateProfile above.
  async setDefaultBus(onelapDeviceId) {
    return request('/bus/default', {
      method: 'POST',
      body: { onelap_device_id: onelapDeviceId },
    }).catch(() => {}); // best-effort — the local AsyncStorage cache still works if this fails
  },
};

// ─── Attendance API ───────────────────────────────────────────────────────────
// Read-only — computed by SmartOffice (AttendanceLogs). Always scoped to the
// logged-in user (one jmd_app_users row = one student), no studentId needed.
const ATT_STATUS_LABEL = { present: 'present', absent: 'absent', weekly_off: 'holiday' };

function mapAttendanceResult(result) {
  const records = (result.records || []).map(r => ({
    ...r,
    status: ATT_STATUS_LABEL[r.status] || r.status,
  }));
  const s = result.summary || {};
  const summary = {
    present: s.present || 0,
    absent:  s.absent  || 0,
    holiday: s.weekly_off || 0,
    leave:   0,
    total:   s.total || 0,
    attendancePercentage: s.attendancePercentage || 0,
  };
  return { ...result, records, summary };
}

export const attendanceAPI = {
  async getMonthly(year, month) {
    const data = await request(`/attendance/me?year=${year}&month=${month}`);
    return mapAttendanceResult(data.data);
  },

  async getRange(from, to) {
    const data = await request(`/attendance/me/range?from=${from}&to=${to}`);
    return (data.data || []).map(r => ({ ...r, status: ATT_STATUS_LABEL[r.status] || r.status }));
  },

  async getToday() {
    const data = await request('/attendance/me/today');
    if (!data.data) return null;
    return { ...data.data, status: ATT_STATUS_LABEL[data.data.status] || data.data.status };
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationsAPI = {
  async getAll() {
    // Errors (including ERR_SESSION_EXPIRED) propagate to the caller —
    // NotificationContext's load() catches them to detect a dead session.
    const data = await request('/notifications');
    return data.data || [];
  },

  // Returns { ok, error } — callers need `ok` to know whether it's safe to
  // keep their optimistic local update or whether they have to revert it
  // (see NotificationScreen.js), and `error` so a failure can be shown to
  // the user (and to us, when debugging) instead of a canned message that
  // hides whether this was a timeout, a network failure, or a real server
  // error — those all look identical from the UI otherwise.
  async markRead(id) {
    try {
      await request(`/notifications/${id}/read`, { method: 'POST' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async markAllRead() {
    try {
      await request('/notifications/read-all', { method: 'POST' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async deleteRead() {
    try {
      await request('/notifications/read', { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  },
};
