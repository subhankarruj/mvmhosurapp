import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
  Animated, Switch,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import JMDLogo from '../components/JMDLogo';
import { authAPI } from '../services/apiService';
import { getExpoPushToken } from '../services/notificationService';
import { useUser } from '../context/UserContext';
import { SHADOWS, platformShadow } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';
import LegalModal from '../components/LegalModal';
import {
  PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATED,
  TERMS_SECTIONS, TERMS_UPDATED,
} from '../constants/legalText';

const webInputStyle = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none', outlineColor: 'transparent', boxShadow: 'none' } }) ?? {};

// ─── Icons ────────────────────────────────────────────────────────────────────
function EyeIcon({ open, size = 20, color = '#888' }) {
  return open ? (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </Svg>
  );
}

// ─── Validators ──────────────────────────────────────────────────────────────
const MOBILE_RE = /^[6-9]\d{9}$/;

function validate(fields) {
  const e = {};
  if (!fields.name.trim())              e.name     = 'Full name is required.';
  else if (fields.name.trim().length < 3) e.name   = 'Name must be at least 3 characters.';

  if (!fields.phone)                    e.phone    = 'Mobile number is required.';
  else if (!MOBILE_RE.test(fields.phone)) e.phone  = 'Enter a valid 10-digit mobile number (starts with 6–9).';

  if (!fields.attendanceEnabled && !fields.busTrackingEnabled) {
    e.features = 'Select at least one feature: Attendance or Bus Tracking.';
  }

  if (fields.busTrackingEnabled && !fields.busStop.trim()) e.busStop = 'Bus stop is required.';

  if (!fields.password)                 e.password = 'Password is required.';
  else if (fields.password.length < 6)  e.password = 'Password must be at least 6 characters.';

  if (!fields.confirm)                  e.confirm  = 'Please confirm your password.';
  else if (fields.confirm !== fields.password) e.confirm = 'Passwords do not match.';

  if (!fields.agreedToTerms) e.agreedToTerms = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';

  return e;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { setUser }             = useUser();
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [attendanceEnabled, setAttendanceEnabled]   = useState(true);
  const [busTrackingEnabled, setBusTrackingEnabled] = useState(true);
  const [busStop, setBusStop]   = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal]   = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity             = useRef(new Animated.Value(0)).current;

  // Shows the toast and resolves once it has been visible long enough to read,
  // so the caller can navigate away right after without the message being missed.
  const showToast = (msg) => new Promise((resolve) => {
    setToastMsg(msg);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
      .start(() => setTimeout(resolve, 1100));
  });

  // refs for returnKeyType focus chain
  const phoneRef    = useRef();
  const busStopRef  = useRef();
  const passwordRef = useRef();
  const confirmRef  = useRef();

  const clearErr = (key) => setErrors(prev => ({ ...prev, [key]: '' }));

  const handlePhoneChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (errors.phone) clearErr('phone');
  };

  const handleRegister = async () => {
    const e = validate({ name, phone, attendanceEnabled, busTrackingEnabled, busStop, password, confirm, agreedToTerms });
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await authAPI.register(
        name.trim(), phone, password,
        busTrackingEnabled ? busStop.trim() : '',
        attendanceEnabled, busTrackingEnabled,
      );
      // Auto-login right after activation — no need to make the user log in again.
      const data = await authAPI.login(phone, password);
      setUser(data.user);
      getExpoPushToken().then(token => {
        if (token) authAPI.savePushToken(token).catch(() => {}); // best-effort — don't block registration
      });
      await showToast('Account activated! Welcome aboard.');
      navigation.replace('Main');
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Toast — non-blocking activation confirmation */}
      {toastMsg ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <JMDLogo width={s(110)} color={COLORS.logo} />
        </View>
        <Text style={styles.appTitle}>MVM</Text>
      </View>

      {/* Form card */}
      <ScrollView contentContainerStyle={styles.formWrapper} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.headingText}>Create Account</Text>
          <Text style={styles.subText}>Register to get started</Text>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={[styles.inputBox, errors.name ? styles.inputBoxError : null]}>
              <Text style={styles.fieldIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={v => { setName(v); if (errors.name) clearErr('name'); }}
                onBlur={() => { if (!name.trim()) setErrors(p => ({ ...p, name: 'Full name is required.' })); }}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
            {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
          </View>

          {/* Mobile */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={[styles.inputBox, errors.phone ? styles.inputBoxError : null]}>
              <View style={styles.countryWrap}>
                <Text style={styles.countryFlag}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                ref={phoneRef}
                style={styles.input}
                value={phone}
                onChangeText={handlePhoneChange}
                onBlur={() => { if (phone && !MOBILE_RE.test(phone)) setErrors(p => ({ ...p, phone: 'Enter a valid 10-digit mobile number.' })); }}
                placeholder="00000 00000"
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="next"
                onSubmitEditing={() => busStopRef.current?.focus()}
              />
            </View>
            {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
          </View>

          {/* Features */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Features</Text>
            <View style={[styles.toggleRow, { marginBottom: ms(8) }]}>
              <Text style={styles.toggleLabel}>✅  Attendance</Text>
              <Switch
                value={attendanceEnabled}
                onValueChange={v => { setAttendanceEnabled(v); if (errors.features) clearErr('features'); }}
                trackColor={{ true: COLORS.primary }}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>🚌  Bus Tracking</Text>
              <Switch
                value={busTrackingEnabled}
                onValueChange={v => { setBusTrackingEnabled(v); if (errors.features) clearErr('features'); if (errors.busStop) clearErr('busStop'); }}
                trackColor={{ true: COLORS.primary }}
              />
            </View>
            {errors.features ? <Text style={styles.fieldError}>{errors.features}</Text> : null}
          </View>

          {/* Bus Stop — only needed when Bus Tracking is enabled */}
          {busTrackingEnabled ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bus Stop</Text>
              <View style={[styles.inputBox, errors.busStop ? styles.inputBoxError : null]}>
                <Text style={styles.fieldIcon}>🚌</Text>
                <TextInput
                  ref={busStopRef}
                  style={styles.input}
                  value={busStop}
                  onChangeText={v => { setBusStop(v); if (errors.busStop) clearErr('busStop'); }}
                  onBlur={() => { if (!busStop.trim()) setErrors(p => ({ ...p, busStop: 'Bus stop is required.' })); }}
                  placeholder="Enter your nearest bus stop"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
              {errors.busStop ? <Text style={styles.fieldError}>{errors.busStop}</Text> : null}
            </View>
          ) : null}

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox, errors.password ? styles.inputBoxError : null]}>
              <TouchableOpacity onPress={() => setShowPass(prev => !prev)} style={styles.eyeBtn}>
                <EyeIcon open={showPass} size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={v => { setPassword(v); if (errors.password) clearErr('password'); }}
                onBlur={() => { if (password && password.length < 6) setErrors(p => ({ ...p, password: 'At least 6 characters.' })); }}
                placeholder="Min. 6 characters"
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showPass}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputBox, errors.confirm ? styles.inputBoxError : null]}>
              <TouchableOpacity onPress={() => setShowConf(prev => !prev)} style={styles.eyeBtn}>
                <EyeIcon open={showConf} size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                value={confirm}
                onChangeText={v => { setConfirm(v); if (errors.confirm) clearErr('confirm'); }}
                onBlur={() => { if (confirm && confirm !== password) setErrors(p => ({ ...p, confirm: 'Passwords do not match.' })); }}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showConf}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
            {errors.confirm ? <Text style={styles.fieldError}>{errors.confirm}</Text> : null}
          </View>

          {/* Terms & Privacy consent */}
          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={styles.consentRow}
              activeOpacity={0.7}
              onPress={() => { setAgreedToTerms(v => !v); if (errors.agreedToTerms) clearErr('agreedToTerms'); }}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text style={styles.consentLink} onPress={() => setShowTermsModal(true)}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={styles.consentLink} onPress={() => setShowPrivacyModal(true)}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.agreedToTerms ? <Text style={styles.fieldError}>{errors.agreedToTerms}</Text> : null}
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && { opacity: 0.8 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.registerBtnText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>

          {/* Back to login — single flowing Text so the phrase + link wrap together
              as one block instead of as two independent siblings that can split
              across lines unevenly on narrower screens / larger font scales. */}
          <Text style={styles.loginRowText}>
            Already have an account?{' '}
            <Text style={styles.loginLink} onPress={() => navigation.goBack()}>Login</Text>
          </Text>
        </View>
      </ScrollView>

      <Text style={styles.footerText}>© 2026 JMD Technologies. All rights reserved.</Text>

      <LegalModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms & Conditions"
        updatedLabel={TERMS_UPDATED}
        sections={TERMS_SECTIONS}
      />
      <LegalModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Privacy Policy"
        updatedLabel={PRIVACY_POLICY_UPDATED}
        sections={PRIVACY_POLICY_SECTIONS}
      />
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },

  toast: {
    position: 'absolute',
    top: ms(50),
    left: ms(20),
    right: ms(20),
    backgroundColor: '#1B5E20',
    borderRadius: ms(12),
    paddingVertical: ms(12),
    paddingHorizontal: ms(16),
    zIndex: 10,
    elevation: 10,
    alignItems: 'center',
  },
  toastText: { color: '#FFF', fontSize: fs(14), fontWeight: '700' },

  header: { alignItems: 'center', paddingTop: ms(16), paddingBottom: ms(16) },
  logoBox: {
    backgroundColor: '#F5F5F5', borderRadius: ms(14),
    paddingHorizontal: ms(16), paddingVertical: ms(10),
    marginBottom: ms(12),
    ...SHADOWS.logoBox,
  },
  appTitle: { fontSize: fs(22), fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  formWrapper: { flexGrow: 1, paddingHorizontal: ms(20), paddingBottom: ms(16) },
  card: {
    backgroundColor: '#FFF', borderRadius: ms(24), padding: ms(24),
    ...SHADOWS.card,
  },

  headingText: { fontSize: fs(22), fontWeight: '800', color: COLORS.textDark, marginBottom: ms(4) },
  subText:     { fontSize: fs(14), color: COLORS.textGray, marginBottom: ms(20) },

  // Inputs
  inputGroup: { marginBottom: ms(16) },
  label: { fontSize: fs(13), fontWeight: '600', color: COLORS.textDark, marginBottom: ms(8) },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: ms(12), paddingHorizontal: ms(14),
    backgroundColor: '#FAFAFA', height: s(52),
  },
  inputBoxError: { borderColor: '#E53935', backgroundColor: '#FFF5F5' },
  fieldIcon: { fontSize: fs(16), marginRight: ms(10) },
  countryWrap:  { flexDirection: 'row', alignItems: 'center', marginRight: ms(8) },
  countryFlag:  { fontSize: fs(16), marginRight: ms(4) },
  countryCode:  { fontSize: fs(14), fontWeight: '700', color: COLORS.textDark },
  divider: { width: 1, height: s(22), backgroundColor: COLORS.border, marginRight: ms(10) },
  input: {
    flex: 1,
    fontSize: fs(15),
    color: COLORS.textDark,
    ...webInputStyle,
  },
  eyeBtn:     { paddingHorizontal: ms(6), paddingVertical: ms(4) },
  fieldError: { fontSize: fs(12), color: '#E53935', marginTop: ms(5), marginLeft: ms(4), fontWeight: '500' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: ms(12), paddingHorizontal: ms(14), paddingVertical: ms(10),
    backgroundColor: '#FAFAFA',
  },
  toggleLabel: { fontSize: fs(14), fontWeight: '600', color: COLORS.textDark },

  // Terms & Privacy consent
  consentRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: {
    width: ms(20), height: ms(20), borderRadius: ms(5),
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: ms(10), marginTop: ms(1),
    backgroundColor: '#FAFAFA',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxTick: { color: '#FFFFFF', fontSize: fs(13), fontWeight: '800' },
  consentText: { flex: 1, fontSize: fs(13), lineHeight: fs(19), color: COLORS.textGray },
  consentLink: { color: COLORS.primary, fontWeight: '700' },

  // Button
  registerBtn: {
    backgroundColor: COLORS.primary, borderRadius: ms(12),
    paddingVertical: ms(15), alignItems: 'center',
    marginTop: ms(8), marginBottom: ms(18),
    ...platformShadow(COLORS.primary, 0, 4, 8, 0.4, 6),
  },
  registerBtnText: { fontSize: fs(16), fontWeight: '800', color: '#FFF', letterSpacing: 2 },

  // Login link
  loginRowText: { fontSize: fs(13), color: COLORS.textGray, textAlign: 'center' },
  loginLink:    { fontSize: fs(13), fontWeight: '700', color: COLORS.primary },

  footerText: {
    textAlign: 'center', fontSize: fs(11),
    color: '#FFFFFF70', paddingVertical: ms(16),
  },
});
