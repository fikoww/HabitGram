import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { uploadImageToCloudinary } from '../cloudinaryConfig';
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

export default function EditProfileScreen() {
    const [userId, setUserId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [newImageUri, setNewImageUri] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            setUserId(user.uid);
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                const data = snap.data();
                setDisplayName(data.displayName || '');
                setUsername(data.username || '');
                setBio(data.bio || '');
                setPhotoUrl(data.photoUrl || '');
                setIsPrivate(data.isPrivate === true);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) {
            setNewImageUri(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!userId) return;
        if (!displayName.trim()) {
            Alert.alert('Missing name', 'Please enter a display name.');
            return;
        }
        setSaving(true);
        try {
            let finalPhotoUrl = photoUrl;
            if (newImageUri) {
                try {
                    finalPhotoUrl = await uploadImageToCloudinary(newImageUri);
                } catch (e) {
                    Alert.alert('Photo upload failed', 'Your profile was saved, but the photo could not be uploaded. Please check your connection and try again.');
                }
            }
            await setDoc(doc(db, 'users', userId), {
                displayName: displayName.trim(),
                username: username.trim().toLowerCase(),
                bio: bio.trim(),
                photoUrl: finalPhotoUrl,
                isPrivate,
            }, { merge: true });
            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={ACCENT} />
            </View>
        );
    }

    const displayImage = newImageUri || photoUrl;

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
                        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickImage}>
                        {displayImage ? (
                            <Image source={{ uri: displayImage }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
                            </View>
                        )}
                        <View style={styles.cameraBadge}>
                            <Ionicons name="camera" size={15} color="#555" />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickImage}>
                        <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                        style={styles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your name"
                        placeholderTextColor={MUTED}
                    />

                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="username"
                        placeholderTextColor={MUTED}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                        style={[styles.input, styles.bioInput]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Share something about yourself"
                        placeholderTextColor={MUTED}
                        multiline
                        maxLength={150}
                    />

                    {/* Private toggle */}
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Private Account</Text>
                            <Text style={styles.toggleHint}>
                                {isPrivate
                                    ? 'Only approved followers can see your habits and posts.'
                                    : 'Anyone can find you and see your habits and posts.'}
                            </Text>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={setIsPrivate}
                            trackColor={{ false: '#E0DDD6', true: ACCENT }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: LINE, backgroundColor: PAPER },
    headerTitle: { fontSize: 18, fontFamily: SERIF, color: INK },
    cancelText: { fontSize: 15, color: MUTED },
    saveText: { fontSize: 15, color: ACCENT, fontWeight: '700' },
    avatarSection: { alignItems: 'center', paddingVertical: 28 },
    avatar: { width: 96, height: 96, borderRadius: 24, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 40, color: '#fff', fontFamily: SERIF },
    cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: SURFACE, borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: LINE },
    cameraIcon: { fontSize: 16 },
    changePhotoText: { color: ACCENT, fontWeight: '600', fontSize: 14, marginTop: 12 },
    form: { paddingHorizontal: 16 },
    label: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 7, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: SURFACE, borderWidth: 0.5, borderColor: LINE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
    bioInput: { height: 90, textAlignVertical: 'top' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, backgroundColor: SURFACE, borderRadius: 12, padding: 16, gap: 12, borderWidth: 0.5, borderColor: LINE },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: INK },
    toggleHint: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 17, paddingRight: 8 },
});