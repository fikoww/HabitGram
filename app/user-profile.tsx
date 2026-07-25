import { router, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

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

const hasPhoto = (imageUrl: any) => {
    if (typeof imageUrl !== 'string') return false;
    const trimmed = imageUrl.trim().toLowerCase();
    return trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined';
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
    const [myId, setMyId] = useState('');
    const [myInfo, setMyInfo] = useState<{ displayName: string; username: string; photoUrl: string }>({ displayName: '', username: '', photoUrl: '' });

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
    const [notFound, setNotFound] = useState(false);

    // Follow state
    const [followState, setFollowState] = useState<'none' | 'requested' | 'following'>('none');
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [busy, setBusy] = useState(false);

    const weekDates = getWeekDates();

    // 3 columns: subtract the two 2px gaps, floor to avoid sub-pixel wrapping
    const { width: winWidth } = useWindowDimensions();
    const gridSize = Math.floor((winWidth - 4) / 3);

    // Current user id + my info (for storing in the request)
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            setMyId(user.uid);
            const meDoc = await getDoc(doc(db, 'users', user.uid));
            if (meDoc.exists()) {
                const d = meDoc.data();
                setMyInfo({ displayName: d.displayName || '', username: d.username || '', photoUrl: d.photoUrl || '' });
            }
        });
        return () => unsub();
    }, []);

    // Load target user + their habits
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
        // Follower/following counts (of the target user)
        // Their posts (sorted client-side to avoid needing a composite index)
        const pq = query(collection(db, 'posts'), where('userId', '==', id));
        const unsubPosts = onSnapshot(pq, (snap) => {
            const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }))
                .filter((p) => hasPhoto(p.imageUrl));
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPosts(list);
        });
        const unsubFollowers = onSnapshot(collection(db, 'users', id, 'followers'), (s) => setFollowersCount(s.size));
        const unsubFollowing = onSnapshot(collection(db, 'users', id, 'following'), (s) => setFollowingCount(s.size));
        return () => { unsubUser(); unsubHabits(); unsubPosts(); unsubFollowers(); unsubFollowing(); };
    }, [id]);

    // My relationship to the target (following? requested?)
    useEffect(() => {
        if (!myId || !id || myId === id) return;
        const unsubFollowing = onSnapshot(doc(db, 'users', myId, 'following', id), (snap) => {
            if (snap.exists()) setFollowState('following');
            else {
                // not following — check if request pending
                setFollowState((prev) => (prev === 'following' ? 'none' : prev));
            }
        });
        const unsubReq = onSnapshot(doc(db, 'users', id, 'followRequests', myId), (snap) => {
            setFollowState((prev) => {
                if (prev === 'following') return prev;
                return snap.exists() ? 'requested' : 'none';
            });
        });
        return () => { unsubFollowing(); unsubReq(); };
    }, [myId, id]);

    const sendRequest = async () => {
        if (!myId || !id) return;
        setBusy(true);
        try {
            await setDoc(doc(db, 'users', id, 'followRequests', myId), {
                displayName: myInfo.displayName,
                username: myInfo.username,
                photoUrl: myInfo.photoUrl,
                requestedAt: serverTimestamp(),
            });
            setFollowState('requested');
        } finally { setBusy(false); }
    };

    // Public account: follow immediately (no approval needed)
    const sendFollow = async () => {
        if (!myId || !id) return;
        setBusy(true);
        try {
            await setDoc(doc(db, 'users', myId, 'following', id), { createdAt: serverTimestamp() });
            await setDoc(doc(db, 'users', id, 'followers', myId), { createdAt: serverTimestamp() });
            setFollowState('following');
        } finally { setBusy(false); }
    };

    const cancelRequest = async () => {
        if (!myId || !id) return;
        setBusy(true);
        try {
            await deleteDoc(doc(db, 'users', id, 'followRequests', myId));
            setFollowState('none');
        } finally { setBusy(false); }
    };

    const unfollow = async () => {
        if (!myId || !id) return;
        setBusy(true);
        try {
            await deleteDoc(doc(db, 'users', myId, 'following', id));
            await deleteDoc(doc(db, 'users', id, 'followers', myId));
            setFollowState('none');
        } finally { setBusy(false); }
    };

    const mostConsistent = habits.reduce((best, h) => {
        if (!best) return h;
        const { max } = getWeekStreak(h.completedDates || [], h.commitment ?? 1);
        const bestMax = getWeekStreak(best.completedDates || [], best.commitment ?? 1).max;
        return max > bestMax ? h : best;
    }, habits[0]);
    const longestStreak = mostConsistent ? getWeekStreak(mostConsistent.completedDates || [], mostConsistent.commitment ?? 1).max : 0;

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

    const isMe = myId === id;
    const locked = isPrivate && !isMe && followState !== 'following';

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container}>
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
                    <Text style={styles.name}>{displayName} {isPrivate && <Text style={styles.lockBadge}>🔒</Text>}</Text>
                    <Text style={styles.username}>@{username}</Text>
                    {bio ? <Text style={styles.bio}>{bio}</Text> : null}
                    {/* Top streaks */}
                    {topStreaks.length > 0 && (
                        <View style={styles.streakWrap}>
                            {topStreaks.map((sk) => (
                                <View key={sk.name} style={[styles.streakChip, sk.lit ? styles.streakChipLit : styles.streakChipCold]}>
                                    <Text style={[styles.fire, !sk.lit && styles.fireCold]}>🔥</Text>
                                    <Text style={[styles.streakLabel, sk.lit ? styles.streakLabelLit : styles.streakLabelCold]}>
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

                    {/* Follow button (only when viewing someone else) */}
                    {!isMe && (
                        followState === 'following' ? (
                            <TouchableOpacity style={[styles.followBtn, styles.followingBtn]} onPress={unfollow} disabled={busy}>
                                <Text style={styles.followingBtnText}>Following ✓</Text>
                            </TouchableOpacity>
                        ) : followState === 'requested' ? (
                            <TouchableOpacity style={[styles.followBtn, styles.requestedBtn]} onPress={cancelRequest} disabled={busy}>
                                <Text style={styles.requestedBtnText}>Requested</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.followBtn} onPress={isPrivate ? sendRequest : sendFollow} disabled={busy}>
                                <Text style={styles.followBtnText}>Follow</Text>
                            </TouchableOpacity>
                        )
                    )}
                </View>

                {/* Locked state for private accounts */}
                {locked ? (
                    <View style={styles.lockedBox}>
                        <Text style={styles.lockedEmoji}>🔒</Text>
                        <Text style={styles.lockedTitle}>This Account is Private</Text>
                        <Text style={styles.lockedText}>Follow {displayName || 'this user'} to see their habits and streaks.</Text>
                    </View>
                ) : (
                    <>
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

                        {/* Tab switcher: Habits | Posts */}
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
                                            <Text style={styles.habitStat}>✨ Just do it (no goal)</Text>
                                            <Text style={styles.habitStatRed}>🔥 {totalDone}x done total</Text>
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
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    backButton: { marginTop: 56, marginLeft: 16, marginBottom: 4, backgroundColor: '#f5f5f5' },
    backText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
    header: { alignItems: 'center', paddingTop: 12, paddingBottom: 24, backgroundColor: '#fff' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
    name: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
    lockBadge: { fontSize: 16 },
    lockedBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, paddingVertical: 32 },
    lockedEmoji: { fontSize: 40, marginBottom: 12 },
    lockedTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
    lockedText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
    username: { fontSize: 15, color: '#888' },
    bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 20 },
    followRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
    followItem: { fontSize: 14, color: '#555' },
    followNum: { fontWeight: 'bold', color: '#333' },
    followBtn: { marginTop: 16, backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 48 },
    followBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    followingBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#4CAF50' },
    followingBtnText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 15 },
    requestedBtn: { backgroundColor: '#f0f0f0' },
    requestedBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, padding: 16, justifyContent: 'space-around' },
    statBox: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12, paddingHorizontal: 16 },
    streakWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
    streakChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
    streakChipLit: { backgroundColor: '#FFF3E0' },
    streakChipCold: { backgroundColor: '#f0f0f0' },
    fire: { fontSize: 12, marginRight: 4 },
    fireCold: { opacity: 0.3 },
    streakLabel: { fontSize: 11, fontWeight: '600' },
    streakLabelLit: { color: '#E53935' },
    streakLabelCold: { color: '#999' },
    tabRow: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: '#4CAF50' },
    tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#4CAF50' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
    gridItem: { overflow: 'hidden' },
    gridImage: { width: '100%', height: '100%' },
    gridNoImage: { width: '100%', height: '100%', backgroundColor: '#f0f7f0', justifyContent: 'center', alignItems: 'center', padding: 6 },
    gridNoImageEmoji: { fontSize: 22, marginBottom: 4 },
    gridNoImageText: { fontSize: 10, color: '#4CAF50', textAlign: 'center', fontWeight: '600' },
    gridEmpty: { alignItems: 'center', paddingVertical: 40 },
    gridEmptyEmoji: { fontSize: 40, marginBottom: 10 },
    postModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    postModalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '85%', overflow: 'hidden' },
    postModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
    postModalHabit: { fontSize: 15, fontWeight: 'bold', color: '#4CAF50' },
    postModalClose: { fontSize: 18, color: '#888' },
    postModalImage: { width: '100%', height: 320 },
    postModalBody: { padding: 16 },
    postModalDate: { fontSize: 12, color: '#888', marginBottom: 8 },
    postModalCaption: { fontSize: 15, color: '#333', lineHeight: 22 },
    postModalNoCaption: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
    postModalStats: { flexDirection: 'row', gap: 16, marginTop: 16 },
    postModalStat: { fontSize: 14, color: '#666' },
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