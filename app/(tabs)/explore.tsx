import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

// Serif display font (OS built-in serif — no font install needed)
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string;
// Design tokens (minimalist: warm paper, ink text, one terracotta accent)
const ACCENT = '#C1440E';
const INK = '#1A1A1A';
const MUTED = '#9A968E';
const LINE = '#EAE8E2';
const PAPER = '#FBFAF8';
const SURFACE = '#FFFFFF';

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
          <Ionicons name="search" size={16} color="#9A968E" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor={MUTED}
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
        <ActivityIndicator style={{ marginTop: 32 }} color={ACCENT} />
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
                      <View key={s.name} style={styles.streakChip}>
                        <Ionicons name="flame" size={12} color="#E23B2E" style={{ marginRight: 4 }} />
                        <Text style={styles.streakLabel}>
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
  container: { flex: 1, backgroundColor: PAPER },
  header: { backgroundColor: PAPER, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: LINE },
  headerTitle: { fontSize: 26, fontFamily: SERIF, color: INK, marginBottom: 14, letterSpacing: -0.3 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 12, borderWidth: 0.5, borderColor: LINE },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: INK, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  clearIcon: { fontSize: 14, color: MUTED, paddingLeft: 8 },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 44, marginBottom: 12, opacity: 0.6 },
  emptyText: { fontSize: 15, color: MUTED, textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 12, gap: 12, borderWidth: 0.5, borderColor: LINE },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20, fontFamily: SERIF },
  resultName: { fontSize: 15, fontWeight: '600', color: INK },
  resultUsername: { fontSize: 13, color: MUTED, marginTop: 2 },
  chevron: { fontSize: 24, color: '#D6D3CB' },
  streakWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  streakChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 0.5, borderColor: ACCENT },
  fire: { fontSize: 12, marginRight: 4 },
  streakLabel: { fontSize: 11, fontWeight: '600', color: ACCENT },
});