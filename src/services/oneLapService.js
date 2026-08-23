import { BASE_URL } from './apiService';
import { ONELAP_CONFIG } from '../config/appConfig';

// Backend proxy base — all REST calls go through our own server to avoid CORS
// and to keep the OneLap admin credentials server-side only.
const BUS_API = `${BASE_URL}/bus`;
const { BASE_URL: ONELAP_BASE } = ONELAP_CONFIG;

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function busGet(path) {
  const res = await fetch(`${BUS_API}${path}`);
  if (!res.ok) throw new Error(`Bus API ${path} failed: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Bus API error');
  return json.data;
}

// ─── 1. List all devices registered to the OneLap admin account ─────────────
export async function getDevices() {
  return busGet('/devices');
}

// ─── 2. Get latest positions for ALL devices ────────────────────────────────
export async function getAllPositions() {
  return busGet('/positions');
}

// ─── 3. Get live GPS position for one bus ────────────────────────────────────
export async function getBusPosition(deviceId) {
  try {
    return await busGet(`/position/${deviceId}`);
  } catch {
    return null;
  }
}

// ─── 4. Get public live-tracking URL (backend handles OneLap auth + caching) ─
export async function getPublicBusTrackingUrl(deviceId) {
  const { url } = await busGet(`/tracking-url/${deviceId}`);
  return url;
}

// ─── Legacy OTP / user registration (direct to OneLap, mobile only) ──────────
export async function requestOTP(phoneNumber) {
  const res = await fetch(`${ONELAP_BASE}/tokens/v2?phoneNumber=${phoneNumber}`);
  if (!res.ok) throw new Error(`OTP request failed: ${res.status}`);
  return res.json();
}

export async function verifyOTP(otpId, otpValue) {
  const res = await fetch(`${ONELAP_BASE}/tokens/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: String(otpValue), id: otpId }),
  });
  if (!res.ok) throw new Error(`OTP verification failed: ${res.status}`);
  return true;
}

export async function registerUser({ phoneNumber, name, password, otpId, otpValue }) {
  const res = await fetch(`${ONELAP_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: phoneNumber,
      name,
      password,
      attributes: { key_otp_id: otpId, key_otp_value: String(otpValue) },
    }),
  });
  if (!res.ok) throw new Error(`User registration failed: ${res.status}`);
  return res.json();
}
