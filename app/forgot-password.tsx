import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) return Alert.alert('Error', 'Masukkin email dulu.');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Berhasil!', 'Link reset password udah dikirim ke email kamu.');
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>We&apos;ll email you a link to reset it.</Text>
      <TextInput
        style={styles.input}
        placeholder="Your email"
        placeholderTextColor={MUTED}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
      </TouchableOpacity>
      <Text style={styles.back} onPress={() => router.back()}>← Back to login</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: PAPER },
  title: { fontSize: 28, fontFamily: SERIF, textAlign: 'center', marginBottom: 8, color: INK, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, textAlign: 'center', color: MUTED, marginBottom: 32 },
  input: { borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 14, marginBottom: 16, color: INK, fontSize: 15, backgroundColor: SURFACE, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  button: { backgroundColor: ACCENT, padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#E0A48D' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  back: { textAlign: 'center', marginTop: 20, color: ACCENT, fontSize: 14, fontWeight: '600' },
});