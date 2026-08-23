import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ms, fs } from '../utils/responsive';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24), backgroundColor: '#FFF' },
  emoji:     { fontSize: fs(48), marginBottom: ms(16) },
  title:     { fontSize: fs(20), fontWeight: '800', color: '#1A1A1A', marginBottom: ms(8) },
  message:   { fontSize: fs(13), color: '#666', textAlign: 'center', marginBottom: ms(24), lineHeight: fs(20) },
  btn:       { backgroundColor: '#2F6B3F', borderRadius: ms(12), paddingVertical: ms(12), paddingHorizontal: ms(32) },
  btnText:   { fontSize: fs(15), fontWeight: '700', color: '#FFF' },
});
