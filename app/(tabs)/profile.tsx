import { router } from 'expo-router';
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
    id: string;
    name: string;
    completed: boolean;
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

export default function ProfileScreen() {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [habits, setHabits] = useState<Habit[]>([]);
    const [menuVisible, setMenuVisible] = useState(false);
    const [habitMenuId, setHabitMenuId] = useState<string | null>(null);
    const [changeCommitmentHabit, setChangeCommitmentHabit] = useState<Habit | null>(null);
    const [newCommitment, setNewCommitment] = useState(1);

    const weekDates = getWeekDates();

    useEffect(() => {
        let unsubscribeHabits: (() => void) | undefined;
        let unsubscribeUser: (() => void) | undefined;
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            // Listen to user profile in real-time (so edits show immediately)
            unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setDisplayName(data.displayName || '');
                    setUsername(data.username || '');
                    setBio(data.bio || '');
                    setPhotoUrl(data.photoUrl || '');
                }
            });
            const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
            unsubscribeHabits = onSnapshot(q, (snapshot) => {
                const loaded = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Habit, 'id'>) }));
                loaded.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
                setHabits(loaded);
            });
        });
        return () => {
            unsubscribeAuth();
            if (unsubscribeHabits) unsubscribeHabits();
            if (unsubscribeUser) unsubscribeUser();
        };
    }, []);

    const handleLogout = async () => {
        setMenuVisible(false);
        await signOut(auth);
        router.replace('/');
    };

    const handleResetPassword = async () => {
        setMenuVisible(false);
        const user = auth.currentUser;
        if (!user?.email) return;
        try {
            await sendPasswordResetEmail(auth, user.email);
            Alert.alert('Email sent!', `Password reset email sent to ${user.email}`);
        } catch (error) {
            Alert.alert('Error', 'Failed to send reset email.');
        }
    };

    const handleDeleteHabit = async (id: string) => {
        setHabitMenuId(null);
        Alert.alert('Delete Habit', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'habits', id)) },
        ]);
    };

    const handlePinHabit = async (habit: Habit) => {
        setHabitMenuId(null);
        await updateDoc(doc(db, 'habits', habit.id), { pinned: !habit.pinned });
    };

    const handleChangeCommitment = async () => {
        if (!changeCommitmentHabit) return;
        await updateDoc(doc(db, 'habits', changeCommitmentHabit.id), { commitment: newCommitment });
        setChangeCommitmentHabit(null);
    };

    const mostConsistent = habits.reduce((best, h) => {
        if (!best) return h;
        const { max } = getWeekStreak(h.completedDates || [], h.commitment || 1);
        const bestMax = getWeekStreak(best.completedDates || [], best.commitment || 1).max;
        return max > bestMax ? h : best;
    }, habits[0]);

    const longestStreak = mostConsistent ? getWeekStreak(mostConsistent.completedDates || [], mostConsistent.commitment || 1).max : 0;

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {displayName ? displayName[0].toUpperCase() : '?'}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.username}>@{username}</Text>
                    {bio ? <Text style={styles.bio}>{bio}</Text> : null}

                    {/* Edit Profile button */}
                    <TouchableOpacity style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(!menuVisible)}>
                        <Text style={styles.menuDots}>⋮</Text>
                    </TouchableOpacity>
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

                {/* Habit list */}
                <Text style={styles.sectionTitle}>My Habits</Text>
                {habits.map((habit) => {
                    const commitment = habit.commitment || 1;
                    const { current, max } = getWeekStreak(habit.completedDates || [], commitment);
                    const doneThisWeek = weekDates.filter((date) => (habit.completedDates || []).includes(date)).length;
                    const commitmentMet = doneThisWeek >= commitment;

                    return (
                        <TouchableOpacity
                            key={habit.id}
                            style={[styles.habitCard, habit.pinned && styles.habitPinned, commitmentMet && styles.habitCardDone]}
                            onPress={() => router.push(`/habit-detail?id=${habit.id}`)}
                        >
                            <View style={styles.habitHeader}>
                                <View style={styles.habitTitleRow}>
                                    {habit.pinned && <Text style={styles.pinIcon}>📌 </Text>}
                                    <Text style={styles.habitName}>{habit.name}</Text>
                                </View>
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setHabitMenuId(habitMenuId === habit.id ? null : habit.id); }}>
                                    <Text style={styles.habitMenuDots}>⋮</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Habit popout menu */}
                            {habitMenuId === habit.id && (
                                <View style={styles.habitPopout}>
                                    <TouchableOpacity style={styles.habitMenuItem} onPress={() => handlePinHabit(habit)}>
                                        <Text style={styles.habitMenuText}>{habit.pinned ? '📌 Unpin' : '📌 Pin Habit'}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.menuDivider} />
                                    <TouchableOpacity style={styles.habitMenuItem} onPress={() => {
                                        setHabitMenuId(null);
                                        setNewCommitment(habit.commitment || 1);
                                        setChangeCommitmentHabit(habit);
                                    }}>
                                        <Text style={styles.habitMenuText}>✏️ Change Commitment</Text>
                                    </TouchableOpacity>
                                    <View style={styles.menuDivider} />
                                    <TouchableOpacity style={styles.habitMenuItem} onPress={() => handleDeleteHabit(habit.id)}>
                                        <Text style={[styles.habitMenuText, { color: '#ff4444' }]}>🗑️ Delete Habit</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Week circles */}
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

                            {/* Stats */}
                            <View style={styles.habitStatsRow}>
                                <Text style={styles.habitStat}>🎯 {commitment}x/week</Text>
                                <Text style={styles.habitStat}>🔥 {current} week(s) streak</Text>
                                <Text style={styles.habitStat}>🏆 Best: {max} week(s)</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Profile dropdown menu */}
            {menuVisible && (
                <TouchableOpacity style={styles.overlay} onPress={() => setMenuVisible(false)} activeOpacity={1}>
                    <View style={styles.dropdownMenu}>
                        <TouchableOpacity style={styles.menuItem} onPress={handleResetPassword}>
                            <Text style={styles.menuItemText}>🔑 Reset Password</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                            <Text style={[styles.menuItemText, { color: '#ff4444' }]}>🚪 Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            )}

            {/* Change Commitment Modal */}
            <Modal visible={!!changeCommitmentHabit} animationType="fade" transparent onRequestClose={() => setChangeCommitmentHabit(null)}>
                <View style={styles.commitmentOverlay}>
                    <View style={styles.commitmentBox}>
                        <Text style={styles.commitmentTitle}>Change Commitment</Text>
                        <Text style={styles.commitmentSubtitle}>{changeCommitmentHabit?.name}</Text>
                        <View style={styles.commitmentRow}>
                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                <TouchableOpacity
                                    key={num}
                                    style={[styles.commitmentChip, newCommitment === num && styles.commitmentChipActive]}
                                    onPress={() => setNewCommitment(num)}
                                >
                                    <Text style={[styles.commitmentChipText, newCommitment === num && styles.commitmentChipTextActive]}>{num}x</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.saveButton} onPress={handleChangeCommitment}>
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setChangeCommitmentHabit(null)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#fff' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
    name: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
    username: { fontSize: 15, color: '#888' },
    bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 20 },
    editButton: { marginTop: 16, borderWidth: 1, borderColor: '#4CAF50', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 32 },
    editButtonText: { color: '#4CAF50', fontWeight: '600', fontSize: 14 },
    menuButton: { position: 'absolute', top: 60, right: 20, padding: 8 },
    menuDots: { fontSize: 24, color: '#333', fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, padding: 16, justifyContent: 'space-around' },
    statBox: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12, paddingHorizontal: 16 },
    habitCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, position: 'relative', minHeight: 100 },
    habitPinned: { borderWidth: 1.5, borderColor: '#4CAF50' },
    habitCardDone: { backgroundColor: '#f0fff0', borderWidth: 1.5, borderColor: '#4CAF50' },
    habitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    habitTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    pinIcon: { fontSize: 14 },
    habitName: { fontSize: 16, fontWeight: '600' },
    habitMenuDots: { fontSize: 20, color: '#888', paddingHorizontal: 4 },
    habitPopout: { position: 'absolute', top: 40, right: 16, backgroundColor: '#fff', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, minWidth: 160, zIndex: 99 },
    habitMenuItem: { padding: 10 },
    habitMenuText: { fontSize: 13, color: '#333' },
    weekRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    dayCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
    dayCircleDone: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    dayLabel: { fontSize: 11, color: '#aaa', fontWeight: '600' },
    dayLabelDone: { color: '#fff' },
    habitStatsRow: { flexDirection: 'row', gap: 12 },
    habitStat: { fontSize: 12, color: '#666' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dropdownMenu: { position: 'absolute', top: 100, right: 16, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, minWidth: 180 },
    menuItem: { padding: 16 },
    menuItemText: { fontSize: 15, color: '#333' },
    menuDivider: { height: 1, backgroundColor: '#f0f0f0' },
    commitmentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    commitmentBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
    commitmentTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
    commitmentSubtitle: { fontSize: 15, color: '#888', marginBottom: 16, textAlign: 'center' },
    commitmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
    commitmentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
    commitmentChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    commitmentChipText: { color: '#666' },
    commitmentChipTextActive: { color: '#fff', fontWeight: 'bold' },
    saveButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelButton: { padding: 14, borderRadius: 8, alignItems: 'center' },
    cancelText: { color: '#888', fontSize: 16 },
});