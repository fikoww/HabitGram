import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { addDoc, arrayUnion, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { uploadImageToCloudinary } from '../cloudinaryConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

type Habit = { id: string; name: string };

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYNAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CreatePostScreen() {
    const [userId, setUserId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');

    const [habits, setHabits] = useState<Habit[]>([]);
    const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
    const [caption, setCaption] = useState('');
    const [imageUri, setImageUri] = useState('');
    const [posting, setPosting] = useState(false);

    // Date picker
    const [selectedDate, setSelectedDate] = useState(fmt(new Date()));
    const [viewMonth, setViewMonth] = useState(new Date().getMonth());
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [showCal, setShowCal] = useState(false);

    useEffect(() => {
        const unsub = require('firebase/auth').onAuthStateChanged(auth, async (user: any) => {
            if (!user) return;
            setUserId(user.uid);
            const uDoc = await require('firebase/firestore').getDoc(doc(db, 'users', user.uid));
            if (uDoc.exists()) {
                setDisplayName(uDoc.data().displayName || '');
                setUsername(uDoc.data().username || '');
            }
            const snap = await getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid)));
            setHabits(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
        });
        return () => unsub();
    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) setImageUri(result.assets[0].uri);
    };

    const handleShare = async () => {
        if (!userId) return;
        if (!selectedHabit) { Alert.alert('Pick a habit', 'Which habit is this post about?'); return; }
        setPosting(true);
        try {
            let imageUrl = '';
            if (imageUri) {
                try { imageUrl = await uploadImageToCloudinary(imageUri); }
                catch (e) { /* keep going — photo is optional */ }
            }

            // Create the post
            await addDoc(collection(db, 'posts'), {
                userId,
                displayName,
                username,
                habitId: selectedHabit.id,
                habitName: selectedHabit.name,
                caption: caption.trim(),
                imageUrl,
                completedDate: selectedDate,
                likes: [],
                commentCount: 0,
                createdAt: serverTimestamp(),
            });

            // Mark the habit done on that date + save caption as the day's journal
            await setDoc(doc(db, 'habits', selectedHabit.id), {
                completedDates: arrayUnion(selectedDate),
                journals: { [selectedDate]: caption.trim() || 'Completed!' },
            }, { merge: true });

            router.back();
        } catch (e) {
            Alert.alert('Error', 'Failed to share your post. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    // Calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(fmt(new Date(viewYear, viewMonth, d)));
    const todayStr = fmt(new Date());

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Post</Text>
                    <TouchableOpacity onPress={handleShare} disabled={posting}>
                        <Text style={styles.shareText}>{posting ? '...' : 'Share'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Image picker */}
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.image} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Text style={styles.imagePlaceholderIcon}>📷</Text>
                            <Text style={styles.imagePlaceholderText}>Add a photo (optional)</Text>
                        </View>
                    )}
                </TouchableOpacity>
                {imageUri ? (
                    <TouchableOpacity onPress={() => setImageUri('')} style={styles.removePhoto}>
                        <Text style={styles.removePhotoText}>Remove photo</Text>
                    </TouchableOpacity>
                ) : null}

                {/* Habit picker */}
                <Text style={styles.label}>Which habit?</Text>
                {habits.length === 0 ? (
                    <Text style={styles.noHabits}>You have no habits yet. Add one first!</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.habitScroll}>
                        {habits.map((h) => (
                            <TouchableOpacity
                                key={h.id}
                                style={[styles.habitChip, selectedHabit?.id === h.id && styles.habitChipActive]}
                                onPress={() => setSelectedHabit(h)}
                            >
                                <Text style={[styles.habitChipText, selectedHabit?.id === h.id && styles.habitChipTextActive]}>{h.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Date */}
                <Text style={styles.label}>When did you do it?</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowCal(!showCal)}>
                    <Text style={styles.dateButtonText}>📅 {selectedDate}{selectedDate === todayStr ? ' (Today)' : ''}</Text>
                    <Text style={styles.dateChevron}>{showCal ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showCal && (
                    <View style={styles.calendarCard}>
                        <View style={styles.calHeader}>
                            <TouchableOpacity onPress={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} style={styles.calNav}>
                                <Text style={styles.calNavText}>‹</Text>
                            </TouchableOpacity>
                            <Text style={styles.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
                            <TouchableOpacity onPress={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} style={styles.calNav}>
                                <Text style={styles.calNavText}>›</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dayNamesRow}>
                            {DAYNAMES.map((d) => <Text key={d} style={styles.dayNameText}>{d}</Text>)}
                        </View>
                        <View style={styles.calGrid}>
                            {cells.map((dateStr, i) => {
                                if (!dateStr) return <View key={`e${i}`} style={styles.calCell} />;
                                const isSelected = dateStr === selectedDate;
                                const isFuture = dateStr > todayStr;
                                const dayNum = parseInt(dateStr.split('-')[2], 10);
                                return (
                                    <TouchableOpacity key={dateStr} style={styles.calCell} disabled={isFuture} onPress={() => { setSelectedDate(dateStr); setShowCal(false); }}>
                                        <View style={[styles.calDay, isSelected && styles.calDaySelected, isFuture && styles.calDayFuture]}>
                                            <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, isFuture && styles.calDayTextFuture]}>{dayNum}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Caption */}
                <Text style={styles.label}>Caption</Text>
                <TextInput
                    style={styles.captionInput}
                    value={caption}
                    onChangeText={setCaption}
                    placeholder="Say something about it..."
                    placeholderTextColor={MUTED}
                    multiline
                />
                <Text style={styles.captionHint}>Your caption is also saved as this day&apos;s journal note.</Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: LINE, backgroundColor: PAPER },
    headerTitle: { fontSize: 18, fontFamily: SERIF, color: INK },
    cancelText: { fontSize: 15, color: MUTED },
    shareText: { fontSize: 15, color: ACCENT, fontWeight: '700' },
    imagePicker: { margin: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: SURFACE, borderWidth: 0.5, borderColor: LINE },
    image: { width: '100%', height: 240 },
    imagePlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center' },
    imagePlaceholderIcon: { fontSize: 44, marginBottom: 8, opacity: 0.5 },
    imagePlaceholderText: { fontSize: 14, color: MUTED },
    removePhoto: { alignItems: 'center', marginTop: -8, marginBottom: 8 },
    removePhotoText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', color: MUTED, marginTop: 16, marginBottom: 10, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    noHabits: { fontSize: 14, color: MUTED, paddingHorizontal: 16 },
    habitScroll: { paddingHorizontal: 12 },
    habitChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 0.5, borderColor: LINE, marginHorizontal: 4, backgroundColor: SURFACE },
    habitChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    habitChipText: { fontSize: 14, color: '#555' },
    habitChipTextActive: { color: '#fff', fontWeight: '600' },
    dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, backgroundColor: SURFACE, borderWidth: 0.5, borderColor: LINE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
    dateButtonText: { fontSize: 15, color: INK },
    dateChevron: { fontSize: 11, color: MUTED },
    calendarCard: { backgroundColor: SURFACE, marginHorizontal: 16, marginTop: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: LINE },
    calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    calNav: { padding: 6, paddingHorizontal: 14 },
    calNavText: { fontSize: 24, color: ACCENT, fontWeight: '600' },
    calMonth: { fontSize: 15, fontWeight: '600', color: INK },
    dayNamesRow: { flexDirection: 'row', marginBottom: 6 },
    dayNameText: { flex: 1, textAlign: 'center', fontSize: 11, color: MUTED, fontWeight: '600' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 2 },
    calDay: { width: '100%', height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center', maxWidth: 42, maxHeight: 42 },
    calDaySelected: { backgroundColor: ACCENT },
    calDayFuture: { opacity: 0.35 },
    calDayText: { fontSize: 14, color: INK },
    calDayTextSelected: { color: '#fff', fontWeight: '700' },
    calDayTextFuture: { color: MUTED },
    captionInput: { marginHorizontal: 16, backgroundColor: SURFACE, borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 14, fontSize: 15, color: INK, minHeight: 90, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
    captionHint: { fontSize: 12, color: MUTED, paddingHorizontal: 16, marginTop: 8, lineHeight: 17 },
});