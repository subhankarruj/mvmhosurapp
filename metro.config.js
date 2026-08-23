const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// On Windows + OneDrive, Metro's readlink() call fails with EINVAL on files
// inside android/ios native source directories (cloud-synced placeholder files
// appear as non-resolvable symlinks). These directories are not needed for
// web bundling, so exclude them from Metro's file map entirely.
config.resolver.blockList = [
  /node_modules[\/\\].*[\/\\]android[\/\\]/,
  /node_modules[\/\\].*[\/\\]ios[\/\\]/,
];

module.exports = config;
