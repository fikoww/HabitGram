import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

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
    } 
    catch (err: any) {
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
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            <Text style={styles.eyeIcon}>{showPassword ? '✕' : '👁️'}</Text>
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
          Don't have an account? <Text style={styles.registerLink}>Register</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', 
               backgroundColor: '#d7d7d7', padding: 24 },
  title: { fontSize: 52, fontWeight: 'bold', marginBottom: 9 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 32 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff',
          borderRadius: 16, padding: 24, shadowColor: '#000000', 
          shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.08, 
          shadowRadius: 12, elevation: 4},
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, 
           padding: 14, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa', ...(Platform.OS === 'web' && { outlineStyle: 'none' as any })},
  inputError: { borderColor: '#ff4444', borderWidth: 1.5},
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 5,
                       borderColor: '#eee', borderRadius: 10, backgroundColor: '#fafafa', marginBottom: 4 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15 , borderColor: 'white', borderWidth: 0 ,  ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }) },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 18 },
  errorText: { color: '#ff4444', fontSize: 13, marginBottom: 8, marginTop: 4 },
  forgotText: { color: '#4CAF50', fontSize: 13, marginBottom: 16, textAlign: 'right' },
  button: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, alignItems: 'center', 
            marginTop: 4, marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  register: { textAlign: 'center', color: '#888', fontSize: 14 },
  registerLink: { color: '#4CAF50', fontWeight: 'bold' },
});