# MVM — React Native App

A mobile school app built with **React Native (Expo)** for students of **Maharishi Vidya Mandir, Hosur**. Provides JWT-authenticated login, read-only attendance (computed by the school's SmartOffice system), live bus tracking (via OneLap GPS on an interactive map), and push/in-app notifications.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Screens](#screens)
- [API Integration](#api-integration)
- [Security Notes](#security-notes)

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.85.3 | Core framework |
| Expo SDK | ~56.0.19 | Build & dev tooling |
| React Navigation | v7 | Stack + bottom-tab navigation |
| react-native-svg | 15.15.4 | Logo & icons |
| react-native-webview | ^13.16.1 | Live bus tracking map (MapLibre GL) |
| @react-native-async-storage/async-storage | 2.2.0 | User profile & cache persistence |
| expo-secure-store | ~56.0.4 | Encrypted auth token storage |
| expo-notifications | ~56.0.23 | Push notifications |
| expo-location | ~56.0.23 | User location for bus proximity |
| expo-linear-gradient | ~56.0.4 | UI gradients |

---

## Prerequisites

- **Node.js** v18 or higher → [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- **Expo Go** app on your Android/iOS device (for testing on a real device)
- **Android Studio** (for an emulator) or **Xcode** (iOS simulator, macOS only) — optional, real-device testing via Expo Go is usually simpler

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/subhankarruj/mvmhosurapp.git
cd mvmhosurapp

# 2. Install dependencies
npm install
```

---

## Configuration

### Backend API URL

The backend endpoint is **not** hardcoded in source — it's runtime config read via `expo-constants`, defined in `app.config.js`:

```js
extra: {
  apiUrl:      'https://api.mvmhosurrfid.in/api', // production/preview builds
  apiUrlLocal: 'http://192.168.1.137:5000/api',   // local dev only (same WiFi as your dev machine)
},
```

`src/services/apiService.js` reads `apiUrl` for production builds and `apiUrlLocal` for local `expo start` dev sessions (`FORCE_PRODUCTION` in that file can override this). Update `apiUrlLocal` to match your own machine's LAN IP if developing locally.

### OneLap Bus Tracking & School Location

`src/config/appConfig.js` holds the school's identity/location and the public OneLap API base — no credentials live here; OneLap admin authentication happens server-side only (see the backend's `oneLapService.js`):

```js
export const SCHOOL_CONFIG = {
  name: 'Maharishi Vidya Mandir',
  location: 'Hosur, Tamil Nadu',
  latitude: 12.770336,
  longitude: 77.801109,
};
```

### Local secrets file

`src/config/secrets.example.js` is a template — copy it to `src/config/secrets.js` (gitignored, never committed) if a screen you're working on needs it.

---

## Running the App

```bash
# Start the Expo development server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Run in a web browser
npm run web
```

After running `npm start`, scan the **QR code** with the **Expo Go** app on your phone to test on a real device (same WiFi network as your dev machine, matching `apiUrlLocal`).

---

## Building for Production

```bash
# Install EAS CLI (Expo Application Services)
npm install -g eas-cli

# Login to your Expo account
eas login

# Internal test build (.apk)
eas build --platform android --profile preview

# Play Store build (.aab)
eas build --platform android --profile production
```

Both build profiles are defined in `eas.json`. `production` uses `apiUrl` (HTTPS) with cleartext traffic disabled; `preview` also uses `apiUrl` now that the backend is on real HTTPS.

---

## Project Structure

```
mvmhosurapp/
├── src/
│   ├── screens/
│   │   ├── SplashScreen.js
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── HomeScreen.js
│   │   ├── AttendanceScreen.js
│   │   ├── BusTrackScreen.js
│   │   ├── NotificationScreen.js
│   │   ├── NotificationSettingsScreen.js
│   │   ├── ProfileScreen.js
│   │   └── ModuleScreen.js
│   ├── navigation/
│   │   ├── AppNavigator.js      # Root stack + bottom tab navigator
│   │   └── RootNavigation.js
│   ├── components/
│   │   ├── BackButton.js
│   │   ├── ErrorBoundary.js
│   │   ├── EyeIcon.js
│   │   ├── JMDLogo.js
│   │   ├── PhoneCallIcon.js
│   │   └── UpdateBanner.js
│   ├── context/
│   │   ├── UserContext.js           # Logged-in user state
│   │   └── NotificationContext.js   # Notification list, unread count, push handling
│   ├── services/
│   │   ├── apiService.js         # Backend REST calls (auth, attendance, bus, notifications)
│   │   ├── oneLapService.js      # Live bus GPS position (proxied through the backend)
│   │   ├── cacheService.js       # AsyncStorage TTL cache (attendance offline fallback)
│   │   ├── locationService.js    # Device location permission + GPS
│   │   └── notificationService.js # Push notification permission + Expo push token
│   ├── config/
│   │   ├── appConfig.js          # School identity/location + OneLap public config
│   │   └── secrets.example.js    # Template — copy to secrets.js (gitignored)
│   ├── constants/
│   │   ├── colors.js
│   │   └── errors.js
│   └── utils/
│       ├── dateUtils.js          # IST timezone helpers
│       ├── navigation.js         # Cross-navigator reset-to-Login helper
│       ├── responsive.js         # Screen-size scaling helpers
│       └── shadow.js             # Cross-platform shadow styles
├── plugins/
│   └── withCleartextTraffic.js   # Config plugin: allows plain HTTP for local dev only
├── App.js                        # Root component
├── app.config.js                 # Expo config (dynamic — reads EAS_BUILD_PROFILE)
├── eas.json                      # EAS build profiles (preview/production)
└── package.json
```

---

## Screens

1. **Splash** — animated logo, auto-navigates to Login after ~2.8s
2. **Login** — Indian mobile number (`+91`, 10 digits, starts 6–9) + password, JWT auth
3. **Register** — activates an account for a phone number already enrolled as a student in the school's SmartOffice system
4. **Home** — greeting (IST-aware), academic year, module tiles, notification bell with unread badge
5. **Attendance** — monthly calendar (present/absent/holiday), date-range view, offline cache fallback via `cacheService`
6. **Bus Track** — live GPS position on an interactive MapLibre map inside a WebView, route stops, proximity status, bus picker
7. **Notifications** — list with read/unread state, mark-read, mark-all-read, auto-clears old read items
8. **Notification Settings** — per-type push preference toggles (attendance / bus)
9. **Profile** — logged-in user's details, edit name/bus stop, change password, logout
10. **Module** — placeholder hub screen for future feature tiles

---

## API Integration

All requests go through `src/services/apiService.js`, which auto-refreshes an expired access token once and retries before giving up. Full endpoint list and request/response shapes are documented in the backend's own README (`JMDSchoolDesk-Backend`).

| Area | Functions |
|------|-----------|
| Auth | `authAPI.login`, `.register`, `.me`, `.logout`, `.savePushToken`, `.updateProfile`, `.updateNotificationSettings` |
| Attendance *(read-only)* | `attendanceAPI.getMonthly`, `.getRange`, `.getToday` |
| Bus | `busAPI.getBusList`, `.getInfo`, `.getStops`, `.getTrackingUrl`, `.getPosition`, `.getAssigned`, `.getDefaultBus`, `.setDefaultBus` |
| Notifications | `notificationsAPI.getAll`, `.markRead`, `.markAllRead`, `.deleteRead` |
| Live GPS | `oneLapService.getBusPosition` — proxied through the backend; no OneLap credentials ever ship in this app |

---

## Security Notes

- **Auth tokens** (access + refresh) are stored in `expo-secure-store` (OS keychain/Android Keystore, encrypted at rest) — never in plain AsyncStorage.
- **No OneLap credentials ship in this app** — GPS position is always fetched through the backend's own proxy endpoints.
- **`secrets.js` is gitignored** — never commit real credentials there.
- Bus stop names/times rendered inside the tracking map's WebView are HTML-escaped before injection, since they originate from the database.
- Cleartext (plain HTTP) traffic is only enabled for local development builds — both `preview` and `production` builds are HTTPS-only.

---

## Backend Repository

**https://github.com/subhankarruj/mvmappbackend**

---

*MVM — Maharishi Vidya Mandir, Hosur*
