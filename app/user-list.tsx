import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

type U = { id: string; displayName: string; username: string; photoUrl?: string };

export default function UserListScreen() {
    const { userId, type } = useLocalSearchParams<{ userId: string; type: string }>();
    const [users, setUsers] = useState<U[]>([]);
    const [loading, setLoading] = useState(true);

    const title = type === 'followers' ? 'Followers' : 'Following';

    useEffect(() => {
        if (!userId || !type) return;
        (async () => {
            try {
                const sub = type === 'followers' ? 'followers' : 'following';
                const snap = await getDocs(collection(db, 'users', userId, sub));
                const ids = snap.docs.map((d) => d.id);
                const results = await Promise.all(ids.map(async (uid) => {
                    const uDoc = await getDoc(doc(db, 'users', uid));
                    const data: any = uDoc.exists() ? uDoc.data() : {};
                    return {
                        id: uid,
                        displayName: data.displayName || 'Unnamed',
                        username: data.username || '',
                        photoUrl: data.photoUrl || '',
                    };
                }));
                setUsers(results);
            } catch (e) {
                setUsers([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, type]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ width: 50 }}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 50 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color={ACCENT} />
            ) : users.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>👤</Text>
                    <Text style={styles.emptyText}>No {title.toLowerCase()} yet.</Text>
                </View>
            ) : (
                <ScrollView>
                    {users.map((u) => (
                        <TouchableOpacity key={u.id} style={styles.row} onPress={() => router.push(`/user-profile?id=${u.id}`)}>
                            {u.photoUrl ? (
                                <Image source={{ uri: u.photoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatar}><Text style={styles.avatarText}>{u.displayName?.[0]?.toUpperCase() || '?'}</Text></View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{u.displayName}</Text>
                                <Text style={styles.username}>@{u.username}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: PAPER, borderBottomWidth: 0.5, borderBottomColor: LINE },
    backText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontFamily: SERIF, color: INK },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12, opacity: 0.6 },
    emptyText: { fontSize: 15, color: MUTED, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, gap: 12, borderWidth: 0.5, borderColor: LINE },
    avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20, fontFamily: SERIF },
    name: { fontSize: 15, fontWeight: '600', color: INK },
    username: { fontSize: 13, color: MUTED, marginTop: 2 },
    chevron: { fontSize: 24, color: '#D6D3CB' },
});