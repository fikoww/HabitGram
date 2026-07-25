import { router } from 'expo-router';
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Habit = {
    id: string;
    name: string;
    completed: boolean;
    completedDates?: string[];
    commitment?: number;
    pinned?: boolean;
};

type HabitListItem = { id: string; name: string; category: string };

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

    const [addHabitVisible, setAddHabitVisible] = useState(false);
    const [allHabitList, setAllHabitList] = useState<HabitListItem[]>([]);
    const [loadingHabitList, setLoadingHabitList] = useState(false);
    const [selectedAddCategory, setSelectedAddCategory] = useState('');
    const [selectedAddHabitName, setSelectedAddHabitName] = useState('');
    const [newHabitCommitment, setNewHabitCommitment] = useState(1);
    const [addError, setAddError] = useState('');

    // Posts grid
    const [posts, setPosts] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'posts' | 'habits'>('posts');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    // Follow counts
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);

    const weekDates = getWeekDates();

    // 3 columns: subtract the two 2px gaps, floor to avoid sub-pixel wrapping
    const { width: winWidth } = useWindowDimensions();
    const gridSize = Math.floor((winWidth - 4) / 3);

    useEffect(() => {
        let unsubscribeHabits: (() => void) | undefined;
        let unsubscribeUser: (() => void) | undefined;
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
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

    // Listen to my followers / following / pending-request counts
    useEffect(() => {
        let unsubs: (() => void)[] = [];
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'followers'), (s) => setFollowersCount(s.size)));
            unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'following'), (s) => setFollowingCount(s.size)));
            unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'followRequests'), (s) => setPendingCount(s.size)));
            // My posts (sorted client-side to avoid needing a composite index)
            const pq = query(collection(db, 'posts'), where('userId', '==', user.uid));
            unsubs.push(onSnapshot(pq, (snap) => {
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }))
                    .filter((p) => hasPhoto(p.imageUrl));
                list.sort((a, b) => {
                    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                });
                setPosts(list);
            }));
        });
        return () => { unsubAuth(); unsubs.forEach((u) => u()); };
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

    const openAddHabit = async () => {
        setAddHabitVisible(true);
        if (allHabitList.length === 0) {
            setLoadingHabitList(true);
            try {
                const snap = await getDocs(collection(db, 'habitlist'));
                setAllHabitList(snap.docs.map((d) => ({
                    id: d.id,
                    name: d.data().name,
                    category: d.data().category,
                })));
            } catch (e) {
                setAddError('Failed to load habits.');
            } finally {
                setLoadingHabitList(false);
            }
        }
    };

    const closeAddHabit = () => {
        setAddHabitVisible(false);
        setSelectedAddCategory('');
        setSelectedAddHabitName('');
        setNewHabitCommitment(1);
        setAddError('');
    };

    const handleAddHabit = async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!selectedAddHabitName) {
            setAddError('Please pick a habit.');
            return;
        }
        try {
            await addDoc(collection(db, 'habits'), {
                userId: user.uid,
                name: selectedAddHabitName,
                commitment: newHabitCommitment,
                completed: false,
                completedDates: [],
                pinned: false,
            });
            closeAddHabit();
        } catch (e) {
            setAddError('Failed to add habit. Please try again.');
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

    const categories = Array.from(new Set(allHabitList.map((h) => h.category)));
    const userHabitNames = habits.map((h) => h.name.toLowerCase());
    const availableHabits = allHabitList.filter(
        (h) => h.category === selectedAddCategory && !userHabitNames.includes(h.name.toLowerCase())
    );

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


                    <TouchableOpacity style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                    </TouchableOpacity>

                    {/* Follower / following counts */}
                    <View style={styles.followRow}>
                        <TouchableOpacity onPress={() => router.push(`/user-list?userId=${auth.currentUser?.uid}&type=followers`)}>
                            <Text style={styles.followItem}><Text style={styles.followNum}>{followersCount}</Text> Followers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push(`/user-list?userId=${auth.currentUser?.uid}&type=following`)}>
                            <Text style={styles.followItem}><Text style={styles.followNum}>{followingCount}</Text> Following</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Follow Requests button */}
                    <TouchableOpacity style={[styles.requestsButton, pendingCount > 0 && styles.requestsButtonActive]} onPress={() => router.push('/follow-requests')}>
                        <Text style={[styles.requestsButtonText, pendingCount > 0 && styles.requestsButtonTextActive]}>
                            👥 Follow Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
                        </Text>
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
                            <Text style={styles.emptyText}>No posts yet.{'\n'}Share your first habit post!</Text>
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
                {activeTab === 'habits' && (
                <View style={styles.addHabitRow}>
                    <TouchableOpacity style={styles.addHabitButton} onPress={openAddHabit}>
                        <Text style={styles.addHabitButtonText}>+ Add Habit</Text>
                    </TouchableOpacity>
                </View>
                )}

                {activeTab === 'habits' && habits.length === 0 && (
                    <Text style={styles.emptyText}>No habits yet. Tap "+ Add Habit" to start!</Text>
                )}

                {/* Habit list */}
                {activeTab === 'habits' && habits.map((habit) => {
                    const commitment = habit.commitment ?? 1;
                    const isNoCommitment = commitment === 0;
                    const { current, max } = getWeekStreak(habit.completedDates || [], commitment);
                    const totalDone = (habit.completedDates || []).length;
                    const doneThisWeek = weekDates.filter((date) => (habit.completedDates || []).includes(date)).length;
                    const commitmentMet = commitment > 0 && doneThisWeek >= commitment;

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

                            {habitMenuId === habit.id && (
                                <View style={styles.habitPopout}>
                                    <TouchableOpacity style={styles.habitMenuItem} onPress={() => handlePinHabit(habit)}>
                                        <Text style={styles.habitMenuText}>{habit.pinned ? '📌 Unpin' : '📌 Pin Habit'}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.menuDivider} />
                                    <TouchableOpacity style={styles.habitMenuItem} onPress={() => {
                                        setHabitMenuId(null);
                                        setNewCommitment(habit.commitment ?? 1);
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

                            {/* Stats — purple fire for commitment, red fire for no-commitment */}
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

            {/* Add Habit Modal */}
            <Modal visible={addHabitVisible} animationType="fade" transparent onRequestClose={closeAddHabit}>
                <View style={styles.commitmentOverlay}>
                    <View style={styles.addHabitBox}>
                        <Text style={styles.commitmentTitle}>Add a Habit</Text>

                        {loadingHabitList ? (
                            <Text style={styles.modalHint}>Loading habits...</Text>
                        ) : (
                            <>
                                <Text style={styles.modalLabel}>Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.commitmentChip, { marginRight: 8 }, selectedAddCategory === cat && styles.commitmentChipActive]}
                                            onPress={() => { setSelectedAddCategory(cat); setSelectedAddHabitName(''); setAddError(''); }}
                                        >
                                            <Text style={[styles.commitmentChipText, selectedAddCategory === cat && styles.commitmentChipTextActive]}>{cat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Text style={styles.modalLabel}>Habit</Text>
                                <ScrollView style={styles.habitPickList} nestedScrollEnabled>
                                    {!selectedAddCategory ? (
                                        <Text style={styles.modalHint}>Pick a category first.</Text>
                                    ) : availableHabits.length === 0 ? (
                                        <Text style={styles.modalHint}>No new habits in this category.</Text>
                                    ) : (
                                        availableHabits.map((h) => (
                                            <TouchableOpacity
                                                key={h.id}
                                                style={[styles.habitPickItem, selectedAddHabitName === h.name && styles.habitPickItemActive]}
                                                onPress={() => { setSelectedAddHabitName(h.name); setAddError(''); }}
                                            >
                                                <Text style={[styles.habitPickText, selectedAddHabitName === h.name && styles.habitPickTextActive]}>
                                                    {selectedAddHabitName === h.name ? '✅ ' : '○ '}{h.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>

                                {selectedAddHabitName ? (
                                    <>
                                        <Text style={styles.modalLabel}>How often?</Text>
                                        <View style={styles.commitmentRow}>
                                            <TouchableOpacity
                                                style={[styles.commitmentChipWide, newHabitCommitment === 0 && styles.commitmentChipActive]}
                                                onPress={() => setNewHabitCommitment(0)}
                                            >
                                                <Text style={[styles.commitmentChipText, newHabitCommitment === 0 && styles.commitmentChipTextActive]}>No commitment</Text>
                                            </TouchableOpacity>
                                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                                <TouchableOpacity
                                                    key={num}
                                                    style={[styles.commitmentChip, newHabitCommitment === num && styles.commitmentChipActive]}
                                                    onPress={() => setNewHabitCommitment(num)}
                                                >
                                                    <Text style={[styles.commitmentChipText, newHabitCommitment === num && styles.commitmentChipTextActive]}>{num}x</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {newHabitCommitment === 0 && (
                                            <Text style={styles.modalSubHint}>Just do it whenever — we'll count your total.</Text>
                                        )}
                                    </>
                                ) : null}

                                {addError ? <Text style={styles.modalErrorText}>{addError}</Text> : null}

                                <TouchableOpacity
                                    style={[styles.saveButton, !selectedAddHabitName && styles.saveButtonDisabled]}
                                    onPress={handleAddHabit}
                                    disabled={!selectedAddHabitName}
                                >
                                    <Text style={styles.saveButtonText}>Add Habit</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity style={styles.cancelButton} onPress={closeAddHabit}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Change Commitment Modal */}
            <Modal visible={!!changeCommitmentHabit} animationType="fade" transparent onRequestClose={() => setChangeCommitmentHabit(null)}>
                <View style={styles.commitmentOverlay}>
                    <View style={styles.commitmentBox}>
                        <Text style={styles.commitmentTitle}>Change Commitment</Text>
                        <Text style={styles.commitmentSubtitle}>{changeCommitmentHabit?.name}</Text>
                        <View style={styles.commitmentRow}>
                            <TouchableOpacity
                                style={[styles.commitmentChipWide, newCommitment === 0 && styles.commitmentChipActive]}
                                onPress={() => setNewCommitment(0)}
                            >
                                <Text style={[styles.commitmentChipText, newCommitment === 0 && styles.commitmentChipTextActive]}>No commitment</Text>
                            </TouchableOpacity>
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
                        {newCommitment === 0 && (
                            <Text style={styles.modalSubHint}>Just do it whenever — we'll count your total.</Text>
                        )}
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
    followRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
    followItem: { fontSize: 14, color: '#555' },
    followNum: { fontWeight: 'bold', color: '#333' },
    requestsButton: { marginTop: 12, backgroundColor: '#f0f0f0', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
    requestsButtonActive: { backgroundColor: '#4CAF50' },
    requestsButtonText: { color: '#333', fontWeight: '600', fontSize: 13 },
    requestsButtonTextActive: { color: '#fff' },
    menuButton: { position: 'absolute', top: 60, right: 20, padding: 8 },
    menuDots: { fontSize: 24, color: '#333', fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, padding: 16, justifyContent: 'space-around' },
    statBox: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center' },
    statLabel: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12, paddingHorizontal: 16 },
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
    addHabitRow: { alignItems: 'flex-end', paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold' },
    addHabitButton: { backgroundColor: '#4CAF50', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    addHabitButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    emptyText: { textAlign: 'center', color: '#aaa', fontSize: 14, marginTop: 20, paddingHorizontal: 16 },
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
    habitStatsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    habitStat: { fontSize: 12, color: '#666' },
    habitStatPurple: { fontSize: 12, color: '#8E24AA', fontWeight: '700' },
    habitStatRed: { fontSize: 12, color: '#E53935', fontWeight: '700' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dropdownMenu: { position: 'absolute', top: 100, right: 16, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, minWidth: 180 },
    menuItem: { padding: 16 },
    menuItemText: { fontSize: 15, color: '#333' },
    menuDivider: { height: 1, backgroundColor: '#f0f0f0' },
    commitmentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    commitmentBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
    addHabitBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, maxHeight: '85%' },
    commitmentTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    commitmentSubtitle: { fontSize: 15, color: '#888', marginBottom: 16, textAlign: 'center' },
    modalLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
    modalHint: { fontSize: 13, color: '#aaa', paddingVertical: 12, textAlign: 'center' },
    modalSubHint: { fontSize: 12, color: '#4CAF50', textAlign: 'center', marginBottom: 12, marginTop: -8 },
    habitPickList: { maxHeight: 180, marginBottom: 12 },
    habitPickItem: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 8, backgroundColor: '#fafafa' },
    habitPickItemActive: { borderColor: '#4CAF50', backgroundColor: '#f0fff0' },
    habitPickText: { fontSize: 14, color: '#444' },
    habitPickTextActive: { color: '#4CAF50', fontWeight: '600' },
    commitmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
    commitmentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
    commitmentChipWide: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
    commitmentChipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
    commitmentChipText: { color: '#666' },
    commitmentChipTextActive: { color: '#fff', fontWeight: 'bold' },
    modalErrorText: { color: '#ff4444', fontSize: 13, marginBottom: 8, textAlign: 'center' },
    saveButton: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
    saveButtonDisabled: { backgroundColor: '#a5d6a7' },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelButton: { padding: 14, borderRadius: 8, alignItems: 'center' },
    cancelText: { color: '#888', fontSize: 16 },
});