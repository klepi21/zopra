import { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Slot, useRouter, useSegments, SplashScreen } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, StatusBar, Text, TouchableOpacity } from 'react-native';
import { tokenCache } from '@/utils/tokenCache';
import { useUserStore } from '@/store/userStore';
import { socketService } from '@/socket/socketService';
import { useSoundStore } from '@/store/soundStore';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthProtectionProvider() {
  const segments = useSegments();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { profile, isOnboarded, isLoading: isProfileLoading, fetchProfile, error: profileError, reset: resetUserStore, hasChecked } = useUserStore();
  const { loadMuteSetting } = useSoundStore();

  // Load persistence mute settings on startup
  useEffect(() => {
    loadMuteSetting();
  }, []);

  // 1. Handle Navigation Redirects based on Auth & Onboarding State
  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!isSignedIn) {
      // If user is not signed in and not on auth screen, force redirect to sign-in
      if (!inAuthGroup) {
        router.replace('/(auth)/sign-in');
      }
    } else {
      // If user is signed in, fetch profile if we haven't checked it yet
      // Only fetch if there is no error and we haven't checked yet to prevent infinite redirect loops on failure/404
      if (!hasChecked && !isProfileLoading && !profileError) {
        getToken().then((token) => {
          if (token) {
            fetchProfile(token);
          }
        });
      } else if (isOnboarded) {
        // If onboarded and trying to access auth/onboarding/root pages, send to home
        if (inAuthGroup || inOnboarding || !segments[0] || (segments[0] as string) === 'index') {
          router.replace('/(game)/home');
        }
      } else {
        // If signed in but not onboarded, force redirect to onboarding screen
        if (!inOnboarding) {
          router.replace('/onboarding');
        }
      }
    }
  }, [isSignedIn, isOnboarded, isLoaded, segments, isProfileLoading, profileError, hasChecked]);

  // 2. Synchronize Socket.io Lifecycle with Auth State
  useEffect(() => {
    if (isSignedIn && isOnboarded) {
      socketService.initialize(() => getToken());
      socketService.connect();
    } else {
      socketService.disconnect();
    }
    return () => {
      socketService.disconnect();
    };
  }, [isSignedIn, isOnboarded]);

  // If there's a profile fetch error, show it with a retry option
  if (isSignedIn && profileError) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{profileError}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              resetUserStore();
            }}
          >
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Hide splash screen when ready
  useEffect(() => {
    if (isLoaded && (!isSignedIn || hasChecked || profileError)) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded, isSignedIn, hasChecked, profileError]);

  // Show a loading screen during Clerk initialization or profile check
  if (!isLoaded || (isSignedIn && isProfileLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
    return null;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <AuthProtectionProvider />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  errorTitle: {
    color: '#FF3B30',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#AEAEB2',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
