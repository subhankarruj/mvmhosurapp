// Single source of truth for the in-app Privacy Policy / Terms & Conditions
// modals (see LegalModal.js, used from RegisterScreen.js). The hosted web
// version (for the Play Console "Privacy Policy URL" field) is kept in sync
// with this text by hand — update both together if either changes.

export const PRIVACY_POLICY_UPDATED = 'August 2026';

export const PRIVACY_POLICY_SECTIONS = [
  {
    heading: 'Who we are',
    body: 'MVM is the mobile app for Maharishi Vidya Mandir, Hosur, used by students to view attendance, track the school bus, and receive notifications.',
  },
  {
    heading: 'Information we collect',
    body: '• Name and mobile number, provided when you register.\n• Your password, stored only as a one-way encrypted hash — we never store or can see your actual password.\n• Attendance records, computed by the school\'s own attendance system and shown to you read-only.\n• Your device\'s live location, only while the Bus Track screen is open and only to calculate distance to the school bus — this is never collected in the background.\n• Your chosen or assigned bus stop.\n• A device push-notification token, so we can deliver attendance and bus alerts.',
  },
  {
    heading: 'How we use this information',
    body: 'Solely to operate the app\'s features for you: showing your own attendance, tracking your assigned school bus, sending you attendance/bus notifications, and letting you log in securely. We do not use your data for advertising, and we do not sell or rent your data to anyone.',
  },
  {
    heading: 'Who we share it with',
    body: 'Your live location is compared against the school bus\'s GPS position, which comes from OneLap, our GPS tracking provider — but this happens on our own server; the app never sends your data directly to OneLap. Push notifications are delivered via Expo\'s push notification service, which only sees your device\'s push token, not your personal data. We do not share your information with any other third party.',
  },
  {
    heading: 'Data storage and security',
    body: 'Your login session (access and refresh tokens) is stored in your device\'s encrypted secure storage (Android Keystore / iOS Keychain), not in plain, readable storage. Your account data is stored on our servers, protected by industry-standard practices including encrypted passwords and access-controlled database accounts.',
  },
  {
    heading: 'Your choices',
    body: 'You can turn attendance and bus-alert push notifications on or off independently from the Notification Settings screen at any time. You can stop sharing your location simply by not opening the Bus Track screen. To request deletion of your account and data, contact your school administration.',
  },
  {
    heading: 'Children\'s privacy',
    body: 'This app is intended for use by school students under the guidance of their school and, where applicable, their parents or guardians. Account activation requires the phone number to already be enrolled as a student by the school itself.',
  },
  {
    heading: 'Changes to this policy',
    body: 'If this policy changes, the updated version will be reflected here and in the app, with a new "last updated" date.',
  },
  {
    heading: 'Contact',
    body: 'For any privacy questions or data deletion requests, please contact your school administration office.',
  },
];

export const TERMS_UPDATED = 'August 2026';

export const TERMS_SECTIONS = [
  {
    heading: 'Acceptance of terms',
    body: 'By creating an account and using the MVM app, you agree to these Terms & Conditions and the Privacy Policy. If you do not agree, please do not use the app.',
  },
  {
    heading: 'Eligibility',
    body: 'This app is for use by students enrolled at Maharishi Vidya Mandir, Hosur, whose mobile number has already been registered with the school\'s own records. Registration through the app only activates an account for an already-enrolled student — it does not enroll new students.',
  },
  {
    heading: 'Your account',
    body: 'You are responsible for keeping your password confidential and for all activity under your account. Notify your school administration if you believe your account has been accessed without your permission.',
  },
  {
    heading: 'Acceptable use',
    body: 'The app is provided for personal, non-commercial use to view your own attendance, track your assigned school bus, and receive related notifications. You agree not to attempt to access another student\'s data, interfere with the app\'s operation, or misuse the bus-tracking feature.',
  },
  {
    heading: 'Accuracy of information',
    body: 'Attendance records are computed by the school\'s own attendance system; bus location is provided by third-party GPS hardware and may occasionally be delayed or inaccurate due to network or device conditions. The app is a convenience tool, not a substitute for official school communication.',
  },
  {
    heading: 'Changes to the service',
    body: 'Features may be added, changed, or removed over time as the school\'s needs evolve.',
  },
  {
    heading: 'Contact',
    body: 'For any questions about these terms, please contact your school administration office.',
  },
];
