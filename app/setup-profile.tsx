import { router } from 'expo-router';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

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

const CATEGORIES = ['Sport', 'Academic', 'Productivity', 'Wellness', 'Creative', 'Health'];

export default function SetupProfileScreen() {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Sport');
  const [habitList, setHabitList] = useState<{ id: string; name: string }[]>([]);
  const [selectedHabit, setSelectedHabit] = useState('');

  const fetchHabits = async (category: string) => {
    const snapshot = await getDocs(query(collection(db, 'habitlist'), where('category', '==', category)));
    setHabitList(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name })));
  };

  const handleNextStep1 = async () => {
    setErrorMessage('');
    if (!displayName.trim()) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Please enter a username.');
      return;
    }
    if (username.includes(' ')) {
      setErrorMessage('Username cannot contain spaces.');
      return;
    }

    setLoading(true);
    const snapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase())));
    if (!snapshot.empty) {
      setErrorMessage('Username already taken. Try another!');
      setLoading(false);
      return;
    }
    setLoading(false);
    fetchHabits(selectedCategory);
    setStep(2);
  };

  const handleFinish = async (skip: boolean) => {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(doc(db, 'users', user.uid), {
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: user.email,
      createdAt: serverTimestamp(),
    });

    if (!skip && selectedHabit) {
      await addDoc(collection(db, 'habits'), {
        name: selectedHabit,
        completed: false,
        completedDates: [],
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
    }

    router.replace('/(tabs)/home');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressStep, step >= 1 && styles.progressActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressActive]} />
      </View>
      <Text style={styles.stepLabel}>Step {step} of 2</Text>

      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.title}>Set Up Profile</Text>
          <Text style={styles.subtitle}>What should we call you?</Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Andi Lee"
            placeholderTextColor={MUTED}
            value={displayName}
            onChangeText={(t) => { setDisplayName(t); setErrorMessage(''); }}
          />

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="e.g. andilee123"
              placeholderTextColor={MUTED}
              value={username}
              onChangeText={(t) => { setUsername(t.toLowerCase()); setErrorMessage(''); }}
              autoCapitalize="none"
            />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleNextStep1} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Checking...' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.card}>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Pick Habits!</Text>
          <Text style={styles.subtitle}>Choose one habit to start!</Text>

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => {
                  setSelectedCategory(cat);
                  setSelectedHabit('');
                  fetchHabits(cat);
                }}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Habits</Text>
          {habitList.length === 0 ? (
            <Text style={styles.emptyText}>No habits in this category yet.</Text>
          ) : (
            habitList.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={[styles.habitItem, selectedHabit === h.name && styles.habitItemActive]}
                onPress={() => setSelectedHabit(h.name)}
              >
                <Text style={[styles.habitItemText, selectedHabit === h.name && styles.habitItemTextActive]}>
                  {selectedHabit === h.name ? '✅ ' : '○ '}{h.name}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={[styles.button, !selectedHabit && styles.buttonDisabled]}
            onPress={() => handleFinish(false)}
            disabled={!selectedHabit}
          >
            <Text style={styles.buttonText}>Let&apos;s Go!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={() => handleFinish(true)}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAPER, padding: 24 },
  progressBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressStep: { width: 60, height: 6, borderRadius: 3, backgroundColor: '#E0DDD6' },
  progressActive: { backgroundColor: ACCENT },
  stepLabel: { color: MUTED, fontSize: 13, marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1 },
  card: { width: '100%', maxWidth: 400, backgroundColor: SURFACE, borderRadius: 18, padding: 24, borderWidth: 0.5, borderColor: LINE },
  title: { fontSize: 24, fontFamily: SERIF, color: INK, marginBottom: 4, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: MUTED, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 7, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: PAPER, marginBottom: 4, color: INK, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  usernameContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: LINE, borderRadius: 10, backgroundColor: PAPER, marginBottom: 4 },
  atSign: { paddingLeft: 14, fontSize: 15, color: MUTED },
  usernameInput: { flex: 1, padding: 14, fontSize: 15, color: INK, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  errorText: { color: DANGER, fontSize: 13, marginBottom: 8, marginTop: 6 },
  button: { backgroundColor: ACCENT, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: '#E0A48D' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  skipButton: { padding: 14, alignItems: 'center', marginTop: 8 },
  skipText: { color: MUTED, fontSize: 14 },
  backButton: { marginBottom: 16 },
  backText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  categoryScroll: { marginBottom: 16 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 0.5, borderColor: LINE, marginRight: 8 },
  categoryChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  categoryChipText: { color: '#666' },
  categoryChipTextActive: { color: '#fff', fontWeight: 'bold' },
  habitItem: { padding: 12, borderWidth: 0.5, borderColor: LINE, borderRadius: 10, marginBottom: 8, backgroundColor: PAPER },
  habitItemActive: { borderColor: ACCENT, backgroundColor: '#FBF3EF' },
  habitItemText: { fontSize: 15, color: '#333' },
  habitItemTextActive: { color: ACCENT, fontWeight: 'bold' },
  emptyText: { color: MUTED, fontSize: 14, marginBottom: 8 },
});