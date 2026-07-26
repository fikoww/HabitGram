import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { arrayRemove, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

type Habit = {
    id: string;
    name: string;
    commitment?: number;
    completedDates?: string[];
    journals?: Record<string, string>;
    pinned?: boolean;
};

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getWeekStreak = (completedDates: string[], commitment: number) => {
    if (!commitment || commitment <= 0) return 0;
    if (!completedDates || completedDates.length === 0) return 0;
    const weekMap: Record<string, number> = {};
    completedDates.forEach((dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        const key = fmt(monday);
        weekMap[key] = (weekMap[key] || 0) + 1;
    });
    const today = new Date();
    const todayDay = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - ((todayDay + 6) % 7));
    let checkMonday = new Date(thisMonday);
    let streak = 0;
    while (true) {
        const key = fmt(checkMonday);
        if ((weekMap[key] || 0) >= commitment) { streak++; checkMonday.setDate(checkMonday.getDate() - 7); }
        else break;
    }
    return streak;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYNAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function HabitDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [habit, setHabit] = useState<Habit | null>(null);
    const [loading, setLoading] = useState(true);

    const [viewMonth, setViewMonth] = useState(new Date().getMonth());
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [journalText, setJournalText] = useState('');

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, 'habits', id), (snap) => {
            if (snap.exists()) setHabit({ id: snap.id, ...(snap.data() as Omit<Habit, 'id'>) });
            setLoading(false);
        });
        return () => unsub();
    }, [id]);

    if (loading) {
        return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color={ACCENT} /></View>;
    }
    if (!habit) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.emptyText}>Habit not found.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
            </View>
        );
    }

    const commitment = habit.commitment ?? 1;
    const isNoCommitment = commitment === 0;
    const completedDates = habit.completedDates || [];
    const journals = habit.journals || {};
    const streak = getWeekStreak(completedDates, commitment);
    const totalDone = completedDates.length;

    const todayStr = fmt(new Date());

    const openDay = (dateStr: string) => {
        setSelectedDate(dateStr);
        setJournalText(journals[dateStr] || '');
    };

    const toggleDone = async () => {
        if (!selectedDate) return;
        const isDone = completedDates.includes(selectedDate);
        await updateDoc(doc(db, 'habits', habit.id), {
            completedDates: isDone ? arrayRemove(selectedDate) : arrayUnion(selectedDate),
        });
    };

    const saveJournal = async () => {
        if (!selectedDate) return;
        await setDoc(doc(db, 'habits', habit.id), {
            journals: { ...journals, [selectedDate]: journalText.trim() },
        }, { merge: true });
        Alert.alert('Saved', 'Your note has been saved.');
        setSelectedDate(null);
    };

    // Calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(fmt(new Date(viewYear, viewMonth, d)));

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{habit.name}</Text>
                    <View style={{ width: 50 }} />
                </View>

                {/* Streak summary */}
                <View style={styles.summaryCard}>
                    <Text style={styles.habitTitle}>{habit.name}</Text>
                    {isNoCommitment ? (
                        <>
                            <Text style={styles.subtitle}>✨ Just do it (no set goal)</Text>
                            <Text style={styles.streakRed}><Ionicons name="flame" size={13} color="#E23B2E" /> {totalDone}x done total</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.subtitle}>🎯 {commitment}x per week</Text>
                            <Text style={styles.streakPurple}><Ionicons name="flame" size={13} color="#E23B2E" /> {streak} week(s) streak</Text>
                        </>
                    )}
                </View>

                {/* Calendar */}
                <View style={styles.calendarCard}>
                    <View style={styles.calHeader}>
                        <TouchableOpacity onPress={prevMonth} style={styles.calNav}><Text style={styles.calNavText}>‹</Text></TouchableOpacity>
                        <Text style={styles.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
                        <TouchableOpacity onPress={nextMonth} style={styles.calNav}><Text style={styles.calNavText}>›</Text></TouchableOpacity>
                    </View>

                    <View style={styles.dayNamesRow}>
                        {DAYNAMES.map((d) => <Text key={d} style={styles.dayNameText}>{d}</Text>)}
                    </View>

                    <View style={styles.calGrid}>
                        {cells.map((dateStr, i) => {
                            if (!dateStr) return <View key={`e${i}`} style={styles.calCell} />;
                            const done = completedDates.includes(dateStr);
                            const hasJournal = !!journals[dateStr];
                            const isToday = dateStr === todayStr;
                            const isFuture = dateStr > todayStr;
                            const dayNum = parseInt(dateStr.split('-')[2], 10);
                            return (
                                <TouchableOpacity
                                    key={dateStr}
                                    style={styles.calCell}
                                    disabled={isFuture}
                                    onPress={() => openDay(dateStr)}
                                >
                                    <View style={[styles.calDay, done && styles.calDayDone, isToday && !done && styles.calDayToday, isFuture && styles.calDayFuture]}>
                                        <Text style={[styles.calDayText, done && styles.calDayTextDone, isFuture && styles.calDayTextFuture]}>{dayNum}</Text>
                                        {hasJournal && <View style={[styles.journalDot, done && { backgroundColor: '#fff' }]} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={styles.calHint}>Tap a day to mark it done or add a note.</Text>
                </View>
            </ScrollView>

            {/* Day editor */}
            {selectedDate && (
                <View style={styles.editorOverlay}>
                    <TouchableOpacity style={styles.editorBackdrop} activeOpacity={1} onPress={() => setSelectedDate(null)} />
                    <View style={styles.editorSheet}>
                        <View style={styles.editorHandle} />
                        <Text style={styles.editorDate}>{selectedDate}</Text>

                        <TouchableOpacity
                            style={[styles.doneButton, completedDates.includes(selectedDate) && styles.doneButtonActive]}
                            onPress={toggleDone}
                        >
                            <Text style={[styles.doneButtonText, completedDates.includes(selectedDate) && styles.doneButtonTextActive]}>
                                {completedDates.includes(selectedDate) ? '✓ Done' : 'Mark as Done'}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.editorLabel}>Note / Journal</Text>
                        <TextInput
                            style={styles.journalInput}
                            value={journalText}
                            onChangeText={setJournalText}
                            placeholder="How did it go?"
                            placeholderTextColor={MUTED}
                            multiline
                        />

                        <TouchableOpacity style={styles.saveButton} onPress={saveJournal}>
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedDate(null)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: PAPER, borderBottomWidth: 0.5, borderBottomColor: LINE },
    backText: { color: ACCENT, fontSize: 16, fontWeight: '600', width: 50 },
    headerTitle: { fontSize: 17, fontFamily: SERIF, color: INK, flex: 1, textAlign: 'center' },
    emptyText: { fontSize: 15, color: MUTED },
    summaryCard: { backgroundColor: SURFACE, margin: 16, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: LINE },
    habitTitle: { fontSize: 22, fontFamily: SERIF, color: INK, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, color: MUTED, marginBottom: 8 },
    streakPurple: { fontSize: 17, color: '#8E24AA', fontWeight: '700' },
    streakRed: { fontSize: 17, color: '#E53935', fontWeight: '700' },
    calendarCard: { backgroundColor: SURFACE, marginHorizontal: 16, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: LINE },
    calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    calNav: { padding: 8, paddingHorizontal: 16 },
    calNavText: { fontSize: 26, color: ACCENT, fontWeight: '600' },
    calMonth: { fontSize: 16, fontWeight: '600', color: INK },
    dayNamesRow: { flexDirection: 'row', marginBottom: 8 },
    dayNameText: { flex: 1, textAlign: 'center', fontSize: 11, color: MUTED, fontWeight: '600' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 2 },
    calDay: { width: '100%', height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center', maxWidth: 44, maxHeight: 44 },
    calDayDone: { backgroundColor: ACCENT },
    calDayToday: { borderWidth: 1.5, borderColor: ACCENT },
    calDayFuture: { opacity: 0.35 },
    calDayText: { fontSize: 14, color: INK },
    calDayTextDone: { color: '#fff', fontWeight: '700' },
    calDayTextFuture: { color: MUTED },
    journalDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT, marginTop: 2 },
    calHint: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 14 },
    editorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
    editorBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    editorSheet: { backgroundColor: SURFACE, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
    editorHandle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 16 },
    editorDate: { fontSize: 17, fontFamily: SERIF, color: INK, textAlign: 'center', marginBottom: 16 },
    doneButton: { borderWidth: 1, borderColor: ACCENT, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
    doneButtonActive: { backgroundColor: ACCENT },
    doneButtonText: { color: ACCENT, fontWeight: '700', fontSize: 15 },
    doneButtonTextActive: { color: '#fff' },
    editorLabel: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    journalInput: { backgroundColor: PAPER, borderWidth: 0.5, borderColor: LINE, borderRadius: 10, padding: 12, fontSize: 15, color: INK, minHeight: 90, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
    saveButton: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    closeButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    closeButtonText: { color: MUTED, fontSize: 15 },
});