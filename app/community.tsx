import { router, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
    addDoc, arrayRemove, arrayUnion, collection, doc, getDoc,
    limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Image, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
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

type Message = {
    id: string;
    text: string;
    senderId: string;
    senderName?: string;
    senderUsername?: string;
    createdAt?: any;
};

export default function CommunityScreen() {
    const { name } = useLocalSearchParams<{ name: string }>();
    const [myId, setMyId] = useState('');
    const [myName, setMyName] = useState('');
    const [myUsername, setMyUsername] = useState('');

    const [tab, setTab] = useState<'posts' | 'chat'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [memberCount, setMemberCount] = useState(0);
    const [isMember, setIsMember] = useState(false);
    const [membersLoaded, setMembersLoaded] = useState(false);
    const [loading, setLoading] = useState(true);

    // Chat
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) return;
            setMyId(u.uid);
            const me = await getDoc(doc(db, 'users', u.uid));
            if (me.exists()) {
                setMyName(me.data().displayName || '');
                setMyUsername(me.data().username || '');
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!name) return;

        // Posts in this community (sorted client-side to avoid a composite index)
        const pq = query(collection(db, 'posts'), where('habitName', '==', name));
        const unsubPosts = onSnapshot(pq, (snap) => {
            const list = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }))
                .filter((p) => !!p.imageUrl);   // photo posts only — journal-only posts stay out of the feed
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPosts(list);
            setLoading(false);
        }, () => setLoading(false));

        // Members = unique users who have this habit
        const mq = query(collection(db, 'habits'), where('name', '==', name));
        const unsubMembers = onSnapshot(mq, (snap) => {
            const uids = new Set(snap.docs.map((d) => d.data().userId));
            setMemberCount(uids.size);
            setIsMember(uids.has(auth.currentUser?.uid || ''));
            setMembersLoaded(true);
        });

        return () => { unsubPosts(); unsubMembers(); };
    }, [name, myId]);

    // Chat messages: take the 50 newest, then flip to chronological order
    useEffect(() => {
        if (!name) return;
        const q = query(
            collection(db, 'communityChats', name, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }));
            setMessages(list.reverse());
        });
        return () => unsub();
    }, [name]);

    const sendMessage = async () => {
        const text = draft.trim();
        if (!text || !myId || !name) return;
        setSending(true);
        setDraft('');
        try {
            await addDoc(collection(db, 'communityChats', name, 'messages'), {
                text,
                senderId: myId,
                senderName: myName,
                senderUsername: myUsername,
                createdAt: serverTimestamp(),
            });
        } catch (e) {
            setDraft(text); // put it back so nothing is lost
        } finally {
            setSending(false);
        }
    };

    const toggleLike = async (post: Post) => {
        if (!myId) return;
        const liked = (post.likes || []).includes(myId);
        await updateDoc(doc(db, 'posts', post.id), {
            likes: liked ? arrayRemove(myId) : arrayUnion(myId),
        });
    };

    const formatTime = (ts: any) => {
        if (!ts?.seconds) return '';
        const d = new Date(ts.seconds * 1000);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

                {/* Tabs */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tabBtn, tab === 'posts' && styles.tabBtnActive]}
                        onPress={() => setTab('posts')}
                    >
                        <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>
                            ▦ Posts {posts.length > 0 ? `(${posts.length})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, tab === 'chat' && styles.tabBtnActive]}
                        onPress={() => setTab('chat')}
                    >
                        <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>
                            💬 Chat
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ---------------- POSTS ---------------- */}
                {tab === 'posts' && (
                    loading ? (
                        <ActivityIndicator style={{ marginTop: 32 }} color={ACCENT} />
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
                    )
                )}

                {/* ---------------- CHAT ---------------- */}
                {/* Chat is members-only: you must have this habit to read or write. */}
                {tab === 'chat' && !membersLoaded && (
                    <ActivityIndicator style={{ marginTop: 32 }} color={ACCENT} />
                )}

                {tab === 'chat' && membersLoaded && !isMember && (
                    <View style={styles.lockedBox}>
                        <Text style={styles.lockedEmoji}>🔒</Text>
                        <Text style={styles.lockedTitle}>Members only</Text>
                        <Text style={styles.lockedText}>
                            Add <Text style={{ fontWeight: 'bold' }}>{name}</Text> to your habits to see and join this conversation.
                        </Text>
                        <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/(tabs)/profile')}>
                            <Text style={styles.joinBtnText}>Go to My Habits</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {tab === 'chat' && membersLoaded && isMember && (
                    <>
                        <ScrollView
                            ref={scrollRef}
                            style={styles.chatScroll}
                            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
                            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                        >
                            {messages.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyEmoji}>💬</Text>
                                    <Text style={styles.emptyText}>No messages yet.{'\n'}Say hi to the {name} community!</Text>
                                </View>
                            ) : (
                                messages.map((m) => {
                                    const mine = m.senderId === myId;
                                    return (
                                        <View key={m.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                                            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                                                {!mine && (
                                                    <Text style={styles.senderName} onPress={() => router.push(`/user-profile?id=${m.senderId}`)}>
                                                        {m.senderName || 'Unnamed'}
                                                    </Text>
                                                )}
                                                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                                                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{formatTime(m.createdAt)}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Input */}
                        <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder={`Message ${name}...`}
                                    placeholderTextColor={MUTED}
                                    value={draft}
                                    onChangeText={setDraft}
                                    multiline
                                />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                                onPress={sendMessage}
                                disabled={!draft.trim() || sending}
                            >
                                <Text style={styles.sendText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: PAPER, borderBottomWidth: 0.5, borderBottomColor: LINE },
    backText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 19, fontFamily: SERIF, color: INK, letterSpacing: -0.2 },
    headerSub: { fontSize: 12, color: MUTED, marginTop: 3 },
    tabRow: { flexDirection: 'row', backgroundColor: PAPER, borderBottomWidth: 0.5, borderBottomColor: LINE },
    tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -0.5 },
    tabBtnActive: { borderBottomColor: INK },
    tabText: { fontSize: 14, color: MUTED, fontWeight: '600' },
    tabTextActive: { color: INK },
    emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12, opacity: 0.6 },
    emptyText: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
    // Posts
    post: { backgroundColor: SURFACE, marginTop: 8, paddingBottom: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: LINE },
    postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16, fontFamily: SERIF },
    postName: { fontSize: 14, fontWeight: '600', color: INK },
    postUsername: { fontSize: 12, color: MUTED },
    postImage: { width: '100%', height: 300 },
    postImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#F1EEE9', justifyContent: 'center', alignItems: 'center' },
    postBody: { paddingHorizontal: 12, paddingTop: 8 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    likeIcon: { fontSize: 20 },
    likeCount: { fontSize: 13, color: INK, fontWeight: '600' },
    commentCount: { fontSize: 13, color: MUTED, marginLeft: 8 },
    caption: { fontSize: 14, color: '#333', lineHeight: 20 },
    captionName: { fontWeight: '600', color: INK },
    // Chat
    chatScroll: { flex: 1 },
    bubbleRow: { flexDirection: 'row', marginBottom: 10 },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
    bubbleOther: { backgroundColor: SURFACE, borderTopLeftRadius: 4, borderWidth: 0.5, borderColor: LINE },
    bubbleMine: { backgroundColor: ACCENT, borderTopRightRadius: 4 },
    senderName: { fontSize: 12, fontWeight: 'bold', color: ACCENT, marginBottom: 3 },
    bubbleText: { fontSize: 15, color: '#333', lineHeight: 20 },
    bubbleTextMine: { color: '#fff' },
    bubbleTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.8)' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 36, gap: 8, backgroundColor: PAPER, borderTopWidth: 0.5, borderTopColor: LINE },
    input: { flex: 1, borderWidth: 0.5, borderColor: LINE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: SURFACE, maxHeight: 100, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
    sendBtn: { backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 20 },
    sendBtnDisabled: { backgroundColor: '#E0A48D' },
    sendText: { color: '#fff', fontWeight: 'bold' },
    lockedBox: { alignItems: 'center', marginTop: 60, marginHorizontal: 24, backgroundColor: SURFACE, borderRadius: 12, padding: 28, borderWidth: 0.5, borderColor: LINE },
    lockedEmoji: { fontSize: 40, marginBottom: 12 },
    lockedTitle: { fontSize: 17, fontFamily: SERIF, color: INK, marginBottom: 8 },
    lockedText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    joinBtn: { borderWidth: 1, borderColor: ACCENT, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
    joinBtnText: { color: ACCENT, fontWeight: '600', fontSize: 13 },
});