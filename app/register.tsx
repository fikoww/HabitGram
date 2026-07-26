import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const handleRegister = async () => {
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    let valid = true;

    if (!email.trim()) {
      setEmailError('Please enter your email.');
      valid = false;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      valid = false;
    }
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      valid = false;
    }
    if (!valid) return; // don't proceed with registration if validation fails

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.replace('/setup-profile');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setEmailError('This email is already registered.');
      } else if (error.code === 'auth/invalid-email') {
        setEmailError('Please enter a valid email address.');
      } else {
        setEmailError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HabitGram</Text>
      <Text style={styles.subtitle}>Create your account</Text>
      <View style={styles.card}>
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor={MUTED}
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

        <View style={[styles.passwordContainer, passwordError ? styles.inputError : null]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor={MUTED}
            value={password}
            onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        <View style={[styles.passwordContainer, confirmError ? styles.inputError : null]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm Password"
            placeholderTextColor={MUTED}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setConfirmError(''); }}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
        <Text style={styles.login} onPress={() => router.replace('/')}>
          Already have an account? <Text style={styles.loginLink}>Login</Text>
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
  input: { borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 14, marginBottom: 4, fontSize: 15, color: INK, backgroundColor: PAPER, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  inputError: { borderColor: DANGER },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: LINE, borderRadius: 10, backgroundColor: PAPER, marginBottom: 4, marginTop: 10, paddingHorizontal: 5 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: INK, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 18 },
  errorText: { color: DANGER, fontSize: 13, marginBottom: 8, marginTop: 2 },
  button: { backgroundColor: ACCENT, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 18, marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  login: { textAlign: 'center', color: MUTED, fontSize: 14 },
  loginLink: { color: ACCENT, fontWeight: 'bold' },
});