import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db, storage } from '../firebaseConfig';

export default function EditProfileScreen() {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDisplayName(data.displayName || '');
        setUsername(data.username || '');
        setOriginalUsername(data.username || '');
        setBio(data.bio || '');
        setPhotoUrl(data.photoUrl || '');
      }
      setLoading(false);
    });
    return () => unsub();
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
    if (!result.canceled) setNewImageUri(result.assets[0].uri);
  };

  const uploadImage = async (uri: string, uid: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handleSave = async () => {
    setError('');
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    if (!username.trim()) {
      setError('Username cannot be empty.');
      return;
    }
    if (username.includes(' ')) {
      setError('Username cannot contain spaces.');
      return;
    }

    setSaving(true);
    try {
      // Check username uniqueness (only if changed)
      if (username.trim().toLowerCase() !== originalUsername.toLowerCase()) {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase())));
        if (!snap.empty) {
          setError('Username already taken. Try another!');
          setSaving(false);
          return;
        }
      }

      // Try to upload new photo if changed. If it fails (e.g. CORS on web),
      // keep the old photo and still save the text fields.
      let finalPhotoUrl = photoUrl;
      let photoFailed = false;
      if (newImageUri) {
        try {
          finalPhotoUrl = await uploadImage(newImageUri, userId);
        } catch (uploadErr) {
          photoFailed = true;
          finalPhotoUrl = photoUrl; // fall back to existing photo
        }
      }

      // Update Firestore with text fields (and photo if it uploaded)
      await setDoc(doc(db, 'users', userId), {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        photoUrl: finalPhotoUrl,
      }, { merge: true });

      if (photoFailed) {
        Alert.alert(
          'Saved (without photo)',
          'Your profile was saved, but the photo could not be uploaded on web. Try uploading the photo from the mobile app.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        router.back();
      }
    } catch (e: any) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const displayedImage = newImageUri || photoUrl;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#4CAF50" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage}>
            {displayedImage ? (
              <Image source={{ uri: displayedImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {displayName ? displayName[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={(t) => { setDisplayName(t); setError(''); }}
            placeholder="Your name"
            placeholderTextColor="#bbb"
          />

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.usernameInput}
              value={username}
              onChangeText={(t) => { setUsername(t.toLowerCase()); setError(''); }}
              placeholder="username"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
            maxLength={150}
          />
          <Text style={styles.charCount}>{bio.length}/150</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cancelText: { fontSize: 16, color: '#888' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  saveText: { fontSize: 16, color: '#4CAF50', fontWeight: 'bold' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  editBadgeText: { fontSize: 16 },
  changePhotoText: { color: '#4CAF50', fontWeight: '600', marginTop: 12, fontSize: 15 },
  section: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  usernameContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 10, backgroundColor: '#fafafa' },
  atSign: { paddingLeft: 14, fontSize: 15, color: '#888' },
  usernameInput: { flex: 1, padding: 14, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  bioInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', minHeight: 80, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4 },
  errorText: { color: '#ff4444', fontSize: 13, marginTop: 12 },
});