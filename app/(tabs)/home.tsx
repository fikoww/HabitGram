import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection, doc, getDoc, getDocs,
  orderBy, query, serverTimestamp,
  updateDoc, where
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

type Post = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  habitName: string;
  caption: string;
  imageUrl?: string;
  likes: string[];
  commentCount: number;
  createdAt: any;
  habitTarget?: number;
  habitStreak?: number;
};

type Comment = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  text: string;
  createdAt: any;
};

type UserSummary = {
  id: string;
  displayName: string;
  username: string;
  photoUrl?: string;
  isFollowing?: boolean;
};

export default function HomeScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comment modal
  const [commentModal, setCommentModal] = useState(false);
  const [likeModal, setLikeModal] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likedUsers, setLikedUsers] = useState<UserSummary[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentDisplayName, setCommentDisplayName] = useState('');
  const [commentUsername, setCommentUsername] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const sheetHeight = useRef(new Animated.Value(70)).current;
  const sheetHeightStyle = sheetHeight.interpolate({
    inputRange: [70, 84],
    outputRange: ['70%', '84%'],
  });

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      Animated.timing(sheetHeight, {
        toValue: 84,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.timing(sheetHeight, {
        toValue: 70,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, [sheetHeight]);

  useFocusEffect(
    useCallback(() => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        setCurrentUserId(user.uid);

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCommentDisplayName(userDoc.data().displayName || '');
          setCommentUsername(userDoc.data().username || '');
        }

        await loadFollowingAndPosts(user.uid);
      });
      return () => unsub();
    }, [])
  );

  const isValidImageUrl = (url: any) => {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.length > 0 && /^(https?:\/\/|blob:|data:)/.test(trimmed);
  };

  const getWeekStreak = (completedDates: string[], commitment: number) => {
    if (!commitment || commitment <= 0) return 0;
    if (!completedDates || completedDates.length === 0) return 0;

    const weekMap: Record<string, number> = {};
    completedDates.forEach((dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
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

    return currentStreak;
  };

  const loadFollowingAndPosts = async (uid: string) => {
    setLoading(true);
    try {
      const byId: Record<string, Post> = {};
      const collect = (snap: any) => {
        snap.docs.forEach((d: any) => {
          byId[d.id] = { id: d.id, ...(d.data() as Omit<Post, 'id'>) };
        });
      };

      // 1) Post kamu sendiri + semua yang kamu follow (tanpa orderBy → tanpa index)
      const followSnap = await getDocs(collection(db, 'users', uid, 'following'));
      const followIds = followSnap.docs.map((d) => d.id);
      setFollowingIds(followIds);

      const authorIds = Array.from(new Set([uid, ...followIds]));
      for (let i = 0; i < authorIds.length; i += 10) {
        const chunk = authorIds.slice(i, i + 10);
        const snap = await getDocs(query(collection(db, 'posts'), where('userId', 'in', chunk)));
        collect(snap);
      }

      // 2) Discovery: orang lain (akun publik) yang mengerjakan habit yang sama
      const myHabitsSnap = await getDocs(query(collection(db, 'habits'), where('userId', '==', uid)));
      const myHabitNames = Array.from(
        new Set(myHabitsSnap.docs.map((d) => d.data().name as string).filter(Boolean))
      ).slice(0, 10);

      if (myHabitNames.length > 0) {
        const discovery: Post[] = [];
        for (let i = 0; i < myHabitNames.length; i += 10) {
          const chunk = myHabitNames.slice(i, i + 10);
          const snap = await getDocs(query(collection(db, 'posts'), where('habitName', 'in', chunk)));
          snap.docs.forEach((d) => {
            const data = d.data() as Omit<Post, 'id'>;
            if (!byId[d.id] && data.userId !== uid) discovery.push({ id: d.id, ...data });
          });
        }

        const discoveryAuthorIds = Array.from(new Set(discovery.map((p) => p.userId))).slice(0, 30);
        const publicAuthors = new Set<string>();
        await Promise.all(
          discoveryAuthorIds.map(async (aid) => {
            const uDoc = await getDoc(doc(db, 'users', aid));
            if (uDoc.exists() && uDoc.data().isPrivate === false) publicAuthors.add(aid);
          })
        );
        discovery.forEach((p) => {
          if (publicAuthors.has(p.userId)) byId[p.id] = p;
        });
      }

      const allPosts = Object.values(byId)
        .filter((p) => isValidImageUrl(p.imageUrl))   // photo posts only — journal-only posts stay out of the feed
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const enrichedPosts = await Promise.all(
        allPosts.map(async (post) => {
          if (!post.habitName) return post;
          const habitSnap = await getDocs(query(
            collection(db, 'habits'),
            where('userId', '==', post.userId),
            where('name', '==', post.habitName)
          ));
          const habitDoc = habitSnap.docs[0];
          if (!habitDoc) return post;
          const data = habitDoc.data() as any;
          const commitment = data.commitment ?? 1;
          return {
            ...post,
            habitTarget: commitment,
            habitStreak: getWeekStreak(data.completedDates || [], commitment),
          };
        })
      );

      setPosts(enrichedPosts);
    } catch (e) {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const handleLike = async (post: Post) => {
    if (!currentUserId) return;
    const ref = doc(db, 'posts', post.id);
    const liked = post.likes.includes(currentUserId);
    await updateDoc(ref, {
      likes: liked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likes: liked ? p.likes.filter((id) => id !== currentUserId) : [...p.likes, currentUserId] }
          : p
      )
    );
  };

  const openLikers = async (post: Post) => {
    setActivePost(post);
    setLikeModal(true);
    setLoadingLikes(true);
    try {
      const ids = Array.from(new Set((post.likes || []).filter(Boolean)));
      const users = await Promise.all(
        ids.map(async (uid) => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (!userDoc.exists()) return null;
          const data = userDoc.data();
          const followingDoc = await getDoc(doc(db, 'users', currentUserId, 'following', uid));
          return {
            id: userDoc.id,
            displayName: data.displayName || '',
            username: data.username || '',
            photoUrl: data.photoUrl || '',
            isFollowing: followingDoc.exists(),
          } as UserSummary;
        })
      );
      setLikedUsers(users.filter(Boolean) as UserSummary[]);
    } catch (e) {
      setLikedUsers([]);
    } finally {
      setLoadingLikes(false);
    }
  };

  const openComments = async (post: Post) => {
    setActivePost(post);
    setCommentModal(true);
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) })));

    // Heal the count: the true number of comments is snap.size. If the stored
    // commentCount drifted, fix it in Firestore and locally.
    const realCount = snap.size;
    if (realCount !== (post.commentCount || 0)) {
      setPosts((prev) => prev.map((pp) => pp.id === post.id ? { ...pp, commentCount: realCount } : pp));
      setActivePost((prev) => prev ? { ...prev, commentCount: realCount } : prev);
      updateDoc(doc(db, 'posts', post.id), { commentCount: realCount }).catch(() => {});
    }
  };

  const submitComment = async () => {
    if (!activePost || !commentText.trim()) return;
    const ref = collection(db, 'posts', activePost.id, 'comments');
    const newComment = {
      userId: currentUserId,
      displayName: commentDisplayName,
      username: commentUsername,
      text: commentText.trim(),
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(ref, newComment);
    await updateDoc(doc(db, 'posts', activePost.id), { commentCount: (activePost.commentCount || 0) + 1 });
    setComments((prev) => [...prev, { id: docRef.id, ...newComment, createdAt: new Date() }]);
    setPosts((prev) => prev.map((p) => p.id === activePost.id ? { ...p, commentCount: p.commentCount + 1 } : p));
    setCommentText('');
  };

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return '';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const renderPost = ({ item }: { item: Post }) => {
    const liked = item.likes.includes(currentUserId);
    return (
      <View style={styles.postCard}>
        {/* Post header */}
        <TouchableOpacity style={styles.postHeader} onPress={() => router.push(`/user-profile?id=${item.userId}`)}>
          <View style={styles.postAvatar}>
            <Text style={styles.postAvatarText}>{item.displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View>
            <Text style={styles.postDisplayName}>{item.displayName}</Text>
            <Text style={styles.postUsername}>@{item.username} · {formatTime(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {/* Habit tag */}
        <View style={styles.habitChipRow}>
          <View style={styles.habitChip}>
            <Text style={styles.habitChipText}><Ionicons name="flame" size={13} color="#E23B2E" /> {item.habitName} · {item.habitStreak ?? 0}w</Text>
          </View>
        </View>

        {/* Image */}
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : (
          <View style={styles.postImagePlaceholder}>
            <Ionicons name="image-outline" size={48} color="#9A968E" style={styles.postImagePlaceholderText} />
          </View>
        )}

        {/* Caption */}
        {item.caption ? <Text style={styles.postCaption}>{item.caption}</Text> : null}

        {/* Actions */}
        <View style={styles.postActions}>
          <View style={styles.actionBtn}>
            <TouchableOpacity onPress={() => handleLike(item)}>
              <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openLikers(item)}>
              <Text style={styles.actionCount}>{item.likes.length}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
            <Ionicons name="chatbubble-outline" size={20} color="#666" style={styles.actionIcon} />
            <Text style={styles.actionCount}>{item.commentCount || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HabitGram</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-post')}>
          <Text style={styles.createBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>Your feed is empty</Text>
          <Text style={styles.emptySubtitle}>Follow people to see their habit posts here!</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.exploreBtnText}>Explore People</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              loadFollowingAndPosts(currentUserId);
            }} />
          }
        />
      )}

      {/* Likes Modal */}
      <Modal
        visible={likeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setLikeModal(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setLikeModal(false)} />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Likes</Text>
              <TouchableOpacity onPress={() => setLikeModal(false)}>
                <Text style={styles.commentClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingLikes ? (
              <Text style={styles.noComments}>Loading likes...</Text>
            ) : likedUsers.length === 0 ? (
              <Text style={styles.noComments}>No likes yet.</Text>
            ) : (
              <FlatList
                data={likedUsers}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                renderItem={({ item }) => {
                  const openProfile = () => {
                    setLikeModal(false);
                    router.push(`/user-profile?id=${item.id}`);
                  };
                  const isMe = item.id === currentUserId;
                  return (
                    <TouchableOpacity style={styles.commentItem} onPress={openProfile}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{item.displayName?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={styles.commentContent}>
                        <Text style={styles.commentName}>{item.displayName}</Text>
                        <Text style={styles.commentUser}>@{item.username}</Text>
                      </View>
                      {!isMe && (
                        <View style={[styles.followBadge, item.isFollowing ? styles.followBadgeFollowing : styles.followBadgeFollow]}>
                          <Text style={[styles.followBadgeText, item.isFollowing ? styles.followBadgeTextFollowing : styles.followBadgeTextFollow]}>
                            {item.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={commentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentModal(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setCommentModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={styles.sheetContentWrapper}
          >
            <Animated.View style={[styles.sheetContainer, { height: sheetHeightStyle as any, maxHeight: sheetHeightStyle as any }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.commentHeader}>
                <Text style={styles.commentTitle}>Comments</Text>
                <TouchableOpacity onPress={() => setCommentModal(false)} style={styles.closeButton}>
                  <Text style={styles.commentClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const openProfile = () => {
                    setCommentModal(false);
                    router.push(`/user-profile?id=${item.userId}`);
                  };
                  return (
                    <View style={styles.commentItem}>
                      <TouchableOpacity onPress={openProfile}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>{item.displayName?.[0]?.toUpperCase() || '?'}</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.commentContent}>
                        <Text style={styles.commentName} onPress={openProfile}>
                          {item.displayName} <Text style={styles.commentUser}>@{item.username}</Text>
                        </Text>
                        <Text style={styles.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={styles.noComments}>No comments yet. Be the first!</Text>}
              />

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity style={styles.commentSendBtn} onPress={submitComment}>
                  <Text style={styles.commentSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: PAPER, borderBottomWidth: 0.5, borderBottomColor: LINE },
  headerTitle: { fontSize: 24, fontFamily: SERIF, color: INK, letterSpacing: -0.3 },
  headerLogo: { width: 130, height: 34 },
  createBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.6 },
  emptyTitle: { fontSize: 21, fontFamily: SERIF, color: INK, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: MUTED, textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  emptyText: { fontSize: 16, color: MUTED },
  exploreBtn: { backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  exploreBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  postCard: { backgroundColor: SURFACE, marginBottom: 8, paddingBottom: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: LINE },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16, fontFamily: SERIF },
  postDisplayName: { fontSize: 15, fontWeight: '600', color: INK },
  postUsername: { fontSize: 12, color: MUTED },
  habitChipRow: { marginHorizontal: 12, marginBottom: 12 },
  habitChip: { alignSelf: 'flex-start', borderWidth: 0.5, borderColor: ACCENT, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  habitChipText: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  postImage: { width: '100%', height: 300 },
  postImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#F1EEE9', justifyContent: 'center', alignItems: 'center' },
  postImagePlaceholderText: { fontSize: 48, opacity: 0.5 },
  postCaption: { fontSize: 14, color: '#333', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, lineHeight: 20 },
  postActions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 4, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 20 },
  actionCount: { fontSize: 14, color: '#666' },
  sheetOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject },
  sheetContentWrapper: { flex: 1, justifyContent: 'flex-end', paddingBottom: 0 },
  sheetContainer: { backgroundColor: SURFACE, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: '70%', maxHeight: '70%', paddingBottom: 4, marginBottom: 0, overflow: 'hidden', alignSelf: 'stretch' },
  sheetHandle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 6, marginBottom: 2 },
  commentContainer: { flex: 1, backgroundColor: SURFACE },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: LINE },
  commentTitle: { fontSize: 17, fontFamily: SERIF, color: INK },
  closeButton: { padding: 4 },
  commentClose: { fontSize: 18, color: '#666' },
  commentItem: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: LINE, alignItems: 'flex-start' },
  commentAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16, fontFamily: SERIF },
  commentContent: { flex: 1 },
  commentName: { fontSize: 15, fontWeight: '600', color: INK },
  commentUser: { fontSize: 13, fontWeight: 'normal', color: MUTED },
  followBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'center' },
  followBadgeFollowing: { backgroundColor: '#F1EEE9' },
  followBadgeFollow: { backgroundColor: ACCENT },
  followBadgeText: { fontSize: 12, fontWeight: '600' },
  followBadgeTextFollowing: { color: ACCENT },
  followBadgeTextFollow: { color: '#fff' },
  commentText: { fontSize: 14, color: '#333', marginTop: 2 },
  noComments: { textAlign: 'center', color: MUTED, padding: 32 },
  commentInputRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: LINE, gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, borderWidth: 0.5, borderColor: LINE, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 96, backgroundColor: PAPER },
  commentSendBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, justifyContent: 'center' },
  commentSendText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});