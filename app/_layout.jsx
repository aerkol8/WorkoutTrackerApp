import { Stack, Redirect, useSegments } from 'expo-router';
import { WorkoutProvider } from '../context/WorkoutContext';
import { NutritionProvider } from '../context/NutritionContext';
import { ProfileProvider } from '../context/ProfileContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, StatusBar } from 'react-native';

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  // segments[0] can be "(tabs)" or "login" 
  const inAuthGroup = segments[0] === 'login';

  // not authenticated and not in login page -> direct login
  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/login" />;
  }

  // authenticated and in login -> direct home page
  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <WorkoutProvider>
        <NutritionProvider>
          <ProfileProvider>
            <RootLayoutNav />
          </ProfileProvider>
        </NutritionProvider>
      </WorkoutProvider>
    </AuthProvider>
  );
}