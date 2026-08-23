import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import JMDLogo from '../components/JMDLogo';
import PhoneCallIcon from '../components/PhoneCallIcon';
import EyeIcon from '../components/EyeIcon';
import { authAPI } from '../services/apiService';
import { getExpoPushToken } from '../services/notificationService';
import { useUser } from '../context/UserContext';
import { ERR_SESSION_EXPIRED } from '../constants/errors';
import { SHADOWS, platformShadow } from '../utils/shadow';
import { s, ms, fs } from '../utils/responsive';

const webInputStyle = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none', outlineColor: 'transparent', boxShadow: 'none' } }) ?? {};

// Indian mobile: exactly 10 digits starting with 6-9
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

function validateIdentifier(value) {
  const v = value.trim();
  if (!v) return 'Mobile number is required.';
  if (!INDIA_MOBILE_RE.test(v)) {
    return 'Enter a valid 10-digit mobile number (starts with 6–9).';
  }
  return '';
}

function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

export default function LoginScreen({ navigation }) {
  const { setUser } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameErr, setUsernameErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  const handleUsernameChange = (val) => {
    // Allow only digits, cap at 10
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setUsername(digits);
    if (usernameErr) setUsernameErr(validateIdentifier(digits));
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (passwordErr) setPasswordErr(validatePassword(val));
  };

  const handleLogin = async () => {
    const uErr = validateIdentifier(username);
    const pErr = validatePassword(password);
    setUsernameErr(uErr);
    setPasswordErr(pErr);
    if (uErr || pErr) return;

    setLoading(true);
    try {
      const data = await authAPI.login(username.trim(), password);
      setUser(data.user);
      navigation.replace('Main');
      getExpoPushToken().then(token => {
        if (token) authAPI.savePushToken(token).catch(() => {}); // best-effort — don't block login
      });
    } catch (err) {
      const msg = err.message === ERR_SESSION_EXPIRED
        ? 'Session expired. Please login again.'
        : err.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
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

      {/* Top red header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <JMDLogo width={s(130)} color={COLORS.logo} />
        </View>
        <Text style={styles.appTitle}>MVM</Text>
      </View>

      {/* White form card */}
      <ScrollView contentContainerStyle={styles.formWrapper} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome Back!</Text>
          <Text style={styles.signInText}>Sign in to continue</Text>

          {/* Mobile number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={[styles.inputBox, usernameErr ? styles.inputBoxError : null]}>
              <View style={styles.fieldIconWrap}>
                <PhoneCallIcon size={18} color={COLORS.primary} />
              </View>
              <View style={styles.countryCodeWrap}>
                <Text style={styles.countryFlag}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={handleUsernameChange}
                onBlur={() => setUsernameErr(validateIdentifier(username))}
                placeholder="00000 00000"
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="next"
              />
            </View>
            {usernameErr ? <Text style={styles.fieldError}>{usernameErr}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox, passwordErr ? styles.inputBoxError : null]}>
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <EyeIcon open={showPassword} size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.inputDivider} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={() => setPasswordErr(validatePassword(password))}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>
            {passwordErr ? <Text style={styles.fieldError}>{passwordErr}</Text> : null}
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          {/* Register link — single flowing Text so it wraps as one block */}
          <Text style={styles.registerRowText}>
            Don't have an account?{' '}
            <Text style={styles.registerLink} onPress={() => navigation.navigate('Register')}>Register</Text>
          </Text>

        </View>
      </ScrollView>

      {/* Footer pinned at bottom */}
      <Text style={styles.footerText}>
        © 2026 JMD Technologies. All rights reserved.
      </Text>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: ms(28),
    paddingBottom: ms(24),
  },
  logoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: ms(14),
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
    marginBottom: ms(14),
    ...SHADOWS.logoBox,
  },
  appTitle: {
    fontSize: fs(22),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  formWrapper: {
    flexGrow: 1,
    paddingHorizontal: ms(20),
    paddingBottom: ms(16),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(24),
    padding: ms(24),
    ...SHADOWS.card,
  },
  welcomeText: {
    fontSize: fs(22),
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: ms(4),
  },
  signInText: {
    fontSize: fs(14),
    color: COLORS.textGray,
    marginBottom: ms(20),
  },
  inputGroup: {
    marginBottom: ms(16),
  },
  label: {
    fontSize: fs(13),
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: ms(8),
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    backgroundColor: '#FAFAFA',
    height: s(52),
  },
  inputBoxError: {
    borderColor: '#E53935',
    backgroundColor: '#FFF5F5',
  },
  fieldError: {
    fontSize: fs(12),
    color: '#E53935',
    marginTop: ms(5),
    marginLeft: ms(4),
    fontWeight: '500',
  },
  fieldIconWrap: {
    width: s(32),
    height: s(32),
    borderRadius: ms(8),
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(8),
  },
  countryCodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: ms(6),
  },
  countryFlag: {
    fontSize: fs(16),
    marginRight: ms(4),
  },
  countryCodeText: {
    fontSize: fs(14),
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: 0.3,
  },
  inputDivider: {
    width: 1,
    height: s(22),
    backgroundColor: COLORS.border,
    marginRight: ms(10),
  },
  input: {
    flex: 1,
    fontSize: fs(15),
    color: COLORS.black,
    ...webInputStyle,
  },
  eyeBtn: {
    paddingHorizontal: ms(6),
    paddingVertical: ms(4),
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: ms(12),
    paddingVertical: ms(15),
    alignItems: 'center',
    marginTop: ms(8),
    marginBottom: ms(20),
    ...platformShadow(COLORS.primary, 0, 4, 8, 0.4, 6),
  },
  loginBtnText: {
    fontSize: fs(16),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  registerRowText: { fontSize: fs(13), color: COLORS.textGray, textAlign: 'center' },
  registerLink:    { fontSize: fs(13), fontWeight: '700', color: COLORS.primary },

  footerText: {
    textAlign: 'center',
    fontSize: fs(11),
    color: '#FFFFFF70',
    paddingVertical: ms(16),
  },
});
