/**
 * Generates JMD School Desk app icons as PNG files.
 * Run: node scripts/generateIcons.js
 */
const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');

// ─── JMD icon SVG ────────────────────────────────────────────────────────────
// Red background, white JMD letters, "School Desk" sub-text
// ViewBox 1024x1024 — matches required icon size directly

function makeIconSvg({ bg = '#CC0000', fg = '#FFFFFF', showText = true } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">

  <!-- Background -->
  <rect width="1024" height="1024" rx="180" ry="180" fill="${bg}"/>

  <!-- White rounded inner frame -->
  <rect x="60" y="60" width="904" height="904" rx="140" ry="140" fill="${bg}"/>

  <!-- JMD letters  (scaled from viewBox 0 0 295 100 → fit ~820x278 centred) -->
  <!-- Scale factor: 820/295 = 2.78, centred at x=102, y=280 -->
  <g transform="translate(102, 270) scale(2.78)">

    <!-- J -->
    <path fill="${fg}" d="
      M 20,0 L 63,0 L 63,66
      C 63,85 49,98 31,96
      C 13,94 1,80 3,65
      L 17,62
      C 15,73 23,83 33,82
      C 44,81 48,73 48,66
      L 48,16 Z
    "/>

    <!-- M — left pillar -->
    <rect fill="${fg}" x="83"  y="0" width="18" height="100"/>
    <!-- M — right pillar -->
    <rect fill="${fg}" x="173" y="0" width="18" height="100"/>
    <!-- M — top bridge left half -->
    <rect fill="${fg}" x="101" y="0" width="26" height="30"/>
    <!-- M — top bridge right half -->
    <rect fill="${fg}" x="145" y="0" width="28" height="30"/>

    <!-- D — left bar -->
    <rect fill="${fg}" x="211" y="0" width="18" height="100"/>
    <!-- D — right arc -->
    <path fill="${fg}" d="
      M 229,0
      C 297,0 297,100 229,100
      L 229,84
      C 273,84 273,16 229,16 Z
    "/>
  </g>

  <!-- "School Desk" label -->
  ${showText ? `
  <text
    x="512" y="730"
    font-family="Arial, Helvetica, sans-serif"
    font-size="72"
    font-weight="700"
    fill="${fg}"
    text-anchor="middle"
    letter-spacing="6"
  >SCHOOL DESK</text>
  <text
    x="512" y="820"
    font-family="Arial, Helvetica, sans-serif"
    font-size="42"
    font-weight="400"
    fill="${fg}"
    opacity="0.85"
    text-anchor="middle"
    letter-spacing="3"
  >Bengaluru</text>
  ` : ''}
</svg>`;
}

// Monochrome (single colour, no background) for Android adaptive monochrome
function makeMonochromeSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(102, 340) scale(2.78)">
    <path fill="#FFFFFF" d="M 20,0 L 63,0 L 63,66 C 63,85 49,98 31,96 C 13,94 1,80 3,65 L 17,62 C 15,73 23,83 33,82 C 44,81 48,73 48,66 L 48,16 Z"/>
    <rect fill="#FFFFFF" x="83"  y="0" width="18" height="100"/>
    <rect fill="#FFFFFF" x="173" y="0" width="18" height="100"/>
    <rect fill="#FFFFFF" x="101" y="0" width="26" height="30"/>
    <rect fill="#FFFFFF" x="145" y="0" width="28" height="30"/>
    <rect fill="#FFFFFF" x="211" y="0" width="18" height="100"/>
    <path fill="#FFFFFF" d="M 229,0 C 297,0 297,100 229,100 L 229,84 C 273,84 273,16 229,16 Z"/>
  </g>
</svg>`;
}

async function generate(filename, svgContent, width, height) {
  const outPath = path.join(ASSETS, filename);
  try {
    await sharp(Buffer.from(svgContent))
      .resize(width, height)
      .png()
      .toFile(outPath);
    console.log(`✅  ${filename}  (${width}×${height})`);
  } catch (e) {
    console.error(`❌  ${filename}: ${e.message}`);
  }
}

async function main() {
  console.log('\n🎨  Generating JMD School Desk icons…\n');

  // Main app icon — 1024×1024, red bg + white JMD
  await generate('icon.png',                    makeIconSvg(),                         1024, 1024);

  // Android adaptive background — solid red
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#CC0000"/></svg>`;
  await generate('android-icon-background.png', bgSvg,                                 1024, 1024);

  // Android adaptive foreground — white JMD on transparent
  await generate('android-icon-foreground.png', makeIconSvg({ bg: 'transparent', fg: '#FFFFFF', showText: false }), 1024, 1024);

  // Android monochrome — white JMD on transparent
  await generate('android-icon-monochrome.png', makeMonochromeSvg(),                   1024, 1024);

  // Splash icon — larger JMD centred, no sub-text
  await generate('splash-icon.png',             makeIconSvg({ showText: false }),      1024, 1024);

  // Favicon — small, just JMD letters
  await generate('favicon.png',                 makeIconSvg({ showText: false }),        48,   48);

  console.log('\n✨  Done! Restart Expo to pick up new icons.\n');
}

main();
