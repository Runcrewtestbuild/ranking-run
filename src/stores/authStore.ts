import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import type { AuthProvider, AuthResponse, UserProfile } from '../types/api';
import { SECURE_STORE_KEYS } from '../utils/constants';
import { authService } from '../services/authService';
import api, { ApiError, performTokenRefresh } from '../services/api';
import { notificationService } from '../services/notificationService';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { clearMyPageCache } from '../screens/mypage/MyPageScreen';

interface BanInfo {
  reason: string;
}

/** Check if an error is a USER_BANNED 403 response */
function isBanError(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 403) {
    const data = error.data as Record<string, unknown> | null;
    if (data?.code === 'USER_BANNED') {
      return (data.message as string) || '';
    }
  }
  return null;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
  error: string | null;
  banInfo: BanInfo | null;

  login: (provider: AuthProvider, token: string, nonce?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  clearError: () => void;
  clearBan: () => void;
  deleteAccount: () => Promise<boolean>;
  submitBanAppeal: (message: string) => Promise<boolean>;
  completeOnboarding: (nickname: string, avatarUrl?: string, country?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  isNewUser: false,
  error: null,
  banInfo: null,

  login: async (provider, token, nonce): Promise<boolean> => {
    set({ error: null });

    const performLogin = async (force: boolean): Promise<boolean> => {
      const response: AuthResponse = await authService.login({
        provider,
        token,
        nonce,
        force,
      });

      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.ACCESS_TOKEN,
        response.access_token,
      );
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.REFRESH_TOKEN,
        response.refresh_token,
      );

      if (response.user.is_new_user) {
        set({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          isNewUser: true,
        });
      } else {
        let profile = null;
        try {
          profile = await authService.getProfile();
        } catch (profileError) {
          const banReason = isBanError(profileError);
          if (banReason !== null) {
            set({
              accessToken: response.access_token,
              refreshToken: response.refresh_token,
              banInfo: { reason: banReason },
              isAuthenticated: false,
            });
            return false;
          }
        }
        set({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          isNewUser: false,
          user: profile,
          isAuthenticated: true,
        });
      }

      return response.user.is_new_user;
    };

    try {
      return await performLogin(false);
    } catch (error: unknown) {
      // Handle single-device login: user already logged in on another device
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        (error.data as Record<string, unknown>)?.code === 'ALREADY_LOGGED_IN'
      ) {
        return new Promise<boolean>((resolve, reject) => {
          Alert.alert(
            '로그인 확인',
            '이 기기에서 로그인하시겠습니까? 기존 기기에서는 자동으로 로그아웃됩니다.',
            [
              {
                text: '취소',
                style: 'cancel',
                onPress: () => {
                  set({ error: null });
                  // Reject with a cancellation so the caller knows login didn't proceed
                  reject(new Error('LOGIN_CANCELLED'));
                },
              },
              {
                text: '로그인',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const result = await performLogin(true);
                    resolve(result);
                  } catch (forceError: unknown) {
                    const message =
                      forceError instanceof Error
                        ? forceError.message
                        : i18n.t('auth.errors.loginFailed');
                    set({ error: message });
                    reject(forceError);
                  }
                },
              },
            ],
          );
        });
      }

      const message =
        error instanceof Error ? error.message : i18n.t('auth.errors.loginFailed');
      set({ error: message });
      throw error;
    }
  },

  logout: async () => {
    // Unregister push token before clearing auth
    try {
      const { data: token } = await Notifications.getDevicePushTokenAsync();
      const deviceToken = typeof token === 'string' ? token : String(token);
      await notificationService.unregisterToken(deviceToken);
    } catch {
      // Token retrieval or unregister may fail — proceed with logout
    }

    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    clearMyPageCache();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      error: null,
      banInfo: null,
    });
  },

  refreshAuth: async () => {
    const storedRefresh = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    if (!storedRefresh) return false;

    try {
      // Use the single performTokenRefresh() from api.ts to prevent
      // race conditions with the 401 interceptor.
      const newAccessToken = await performTokenRefresh();

      const newRefreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
      set({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      return true;
    } catch (error: unknown) {
      // Only logout on definitive 401 (token revoked/expired).
      // Other 4xx (429 rate-limit, 400, 403) may be transient — don't logout.
      const isDefinitiveAuthFailure =
        error instanceof Error &&
        'status' in error &&
        (error as any).status === 401;
      if (isDefinitiveAuthFailure) {
        await get().logout();
      }
      return false;
    }
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });

    try {
      const accessToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.ACCESS_TOKEN,
      );
      const refreshToken = await SecureStore.getItemAsync(
        SECURE_STORE_KEYS.REFRESH_TOKEN,
      );

      if (!accessToken || !refreshToken) {
        set({ isLoading: false });
        return;
      }

      set({ accessToken, refreshToken });

      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 10000),
        );
        const profile = await Promise.race([
          authService.getProfile(),
          timeout,
        ]);
        // If user has no nickname, onboarding was never completed
        // (e.g. first login created user but app navigated back to login)
        const needsOnboarding = !profile.nickname;
        set({
          user: profile,
          isAuthenticated: !needsOnboarding,
          isNewUser: needsOnboarding,
          isLoading: false,
        });
      } catch (profileError) {
        const banReason = isBanError(profileError);
        if (banReason !== null) {
          set({ banInfo: { reason: banReason }, isLoading: false });
          return;
        }
        // Access token expired or server unreachable, try refresh
        try {
          const refreshed = await get().refreshAuth();
          if (refreshed) {
            try {
              const profile = await authService.getProfile();
              const needsOnboarding = !profile.nickname;
              set({
                user: profile,
                isAuthenticated: !needsOnboarding,
                isNewUser: needsOnboarding,
                isLoading: false,
              });
            } catch {
              // Profile fetch failed after refresh — still authenticated,
              // just don't have profile data yet. User can pull-to-refresh.
              set({ isAuthenticated: true, isLoading: false });
            }
          } else {
            // refreshAuth returned false — if tokens still exist, stay authenticated
            // (transient network error won't have wiped them)
            const currentToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
            if (currentToken) {
              set({ isAuthenticated: true, isLoading: false });
            } else {
              set({ isLoading: false });
            }
          }
        } catch {
          // Network completely unavailable — keep tokens, mark as authenticated
          // so user can use the app offline
          set({ isAuthenticated: true, isLoading: false });
        }
      }
    } catch {
      // Outer catch: SecureStore read itself failed (very rare).
      // If we somehow got tokens before the error, keep them.
      const currentToken = get().accessToken;
      if (currentToken) {
        set({ isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true });
  },

  clearError: () => {
    set({ error: null });
  },

  clearBan: () => {
    set({ banInfo: null });
  },

  deleteAccount: async (): Promise<boolean> => {
    try {
      await api.delete('/users/me/account');
      await get().logout();
      return true;
    } catch {
      return false;
    }
  },

  submitBanAppeal: async (message: string): Promise<boolean> => {
    try {
      await api.post('/users/me/ban-appeal', { message });
      return true;
    } catch {
      return false;
    }
  },

  completeOnboarding: async (nickname, avatarUrl, country) => {
    set({ error: null });
    try {
      const profile = await authService.setupProfile({
        nickname,
        avatar_url: avatarUrl,
        country,
      });
      set({
        user: {
          id: profile.id,
          user_code: get().user?.user_code ?? '',
          email: '',
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
          birthday: null,
          height_cm: null,
          weight_kg: null,
          bio: null,
          instagram_username: null,
          country: country ?? null,
          gender: null,
          total_distance_meters: profile.total_distance_meters,
          total_runs: profile.total_runs,
          total_points: profile.total_points ?? 0,
          created_at: profile.created_at,
        },
        isAuthenticated: true,
        isNewUser: false,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : i18n.t('auth.errors.profileSetupFailed');
      set({ error: message });
      throw error;
    }
  },
}));
