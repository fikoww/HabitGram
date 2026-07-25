import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

type Request = { id: string; displayName: string; username: string; photoUrl?: string };

export default function FollowRequestsScreen() {
    const [myId, setMyId] = useState('');
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        let unsubReq: (() => void) | undefined;
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setMyId(user.uid);
            unsubReq = onSnapshot(collection(db, 'users', user.uid, 'followRequests'), (snap) => {
                setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Request, 'id'>) })));
                setLoading(false);
            });
        });
        return () => { unsub(); if (unsubReq) unsubReq(); };
    }, []);

    // Approve: the requester (r) now follows me; I gain a follower.
    const approve = async (r: Request) => {
        if (!myId) return;
        setBusyId(r.id);
        try {
            await setDoc(doc(db, 'users', r.id, 'following', myId), { createdAt: serverTimestamp() });
            await setDoc(doc(db, 'users', myId, 'followers', r.id), { createdAt: serverTimestamp() });
            await deleteDoc(doc(db, 'users', myId, 'followRequests', r.id));
        } finally { setBusyId(null); }
    };

    const reject = async (r: Request) => {
        if (!myId) return;
        setBusyId(r.id);
        try {
            await deleteDoc(doc(db, 'users', myId, 'followRequests', r.id));
        } finally { setBusyId(null); }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Follow Requests</Text>
                <View style={{ width: 50 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color="#4CAF50" />
            ) : requests.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>📭</Text>
                    <Text style={styles.emptyText}>No pending follow requests</Text>
                </View>
            ) : (
                <ScrollView>
                    {requests.map((r) => (
                        <View key={r.id} style={styles.row}>
                            <TouchableOpacity style={styles.userInfo} onPress={() => router.push(`/user-profile?id=${r.id}`)}>
                                {r.photoUrl ? (
                                    <Image source={{ uri: r.photoUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatar}><Text style={styles.avatarText}>{r.displayName?.[0]?.toUpperCase() || '?'}</Text></View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{r.displayName || 'Unnamed'}</Text>
                                    <Text style={styles.username}>@{r.username}</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.approveBtn} onPress={() => approve(r)} disabled={busyId === r.id}>
                                    <Text style={styles.approveText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(r)} disabled={busyId === r.id}>
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
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    backText: { color: '#B45309', fontSize: 16, fontWeight: '600', width: 50 },
    headerTitle: { fontSize: 17, fontWeight: 'bold' },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12 },
    userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#C17F3F', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
    name: { fontSize: 15, fontWeight: '600', color: '#333' },
    username: { fontSize: 13, color: '#888', marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    approveBtn: { backgroundColor: '#C17F3F', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    approveText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    rejectBtn: { backgroundColor: '#f0f0f0', width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    rejectText: { color: '#888', fontWeight: 'bold', fontSize: 16 },
});