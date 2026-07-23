import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection, doc, getDoc, getDocs,
  orderBy, query, serverTimestamp,
  updateDoc, where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView, Modal, Platform,
  RefreshControl,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

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
};

type Comment = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  text: string;
  createdAt: any;
};

export default function HomeScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comment modal
  const [commentModal, setCommentModal] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentDisplayName, setCommentDisplayName] = useState('');
  const [commentUsername, setCommentUsername] = useState('');

  useEffect(() => {
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
  }, []);

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

      const allPosts = Object.values(byId).sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setPosts(allPosts);
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

  const openComments = async (post: Post) => {
    setActivePost(post);
    setCommentModal(true);
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) })));
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
        <View style={styles.habitTag}>
          <Text style={styles.habitTagText}>🔥 {item.habitName}</Text>
        </View>

        {/* Image */}
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : (
          <View style={styles.postImagePlaceholder}>
            <Text style={styles.postImagePlaceholderText}>📷</Text>
          </View>
        )}

        {/* Caption */}
        {item.caption ? <Text style={styles.postCaption}>{item.caption}</Text> : null}

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
            <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionCount}>{item.likes.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
            <Text style={styles.actionIcon}>💬</Text>
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

      {/* Comment Modal */}
      <Modal visible={commentModal} animationType="slide" onRequestClose={() => setCommentModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.commentContainer}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModal(false)}>
                <Text style={styles.commentClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{item.displayName?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.commentContent}>
                    <Text style={styles.commentName}>{item.displayName} <Text style={styles.commentUser}>@{item.username}</Text></Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50' },
  createBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  emptyText: { fontSize: 16, color: '#888' },
  exploreBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  exploreBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  postCard: { backgroundColor: '#fff', marginBottom: 8, paddingBottom: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  postAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  postDisplayName: { fontSize: 15, fontWeight: '600' },
  postUsername: { fontSize: 12, color: '#888' },
  habitTag: { marginHorizontal: 12, marginBottom: 8, alignSelf: 'flex-start', backgroundColor: '#f0fff0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#4CAF50' },
  habitTagText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  postImage: { width: '100%', height: 300 },
  postImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  postImagePlaceholderText: { fontSize: 48 },
  postCaption: { fontSize: 14, color: '#333', padding: 12, paddingBottom: 8 },
  postActions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 4, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 20 },
  actionCount: { fontSize: 14, color: '#666' },
  commentContainer: { flex: 1, backgroundColor: '#fff' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 56 },
  commentTitle: { fontSize: 18, fontWeight: 'bold' },
  commentClose: { fontSize: 18, color: '#888' },
  commentItem: { flexDirection: 'row', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentName: { fontSize: 14, fontWeight: '600' },
  commentUser: { fontWeight: 'normal', color: '#888' },
  commentText: { fontSize: 14, color: '#333', marginTop: 2 },
  noComments: { textAlign: 'center', color: '#aaa', padding: 32 },
  commentInputRow: { flexDirection: 'row', padding: 12, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#eee', gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 80 },
  commentSendBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, justifyContent: 'center' },
  commentSendText: { color: '#fff', fontWeight: 'bold' },
});