import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../stores/authStore';
import AuthStack from './AuthStack';
import TabNavigator from './TabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import { useTheme } from '../hooks/useTheme';
import { ActivityIndicator, Alert, Linking, View, StatusBar } from 'react-native';
import ToastContainer from '../components/common/ToastContainer';
import {
  loadPersistedSession,
  clearPersistedSession,
  hasRecoverableSession,
} from '../services/runningSessionPersistence';
import { useRunningStore, type RunningPhase } from '../stores/runningStore';
import { runService } from '../services/runService';
import { formatDistance, formatDuration } from '../utils/format';
import { useNetworkStore } from '../stores/networkStore';
import OfflineBanner from '../components/common/OfflineBanner';
import { useNotifications } from '../hooks/useNotifications';
import RouteSnapshotGenerator from '../components/map/RouteSnapshotGenerator';
import { useTranslation } from 'react-i18next';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['runcrew://', 'app.runcrew://', 'https://runcrew.app'],
  config: {
    screens: {
      Main: {
        screens: {
          WorldTab: {
            screens: {
              RunningMain: 'running',
            },
          },
          CourseTab: {
            screens: {
              CourseDetail: 'course/:courseId',
            },
          },
          CommunityTab: {
            screens: {
              UserProfile: 'profile/:userId',
              CrewDetail: 'crew/:crewId',
              CommunityPostDetail: 'post/:postId',
            },
          },
          MyPageTab: {
            screens: {
              RunDetail: 'run/:runId',
            },
          },
        },
      },
    },
  },
  // Custom URL handler: intercept widget deep links and handle them manually
  // when there's an active running session (prevents duplicate navigation)
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      // For runcrew://running, check if we're already on the running screen
      // to prevent duplicate session creation
      const phase = useRunningStore.getState().phase;
      if (url.includes('running') && (phase === 'running' || phase === 'paused')) {
        // Already in an active session — just bring app to foreground (no-op)
        return;
      }
      listener(url);
    });
    return () => subscription.remove();
  },
};

