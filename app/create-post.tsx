import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { addDoc, arrayUnion, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db, storage } from '../firebaseConfig';

type Habit = { id: string; name: string };

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CreatePostScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  // Date picker
  const today = getTodayString();
  const todayDate = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid))).then((snap) => {
      setHabits(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });

    import('firebase/firestore').then(({ getDoc, doc }) => {
      getDoc(doc(db, 'users', user.uid)).then((userDoc) => {
        if (userDoc.exists()) {
          setDisplayName(userDoc.data().displayName || '');
          setUsername(userDoc.data().username || '');
        }
      });
    });
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const uploadImageToStorage = async (uri: string, userId: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `posts/${userId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    const uploadPromise = uploadBytes(storageRef, blob).then(() => getDownloadURL(storageRef));
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Upload timed out')), 15000)
    );
    return await Promise.race([uploadPromise, timeoutPromise]);
  };

  // ---- Mini calendar navigation ----
  const goPrevMonth = () => {
    let m = viewMonth - 1, y = viewYear;
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  };
  const canGoNext = !(viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth()) && viewYear <= todayDate.getFullYear();
  const goNextMonth = () => {
    if (!canGoNext) return;
    let m = viewMonth + 1, y = viewYear;
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  const renderCalendar = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<View key={`e${i}`} style={styles.calCell} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = dateStr > today;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === today;
      cells.push(
        <TouchableOpacity
          key={dateStr}
          style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
          disabled={isFuture}
          onPress={() => setSelectedDate(dateStr)}
        >
          <Text style={[styles.calNum, isFuture && styles.calNumFuture, isSelected && styles.calNumSelected]}>{d}</Text>
        </TouchableOpacity>
      );
    }
    return cells;
  };

  const handlePost = async () => {
    if (!selectedHabit) {
      Alert.alert('Pick a habit', 'Select which habit this post is for.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setUploading(true);
    let photoFailed = false;
    try {
      let imageUrl = '';
      if (imageUri) {
        try {
          imageUrl = await uploadImageToStorage(imageUri, user.uid);
        } catch (uploadErr) {
          photoFailed = true;
          imageUrl = '';
        }
      }

      // 1) Create the post
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        displayName,
        username,
        habitName: selectedHabit.name,
        habitId: selectedHabit.id,
        caption: caption.trim(),
        imageUrl,
        completedDate: selectedDate,   // which day this log is for
        likes: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      });

      // 2) Mark the habit DONE for the SELECTED date AND save the caption as
      //    that day's journal (defaults to "Completed!" when caption is empty).
      //    setDoc + merge deep-merges the journals map, so other days' journals
      //    are preserved. arrayUnion won't duplicate an already-logged date.
      try {
        await setDoc(doc(db, 'habits', selectedHabit.id), {
          completedDates: arrayUnion(selectedDate),
          completed: true,
          journals: { [selectedDate]: caption.trim() || 'Completed!' },
        }, { merge: true });
      } catch (habitErr) {
        // post already succeeded; ignore
      }

      if (photoFailed) {
        Alert.alert(
          'Posted (without photo)',
          'Your post was shared and the habit was marked done, but the photo could not be uploaded on web. Try the mobile app for photos.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
        );
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create post. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity style={[styles.postBtn, uploading && { opacity: 0.6 }]} onPress={handlePost} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.postBtnText}>Share</Text>}
          </TouchableOpacity>
        </View>

        {/* Image picker (optional) */}
        {imageUri ? (
          <View>
            <TouchableOpacity onPress={pickImage}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.changePhotoOverlay}>
                <Text style={styles.changePhotoText}>Tap to change</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setImageUri(null)}>
              <Text style={styles.removePhotoText}>✕ Remove photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePicker}>
            <Text style={styles.imagePickerEmoji}>📷</Text>
            <Text style={styles.imagePickerTitle}>Add a photo (optional)</Text>
            <Text style={styles.imagePickerSubtitle}>Add proof if you want — or just post!</Text>
            <View style={styles.imagePickerBtns}>
              <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
                <Text style={styles.imageBtnText}>📸 Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                <Text style={styles.imageBtnText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="How did it go? Share your experience..."
            placeholderTextColor="#bbb"
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Habit picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Which habit? *</Text>
          {habits.length === 0 ? (
            <Text style={styles.noHabits}>No habits yet. Add habits from your profile first!</Text>
          ) : (
            habits.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={[styles.habitOption, selectedHabit?.id === h.id && styles.habitOptionActive]}
                onPress={() => setSelectedHabit(h)}
              >
                <Text style={[styles.habitOptionText, selectedHabit?.id === h.id && styles.habitOptionTextActive]}>
                  {selectedHabit?.id === h.id ? '✅ ' : '○ '}{h.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Date picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>When did you do it?</Text>
          <View style={styles.calBox}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={goPrevMonth} style={styles.calNavBtn}>
                <Text style={styles.calNav}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonth}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={goNextMonth} style={styles.calNavBtn} disabled={!canGoNext}>
                <Text style={[styles.calNav, !canGoNext && styles.calNavDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calDayNames}>
              {DAY_NAMES.map((d, i) => <Text key={i} style={styles.calDayName}>{d}</Text>)}
            </View>
            <View style={styles.calGrid}>{renderCalendar()}</View>
          </View>
          <Text style={styles.selectedDateText}>
            📅 {selectedDate}{selectedDate === today ? ' (today)' : ''}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cancelText: { fontSize: 16, color: '#888' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  postBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  imagePicker: { margin: 16, height: 240, borderRadius: 12, borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  imagePickerEmoji: { fontSize: 40, marginBottom: 8 },
  imagePickerTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  imagePickerSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  imagePickerBtns: { flexDirection: 'row', gap: 12 },
  imageBtn: { borderWidth: 1, borderColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  imageBtnText: { color: '#4CAF50', fontWeight: '600' },
  previewImage: { width: '100%', height: 300 },
  changePhotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, alignItems: 'center' },
  changePhotoText: { color: '#fff', fontWeight: '600' },
  removePhotoBtn: { alignItems: 'center', paddingVertical: 10 },
  removePhotoText: { color: '#ff4444', fontWeight: '600', fontSize: 14 },
  section: { padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 10, color: '#333' },
  captionInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa', minHeight: 80, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  habitOption: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 8 },
  habitOptionActive: { borderColor: '#4CAF50', backgroundColor: '#f0fff0' },
  habitOptionText: { fontSize: 15, color: '#333' },
  habitOptionTextActive: { color: '#4CAF50', fontWeight: '600' },
  noHabits: { color: '#aaa', fontSize: 14 },
  // Calendar
  calBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa', alignItems: 'center' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 252, marginBottom: 10 },
  calNavBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  calNav: { fontSize: 22, color: '#4CAF50', fontWeight: 'bold' },
  calNavDisabled: { color: '#ddd' },
  calMonth: { fontSize: 14, fontWeight: '600', color: '#333' },
  calDayNames: { flexDirection: 'row', width: 252, marginBottom: 4 },
  calDayName: { width: 36, textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 252 },
  calCell: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  calCellSelected: { backgroundColor: '#4CAF50' },
  calCellToday: { borderWidth: 1.5, borderColor: '#4CAF50' },
  calNum: { fontSize: 13, color: '#333' },
  calNumFuture: { color: '#ddd' },
  calNumSelected: { color: '#fff', fontWeight: 'bold' },
  selectedDateText: { fontSize: 13, color: '#4CAF50', fontWeight: '600', marginTop: 12, textAlign: 'center' },
});