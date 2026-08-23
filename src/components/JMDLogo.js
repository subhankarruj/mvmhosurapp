import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function JMDLogo({ width = 200, color = '#2F6B3F' }) {
  const height = Math.round(width * (150 / 450));

  return (
    <Svg width={width} height={height} viewBox="0 0 450 150">

      {/* J */}
      <Path
        fill={color}
        d="M 75 15 L 105 15 L 105 80 C 105 125, 45 145, 5 125 C 35 120, 75 105, 75 60 Z"
      />

      {/* M — outer arch */}
      <Path
        fill={color}
        d="M 140 15 L 255 15 C 255 55, 265 100, 285 140 L 245 140 C 230 100, 225 50, 225 50 L 170 50 C 170 50, 165 100, 150 140 L 110 140 C 130 100, 140 55, 140 15 Z"
      />

      {/* M — inner centre pillar */}
      <Path
        fill={color}
        d="M 175 60 L 220 60 L 220 140 L 175 140 Z"
      />

      {/* D — outer shape with inner cutout via evenodd */}
      <Path
        fill={color}
        fillRule="evenodd"
        d="M 305 15 L 365 15 C 430 15, 440 40, 440 77.5 C 440 115, 430 140, 365 140 L 305 140 Z M 345 45 L 345 110 L 360 110 C 395 110, 395 45, 360 45 Z"
      />

    </Svg>
  );
}