export default function RootNavigator() {
  const { isAuthenticated, isLoading, isNewUser, loadStoredAuth } =
    useAuthStore();
  const colors = useTheme();
  const { t } = useTranslation();
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const navReadyRef = useRef(false);
  const recoveryCheckedRef = useRef(false);

  // Defer RouteSnapshotGenerator mount — it creates a hidden Mapbox MapView
  // which uses GPU memory. Wait 60s after auth so it doesn't compete with
  // the initial app experience (map load, home screen, navigation).
  const [snapshotReady, setSnapshotReady] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) { setSnapshotReady(false); return; }
    const timer = setTimeout(() => setSnapshotReady(true), 60_000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Push notification registration, listeners, and tap handling
  useNotifications(isAuthenticated, navRef);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  // Handle widget deep link: if app opens via runcrew://running with active session,
  // navigate directly to running screen instead of letting linking config create a new one
  const widgetHandledRef = useRef(false);
  const handleWidgetDeepLink = useCallback(async () => {
    if (!isAuthenticated || widgetHandledRef.current) return;

    const initialUrl = await Linking.getInitialURL();
    if (!initialUrl?.includes('running')) return;

    widgetHandledRef.current = true;

    let phase = useRunningStore.getState().phase;

    // If store is idle but a persisted session exists, restore it first
    if (phase === 'idle') {
      const persisted = await loadPersistedSession();
      if (persisted && (persisted.phase === 'running' || persisted.phase === 'paused')) {
        // Restore session in its original phase (running/paused) so user can continue
        useRunningStore.getState().restoreSession({
          ...persisted,
          phase: persisted.phase as RunningPhase,
        });
        phase = persisted.phase as RunningPhase;
        // Skip normal crash recovery since we handled it here
        recoveryCheckedRef.current = true;
      }
    }

    if (phase === 'running' || phase === 'paused') {
      // Active session exists — navigate to RunningMain directly
      setTimeout(() => {
        try {
          (navRef.current as any)?.navigate('Main', {
            screen: 'WorldTab',
            params: { screen: 'RunningMain' },
          });
        } catch (e) {
          console.warn('[WidgetDeepLink] Navigation failed:', e);
        }
      }, 300);
    }
  }, [isAuthenticated, navRef]);

  useEffect(() => {
    if (!isAuthenticated || !navReadyRef.current) return;
    handleWidgetDeepLink();
  }, [isAuthenticated, handleWidgetDeepLink]);

  // Initialize network monitoring + auto-sync on network recovery
  useEffect(() => {
    const unsubscribe = useNetworkStore.getState().startListening();
    return unsubscribe;
  }, []);

  // Trigger sync when authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      useNetworkStore.getState().triggerSync();
    }
  }, [isLoading, isAuthenticated]);

  // --- Crash recovery: detect incomplete sessions on app start ---
  const checkCrashRecovery = useCallback(async () => {
    if (recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;

    const persisted = await loadPersistedSession();
    if (!persisted) return;
    if (persisted.phase !== 'running' && persisted.phase !== 'paused') {
      await clearPersistedSession();
      return;
    }

    // Sanity check: session must have some meaningful data
    if (persisted.distanceMeters < 10 && persisted.durationSeconds < 30) {
      await clearPersistedSession();
      return;
    }

    const distStr = formatDistance(persisted.distanceMeters);
    const durStr = formatDuration(persisted.durationSeconds);

    Alert.alert(
      t('running.crashRecoveryTitle'),
      t('running.crashRecoveryMsg', { distance: distStr, duration: durStr }),
      [
        {
          text: t('running.crashRecoveryDiscard'),
          style: 'destructive',
          onPress: async () => {
            // Try server-side recovery if we have a real session ID
            if (persisted.sessionId && !persisted.sessionId.startsWith('local_')) {
              try {
                await runService.recoverSession(persisted.sessionId, {
                  finished_at: new Date().toISOString(),
                  total_chunks: persisted.chunkSequence,
                  uploaded_chunk_sequences: persisted.uploadedChunkSequences,
                });
              } catch {
                // Server recovery failed — data is lost
              }
            }
            await clearPersistedSession();
          },
        },
        {
          text: t('running.crashRecoveryRestore'),
          style: 'default',
          onPress: async () => {
            // Restore session data into the store, then mark as completed
            const { restoreSession, complete } = useRunningStore.getState();
            restoreSession({
              ...persisted,
              phase: persisted.phase as RunningPhase,
            });
            complete();

            await clearPersistedSession();

            // Navigate to RunResult after a short delay for navigation to settle
            setTimeout(() => {
              if (navRef.current) {
                try {
                  (navRef.current as any).navigate('Main', {
                    screen: 'WorldTab',
                    params: {
                      screen: 'RunResult',
                      params: {
                        sessionId: persisted.sessionId,
                        alreadyCompleted: false,
                      },
                    },
                  });
                } catch (e) {
                  console.warn('[CrashRecovery] Navigation failed:', e);
                }
              }
            }, 500);
          },
        },
      ],
      { cancelable: false },
    );
  }, [navRef, t]);

  // Run crash recovery after auth loads and navigation is ready
  useEffect(() => {
    if (!isLoading && isAuthenticated && navReadyRef.current) {
      checkCrashRecovery();
    }
  }, [isLoading, isAuthenticated, checkCrashRecovery]);

  const handleNavReady = useCallback(() => {
    navReadyRef.current = true;
    if (!isLoading && isAuthenticated) {
      checkCrashRecovery();
      // Also handle pending widget deep link now that navigation is ready
      handleWidgetDeepLink();
    }
  }, [isLoading, isAuthenticated, checkCrashRecovery, handleWidgetDeepLink]);

  const navTheme = useMemo(
    () => ({
      dark: colors.statusBar === 'light-content',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' as const },
        medium: { fontFamily: 'System', fontWeight: '500' as const },
        bold: { fontFamily: 'System', fontWeight: '700' as const },
        heavy: { fontFamily: 'System', fontWeight: '900' as const },
      },
    }),
    [colors],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FF7A33" />
      </View>
    );
  }

  const showAuth = !isAuthenticated && !isNewUser;
  const showOnboarding = isNewUser;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <NavigationContainer theme={navTheme} ref={navRef} onReady={handleNavReady} linking={linking}>
        <StatusBar barStyle={colors.statusBar} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {showOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : showAuth ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : (
            <Stack.Screen name="Main" component={TabNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <ToastContainer />
      {isAuthenticated && snapshotReady && <RouteSnapshotGenerator />}
    </View>
  );
}
