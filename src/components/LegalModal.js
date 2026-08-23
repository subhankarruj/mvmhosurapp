import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { ms, fs } from '../utils/responsive';

// Reusable full-screen modal for reading Privacy Policy / Terms & Conditions
// text in-app — fed section data from src/constants/legalText.js so both
// documents share one presentation.
export default function LegalModal({ visible, onClose, title, updatedLabel, sections }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={ms(10)} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {updatedLabel ? <Text style={styles.updated}>Last updated: {updatedLabel}</Text> : null}
          {sections.map((s, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionHeading}>{s.heading}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(20),
    paddingVertical: ms(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { flex: 1, fontSize: fs(18), fontWeight: '800', color: COLORS.textDark },
  closeBtn: {
    width: ms(32), height: ms(32), borderRadius: ms(16),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0F0F0', marginLeft: ms(12),
  },
  closeTxt: { fontSize: fs(16), fontWeight: '700', color: COLORS.textDark },

  body: { paddingHorizontal: ms(20), paddingTop: ms(16), paddingBottom: ms(32) },
  updated: { fontSize: fs(12), color: COLORS.textGray, marginBottom: ms(16), fontStyle: 'italic' },

  section: { marginBottom: ms(20) },
  sectionHeading: { fontSize: fs(15), fontWeight: '800', color: COLORS.primary, marginBottom: ms(6) },
  sectionBody: { fontSize: fs(14), lineHeight: fs(21), color: COLORS.textDark },

  footer: {
    paddingHorizontal: ms(20), paddingVertical: ms(14),
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  doneBtn: {
    backgroundColor: COLORS.primary, borderRadius: ms(12),
    paddingVertical: ms(14), alignItems: 'center',
  },
  doneBtnText: { fontSize: fs(15), fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
});
