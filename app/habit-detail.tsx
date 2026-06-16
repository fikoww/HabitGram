import { StyleSheet, Text, View } from 'react-native';

export default function ExploreScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>🔥</Text>
            <Text style={styles.title}>Coming Soon</Text>
            <Text style={styles.subtitle}>
                See what others are achieving, share your progress, and grow together.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 24 },
});