import { router, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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

type Habit = {
    id: string;
    name: string;
    completedDates?: string[];
    commitment?: number;
    pinned?: boolean;
};

type Post = {
    id: string;
    userId: string;
    habitName?: string;
    caption?: string;
    imageUrl?: string;
    likes?: string[];
    commentCount?: number;
    completedDate?: string;
    createdAt?: any;
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
    const [isPrivate, setIsPrivate] = useState(false);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'posts' | 'habits'>('posts');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);

    const [meId, setMeId] = useState('');
    const [followState, setFollowState] = useState<'none' | 'requested' | 'following'>('none');
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    const weekDates = getWeekDates();
    const { width: winWidth } = useWindowDimensions();
    const gridSize = Math.floor((winWidth - 4) / 3);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => { if (u) setMeId(u.uid); });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!id) return;

        const unsubUser = onSnapshot(doc(db, 'users', id), (snap) => {
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

        const unsubHabits = onSnapshot(query(collection(db, 'habits'), where('userId', '==', id)), (snap) => {
            const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Habit, 'id'>) }));
            loaded.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            setHabits(loaded);
        });

        // Their posts (sorted client-side to avoid needing a composite index)
        const pq = query(collection(db, 'posts'), where('userId', '==', id));
        const unsubPosts = onSnapshot(pq, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }));
            list.sort((a, b) => {
                const aHasPhoto = a.imageUrl ? 1 : 0;
                const bHasPhoto = b.imageUrl ? 1 : 0;
                if (aHasPhoto !== bHasPhoto) return bHasPhoto - aHasPhoto;
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
            setPosts(list);
        });

        const unsubFollowers = onSnapshot(collection(db, 'users', id, 'followers'), (s) => setFollowersCount(s.size));
        const unsubFollowing = onSnapshot(collection(db, 'users', id, 'following'), (s) => setFollowingCount(s.size));

        return () => { unsubUser(); unsubHabits(); unsubPosts(); unsubFollowers(); unsubFollowing(); };
    }, [id]);

    // Am I following / requested?
    useEffect(() => {
        if (!meId || !id || meId === id) return;
        const unsubF = onSnapshot(doc(db, 'users', meId, 'following', id), (snap) => {
            if (snap.exists()) setFollowState('following');
            else {
                const unsubR = onSnapshot(doc(db, 'users', id, 'followRequests', meId), (r) => {
                    setFollowState(r.exists() ? 'requested' : 'none');
                });
                return () => unsubR();
            }
        });
        return () => unsubF();
    }, [meId, id]);

    const isMe = meId === id;

    const sendFollow = async () => {
        if (!meId || !id) return;
        await setDoc(doc(db, 'users', meId, 'following', id), { createdAt: serverTimestamp() });
        await setDoc(doc(db, 'users', id, 'followers', meId), { createdAt: serverTimestamp() });
    };

    const sendRequest = async () => {
        if (!meId || !id) return;
        const meDoc = await getDoc(doc(db, 'users', meId));
        const meData = meDoc.exists() ? meDoc.data() : {};
        await setDoc(doc(db, 'users', id, 'followRequests', meId), {
            displayName: meData.displayName || '',
            username: meData.username || '',
            photoUrl: meData.photoUrl || '',
            requestedAt: serverTimestamp(),
        });
    };

    const unfollow = async () => {
        if (!meId || !id) return;
        await deleteDoc(doc(db, 'users', meId, 'following', id));
        await deleteDoc(doc(db, 'users', id, 'followers', meId));
    };

    const cancelRequest = async () => {
        if (!meId || !id) return;
        await deleteDoc(doc(db, 'users', id, 'followRequests', meId));
    };

    const handleFollowPress = () => {
        if (followState === 'following') unfollow();
        else if (followState === 'requested') cancelRequest();
        else if (isPrivate) sendRequest();
        else sendFollow();
    };

    const locked = isPrivate && !isMe && followState !== 'following';

    const totalDone = habits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);

    // Top 3 current streaks for the streak row (fire is lit at >= 3 weeks)
    const topStreaks = habits
        .map((h) => {
            const weeks = getWeekStreak(h.completedDates || [], h.commitment ?? 1).current;
            return { name: h.name, weeks, lit: weeks >= 3 };
        })
        .filter((sk) => sk.weeks >= 3)   // only show lit streaks (>= 3 weeks)
        .sort((a, b) => b.weeks - a.weeks)
        .slice(0, 3);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={ACCENT} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
                {/* Back */}
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
                    <Text style={styles.name}>{displayName} {isPrivate ? <Text style={styles.lockMini}>🔒</Text> : null}</Text>
                    <Text style={styles.username}>@{username}</Text>
                    {bio ? <Text style={styles.bio}>{bio}</Text> : null}
                    {/* Top streaks */}
                    {!locked && topStreaks.length > 0 && (
                        <View style={styles.streakWrap}>
                            {topStreaks.map((sk) => (
                                <View key={sk.name} style={styles.streakChip}>
                                    <Text style={styles.fire}>🔥</Text>
                                    <Text style={styles.streakLabel}>
                                        {sk.name} · {sk.weeks}w
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Follower / following counts */}
                    <View style={styles.followRow}>
                        <TouchableOpacity onPress={() => router.push(`/user-list?userId=${id}&type=followers`)}>
                            <Text style={styles.followItem}><Text style={styles.followNum}>{followersCount}</Text> Followers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push(`/user-list?userId=${id}&type=following`)}>
                            <Text style={styles.followItem}><Text style={styles.followNum}>{followingCount}</Text> Following</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Follow button */}
                    {!isMe && (
                        <TouchableOpacity
                            style={[styles.followButton, followState === 'following' && styles.followingButton, followState === 'requested' && styles.requestedButton]}
                            onPress={handleFollowPress}
                        >
                            <Text style={[styles.followButtonText, (followState === 'following' || followState === 'requested') && styles.followingButtonText]}>
                                {followState === 'following' ? 'Following ✓' : followState === 'requested' ? 'Requested' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Locked state for private accounts */}
                {locked ? (
                    <View style={styles.lockedBox}>
                        <Text style={styles.lockedEmoji}>🔒</Text>
                        <Text style={styles.lockedTitle}>This Account is Private</Text>
                        <Text style={styles.lockedText}>Follow this account to see their habits and posts.</Text>
                    </View>
                ) : (
                    <>
                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{habits.length}</Text>
                                <Text style={styles.statLabel}>Habits</Text>
                            </View>
                            <View style={[styles.statBox, styles.statBoxMiddle]}>
                                <Text style={styles.statNumber}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{totalDone}</Text>
                                <Text style={styles.statLabel}>Done</Text>
                            </View>
                        </View>

                        {/* Tab switcher: Posts | Habits */}
                        <View style={styles.tabRow}>
                            <TouchableOpacity
                                style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
                                onPress={() => setActiveTab('posts')}
                            >
                                <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
                                    ▦ Posts {posts.length > 0 ? `(${posts.length})` : ''}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabBtn, activeTab === 'habits' && styles.tabBtnActive]}
                                onPress={() => setActiveTab('habits')}
                            >
                                <Text style={[styles.tabText, activeTab === 'habits' && styles.tabTextActive]}>
                                    🎯 Habits
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* ---------- POSTS GRID ---------- */}
                        {activeTab === 'posts' && (
                            posts.length === 0 ? (
                                <View style={styles.gridEmpty}>
                                    <Text style={styles.gridEmptyEmoji}>📷</Text>
                                    <Text style={styles.emptyText}>No posts yet.</Text>
                                </View>
                            ) : (
                                <View style={styles.grid}>
                                    {posts.map((p) => (
                                        <TouchableOpacity key={p.id} style={[styles.gridItem, { width: gridSize, height: gridSize }]} onPress={() => setSelectedPost(p)}>
                                            {p.imageUrl ? (
                                                <Image source={{ uri: p.imageUrl }} style={styles.gridImage} />
                                            ) : (
                                                <View style={styles.gridNoImage}>
                                                    <Text style={styles.gridNoImageEmoji}>📝</Text>
                                                    <Text style={styles.gridNoImageText} numberOfLines={2}>{p.habitName}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )
                        )}

                        {/* ---------- HABITS LIST ---------- */}
                        {activeTab === 'habits' && habits.length === 0 && (
                            <Text style={styles.emptyText}>No habits yet.</Text>
                        )}
                        {activeTab === 'habits' && habits.map((habit) => {
                            const commitment = habit.commitment ?? 1;
                            const isNoCommitment = commitment === 0;
                            const { current, max } = getWeekStreak(habit.completedDates || [], commitment);
                            const totalDoneH = (habit.completedDates || []).length;

                            return (
                                <View key={habit.id} style={[styles.habitCard, habit.pinned && styles.habitPinned]}>
                                    <View style={styles.habitTitleRow}>
                                        {habit.pinned && <Text style={styles.pinIcon}>📌 </Text>}
                                        <Text style={styles.habitName}>{habit.name}</Text>
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
                                            <Text style={styles.habitStat}>✨ Just do it (no goal)</Text>
                                            <Text style={styles.habitStatRed}>🔥 {totalDoneH}x done total</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.habitStatsRow}>
                                            <Text style={styles.habitStat}>🎯 {commitment}x/week</Text>
                                            <Text style={styles.habitStatPurple}>🔥 {current} week(s) streak</Text>
                                            <Text style={styles.habitStat}>🏆 Best: {max} week(s)</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Post detail modal */}
            <Modal visible={!!selectedPost} animationType="slide" transparent onRequestClose={() => setSelectedPost(null)}>
                <View style={styles.postModalOverlay}>
                    <View style={styles.postModalBox}>
                        <View style={styles.postModalHeader}>
                            <Text style={styles.postModalHabit}>🔥 {selectedPost?.habitName}</Text>
                            <TouchableOpacity onPress={() => setSelectedPost(null)}>
                                <Text style={styles.postModalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {selectedPost?.imageUrl ? (
                                <Image source={{ uri: selectedPost.imageUrl }} style={styles.postModalImage} resizeMode="cover" />
                            ) : null}
                            <View style={styles.postModalBody}>
                                {selectedPost?.completedDate ? (
                                    <Text style={styles.postModalDate}>📅 {selectedPost.completedDate}</Text>
                                ) : null}
                                {selectedPost?.caption ? (
                                    <Text style={styles.postModalCaption}>{selectedPost.caption}</Text>
                                ) : (
                                    <Text style={styles.postModalNoCaption}>No caption</Text>
                                )}
                                <View style={styles.postModalStats}>
                                    <Text style={styles.postModalStat}>❤️ {(selectedPost?.likes || []).length}</Text>
                                    <Text style={styles.postModalStat}>💬 {selectedPost?.commentCount || 0}</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    backButton: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 4 },
    backText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
    header: { alignItems: 'center', paddingTop: 12, paddingBottom: 24, backgroundColor: PAPER },
    avatar: { width: 84, height: 84, borderRadius: 20, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    avatarText: { fontSize: 34, color: '#fff', fontFamily: SERIF },
    name: { fontSize: 27, color: INK, fontFamily: SERIF, letterSpacing: -0.3 },
    lockMini: { fontSize: 16 },
    username: { fontSize: 14, color: MUTED, marginTop: 3 },
    bio: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginTop: 10, paddingHorizontal: 40, lineHeight: 20 },
    followRow: { flexDirection: 'row', gap: 28, marginTop: 16 },
    followItem: { fontSize: 14, color: MUTED },
    followNum: { fontWeight: '700', color: INK },
    followButton: { marginTop: 16, backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 40 },
    followingButton: { backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE },
    requestedButton: { backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE },
    followButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    followingButtonText: { color: INK },
    streakWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 16, marginTop: 14, marginBottom: 2 },
    streakChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 0.5, borderColor: ACCENT },
    fire: { fontSize: 12, marginRight: 4 },
    streakLabel: { fontSize: 11, fontWeight: '600', color: ACCENT },
    lockedBox: { alignItems: 'center', marginTop: 40, marginHorizontal: 24, backgroundColor: SURFACE, borderRadius: 12, padding: 32, borderWidth: 0.5, borderColor: LINE },
    lockedEmoji: { fontSize: 44, marginBottom: 12 },
    lockedTitle: { fontSize: 18, fontFamily: SERIF, color: INK, marginBottom: 8 },
    lockedText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
    statsRow: { flexDirection: 'row', backgroundColor: PAPER, marginTop: 4, paddingVertical: 18, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: LINE },
    statBox: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
    statBoxMiddle: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: LINE },
    statNumber: { fontSize: 25, fontWeight: '700', color: INK, letterSpacing: -0.5 },
    statLabel: { fontSize: 10, color: MUTED, marginTop: 5, textTransform: 'uppercase', letterSpacing: 1 },
    tabRow: { flexDirection: 'row', backgroundColor: PAPER, marginTop: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
    tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -0.5 },
    tabBtnActive: { borderBottomColor: INK },
    tabText: { fontSize: 14, color: MUTED, fontWeight: '600' },
    tabTextActive: { color: INK },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
    gridItem: { overflow: 'hidden' },
    gridImage: { width: '100%', height: '100%' },
    gridNoImage: { width: '100%', height: '100%', backgroundColor: '#F1EEE9', justifyContent: 'center', alignItems: 'center', padding: 6 },
    gridNoImageEmoji: { fontSize: 22, marginBottom: 4 },
    gridNoImageText: { fontSize: 10, color: ACCENT, textAlign: 'center', fontWeight: '600' },
    gridEmpty: { alignItems: 'center', paddingVertical: 48 },
    gridEmptyEmoji: { fontSize: 40, marginBottom: 10, opacity: 0.5 },
    habitCard: { backgroundColor: SURFACE, borderRadius: 12, padding: 16, marginHorizontal: 16, marginTop: 10, borderWidth: 0.5, borderColor: LINE },
    habitPinned: { borderWidth: 1.5, borderColor: ACCENT },
    habitTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    pinIcon: { fontSize: 14 },
    habitName: { fontSize: 16, fontWeight: '600', color: INK },
    weekRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    dayCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: LINE, justifyContent: 'center', alignItems: 'center' },
    dayCircleDone: { backgroundColor: ACCENT, borderColor: ACCENT },
    dayLabel: { fontSize: 11, color: MUTED, fontWeight: '600' },
    dayLabelDone: { color: '#fff' },
    habitStatsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    habitStat: { fontSize: 12, color: '#666' },
    habitStatPurple: { fontSize: 12, color: '#8E24AA', fontWeight: '700' },
    habitStatRed: { fontSize: 12, color: '#E53935', fontWeight: '700' },
    postModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    postModalBox: { backgroundColor: SURFACE, borderRadius: 16, maxHeight: '85%', overflow: 'hidden' },
    postModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: LINE },
    postModalHabit: { fontSize: 15, fontWeight: 'bold', color: ACCENT },
    postModalClose: { fontSize: 18, color: MUTED },
    postModalImage: { width: '100%', height: 320 },
    postModalBody: { padding: 16 },
    postModalDate: { fontSize: 12, color: MUTED, marginBottom: 8 },
    postModalCaption: { fontSize: 15, color: '#333', lineHeight: 22 },
    postModalNoCaption: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
    postModalStats: { flexDirection: 'row', gap: 16, marginTop: 16 },
    postModalStat: { fontSize: 14, color: '#666' },
});