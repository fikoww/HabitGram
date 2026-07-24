import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack>
        {/* Auth & onboarding */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="setup-profile" options={{ headerShown: false }} />

        {/* Habits & posting */}
        <Stack.Screen name="habit-detail" options={{ headerShown: false }} />
        <Stack.Screen name="create-post" options={{ headerShown: false }} />

        {/* Profile & social */}
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="user-profile" options={{ headerShown: false }} />
        <Stack.Screen name="user-list" options={{ headerShown: false }} />
        <Stack.Screen name="follow-requests" options={{ headerShown: false }} />

        {/* Communities */}
        <Stack.Screen name="community" options={{ headerShown: false }} />

        {/* Tab navigator */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}