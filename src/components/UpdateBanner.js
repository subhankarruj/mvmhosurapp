import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { ms, fs } from '../utils/responsive';
import { COLORS } from '../constants/colors';

// Surfaces the background OTA update process (checked/downloaded
// automatically on every cold start) so the user can actually see it
// happening instead of guessing whether closing/reopening the app twice
// did anything.
export default function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isDownloading, isUpdatePending, downloadProgress } = Updates.useUpdates();
  const visible = isDownloading || isUpdatePending;
  const slideY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.timing(slideY, {
      toValue: visible ? 0 : -100,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideY]);

  // expo-updates is a no-op on web and disabled in local dev — nothing to show there.
  if (Platform.OS === 'web' || !Updates.isEnabled) return null;

  const pct = downloadProgress != null ? Math.round(downloadProgress * 100) : null;

  return (
    <Animated.View
      style={[styles.banner, { paddingTop: insets.top + ms(8), transform: [{ translateY: slideY }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {isUpdatePending ? (
        <TouchableOpacity style={styles.row} onPress={() => Updates.reloadAsync()} activeOpacity={0.85}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.text}>Update ready — tap to restart</Text>
        </TouchableOpacity>
      ) : isDownloading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.text}>Downloading update{pct != null ? ` ${pct}%` : '…'}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: COLORS.primaryDark,
    paddingBottom: ms(10),
    paddingHorizontal: ms(16),
    zIndex: 999,
    elevation: 999,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(8) },
  icon: { fontSize: fs(14) },
  text: { color: '#FFF', fontSize: fs(13), fontWeight: '700' },
});
