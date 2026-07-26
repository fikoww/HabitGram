import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
const DANGER = '#E53935';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields!');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HabitGram</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor={MUTED}
          value={email}
          onChangeText={(t) => { setEmail(t); setError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <View style={[styles.passwordContainer, error ? styles.inputError : null]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor={MUTED}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity onPress={() => router.push('/forgot-password')}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <Text style={styles.register} onPress={() => router.push('/register')}>
          Don&apos;t have an account? <Text style={styles.registerLink}>Register</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER, padding: 24 },
  title: { fontSize: 40, fontFamily: SERIF, color: ACCENT, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: MUTED, marginBottom: 28 },
  card: { width: '100%', maxWidth: 400, backgroundColor: SURFACE, borderRadius: 18, padding: 24, borderWidth: 0.5, borderColor: LINE },
  label: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 7, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 14, marginBottom: 6, fontSize: 15, color: INK, backgroundColor: PAPER, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  inputError: { borderColor: DANGER, borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: LINE, borderRadius: 10, backgroundColor: PAPER, paddingHorizontal: 5 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: INK, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 18 },
  errorText: { color: DANGER, fontSize: 13, marginBottom: 8, marginTop: 6 },
  forgotText: { color: MUTED, fontSize: 13, marginBottom: 16, textAlign: 'right', marginTop: 8 },
  button: { backgroundColor: ACCENT, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4, marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  register: { textAlign: 'center', color: MUTED, fontSize: 14 },
  registerLink: { color: ACCENT, fontWeight: 'bold' },
});