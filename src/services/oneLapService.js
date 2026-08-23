import { BASE_URL } from './apiService';

// Backend proxy base — all REST calls go through our own server to avoid CORS
// and to keep the OneLap admin credentials server-side only.
const BUS_API = `${BASE_URL}/bus`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function busGet(path) {
  const res = await fetch(`${BUS_API}${path}`);
  if (!res.ok) throw new Error(`Bus API ${path} failed: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Bus API error');
  return json.data;
}

// ─── Get live GPS position for one bus ────────────────────────────────────
export async function getBusPosition(deviceId) {
  try {
    return await busGet(`/position/${deviceId}`);
  } catch {
    return null;
  }
}
