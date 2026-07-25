import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

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
      } 
      else if (error.code === 'auth/invalid-email') {
        setEmailError('Please enter a valid email address.');
      } 
      else {
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
            value={password}
            onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showPassword ? '✕' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        <View style={[styles.passwordContainer, confirmError ? styles.inputError : null]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setConfirmError(''); }}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showConfirm ? '✕' : '👁️'}</Text>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', 
               backgroundColor: '#d7d7d7', padding: 24 },
  title: { fontSize: 52, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 32 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', 
          borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, 
          shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, 
           marginBottom: 4, fontSize: 15, backgroundColor: '#fafafa', ...(Platform.OS === 'web' && { outlineStyle: 'none' as any })},
  inputError: { borderColor: '#ff4444' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', 
                       borderWidth: 1, borderColor: '#eee', borderRadius: 10, 
                       backgroundColor: '#fafafa', marginBottom: 4, padding: 5},
  passwordInput: { flex: 1, padding: 14, fontSize: 15, ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 18 },
  errorText: { color: '#ff4444', fontSize: 13, marginBottom: 8 },
  button: { backgroundColor: '#C17F3F', padding: 14, borderRadius: 10, 
            alignItems: 'center', marginTop: 12, marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  login: { textAlign: 'center', color: '#888', fontSize: 14 },
  loginLink: { color: '#B45309', fontWeight: 'bold' },
});