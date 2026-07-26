import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

type Request = { id: string; displayName: string; username: string; photoUrl?: string };

export default function FollowRequestsScreen() {
    const [meId, setMeId] = useState('');
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setMeId(user.uid);
            const unsubReq = onSnapshot(collection(db, 'users', user.uid, 'followRequests'), (snap) => {
                setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Request, 'id'>) })));
                setLoading(false);
            });
            return () => unsubReq();
        });
        return () => unsub();
    }, []);

    const approve = async (req: Request) => {
        if (!meId) return;
        // Requester now follows me
        await setDoc(doc(db, 'users', req.id, 'following', meId), { createdAt: serverTimestamp() });
        await setDoc(doc(db, 'users', meId, 'followers', req.id), { createdAt: serverTimestamp() });
        // Remove the request
        await deleteDoc(doc(db, 'users', meId, 'followRequests', req.id));
    };

    const reject = async (req: Request) => {
        if (!meId) return;
        await deleteDoc(doc(db, 'users', meId, 'followRequests', req.id));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ width: 50 }}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Follow Requests</Text>
                <View style={{ width: 50 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color={ACCENT} />
            ) : requests.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>📭</Text>
                    <Text style={styles.emptyText}>No pending requests.</Text>
                </View>
            ) : (
                <ScrollView>
                    {requests.map((req) => (
                        <View key={req.id} style={styles.row}>
                            <TouchableOpacity style={styles.userInfo} onPress={() => router.push(`/user-profile?id=${req.id}`)}>
                                {req.photoUrl ? (
                                    <Image source={{ uri: req.photoUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatar}><Text style={styles.avatarText}>{req.displayName?.[0]?.toUpperCase() || '?'}</Text></View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{req.displayName}</Text>
                                    <Text style={styles.username}>@{req.username}</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.approveBtn} onPress={() => approve(req)}>
                                    <Text style={styles.approveText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(req)}>
                                    <Text style={styles.rejectText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
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
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 0.5, borderColor: LINE },
    userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20, fontFamily: SERIF },
    name: { fontSize: 15, fontWeight: '600', color: INK },
    username: { fontSize: 13, color: MUTED, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    approveBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    approveText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    rejectBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 0.5, borderColor: LINE, justifyContent: 'center', alignItems: 'center' },
    rejectText: { color: MUTED, fontSize: 16 },
});