import { router } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebaseConfig';

type Community = { id: string; name: string; category: string; members: number };

export default function CommunitiesScreen() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                // All communities come from the master habit list
                const listSnap = await getDocs(collection(db, 'habitlist'));
                // Count members: how many people have each habit
                const habitsSnap = await getDocs(collection(db, 'habits'));
                const counts: Record<string, Set<string>> = {};
                habitsSnap.docs.forEach((d) => {
                    const n = d.data().name;
                    const uid = d.data().userId;
                    if (!n || !uid) return;
                    if (!counts[n]) counts[n] = new Set();
                    counts[n].add(uid);
                });
                const list = listSnap.docs.map((d) => ({
                    id: d.id,
                    name: d.data().name,
                    category: d.data().category || '',
                    members: counts[d.data().name] ? counts[d.data().name].size : 0,
                }));
                list.sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
                setCommunities(list);
            } catch (e) {
                setCommunities([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Communities</Text>
                <Text style={styles.headerSub}>Find people doing the same habits as you</Text>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color="#4CAF50" />
            ) : communities.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>🌍</Text>
                    <Text style={styles.emptyText}>No communities found.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 12 }}>
                    {communities.map((c) => (
                        <TouchableOpacity key={c.id} style={styles.card} onPress={() => router.push(`/community?name=${encodeURIComponent(c.name)}`)}>
                            <View style={styles.iconCircle}>
                                <Text style={styles.iconText}>{c.name?.[0]?.toUpperCase() || '#'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cName}>{c.name}</Text>
                                {c.category ? <Text style={styles.cCategory}>{c.category}</Text> : null}
                            </View>
                            <View style={styles.membersBox}>
                                <Text style={styles.membersNum}>{c.members}</Text>
                                <Text style={styles.membersLabel}>member{c.members === 1 ? '' : 's'}</Text>
                            </View>
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
    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50' },
    headerSub: { fontSize: 13, color: '#888', marginTop: 4 },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginBottom: 8, borderRadius: 12, gap: 12 },
    iconCircle: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
    iconText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
    cName: { fontSize: 16, fontWeight: '600', color: '#333' },
    cCategory: { fontSize: 12, color: '#888', marginTop: 2 },
    membersBox: { alignItems: 'center' },
    membersNum: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
    membersLabel: { fontSize: 10, color: '#aaa' },
});