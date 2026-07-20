import { router, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

type Post = {
    id: string;
    userId: string;
    displayName?: string;
    username?: string;
    habitName?: string;
    caption?: string;
    imageUrl?: string;
    likes?: string[];
    commentCount?: number;
    completedDate?: string;
    createdAt?: any;
};

export default function CommunityScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [myId, setMyId] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [memberCount, setMemberCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => { if (u) setMyId(u.uid); });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!name) return;
        // Posts in this community (filter by habit name).
        // We sort client-side by createdAt to avoid needing a composite index.
        const q = query(collection(db, 'posts'), where('habitName', '==', name));
        const unsubPosts = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }));
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPosts(list);
            setLoading(false);
        }, () => setLoading(false));

        // Member count = unique users who have this habit
        const mq = query(collection(db, 'habits'), where('name', '==', name));
        const unsubMembers = onSnapshot(mq, (snap) => {
            const uids = new Set(snap.docs.map((d) => d.data().userId));
            setMemberCount(uids.size);
        });

        return () => { unsubPosts(); unsubMembers(); };
    }, [name]);

    const toggleLike = async (post: Post) => {
        if (!myId) return;
        const liked = (post.likes || []).includes(myId);
        await updateDoc(doc(db, 'posts', post.id), {
            likes: liked ? arrayRemove(myId) : arrayUnion(myId),
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ width: 50 }}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>{name}</Text>
                    <Text style={styles.headerSub}>{memberCount} member{memberCount === 1 ? '' : 's'}</Text>
                </View>
                <View style={{ width: 50 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color="#4CAF50" />
            ) : posts.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>🌱</Text>
                    <Text style={styles.emptyText}>No posts in this community yet.{'\n'}Be the first to post about {name}!</Text>
                </View>
            ) : (
                <ScrollView>
                    {posts.map((p) => {
                        const liked = (p.likes || []).includes(myId);
                        return (
                            <View key={p.id} style={styles.post}>
                                <TouchableOpacity style={styles.postHeader} onPress={() => router.push(`/user-profile?id=${p.userId}`)}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{p.displayName?.[0]?.toUpperCase() || '?'}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.postName}>{p.displayName || 'Unnamed'}</Text>
                                        <Text style={styles.postUsername}>@{p.username}</Text>
                                    </View>
                                </TouchableOpacity>

                                {p.imageUrl ? (
                                    <Image source={{ uri: p.imageUrl }} style={styles.postImage} />
                                ) : (
                                    <View style={styles.postImagePlaceholder}>
                                        <Text style={{ fontSize: 40 }}>📷</Text>
                                    </View>
                                )}

                                <View style={styles.postBody}>
                                    <View style={styles.actionsRow}>
                                        <TouchableOpacity onPress={() => toggleLike(p)}>
                                            <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.likeCount}>{(p.likes || []).length}</Text>
                                        <Text style={styles.commentCount}>💬 {p.commentCount || 0}</Text>
                                    </View>
                                    {p.caption ? (
                                        <Text style={styles.caption}>
                                            <Text style={styles.captionName}>{p.username} </Text>{p.caption}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    backText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
    post: { backgroundColor: '#fff', marginTop: 8, paddingBottom: 8 },
    postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    postName: { fontSize: 14, fontWeight: '600', color: '#333' },
    postUsername: { fontSize: 12, color: '#888' },
    postImage: { width: '100%', height: 300 },
    postImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
    postBody: { paddingHorizontal: 12, paddingTop: 8 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    likeIcon: { fontSize: 20 },
    likeCount: { fontSize: 13, color: '#333', fontWeight: '600' },
    commentCount: { fontSize: 13, color: '#888', marginLeft: 8 },
    caption: { fontSize: 14, color: '#333', lineHeight: 20 },
    captionName: { fontWeight: '600' },
});