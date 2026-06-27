import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { db } from '../firebaseConfig';

type Habit = {
    id: string;
    name: string;
    completed: boolean;
    completedDates?: string[];
    commitment?: number;
    journals?: Record<string, string>;
    createdAt?: any;
};

const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return dates;
};

export default function HabitDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [habit, setHabit] = useState<Habit | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [journalText, setJournalText] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [monthDropdown, setMonthDropdown] = useState(false);
    const [yearDropdown, setYearDropdown] = useState(false);
    const { width } = useWindowDimensions();
    const isWide = width > 700;

    const today = getTodayString();
    const todayDate = new Date();
    const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
    const [viewYear, setViewYear] = useState(todayDate.getFullYear());

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, 'habits', id), (snap) => {
            if (snap.exists()) {
                setHabit({ id: snap.id, ...(snap.data() as Omit<Habit, 'id'>) });
            }
        });
        return unsub;
    }, [id]);

    const saveJournal = async () => {
        if (!habit || !journalText.trim() || !selectedDate) {
            alert('Please write something!');
            return;
        }
        const dates = habit.completedDates || [];
        const newDates = dates.includes(selectedDate) ? dates : [...dates, selectedDate];
        await updateDoc(doc(db, 'habits', habit.id), {
            completedDates: newDates, completed: true,
            journals: { ...(habit.journals || {}), [selectedDate]: journalText.trim() },
        });
        setEditMode(false);
        setJournalText('');
    };

    const markAsUndone = async (date: string) => {
        if (!habit) return;
        const newDates = (habit.completedDates || []).filter((d) => d !== date);
        const journals = { ...(habit.journals || {}) };
        delete journals[date];
        await updateDoc(doc(db, 'habits', habit.id), {
            completedDates: newDates, completed: newDates.includes(today), journals,
        });
        setSelectedDate(null);
    };

    const handleDatePress = (dateStr: string) => {
        if (dateStr > today) return;
        setSelectedDate(dateStr);
        setEditMode(false);
        setJournalText('');
        setMonthDropdown(false);
        setYearDropdown(false);
    };

    const getAvailableYears = () => {
        if (!habit) return [todayDate.getFullYear()];
        let startYear = todayDate.getFullYear();
        if (habit.createdAt?.toDate) startYear = habit.createdAt.toDate().getFullYear();
        const years = [];
        for (let y = startYear; y <= todayDate.getFullYear(); y++) years.push(y);
        return years;
    };

    const renderCalendar = () => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const completedDates = habit?.completedDates || [];
        const cells = [];

        for (let i = 0; i < firstDay; i++) {
            cells.push(<View key={`e${i}`} style={styles.dayCell} />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const done = completedDates.includes(dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const isSelected = dateStr === selectedDate;

            cells.push(
                <TouchableOpacity
                    key={dateStr}
                    style={[styles.dayCell, done && styles.dayCellDone, isToday && styles.dayCellToday, isSelected && styles.dayCellSelected]}
                    onPress={() => handleDatePress(dateStr)}
                    disabled={isFuture}
                >
                    <Text style={[styles.dayNumber, done && styles.dayNumberDone, isToday && styles.dayNumberToday, isFuture && styles.dayNumberFuture, isSelected && styles.dayNumberSelected]}>
                        {d}
                    </Text>
                </TouchableOpacity>
            );
        }
        return cells;
    };

    if (!habit) return (
        <View style={styles.container}>
            <Text style={{ padding: 24, marginTop: 60 }}>Loading...</Text>
        </View>
    );

    const weekDates = getWeekDates();
    const commitment = habit.commitment || 1;
    const doneThisWeek = weekDates.filter((d) => (habit.completedDates || []).includes(d)).length;
    const commitmentMet = doneThisWeek >= commitment;
    const totalDone = (habit.completedDates || []).length;
    const journalEntries = Object.entries(habit.journals || {}).sort((a, b) => b[0].localeCompare(a[0]));
    const years = getAvailableYears();
    const selectedDone = selectedDate ? (habit.completedDates || []).includes(selectedDate) : false;
    const selectedJournal = selectedDate ? habit.journals?.[selectedDate] : null;

    const calendarPanel = (
        <View style={[styles.calendarBox, isWide && { marginHorizontal: 0 }]}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setMonthDropdown(!monthDropdown); setYearDropdown(false); }}>
                    <Text style={styles.dropdownBtnText}>{MONTH_NAMES[viewMonth].slice(0, 3)} ▾</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setYearDropdown(!yearDropdown); setMonthDropdown(false); }}>
                    <Text style={styles.dropdownBtnText}>{viewYear} ▾</Text>
                </TouchableOpacity>
            </View>

            {monthDropdown && (
                <View style={styles.dropdownList}>
                    {MONTH_NAMES.map((m, i) => (
                        <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setViewMonth(i); setMonthDropdown(false); }}>
                            <Text style={[styles.dropdownItemText, viewMonth === i && styles.dropdownItemActive]}>{m}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {yearDropdown && (
                <View style={styles.dropdownList}>
                    {years.map((y) => (
                        <TouchableOpacity key={y} style={styles.dropdownItem} onPress={() => { setViewYear(y); setYearDropdown(false); }}>
                            <Text style={[styles.dropdownItemText, viewYear === y && styles.dropdownItemActive]}>{y}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.dayNamesRow}>
                {DAY_NAMES.map((d, i) => <Text key={i} style={styles.dayNameText}>{d}</Text>)}
            </View>
            <View style={styles.daysGrid}>{renderCalendar()}</View>
        </View>
    );

    const journalPanel = (
        <View style={[styles.journalPanel, isWide && styles.journalPanelWide]}>
            {!selectedDate ? (
                <Text style={styles.journalPanelEmpty}>Tap a date to view or add journal</Text>
            ) : (
                <>
                    <Text style={styles.journalPanelDate}>📅 {selectedDate}</Text>
                    {selectedDone && !editMode ? (
                        <>
                            <View style={styles.journalViewBox}>
                                <Text style={styles.journalViewText}>{selectedJournal || 'No journal written.'}</Text>
                            </View>
                            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditMode(true); setJournalText(selectedJournal || ''); }}>
                                <Text style={styles.editBtnText}>✏️ Edit Journal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.undoneBtn} onPress={() => markAsUndone(selectedDate)}>
                                <Text style={styles.undoneBtnText}>↩️ Mark as Not Done</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TextInput
                                style={styles.journalInput}
                                placeholder="Write about your session..."
                                value={journalText}
                                onChangeText={setJournalText}
                                multiline
                                numberOfLines={4}
                            />
                            <TouchableOpacity style={styles.saveButton} onPress={saveJournal}>
                                <Text style={styles.saveButtonText}>{selectedDone ? 'Save Changes' : 'Mark as Done ✅'}</Text>
                            </TouchableOpacity>
                            {editMode && (
                                <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setEditMode(false); setJournalText(''); }}>
                                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </>
            )}
        </View>
    );

    return (
        <ScrollView style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{habit.name}</Text>
            <Text style={styles.commitment}>🎯 {commitment}x per week</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{totalDone}</Text>
                    <Text style={styles.statLabel}>Total Done</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{doneThisWeek}/{commitment}</Text>
                    <Text style={styles.statLabel}>This Week</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{journalEntries.length}</Text>
                    <Text style={styles.statLabel}>Journals</Text>
                </View>
            </View>

            {/* This week */}
            <View style={[styles.card, commitmentMet && styles.cardDone]}>
                <View style={styles.weekHeader}>
                    <Text style={styles.cardTitle}>This Week</Text>
                    <Text style={[styles.weekProgress, commitmentMet && styles.weekProgressDone]}>
                        {doneThisWeek}/{commitment} done
                    </Text>
                </View>
                <View style={styles.weekRow}>
                    {weekDates.map((date, i) => {
                        const done = (habit.completedDates || []).includes(date);
                        return (
                            <View key={date} style={styles.weekDayCol}>
                                <View style={[styles.weekCircle, done && styles.weekCircleDone]}>
                                    <Text style={[styles.weekCircleText, done && styles.weekCircleTextDone]}>{WEEK_DAYS[i]}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Calendar + Journal */}
            {isWide ? (
                <View style={styles.wideLayout}>
                    {calendarPanel}
                    {journalPanel}
                </View>
            ) : (
                <View style={styles.narrowLayout}>
                    {calendarPanel}
                    {journalPanel}
                </View>
            )}

            {/* All journal entries */}
            {journalEntries.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>All Entries</Text>
                    {journalEntries.map(([date, text]) => (
                        <View key={date} style={styles.journalCard}>
                            <Text style={styles.journalCardHabit}>{habit.name}</Text>
                            <Text style={styles.journalCardDate}>📅 {date}</Text>
                            <Text style={styles.journalCardText}>{text}</Text>
                        </View>
                    ))}
                </>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    backButton: { marginTop: 60, marginLeft: 16, marginBottom: 8 },
    backText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 26, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 4 },
    commitment: { fontSize: 13, color: '#888', paddingHorizontal: 16, marginBottom: 16 },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 12, justifyContent: 'space-around' },
    statBox: { alignItems: 'center' },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12 },
    cardDone: { backgroundColor: '#f0fff0', borderWidth: 1.5, borderColor: '#4CAF50' },
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    weekProgress: { fontSize: 12, color: '#888' },
    weekProgressDone: { color: '#4CAF50', fontWeight: 'bold' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDayCol: { alignItems: 'center' },
    weekCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
    weekCircleDone: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    weekCircleText: { fontSize: 11, color: '#aaa', fontWeight: '600' },
    weekCircleTextDone: { color: '#fff' },
    wideLayout: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
    narrowLayout: { paddingHorizontal: 0, marginBottom: 12 },
    calendarBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12, width: 280 },
    calendarHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    dropdownBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fafafa' },
    dropdownBtnText: { fontSize: 12, fontWeight: '600', color: '#333' },
    dropdownList: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8, maxHeight: 160, overflow: 'hidden' },
    dropdownItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    dropdownItemText: { fontSize: 12, color: '#333' },
    dropdownItemActive: { color: '#4CAF50', fontWeight: 'bold' },
    dayNamesRow: { flexDirection: 'row', marginBottom: 4 },
    dayNameText: { width: 32, textAlign: 'center', fontSize: 10, color: '#aaa', fontWeight: '600' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
    dayCellDone: { backgroundColor: '#e0f7e0' },
    dayCellToday: { borderWidth: 1.5, borderColor: '#4CAF50' },
    dayCellSelected: { backgroundColor: '#4CAF50' },
    dayNumber: { fontSize: 11, color: '#333' },
    dayNumberDone: { color: '#4CAF50', fontWeight: 'bold' },
    dayNumberToday: { color: '#4CAF50', fontWeight: 'bold' },
    dayNumberFuture: { color: '#ddd' },
    dayNumberSelected: { color: '#fff', fontWeight: 'bold' },
    journalPanel: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 12 },
    journalPanelWide: { flex: 1, marginHorizontal: 0 },
    journalPanelEmpty: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
    journalPanelDate: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    journalViewBox: { backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12, marginBottom: 12 },
    journalViewText: { fontSize: 14, color: '#333', lineHeight: 20 },
    editBtn: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
    editBtnText: { fontSize: 13, color: '#333', fontWeight: '600' },
    undoneBtn: { padding: 10, alignItems: 'center' },
    undoneBtnText: { fontSize: 13, color: '#ff4444' },
    journalInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 12, minHeight: 80, textAlignVertical: 'top' },
    saveButton: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    cancelEditBtn: { padding: 10, alignItems: 'center' },
    cancelEditBtnText: { color: '#888', fontSize: 13 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
    journalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10 },
    journalCardHabit: { fontSize: 12, fontWeight: 'bold', color: '#4CAF50', marginBottom: 2 },
    journalCardDate: { fontSize: 11, color: '#aaa', marginBottom: 8 },
    journalCardText: { fontSize: 14, color: '#333', lineHeight: 20 },
});