import { Platform } from 'react-native';

function toRgba(hex, opacity) {
  const h = hex.replace('#', '').substring(0, 6);
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function platformShadow(color, offsetX, offsetY, blur, opacity, elevation = 0) {
  if (Platform.OS !== 'web') {
    return {
      shadowColor: color,
      shadowOffset: { width: offsetX, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
      elevation,
    };
  }
  const rgba = color.startsWith('#') ? toRgba(color, opacity) : `rgba(0,0,0,${opacity})`;
  return { boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${rgba}` };
}

export const SHADOWS = {
  xs:      platformShadow('#000000', 0, 1,  3,  0.04, 1),
  sm:      platformShadow('#000000', 0, 1,  4,  0.06, 2),
  md:      platformShadow('#000000', 0, 2,  6,  0.08, 3),
  card:    platformShadow('#000000', 0, -4, 16, 0.08, 8),
  logoBox: platformShadow('#000000', 0, 4,  8,  0.20, 8),
  splash:  platformShadow('#000000', 0, 8,  12, 0.30, 12),
  tabBar:  platformShadow('#000000', 0, -3, 8,  0.08, 0),
  icon:    platformShadow('#000000', 0, 4,  6,  0.30, 4),
};
