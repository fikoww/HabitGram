import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db, storage } from '../firebaseConfig';

type Habit = { id: string; name: string };

export default function CreatePostScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Load user habits
    getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid))).then((snap) => {
      setHabits(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });

    // Load user profile
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
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handlePost = async () => {
    if (!selectedHabit) {
      Alert.alert('Pick a habit', 'Select which habit this post is for.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Add a photo', 'Please attach a photo as proof!');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage(imageUri, user.uid);
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        displayName,
        username,
        habitName: selectedHabit.name,
        habitId: selectedHabit.id,
        caption: caption.trim(),
        imageUrl,
        likes: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Error', 'Failed to upload post. Try again.');
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

        {/* Image picker */}
        {imageUri ? (
          <TouchableOpacity onPress={pickImage}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.changePhotoOverlay}>
              <Text style={styles.changePhotoText}>Tap to change</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.imagePicker}>
            <Text style={styles.imagePickerEmoji}>📷</Text>
            <Text style={styles.imagePickerTitle}>Add proof photo</Text>
            <Text style={styles.imagePickerSubtitle}>Show that you actually did it!</Text>
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
  section: { padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 10, color: '#333' },
  captionInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa', minHeight: 80, textAlignVertical: 'top' },
  habitOption: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 8 },
  habitOptionActive: { borderColor: '#4CAF50', backgroundColor: '#f0fff0' },
  habitOptionText: { fontSize: 15, color: '#333' },
  habitOptionTextActive: { color: '#4CAF50', fontWeight: '600' },
  noHabits: { color: '#aaa', fontSize: 14 },
});