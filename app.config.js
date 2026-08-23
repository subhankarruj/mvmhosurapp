// Dynamic config (replaces app.json) so the Android cleartext-traffic
// exception can be scoped to non-production builds only — see AGENTS.md for
// the SDK 56 docs this targets. EAS sets EAS_BUILD_PROFILE to the exact
// profile name ('preview' or 'production') for every `eas build`; it's unset
// for local `expo start`.
//
//   - local dev        → apiUrlLocal (LAN, http) is what's actually used,
//                         see BASE_URL in apiService.js — cleartext enabled.
//   - preview build     → the backend at 3.108.191.155 isn't behind HTTPS on
//                         this port yet, so this profile points apiUrl at
//                         the plain-HTTP endpoint too, with the same
//                         cleartext exception as local dev. TEMPORARY, for
//                         internal device testing only — see the note by
//                         `apiUrl` below before using this profile for
//                         anything wider.
//   - production build  → apiUrl stays HTTPS-only, cleartext stays
//                         disabled. Never point this profile at a plain-HTTP
//                         backend.
const IS_PRODUCTION_BUILD = process.env.EAS_BUILD_PROFILE === 'production';

module.exports = {
  expo: {
    name: 'MVM',
    slug: 'jmd',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      backgroundColor: '#F5F5F5',
      resizeMode: 'contain',
    },
    plugins: [
      ...(IS_PRODUCTION_BUILD ? [] : ['./plugins/withCleartextTraffic']),
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#5F9EA0',
          sounds: [],
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'MVM needs your location to alert you when the school bus is approaching your stop.',
          locationWhenInUsePermission: 'MVM needs your location to alert you when the school bus is approaching your stop.',
        },
      ],
      'expo-asset',
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.jmd.schooldesk',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'MVM needs your location to alert you when the school bus is approaching your stop.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'MVM needs your location to alert you when the school bus is approaching your stop.',
      },
    },
    android: {
      package: 'com.jmd.schooldesk',
      usesCleartextTraffic: !IS_PRODUCTION_BUILD,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: '#F5F5F5',
      },
      statusBar: {
        backgroundColor: '#F5F5F5',
        barStyle: 'dark-content',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    description: 'MVM - Parent Student Teacher Portal',
    runtimeVersion: {
      policy: 'appVersion',
    },
    owner: 'subhankarjmds-team',
    extra: {
      eas: {
        projectId: '092cc53b-67a0-4d2e-a9c9-94378ecfcfaf',
      },
      // Runtime API config — read via expo-constants in apiService.js instead
      // of hardcoding endpoints in source. Backend runs behind IIS with a
      // real Let's Encrypt certificate (auto-renewing), so both preview and
      // production builds use HTTPS. apiUrlLocal (LAN dev server, :5000 —
      // the Node process's own directly-bound local port) stays plain HTTP
      // for local dev only.
      apiUrl: 'https://api.mvmhosurrfid.in/api',
      apiUrlLocal: 'http://192.168.1.137:5000/api',
    },
  },
};
