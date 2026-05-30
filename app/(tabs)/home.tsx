import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [habit, setHabit] = useState('');
  const [habits, setHabits] = useState<string[]>([]);

  const addHabit = () => {
    if (habit.trim() === '') return;
    setHabits([...habits, habit]);
    setHabit('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Habits 🌱</Text>

      <TextInput
        style={styles.input}
        placeholder="Add a new habit..."
        value={habit}
        onChangeText={setHabit}
      />

      <TouchableOpacity style={styles.button} onPress={addHabit}>
        <Text style={styles.buttonText}>Add Habit</Text>
      </TouchableOpacity>

      <FlatList
        data={habits}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.habitItem}>
            <Text style={styles.habitText}>🔥 {item}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, marginTop: 40 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16 },
  button: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  habitItem: { padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 },
  habitText: { fontSize: 16 },
});