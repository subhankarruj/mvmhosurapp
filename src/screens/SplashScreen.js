import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  Animated, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAccessToken } from '../services/apiService';
import { SCHOOL_CONFIG } from '../config/appConfig';
import { s, ms, fs } from '../utils/responsive';

const LOGO_SIZE = s(180);

export default function SplashScreen({ navigation }) {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(ms(20))).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const native = Platform.OS !== 'web';

    // Step 1: logo pops in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 55,
        friction: 7,
        useNativeDriver: native,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: native,
      }),
    ]).start(() => {
      // Step 2: text slides up
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: native,
        }),
        Animated.timing(textY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: native,
        }),
      ]).start();

      // Step 3: footer fades in
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: native,
      }).start();
    });

    const timer = setTimeout(async () => {
      const token = await getAccessToken();
      navigation.replace(token ? 'Main' : 'Login');
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#FFFFFF', '#F0F7F1', '#FFFFFF']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Logo */}
      <Animated.View style={[
        styles.logoWrap,
        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        {/* Outer glow ring */}
        <View style={styles.glowRing}>
          {/* Inner white circle with shadow */}
          <View style={styles.logoCircle}>
            <Image
              source={require('../../assets/mvm-logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        </View>
      </Animated.View>

      {/* School name + app name */}
      <Animated.View style={[
        styles.textBlock,
        { opacity: textOpacity, transform: [{ translateY: textY }] },
      ]}>
        <Text style={styles.schoolName}>{SCHOOL_CONFIG.name}</Text>
        <Text style={styles.schoolSub}>{SCHOOL_CONFIG.location}</Text>

        <View style={styles.divider} />

        <Text style={styles.appName}>School Desk</Text>
        <Text style={styles.tagline}>Connecting Schools · Parents · Students</Text>
      </Animated.View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Powered by JMD Technologies</Text>
        <View style={styles.footerDot} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Logo ──
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(32),
  },
  glowRing: {
    width:  LOGO_SIZE + ms(24),
    height: LOGO_SIZE + ms(24),
    borderRadius: (LOGO_SIZE + ms(24)) / 2,
    backgroundColor: '#2F6B3F18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width:  LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6B3F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImg: {
    width:  LOGO_SIZE - ms(16),
    height: LOGO_SIZE - ms(16),
  },

  // ── Text block ──
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: ms(24),
  },
  schoolName: {
    fontSize: fs(22),
    fontWeight: '800',
    color: '#2F6B3F',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  schoolSub: {
    fontSize: fs(12),
    color: '#888',
    marginTop: ms(4),
    letterSpacing: 0.3,
  },
  divider: {
    width: s(48),
    height: 2.5,
    backgroundColor: '#2F6B3F50',
    borderRadius: 2,
    marginVertical: ms(16),
  },
  appName: {
    fontSize: fs(16),
    fontWeight: '600',
    color: '#333333',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: ms(8),
  },
  tagline: {
    fontSize: fs(12),
    color: '#999',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: ms(40),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  footerDot: {
    width: ms(4),
    height: ms(4),
    borderRadius: ms(2),
    backgroundColor: '#CCCCCC',
  },
  footerText: {
    fontSize: fs(11),
    color: '#BBBBBB',
    letterSpacing: 0.3,
  },
});
