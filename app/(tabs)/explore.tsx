import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

type Streak = { name: string; weeks: number; lit: boolean };
type UserResult = { id: string; displayName: string; username: string; photoUrl?: string; streaks?: Streak[] };

// Consecutive weeks (up to now) where the weekly commitment was met.
const getCurrentStreak = (completedDates: string[], commitment: number) => {
  if (!commitment || commitment <= 0) return 0;
  if (!completedDates || completedDates.length === 0) return 0;

  const weekMap: Record<string, number> = {};
  completedDates.forEach((dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    weekMap[key] = (weekMap[key] || 0) + 1;
  });

  const today = new Date();
  const todayDay = today.getDay();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((todayDay + 6) % 7));

  let checkMonday = new Date(thisMonday);
  let streak = 0;
  while (true) {
    const key = `${checkMonday.getFullYear()}-${String(checkMonday.getMonth() + 1).padStart(2, '0')}-${String(checkMonday.getDate()).padStart(2, '0')}`;
    if ((weekMap[key] || 0) >= commitment) {
      streak++;
      checkMonday.setDate(checkMonday.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
};

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

  // Fetch a user's habits and return their top 3 streaks (highest first).
  const loadStreaks = async (userId: string): Promise<Streak[]> => {
    try {
      const snap = await getDocs(query(collection(db, 'habits'), where('userId', '==', userId)));
      const streaks = snap.docs.map((d) => {
        const data: any = d.data();
        const commitment = data.commitment ?? 1;
        const weeks = getCurrentStreak(data.completedDates || [], commitment);
        return { name: data.name as string, weeks, lit: weeks >= 3 };
      });
      return streaks
        .filter((sk) => sk.weeks >= 3)   // only show lit streaks (>= 3 weeks)
        .sort((a, b) => b.weeks - a.weeks)
        .slice(0, 3);
    } catch (e) {
      return [];
    }
  };

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

        // Show the names right away, then fill in streaks as they load.
        setResults(found);
        setLoading(false);
        setSearched(true);

        const withStreaks = await Promise.all(
          found.map(async (u) => ({ ...u, streaks: await loadStreaks(u.id) }))
        );
        setResults(withStreaks);
      } catch (e) {
        setResults([]);
        setLoading(false);
        setSearched(true);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [term, currentUserId]);

  return (
    <View style={styles.container}>
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
          <Text style={styles.emptyEmoji}>🤷</Text>
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

                {/* Top streaks */}
                {u.streaks && u.streaks.length > 0 && (
                  <View style={styles.streakWrap}>
                    {u.streaks.map((s) => (
                      <View key={s.name} style={[styles.streakChip, s.lit ? styles.streakChipLit : styles.streakChipCold]}>
                        <Text style={[styles.fire, !s.lit && styles.fireCold]}>🔥</Text>
                        <Text style={[styles.streakLabel, s.lit ? styles.streakLabelLit : styles.streakLabelCold]}>
                          {s.name} · {s.weeks}w
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
  streakWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  streakChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  streakChipLit: { backgroundColor: '#FFF3E0' },
  streakChipCold: { backgroundColor: '#f0f0f0' },
  fire: { fontSize: 12, marginRight: 4 },
  fireCold: { opacity: 0.3 },
  streakLabel: { fontSize: 11, fontWeight: '600' },
  streakLabelLit: { color: '#E53935' },
  streakLabelCold: { color: '#999' },
});