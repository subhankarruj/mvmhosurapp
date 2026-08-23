import { Dimensions, PixelRatio } from 'react-native';

let { width: W, height: H } = Dimensions.get('window');

// Base design dimensions — iPhone 14 / standard 390×844
const BASE_W = 390;

// Keep W/H in sync with the live window size — covers rotation (if ever
// enabled), foldables, split-screen/multi-window on Android/tablets, and
// browser window resizing on web. Since W/H are module-level `let`s and the
// exported helpers below close over them, every consumer automatically picks
// up the latest values on its next render/call.
Dimensions.addEventListener('change', ({ window }) => {
  W = window.width;
  H = window.height;
  SCREEN.W = W;
  SCREEN.H = H;
});

// Linear scale on screen width — use for fixed-size components (icons, inputs, buttons)
export const s = (n) => Math.round((W / BASE_W) * n);

// Moderate scale — 50% blend between linear and original.
// Less aggressive than s(); good for padding, margin, border-radius.
export const ms = (n, factor = 0.5) => {
  const scaled = (W / BASE_W) * n;
  return Math.round(n + (scaled - n) * factor);
};

// Font scale — conservative (40% factor) so text stays readable at every size.
// Uses PixelRatio to snap to device pixel grid.
export const fs = (n) =>
  PixelRatio.roundToNearestPixel(n + ((W / BASE_W) * n - n) * 0.4);

// Width / height percentage helpers
export const wp = (p) => Math.round((p / 100) * W);
export const hp = (p) => Math.round((p / 100) * H);

// Raw screen dimensions — use when you need conditional logic.
// Mutated in place (not reassigned) so existing references stay live.
export const SCREEN = { W, H };
