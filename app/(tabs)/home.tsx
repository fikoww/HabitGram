import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
  id: string;
  name: string;
  completed: boolean;
};

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [habit, setHabit] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);

  // Load habits from Firestore in real-time
  useEffect(() => {
  let unsubscribeHabits: (() => void) | undefined;

  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setDisplayName('');
      setHabits([]);
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();
      setDisplayName(data.displayName || '');
    }

    if (unsubscribeHabits) {
      unsubscribeHabits();
    }

    const q = query(
      collection(db, 'habits'),
      where('userId', '==', user.uid)
    );

    unsubscribeHabits = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((document) => ({
        id: document.id,
        ...(document.data() as Omit<Habit, 'id'>),
      }));

      setHabits(loaded);
    });
  });

  return () => {
    unsubscribeAuth();

    if (unsubscribeHabits) {
      unsubscribeHabits();
    }
  };
}, []);

  const addHabit = async () => {
    if (habit.trim() === '') return;

    const user = auth.currentUser;

    if (!user) return;

    await addDoc(collection(db, 'habits'), {
      name: habit.trim(),
      completed: false,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setHabit('');
  };

  const toggleHabit = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'habits', id), {
      completed: !current,
    });
  };

  const handleLogout = async () => {
  await signOut(auth);
  router.replace('/(tabs)');
};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
  <Text style={styles.welcome}>
    Welcome{displayName ? `, ${displayName}` : ''}!
  </Text>

  <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
    <Text style={styles.logoutText}>Logout</Text>
  </TouchableOpacity>
</View>

<Text style={styles.title}>My Habits 🌱</Text>

      <TextInput
        style={styles.input}
        placeholder="Add a new habit..."
        value={habit}
        onChangeText={setHabit}
      />

      <TouchableOpacity style={styles.button} onPress={addHabit}>
        <Text style={styles.buttonText}>Add Habit</Text>
      </TouchableOpacity>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.habitItem, item.completed && styles.habitCompleted]}
            onPress={() => toggleHabit(item.id, item.completed)}
          >
            <Text style={styles.habitText}>
              {item.completed ? '✅' : '🔥'} {item.name}
            </Text>
            <Text style={styles.habitHint}>
              {item.completed ? 'Done! Tap to undo' : 'Tap to complete'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>

  );
  
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, backgroundColor: '#fff',},
  welcome: {fontSize: 18, color: '#666', flex: 1,},
  title: {fontSize: 28, fontWeight: 'bold', marginBottom: 24,},
  input: {borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16,},
  button: {backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24,},
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16,},
  habitItem: {padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8,},
  habitCompleted: {backgroundColor: '#f0fff0', borderColor: '#4CAF50',},
  habitText: {fontSize: 16,},
  habitHint: {fontSize: 12, color: '#999', marginTop: 4,},
  logoutButton: {paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center',},
  logoutText: {color: '#666', fontWeight: 'bold',},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8,},
});