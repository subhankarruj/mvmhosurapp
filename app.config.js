// Dynamic config (replaces app.json) so the Android cleartext-traffic
// exception can be scoped to genuine local development only — see AGENTS.md
// for the SDK 56 docs this targets. EAS sets EAS_BUILD_PROFILE to the exact
// profile name ('preview' or 'production') for every `eas build`; it's unset
// for local `expo start` / `expo run:android`.
//
//   - local dev        → apiUrlLocal (LAN, http) is what's actually used,
//                         see BASE_URL in apiService.js — cleartext enabled,
//                         since this build never leaves your machine.
//   - preview build     → backend is now behind HTTPS (api.mvmhosurrfid.in,
//                         Let's Encrypt via IIS), same as production — see
//                         `apiUrl` below. No cleartext exception needed or
//                         permitted; this APK goes onto real testers' phones.
//   - production build  → apiUrl stays HTTPS-only, cleartext stays
//                         disabled. Never point this profile at a plain-HTTP
//                         backend.
const IS_EAS_BUILD = !!process.env.EAS_BUILD_PROFILE;

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
      ...(IS_EAS_BUILD ? [] : ['./plugins/withCleartextTraffic']),
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
          // Only requestForegroundPermissionsAsync() is ever called in code
          // (see locationService.js) — no background/"always" location is
          // actually requested, so only the when-in-use description is set.
          // Setting an unused "Always" description here previously implied
          // background tracking that doesn't exist, which is exactly the
          // kind of code/behavior mismatch Play Store review flags.
          locationWhenInUsePermission: 'MVM needs your location to alert you when the school bus is approaching your stop.',
        },
      ],
      'expo-asset',
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.mvm.hosur',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'MVM needs your location to alert you when the school bus is approaching your stop.',
      },
    },
    android: {
      package: 'com.mvm.hosur',
      usesCleartextTraffic: !IS_EAS_BUILD,
      // RECEIVE_BOOT_COMPLETED removed — nothing in this app reschedules
      // local alarms/notifications on boot (push delivery is server-side via
      // Expo's own push service), so it was an unused, unjustifiable
      // permission that Play Store review scrutinizes.
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'VIBRATE',
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
      // CARTO retired anonymous access to its Voyager raster basemap tiles
      // (basemaps.cartocdn.com) — unauthenticated requests now get served an
      // "API KEY REQUIRED" watermark instead of the real map, which is what
      // BusTrackScreen was showing. A key is free (5M tile requests/month,
      // fair-use) and not a backend secret — it's a client-side, rate-limited
      // identifier meant to ship in the app bundle, same as a Google Maps
      // client key. Get one at https://carto.com/basemaps/apikey/ and paste
      // it here; see CARTO_API_KEY in BusTrackScreen.js for where it's used.
      cartoApiKey: 'cb1_2h2s_1_7713a38a56cd244279948f4b',
    },
  },
};
