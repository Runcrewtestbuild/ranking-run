import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';

type NavRef = NavigationContainerRefWithCurrent<RootStackParamList>;

/**
 * Navigate to the appropriate screen based on notification data.
 * Mirrors the routing logic in NotificationInboxScreen.handlePress.
 */
function navigateFromNotification(
  navRef: NavRef,
  data: Record<string, unknown>,
): void {
  if (!navRef.isReady()) return;

  const type = data.type as string | undefined;
  const targetId = data.target_id as string | undefined;
  const actorId = data.actor_id as string | undefined;

  let screen: string;
  let params: Record<string, unknown>;

  switch (type) {
    case 'post_comment':
    case 'post_like':
      if (!targetId) return;
      screen = 'CommunityPostDetail';
      params = { postId: targetId };
      break;
    case 'crew_join_request':
    case 'crew_member_joined':
      if (!targetId) return;
      screen = 'CrewManage';
      params = { crewId: targetId };
      break;
    case 'follow':
    case 'friend_request':
    case 'friend_request_accepted':
      if (!actorId) return;
      screen = 'UserProfile';
      params = { userId: actorId };
      break;
    case 'run_completed':
      // Friend's run → show their profile (RunDetail only works for own runs)
      if (actorId) {
        screen = 'UserProfile';
        params = { userId: actorId };
      } else {
        return;
      }
      break;
    case 'crew_chat':
      if (!targetId) return;
      screen = 'CrewDetail';
      params = { crewId: targetId };
      break;
    case 'ranking_achievement':
    case 'course_record':
    case 'course_dominion_gained':
    case 'course_dominion_lost':
    case 'course_review':
      if (!targetId) return;
      screen = 'CourseDetail';
      params = { courseId: targetId };
      break;
    case 'challenge_completed':
      if (!targetId) return;
      screen = 'ChallengeDetail';
      params = { challengeId: targetId };
      break;
    case 'level_up':
    case 'weekly_goal':
      screen = 'MyPage';
      params = {};
      break;
    case 'announcement':
      screen = 'NotificationInbox';
      params = {};
      break;
    default:
      screen = 'NotificationInbox';
      params = {};
      break;
  }

  // Determine which tab contains the target screen
  let tab = 'HomeTab';
  if (['MyPage', 'ProfileEdit', 'MyCourses', 'GearManage', 'Settings'].includes(screen)) {
    tab = 'MyPageTab';
  } else if (screen === 'CourseDetail' || screen === 'CourseList') {
    tab = 'CourseTab';
  }

  // First navigate to the tab (resets to root), then push the screen
  (navRef as any).navigate('Main', { screen: tab });
  setTimeout(() => {
    (navRef as any).navigate(screen, params);
  }, 100);
}

/**
 * Registers device push token, sets up notification listeners,
 * and handles notification tap navigation.
 *
 * Must be called inside a component that lives for the app's lifetime
 * (e.g. RootNavigator).
 */
export function useNotifications(
  isAuthenticated: boolean,
  navRef: NavRef,
): void {
  const tokenRef = useRef<string | null>(null);

  // Register device token with backend
  const registerToken = useCallback(async () => {
    try {
      // Android: ensure notification channel exists
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'RUNVS',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const { data: token } = await Notifications.getDevicePushTokenAsync();
      const deviceToken = typeof token === 'string' ? token : String(token);
      tokenRef.current = deviceToken;

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await notificationService.registerToken(deviceToken, platform);
    } catch (error: any) {
      const { Alert } = require('react-native');
      Alert.alert('Push Error', String(error?.message || error));
    }
  }, []);

  // Register token when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    registerToken();
  }, [isAuthenticated, registerToken]);

  // Listen for token refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = Notifications.addPushTokenListener(async (event: any) => {
      try {
        const newToken =
          typeof event.data === 'string' ? event.data : String(event.data);
        tokenRef.current = newToken;
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await notificationService.registerToken(newToken, platform);
      } catch (error) {
        console.warn('[useNotifications] Token refresh registration failed:', error);
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  // Handle notification tap (foreground / background)
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data ?? {};
        navigateFromNotification(navRef, data);
      },
    );

    return () => subscription.remove();
  }, [isAuthenticated, navRef]);

  // Handle cold start notification
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    Notifications.getLastNotificationResponseAsync().then((response: any) => {
      if (cancelled || !response) return;
      const data = response.notification.request.content.data ?? {};
      navigateFromNotification(navRef, data);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navRef]);
}
