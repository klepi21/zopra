import { useUserStore } from '../store/userStore';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('userStore Zustand Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useUserStore.getState();
    expect(state.profile).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isOnboarded).toBe(false);
  });

  describe('fetchProfile', () => {
    it('should successfully fetch profile if it exists', async () => {
      const mockProfile = {
        id: 'user-uuid-1',
        clerk_id: 'clerk-user-1',
        username: 'hector',
        avatar_url: '{"id":"zeus","emoji":"⚡"}',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockProfile,
      });

      const profile = await useUserStore.getState().fetchProfile('mock-jwt-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        {
          headers: {
            Authorization: 'Bearer mock-jwt-token',
          },
        }
      );
      expect(profile).toEqual(mockProfile);
      expect(useUserStore.getState().profile).toEqual(mockProfile);
      expect(useUserStore.getState().isOnboarded).toBe(true);
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should handle 404 not found (user is not yet onboarded)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const profile = await useUserStore.getState().fetchProfile('mock-jwt-token');

      expect(profile).toBeNull();
      expect(useUserStore.getState().profile).toBeNull();
      expect(useUserStore.getState().isOnboarded).toBe(false);
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const profile = await useUserStore.getState().fetchProfile('mock-jwt-token');

      expect(profile).toBeNull();
      expect(useUserStore.getState().profile).toBeNull();
      expect(useUserStore.getState().error).toBe('Network error');
      expect(useUserStore.getState().isOnboarded).toBe(false);
      expect(useUserStore.getState().isLoading).toBe(false);
    });
  });

  describe('onboardUser', () => {
    it('should successfully create profile on onboarding', async () => {
      const mockNewProfile = {
        id: 'new-uuid',
        clerk_id: 'clerk-user-1',
        username: 'achilles',
        avatar_url: '{"id":"achilles","emoji":"🛡️"}',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockNewProfile,
      });

      const profile = await useUserStore
        .getState()
        .onboardUser('achilles', '{"id":"achilles","emoji":"🛡️"}', 'mock-jwt-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/users',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-jwt-token',
          },
          body: JSON.stringify({
            username: 'achilles',
            avatar_url: '{"id":"achilles","emoji":"🛡️"}',
          }),
        }
      );
      expect(profile).toEqual(mockNewProfile);
      expect(useUserStore.getState().profile).toEqual(mockNewProfile);
      expect(useUserStore.getState().isOnboarded).toBe(true);
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should throw an error if username is already taken (409)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      await expect(
        useUserStore
          .getState()
          .onboardUser('achilles', '{"id":"achilles","emoji":"🛡️"}', 'mock-jwt-token')
      ).rejects.toThrow('Username already taken');

      expect(useUserStore.getState().profile).toBeNull();
      expect(useUserStore.getState().isOnboarded).toBe(false);
      expect(useUserStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all states back to default', () => {
      // 1. Manually set some dummy states
      useUserStore.setState({
        profile: { id: '1', clerk_id: '1', username: 'a', avatar_url: null },
        isOnboarded: true,
        error: 'some error',
        isLoading: true,
      });

      // 2. Reset the store
      useUserStore.getState().reset();

      // 3. Expect it to be back to initial state
      const state = useUserStore.getState();
      expect(state.profile).toBeNull();
      expect(state.isOnboarded).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
