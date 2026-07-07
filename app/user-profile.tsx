import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

type Habit = {
    id: string;
    name: string;
    completedDates?: string[];
    commitment?: number;
    pinned?: boolean;
};

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

const getWeekStreak = (completedDates: string[], commitment: number) => {
    if (!commitment || commitment <= 0) return { current: 0, max: 0 };
    if (!completedDates || completedDates.length === 0) return { current: 0, max: 0 };

    const weekMap: Record<string, number> = {};
    completedDates.forEach((dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
    });

    const weekKeys = Object.keys(weekMap).sort();
    let maxStreak = 0;
    let tempStreak = 0;
    weekKeys.forEach((key) => {
        if (weekMap[key] >= commitment) {
            tempStreak++;
            maxStreak = Math.max(maxStreak, tempStreak);
        } else {
            tempStreak = 0;
        }
    });

    const today = new Date();
    const todayDay = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - ((todayDay + 6) % 7));
    let checkMonday = new Date(thisMonday);
    let currentStreak = 0;
    while (true) {
        const weekKey = `${checkMonday.getFullYear()}-${String(checkMonday.getMonth() + 1).padStart(2, '0')}-${String(checkMonday.getDate()).padStart(2, '0')}`;
        if (weekMap[weekKey] >= commitment) {
            currentStreak++;
            checkMonday.setDate(checkMonday.getDate() - 7);
        } else {
            break;
        }
    }
    return { current: currentStreak, max: maxStreak };
};

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const weekDates = getWeekDates();

    useEffect(() => {
        if (!id) return;
        const unsubUser = onSnapshot(doc(db, 'users', id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setDisplayName(data.displayName || '');
                setUsername(data.username || '');
                setBio(data.bio || '');
                setPhotoUrl(data.photoUrl || '');
            } else {
                setNotFound(true);
            }
            setLoading(false);
        });
        const q = query(collection(db, 'habits'), where('userId', '==', id));
        const unsubHabits = onSnapshot(q, (snap) => {
            const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Habit, 'id'>) }));
            loaded.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            setHabits(loaded);
        });
        return () => { unsubUser(); unsubHabits(); };
    }, [id]);

    const mostConsistent = habits.reduce((best, h) => {
        if (!best) return h;
        const { max } = getWeekStreak(h.completedDates || [], h.commitment ?? 1);
        const bestMax = getWeekStreak(best.completedDates || [], best.commitment ?? 1).max;
        return max > bestMax ? h : best;
    }, habits[0]);
    const longestStreak = mostConsistent ? getWeekStreak(mostConsistent.completedDates || [], mostConsistent.commitment ?? 1).max : 0;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    if (notFound) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: '#888', marginBottom: 16 }}>User not found.</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: '#4CAF50', fontWeight: '600' }}>← Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                {/* Back button */}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
                        </View>
                    )}
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.username}>@{username}</Text>
                    {bio ? <Text style={styles.bio}>{bio}</Text> : null}
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{habits.length}</Text>
                        <Text style={styles.statLabel}>Habits</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                            {mostConsistent?.name || '-'}
                        </Text>
                        <Text style={styles.statLabel}>Most Consistent</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{longestStreak} week(s)</Text>
                        <Text style={styles.statLabel}>Longest Streak</Text>
                    </View>
                </View>

                {/* Habit list (view-only) */}
                <Text style={styles.sectionTitle}>{displayName ? `${displayName}'s Habits` : 'Habits'}</Text>
                {habits.length === 0 && (
                    <Text style={styles.emptyText}>No habits yet.</Text>
                )}
                {habits.map((habit) => {
                    const commitment = habit.commitment ?? 1;
                    const isNoCommitment = commitment === 0;
                    const { current, max } = getWeekStreak(habit.completedDates || [], commitment);
                    const totalDone = (habit.completedDates || []).length;

                    return (
                        <View key={habit.id} style={styles.habitCard}>
                            <View style={styles.habitHeader}>
                                <View style={styles.habitTitleRow}>
                                    {habit.pinned && <Text style={styles.pinIcon}>📌 </Text>}
                                    <Text style={styles.habitName}>{habit.name}</Text>
                                </View>
                            </View>

                            <View style={styles.weekRow}>
                                {weekDates.map((date, i) => {
                                    const done = (habit.completedDates || []).includes(date);
                                    return (
                                        <View key={date} style={[styles.dayCircle, done && styles.dayCircleDone]}>
                                            <Text style={[styles.dayLabel, done && styles.dayLabelDone]}>{DAYS[i]}</Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {isNoCommitment ? (
                                <View style={styles.habitStatsRow}>
                                    <Text style={styles.habitStat}>Just do it (no goal)</Text>
                                    <Text style={styles.habitStatRed}>🔥 {totalDone}x done total</Text>
                                </View>
                            ) : (
                                <View style={styles.habitStatsRow}>
                                    <Text style={styles.habitStat}>🎯 {commitment}x/week</Text>
                                    <Text style={styles.habitStatPurple}>🔥 {current} week(s) streak</Text>
                                    <Text style={styles.habitStat}>Best: {max} week(s)</Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    backButton: { marginTop: 56, marginLeft: 16, marginBottom: 4, backgroundColor: '#f5f5f5' },
    backText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
    header: { alignItems: 'center', paddingTop: 12, paddingBottom: 24, backgroundColor: '#fff' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
    name: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
    username: { fontSize: 15, color: '#888' },
    bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 20 },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, padding: 16, justifyContent: 'space-around' },
    statBox: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12, paddingHorizontal: 16 },
    emptyText: { textAlign: 'center', color: '#aaa', fontSize: 14, marginTop: 10, paddingHorizontal: 16 },
    habitCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, minHeight: 90 },
    habitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    habitTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    pinIcon: { fontSize: 14 },
    habitName: { fontSize: 16, fontWeight: '600' },
    weekRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    dayCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
    dayCircleDone: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    dayLabel: { fontSize: 11, color: '#aaa', fontWeight: '600' },
    dayLabelDone: { color: '#fff' },
    habitStatsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    habitStat: { fontSize: 12, color: '#666' },
    habitStatPurple: { fontSize: 12, color: '#8E24AA', fontWeight: '700' },
    habitStatRed: { fontSize: 12, color: '#E53935', fontWeight: '700' },
});