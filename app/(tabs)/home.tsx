import { router } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
  id: string;
  name: string;
  completed: boolean;
  completedDates?: string[];
  commitment?: number;
  journals?: Record<string, string>;
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
  const [commitment, setCommitment] = useState(1);
  const [pendingHabit, setPendingHabit] = useState<string | null>(null);
  const [commitmentModalVisible, setCommitmentModalVisible] = useState(false);

  // Journal states
  const [journalModal, setJournalModal] = useState(false);
  const [journalText, setJournalText] = useState('');
  const [activeHabit, setActiveHabit] = useState<Habit | null>(null);
  const [optionsModal, setOptionsModal] = useState(false);

  // Delete state
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);

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

  const confirmAddHabit = async () => {
    const user = auth.currentUser;
    if (!user || !pendingHabit) return;

    const alreadyExists = habits.some((h) => h.name.toLowerCase() === pendingHabit.toLowerCase());
    if (alreadyExists) {
      alert('Habit already in your list!');
      setCommitmentModalVisible(false);
      setPendingHabit(null);
      return;
    }

    await addDoc(collection(db, 'habits'), {
      name: pendingHabit,
      completed: false,
      completedDates: [],
      commitment: commitment,
      journals: {},
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setPendingHabit(null);
    setCommitment(1);
    setCommitmentModalVisible(false);
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
      commitment: commitment,
      journals: {},
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setNewHabitName('');
    setCommitment(1);
    setModalVisible(false);
  };

  const handleDonePress = (habit: Habit) => {
    const today = getTodayString();
    const doneToday = (habit.completedDates || []).includes(today);
    setActiveHabit(habit);
    if (doneToday) {
      setOptionsModal(true);
    } else {
      setJournalText('');
      setJournalModal(true);
    }
  };

  const saveJournal = async () => {
    if (!activeHabit || !journalText.trim()) {
      alert('Please write something in your journal!');
      return;
    }
    const today = getTodayString();
    const dates = activeHabit.completedDates || [];
    const newDates = dates.includes(today) ? dates : [...dates, today];
    const journals = activeHabit.journals || {};
    await updateDoc(doc(db, 'habits', activeHabit.id), {
      completedDates: newDates,
      completed: true,
      journals: { ...journals, [today]: journalText.trim() },
    });
    setJournalModal(false);
    setActiveHabit(null);
    setJournalText('');
  };

  const openEditJournal = () => {
    const today = getTodayString();
    setOptionsModal(false);
    setJournalText(activeHabit?.journals?.[today] || '');
    setJournalModal(true);
  };

  const markAsUndone = async () => {
    if (!activeHabit) return;
    const today = getTodayString();
    const newDates = (activeHabit.completedDates || []).filter((d) => d !== today);
    const journals = { ...(activeHabit.journals || {}) };
    delete journals[today];
    await updateDoc(doc(db, 'habits', activeHabit.id), {
      completedDates: newDates,
      completed: false,
      journals,
    });
    setOptionsModal(false);
    setActiveHabit(null);
  };

  const removeHabit = (id: string) => {
    setDeleteHabitId(id);
  };

  const confirmDelete = async () => {
    if (!deleteHabitId) return;
    await deleteDoc(doc(db, 'habits', deleteHabitId));
    setDeleteHabitId(null);
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
        renderItem={({ item }) => {
          const today = getTodayString();
          const doneToday = (item.completedDates || []).includes(today);
          return (
            <TouchableOpacity
              style={[styles.habitItem, doneToday && styles.habitCompleted]}
              onPress={() => router.push(`/habit-detail?id=${item.id}`)}
            >
              <View style={styles.habitMain}>
                <Text style={styles.habitText}>{doneToday ? '✅' : '🔥'} {item.name}</Text>
                <Text style={styles.habitCommitment}>🎯 {item.commitment || 1}x per week</Text>
                {doneToday && item.journals?.[today] && (
                  <Text style={styles.journalPreview}>📝 {item.journals[today].slice(0, 40)}{item.journals[today].length > 40 ? '...' : ''}</Text>
                )}
              </View>
              <View style={styles.habitActions}>
                <TouchableOpacity
                  style={[styles.doneButton, doneToday && styles.doneButtonActive]}
                  onPress={(e) => { e.stopPropagation(); handleDonePress(item); }}
                >
                  <Text style={styles.doneButtonText}>{doneToday ? '✅ Done' : 'Done Today'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={(e) => { e.stopPropagation(); removeHabit(item.id); }}
                >
                  <Text style={styles.removeButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
              <TouchableOpacity key={item.id} style={styles.libraryItem} onPress={() => {
                setPendingHabit(item.name);
                setCommitmentModalVisible(true);
              }}>
                <Text style={styles.libraryItemText}>{item.name}</Text>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Or add new to "{selectedCategory}":</Text>
          <Text style={styles.sectionTitle}>Commitment per week:</Text>
          <View style={styles.commitmentRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.commitmentChip, commitment === num && styles.commitmentChipActive]}
                onPress={() => setCommitment(num)}
              >
                <Text style={[styles.commitmentChipText, commitment === num && styles.commitmentChipTextActive]}>{num}x</Text>
              </TouchableOpacity>
            ))}
          </View>
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

      {/* Commitment Modal */}
      <Modal visible={commitmentModalVisible} animationType="fade" transparent onRequestClose={() => setCommitmentModalVisible(false)}>
        <View style={styles.overlayCenter}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>How often per week?</Text>
            <Text style={styles.overlaySubtitle}>{pendingHabit}</Text>
            <View style={styles.commitmentRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.commitmentChip, commitment === num && styles.commitmentChipActive]}
                  onPress={() => setCommitment(num)}
                >
                  <Text style={[styles.commitmentChipText, commitment === num && styles.commitmentChipTextActive]}>{num}x</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.button} onPress={confirmAddHabit}>
              <Text style={styles.buttonText}>Add Habit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => {
              setCommitmentModalVisible(false);
              setPendingHabit(null);
              setCommitment(1);
            }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Journal Modal */}
      <Modal visible={journalModal} animationType="slide" transparent onRequestClose={() => setJournalModal(false)}>
        <View style={styles.overlayBottom}>
          <View style={styles.overlayBottomBox}>
            <Text style={styles.overlayTitle}>How did it go? 📝</Text>
            <Text style={styles.overlaySubtitle}>{activeHabit?.name} — Today</Text>
            <TextInput
              style={styles.journalInput}
              placeholder="Write about your session... (required)"
              value={journalText}
              onChangeText={setJournalText}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.button} onPress={saveJournal}>
              <Text style={styles.buttonText}>Mark as Done ✅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setJournalModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsModal} animationType="fade" transparent onRequestClose={() => setOptionsModal(false)}>
        <View style={styles.overlayCenter}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>Already done today! 🎉</Text>
            <Text style={styles.overlaySubtitle}>{activeHabit?.name}</Text>
            <TouchableOpacity style={styles.button} onPress={openEditJournal}>
              <Text style={styles.buttonText}>✏️ Edit Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#ff4444' }]} onPress={markAsUndone}>
              <Text style={styles.buttonText}>↩️ Mark as Not Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setOptionsModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!deleteHabitId} animationType="fade" transparent onRequestClose={() => setDeleteHabitId(null)}>
        <View style={styles.overlayCenter}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>Delete Habit?</Text>
            <Text style={styles.overlaySubtitle}>This can't be undone.</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#ff4444' }]} onPress={confirmDelete}>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteHabitId(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  habitCommitment: { fontSize: 12, color: '#4CAF50', marginTop: 4 },
  journalPreview: { fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' },
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
  cancelButton: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#888', fontSize: 16 },
  commitmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  commitmentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  commitmentChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  commitmentChipText: { color: '#666' },
  commitmentChipTextActive: { color: '#fff', fontWeight: 'bold' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  overlayBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  overlayBottomBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, paddingBottom: 40 },
  overlayTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  overlaySubtitle: { fontSize: 14, color: '#888', marginBottom: 16, textAlign: 'center' },
  journalInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 16, minHeight: 100, textAlignVertical: 'top' },
});