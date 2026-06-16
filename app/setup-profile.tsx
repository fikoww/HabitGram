import { router } from 'expo-router';
import { doc, getDocs, addDoc, collection, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

const CATEGORIES = ['Sport', 'Academic', 'Productivity', 'Wellness', 'Creative', 'Health'];

export default function SetupProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [username, setUsername] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Sport');
  const [habitList, setHabitList] = useState<{ id: string; name: string }[]>([]);

  const handleSave = async () => {
    setErrorMessage('');

    if (!displayName.trim()) {
      setErrorMessage('Please enter your display name.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMessage('No user found. Please login again.');
      return;
    }

    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        email: user.email,
        createdAt: serverTimestamp(),
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      console.log('Profile save error:', error);
      setErrorMessage('Failed to save profile. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Profile</Text>
      <Text style={styles.subtitle}>What should we call you?</Text>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        value={displayName}
        onChangeText={setDisplayName}
      />

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Let's Go 🌱</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#888', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16 },
  button: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  errorText: { color: 'red', marginBottom: 12 },
});
