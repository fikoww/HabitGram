import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

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
                // Get the list of user IDs from the subcollection
                const snap = await getDocs(collection(db, 'users', userId, sub));
                const ids = snap.docs.map((d) => d.id);
                // Fetch each user's profile info
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
                <ActivityIndicator style={{ marginTop: 32 }} color="#4CAF50" />
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
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    backText: { color: '#B45309', fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: 'bold' },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#C17F3F', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
    name: { fontSize: 15, fontWeight: '600', color: '#333' },
    username: { fontSize: 13, color: '#888', marginTop: 2 },
    chevron: { fontSize: 24, color: '#ccc' },
});