import { create } from 'zustand';

export interface UserProfile {
  id: string;
  clerk_id: string;
  username: string;
  avatar_url: string | null;
  games_played?: number;
  wins?: number;
  total_score?: number;
  created_at?: string;
  push_token?: string | null;
  notifications_enabled?: boolean;
}

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isOnboarded: boolean;
  hasChecked: boolean;

  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (token: string, options?: { silent?: boolean }) => Promise<UserProfile | null>;
  onboardUser: (username: string, avatarUrl: string | null, token: string) => Promise<UserProfile | null>;
  updatePushToken: (pushToken: string | null, enabled: boolean, authToken: string) => Promise<void>;
  reset: () => void;
}

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,
  isOnboarded: false,
  hasChecked: false,

  setProfile: (profile) => set({ profile, isOnboarded: !!profile, hasChecked: true }),

  fetchProfile: async (token: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      set({ isLoading: true, error: null });
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 404) {
        // Not onboarded yet
        if (!silent) {
          set({ profile: null, isOnboarded: false, isLoading: false, hasChecked: true });
        } else {
          set({ profile: null, isOnboarded: false, hasChecked: true });
        }
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile: UserProfile = await res.json();
      if (!silent) {
        set({ profile, isOnboarded: true, isLoading: false, hasChecked: true });
      } else {
        set({ profile, isOnboarded: true, hasChecked: true });
      }
      return profile;
    } catch (err: any) {
      if (!silent) {
        set({ error: err.message || 'Error fetching profile', isLoading: false, hasChecked: true });
      } else {
        console.error('Silent profile fetch failed:', err);
      }
      return null;
    }
  },

  onboardUser: async (username: string, avatarUrl: string | null, token: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${SERVER_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          avatar_url: avatarUrl,
        }),
      });

      if (res.status === 409) {
        throw new Error('Αυτό το όνομα χρήστη χρησιμοποιείται ήδη. Δοκίμασε ένα διαφορετικό!');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Αποτυχία ολοκλήρωσης εγγραφής');
      }

      const profile: UserProfile = await res.json();
      set({ profile, isOnboarded: true, isLoading: false, hasChecked: true, error: null });
      return profile;
    } catch (err: any) {
      // IMPORTANT: do NOT write to userStore.error here.
      // That field is watched by _layout.tsx and, when truthy, replaces the whole screen
      // with a full-screen "Connection Error" overlay — completely hiding the onboarding form.
      // Onboarding validation errors are inline concerns: just stop the spinner and re-throw
      // so the onboarding screen's own catch block can show the message in the form.
      set({ isLoading: false });
      throw err;
    }
  },

  updatePushToken: async (pushToken: string | null, enabled: boolean, authToken: string) => {
    try {
      await fetch(`${SERVER_URL}/api/users/push-token`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ push_token: pushToken, notifications_enabled: enabled }),
      });
      // Update local profile state immediately so the toggle reflects the new value
      set((state) => ({
        profile: state.profile
          ? { ...state.profile, push_token: pushToken, notifications_enabled: enabled }
          : null,
      }));
    } catch (err) {
      console.error('Failed to update push token:', err);
    }
  },

  reset: () => set({ profile: null, isOnboarded: false, error: null, isLoading: false, hasChecked: false }),
}));
