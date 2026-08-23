# JMD School Desk — React Native App

A mobile school management application built with **React Native (Expo)** for students, parents, and teachers of JMD School, Bengaluru. The app provides real-time bus tracking, attendance monitoring, and school notifications — all in one place.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Screens & Features](#screens--features)
- [API Integration](#api-integration)

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.85.3 | Core framework |
| Expo SDK | ~56.0.3 | Build & dev tooling |
| React Navigation | v7 | Screen navigation |
| react-native-svg | 15.15.4 | JMD logo & icons |
| react-native-webview | ^13.16.1 | Bus tracking map |
| AsyncStorage | 2.2.0 | Token & user persistence |
| expo-linear-gradient | ~56.0.4 | UI gradients |

---

## Prerequisites

Make sure the following are installed on your machine:

- **Node.js** v18 or higher → [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- **Expo CLI** → `npm install -g expo-cli`
- **Expo Go** app on your Android/iOS device (for testing on device)
- **Android Studio** (for Android emulator) or **Xcode** (for iOS simulator, macOS only)

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/Abhilasyadav/JMD-School-Desk.git
cd JMD-School-Desk

# 2. Install dependencies
npm install
```

---

## Configuration

### Backend API URL

Open `src/services/apiService.js` and update `BASE_URL` to point to your backend server:

```js
// For local development (same machine)
export const BASE_URL = 'http://localhost:5000/api';

// For real device testing (replace with your machine's local IP)
export const BASE_URL = 'http://192.168.1.x:5000/api';

// For production server
export const BASE_URL = 'http://117.222.159.25:5000/api';
```

### OneLap Bus Tracking

Open `src/config/appConfig.js` and fill in your OneLap credentials:

```js
export const ONELAP_CONFIG = {
  ADMIN_PHONE:    '9XXXXXXXXX',   // School's registered OneLap phone
  ADMIN_PASSWORD: 'your_password', // OneLap account password
  BUSES: [
    { id: 79348, name: 'Bus No. JMD-007', route: 'Route A - Sector 12' },
  ],
};
```

---

## Running the App

```bash
# Start the Expo development server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Run in web browser
npm run web
```

After running `npm start`, scan the **QR code** with the **Expo Go** app on your phone to test on a real device.

---

## Building for Production

```bash
# Install EAS CLI (Expo Application Services)
npm install -g eas-cli

# Login to your Expo account
eas login

# Build for Android (.apk / .aab)
eas build --platform android

# Build for iOS (.ipa)
eas build --platform ios

# Build for both platforms
eas build --platform all
```

---

## Project Structure

```
JMD-School-Desk/
├── src/
│   ├── screens/              # All app screens
│   │   ├── SplashScreen.js
│   │   ├── LoginScreen.js
│   │   ├── HomeScreen.js
│   │   ├── AttendanceScreen.js
│   │   ├── BusTrackScreen.js
│   │   ├── NotificationScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── ModuleScreen.js
│   │   ├── AnnouncementsScreen.js
│   │   ├── AssignmentsScreen.js
│   │   ├── ClassDiaryScreen.js
│   │   └── NewslettersScreen.js
│   ├── navigation/
│   │   └── AppNavigator.js   # Stack + bottom tab navigator
│   ├── components/
│   │   └── JMDLogo.js        # SVG-based JMD logo
│   ├── services/
│   │   ├── apiService.js     # Backend REST API calls (auth + attendance)
│   │   └── oneLapService.js  # OneLap bus tracking API
│   ├── config/
│   │   └── appConfig.js      # OneLap config & bus details
│   ├── constants/
│   │   └── colors.js         # App-wide color palette
│   └── utils/
│       └── dateUtils.js      # IST timezone helpers
├── App.js                    # Root component
├── app.json                  # Expo configuration
└── package.json
```

---

## Screens & Features

### 1. Splash Screen
- Animated JMD logo with fade + scale effect
- Auto-navigates to Login after **2.8 seconds**
- Red background with school branding

### 2. Login Screen
- **Mobile number input** with Indian flag 🇮🇳 and `+91` country code prefix
- Indian mobile number validation (10 digits, starts with 6–9)
- Password field with show/hide eye toggle (left side)
- Real-time inline field validation on blur
- Connects to backend JWT authentication

### 3. Home Screen
- Dynamic school name from logged-in user's profile
- IST-aware greeting: **Good Morning / Afternoon / Evening / Night**
- Auto-calculated Indian academic year (June–May cycle)
- Today's date with Bengaluru location label
- 2 module tiles: **Bus Track** and **Attendance**
- Notification bell 🔔 with unread count badge

### 4. Attendance Screen
- Monthly calendar view with colour-coded day circles:
  - 🟢 **Present** — Green
  - 🔴 **Absent** — Red
  - 🟣 **Holiday** — Purple
  - 🔵 **Leave** — Blue
- Previous / next month navigation
- 4 stat chips showing monthly counts
- Attendance percentage calculation
- Real API fetch from backend on month change
- Loading spinner and error banner
- IST-aware "today" highlight

### 5. Bus Track Screen
- **OneLap API** live GPS tracking integration
- WebView embedded map (tap to show / hide)
- Bus info card: bus number, route, driver name, contact, ETA
- Live / Inactive status indicator
- Route stop timeline (Completed → Current → Upcoming)
- Grant tracking access to parent's phone number
- 3-step OTP registration modal (Phone → OTP → Name/Password)
- Open tracking link in browser option
- Pull-to-refresh

### 6. Notification Screen
- Notification list with 4 types:
  - ✅ **Attendance** — Green
  - 🚌 **Bus** — Orange
  - 📢 **Announcement** — Red
  - 📋 **General** — Blue
- Unread badge count in header
- Red left border + bold title for unread items
- Tap to mark single notification as read
- **Mark all read** button
- Empty state illustration

### 7. Profile Screen *(placeholder — ready to build)*

### 8. Module Screen *(placeholder — ready to build)*

### 9–12. Announcements, Assignments, Class Diary, Newsletters *(placeholders)*

---

## API Integration

### Authentication (`src/services/apiService.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with mobile/email + password |
| POST | `/auth/register` | Register new user |
| GET | `/auth/me` | Get logged-in user profile |
| POST | `/auth/logout` | Logout and revoke refresh token |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/change-password` | Change password |

### Attendance (`src/services/apiService.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/attendance/student/:id?year=&month=` | Monthly attendance |
| GET | `/attendance/student/:id/range?from=&to=` | Date range attendance |
| POST | `/attendance` | Mark attendance (teacher/admin) |
| PUT | `/attendance/:id` | Update record (teacher/admin) |
| GET | `/attendance/class/:classId?date=` | Full class attendance |

### Bus Tracking (`src/services/oneLapService.js`)

| Function | OneLap Endpoint | Description |
|----------|----------------|-------------|
| `requestOTP` | `GET /tokens/v2` | Request OTP for registration |
| `verifyOTP` | `POST /tokens/verify` | Verify OTP |
| `registerUser` | `POST /users` | Register on OneLap |
| `mapDeviceToViewer` | `POST /trackingPermission/mapdevices-to-viewers` | Grant tracking |
| `getPublicBusTrackingUrl` | *(above)* | Get shareable tracking URL |

---

## Timezone

The app uses **IST (Asia/Kolkata, UTC+5:30)** throughout:
- Attendance calendar "today" highlight
- OneLap tracking duration timestamps
- Greeting (morning/afternoon/evening) based on IST hour
- Academic year auto-calculation (June start)

---

## Backend Repository

The Node.js + Express + MSSQL backend is in a separate repository:
**https://github.com/Abhilasyadav/JMDSchoolDesk-Backend**

---

*Built with ❤️ for JMD School, Bengaluru*
