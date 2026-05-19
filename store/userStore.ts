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
}

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isOnboarded: boolean;
  hasChecked: boolean;
  
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (token: string) => Promise<UserProfile | null>;
  onboardUser: (username: string, avatarUrl: string | null, token: string) => Promise<UserProfile | null>;
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

  fetchProfile: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${SERVER_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 404) {
        // Not onboarded yet
        set({ profile: null, isOnboarded: false, isLoading: false, hasChecked: true });
        return null;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile: UserProfile = await res.json();
      set({ profile, isOnboarded: true, isLoading: false, hasChecked: true });
      return profile;
    } catch (err: any) {
      set({ error: err.message || 'Error fetching profile', isLoading: false, hasChecked: true });
      return null;
    }
  },

  onboardUser: async (username: string, avatarUrl: string | null, token: string) => {
    set({ isLoading: true, error: null });
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
        throw new Error('Username already taken');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete onboarding');
      }

      const profile: UserProfile = await res.json();
      set({ profile, isOnboarded: true, isLoading: false, hasChecked: true });
      return profile;
    } catch (err: any) {
      set({ error: err.message || 'Error onboarding user', isLoading: false });
      throw err;
    }
  },

  reset: () => set({ profile: null, isOnboarded: false, error: null, isLoading: false, hasChecked: false }),
}));
