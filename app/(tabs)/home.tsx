import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
  id: string;
  name: string;
  completed: boolean;
};

type LibraryHabit = {
  id: string;
  name: string;
  category: string;
};
const CATEGORIES = ["Sport", "Academic", "Productivity", "Wellness", "Creative", "Health"];

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Sport");
  const [libraryHabits, setLibraryHabits] = useState<LibraryHabit[]>([]);
  const [newHabitName, setNewHabitName] = useState("");

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
        setDisplayName(userDoc.data().displayName || '');
      }
      const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
      unsubscribeHabits = onSnapshot(q, (snapshot) => {
        setHabits(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Habit, 'id'>) })));
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeHabits) unsubscribeHabits();
    };
  }, []);

  useEffect(() => {
    const fetchLibrary = async () => {
      const snapshot = await getDocs(query(collection(db, 'habitlist'), where('category', '==', selectedCategory)));
      setLibraryHabits(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LibraryHabit, 'id'>) })));
    };
    fetchLibrary();
  }, [selectedCategory]);

  const addHabitFromLibrary = async (name: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const alreadyExists = habits.some((h) => h.name.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      alert('Habit already in your list!');
      return;
    }
    await addDoc(collection(db, 'habits'), {
      name,
      completed: false,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    setModalVisible(false);
  };

  const addNewHabit = async () => {
    if (!newHabitName.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'habitlist'), {
      name: newHabitName.trim(),
      category: selectedCategory,
    });

    await addDoc(collection(db, 'habits'), {
      name: newHabitName.trim(),
      completed: false,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setNewHabitName('');
    setModalVisible(false);
  };

  const toggleHabit = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'habits', id), {
      completed: !current,
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome{displayName ? `, ${displayName}` : ''}!</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>My Habits 🌱</Text>

      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>+ Add Habit</Text>
      </TouchableOpacity>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.habitItem, item.completed && styles.habitCompleted]}
            onPress={() => toggleHabit(item.id, item.completed)}
          >
            <Text style={styles.habitText}>{item.completed ? '✅' : '🔥'} {item.name}</Text>
            <Text style={styles.habitHint}>{item.completed ? 'Done! Tap to undo' : 'Tap to complete'}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Add Habit</Text>

          {/* Category selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Library habits */}
          <Text style={styles.sectionTitle}>Choose from list:</Text>
          <ScrollView style={styles.libraryList}>
            {libraryHabits.filter((item) => !habits.some((h) => h.name.toLowerCase() === item.name.toLowerCase())).map((item) => (
              <TouchableOpacity key={item.id} style={styles.libraryItem} onPress={() => addHabitFromLibrary(item.name)}>
                <Text style={styles.libraryItemText}>{item.name}</Text>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Add new habit */}
          <Text style={styles.sectionTitle}>Or add new to "{selectedCategory}":</Text>
          <TextInput
            style={styles.input}
            placeholder="New habit name..."
            value={newHabitName}
            onChangeText={setNewHabitName}
          />
          <TouchableOpacity style={styles.button} onPress={addNewHabit}>
            <Text style={styles.buttonText}>Add New Habit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8 },
  welcome: { fontSize: 18, color: '#666', flex: 1, },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, },
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 60 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  categoryScroll: { marginBottom: 16 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  categoryChipText: { color: '#666' },
  categoryChipTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  libraryList: { maxHeight: 200, marginBottom: 16 },
  libraryItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 },
  libraryItemText: { fontSize: 16 },
  addText: { color: '#4CAF50', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16 },
  cancelButton: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#888', fontSize: 16 }, button: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24, },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, },
  habitItem: { padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8, },
  habitCompleted: { backgroundColor: '#f0fff0', borderColor: '#4CAF50', },
  habitText: { fontSize: 16, },
  habitHint: { fontSize: 12, color: '#999', marginTop: 4, },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', },
  logoutText: { color: '#666', fontWeight: 'bold', },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8, },
});