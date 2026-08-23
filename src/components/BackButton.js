import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { s } from '../utils/responsive';

export default function BackButton({ onPress, color = '#FFF' }) {
  const iconSize = s(20);
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.7}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 18l-6-6 6-6"
          stroke={color}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    // 44x44 meets Apple/Google's minimum recommended touch-target size,
    // and scales with s() so it stays proportionate on every screen size.
    width: s(44),
    height: s(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
