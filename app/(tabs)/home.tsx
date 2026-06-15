import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
  id: string;
  name: string;
  completed: boolean;
  completedDates?: string[];
};

type LibraryHabit = {
  id: string;
  name: string;
  category: string;
};

const CATEGORIES = ['Sport', 'Academic', 'Productivity', 'Wellness', 'Creative', 'Health'];

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Sport');
  const [libraryHabits, setLibraryHabits] = useState<LibraryHabit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

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
      completedDates: [],
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
      completedDates: [],
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    setNewHabitName('');
    setModalVisible(false);
  };

  const toggleToday = async (habit: Habit) => {
    const today = getTodayString();
    const dates = habit.completedDates || [];
    const isDoneToday = dates.includes(today);
    const newDates = isDoneToday ? dates.filter((d) => d !== today) : [...dates, today];
    await updateDoc(doc(db, 'habits', habit.id), {
      completedDates: newDates,
      completed: !isDoneToday,
    });
  };

  const removeHabit = async (id: string) => {
    await deleteDoc(doc(db, 'habits', id));
  };

  const openCalendar = (habit: Habit) => {
    setSelectedHabit(habit);
    setCalendarVisible(true);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  const renderCalendar = () => {
    if (!selectedHabit) return null;
    const dates = selectedHabit.completedDates || [];
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const done = dates.includes(str);
      days.push({ str, done, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return (
      <View style={styles.calendarGrid}>
        {days.map((day) => (
          <View key={day.str} style={[styles.calendarDay, day.done ? styles.calendarDone : styles.calendarMiss]}>
            <Text style={styles.calendarDayText}>{day.label}</Text>
            <Text style={styles.calendarDayIcon}>{day.done ? '✅' : '❌'}</Text>
          </View>
        ))}
      </View>
    );
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
        renderItem={({ item }) => {
          const today = getTodayString();
          const doneToday = (item.completedDates || []).includes(today);
          return (
            <View style={[styles.habitItem, doneToday && styles.habitCompleted]}>
              <TouchableOpacity style={styles.habitMain} onPress={() => openCalendar(item)}>
                <Text style={styles.habitText}>{doneToday ? '✅' : '🔥'} {item.name}</Text>
                <Text style={styles.habitHint}>Tap to see calendar</Text>
              </TouchableOpacity>
              <View style={styles.habitActions}>
                <TouchableOpacity style={[styles.doneButton, doneToday && styles.doneButtonActive]} onPress={() => toggleToday(item)}>
                  <Text style={styles.doneButtonText}>{doneToday ? 'Undo' : 'Done Today'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeButton} onPress={() => removeHabit(item.id)}>
                  <Text style={styles.removeButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Add Habit Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Add Habit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Choose from list:</Text>
          <ScrollView style={styles.libraryList}>
            {libraryHabits.filter((item) =>
              !habits.some((h) => h.name.toLowerCase() === item.name.toLowerCase())
            ).map((item) => (
              <TouchableOpacity key={item.id} style={styles.libraryItem} onPress={() => addHabitFromLibrary(item.name)}>
                <Text style={styles.libraryItemText}>{item.name}</Text>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} animationType="slide" onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{selectedHabit?.name}</Text>
          <Text style={styles.sectionTitle}>Last 30 days:</Text>
          <ScrollView>{renderCalendar()}</ScrollView>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setCalendarVisible(false)}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8 },
  welcome: { fontSize: 18, color: '#666', flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  button: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  habitItem: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  habitCompleted: { backgroundColor: '#f0fff0', borderColor: '#4CAF50' },
  habitMain: { padding: 16 },
  habitText: { fontSize: 16 },
  habitHint: { fontSize: 12, color: '#999', marginTop: 4 },
  habitActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee' },
  doneButton: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#f9f9f9' },
  doneButtonActive: { backgroundColor: '#e0f7e0' },
  doneButtonText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 14 },
  removeButton: { padding: 10, paddingHorizontal: 16, alignItems: 'center', backgroundColor: '#fff5f5' },
  removeButtonText: { fontSize: 18 },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  logoutText: { color: '#666', fontWeight: 'bold' },
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
  cancelText: { color: '#888', fontSize: 16 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  calendarDay: { width: 60, padding: 8, borderRadius: 8, alignItems: 'center' },
  calendarDone: { backgroundColor: '#e0f7e0' },
  calendarMiss: { backgroundColor: '#fff0f0' },
  calendarDayText: { fontSize: 12, color: '#666' },
  calendarDayIcon: { fontSize: 16, marginTop: 4 },
});