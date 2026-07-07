import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type UserResult = { id: string; displayName: string; username: string; photoUrl?: string; bio?: string };

export default function ExploreScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUserId(user.uid);
    });
    return () => unsub();
  }, []);

  // Search users by username prefix (usernames are stored lowercase).
  // Debounced so we don't query on every keystroke.
  useEffect(() => {
    const t = term.trim().toLowerCase();
    if (!t) { setResults([]); setSearched(false); return; }
    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '>=', t),
          where('username', '<=', t + '\uf8ff'),
          orderBy('username'),
          limit(20)
        );
        const snap = await getDocs(q);
        const found = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<UserResult, 'id'>) }))
          .filter((u) => u.id !== currentUserId);
        setResults(found);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [term, currentUserId]);

  return (
    <View style={styles.container}>
      {/* Header + search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor="#aaa"
            value={term}
            onChangeText={setTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {term.length > 0 && (
            <TouchableOpacity onPress={() => setTerm('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#4CAF50" />
      ) : !term.trim() ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyText}>Search for people by their username</Text>
        </View>
      ) : results.length === 0 && searched ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No users found for &quot;{term.trim()}&quot;</Text>
        </View>
      ) : (
        <ScrollView>
          {results.map((u) => (
            <TouchableOpacity key={u.id} style={styles.resultRow} onPress={() => router.push(`/user-profile?id=${u.id}`)}>
              {u.photoUrl ? (
                <Image source={{ uri: u.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{u.displayName?.[0]?.toUpperCase() || '?'}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{u.displayName || 'Unnamed'}</Text>
                <Text style={styles.resultUsername}>@{u.username}</Text>
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
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#333', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  clearIcon: { fontSize: 14, color: '#888', paddingLeft: 8 },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#333' },
  resultUsername: { fontSize: 13, color: '#888', marginTop: 2 },
  chevron: { fontSize: 24, color: '#ccc' },
});