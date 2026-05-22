import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { soundManager } from '@/utils/soundManager';

interface SoundSettingsState {
  isMuted: boolean;
  loadMuteSetting: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

export const useSoundStore = create<SoundSettingsState>((set) => ({
  isMuted: false,
  loadMuteSetting: async () => {
    try {
      const storedVal = await SecureStore.getItemAsync('zopra_muted_setting');
      const isMuted = storedVal === 'true';
      set({ isMuted });
      soundManager.setMuted(isMuted);
    } catch (e) {
      console.warn('Failed to load sound settings', e);
    }
  },
  toggleMute: async () => {
    try {
      set((state) => {
        const newMuted = !state.isMuted;
        SecureStore.setItemAsync('zopra_muted_setting', String(newMuted)).catch(() => {});
        soundManager.setMuted(newMuted);
        return { isMuted: newMuted };
      });
    } catch (e) {
      console.warn('Failed to toggle sound settings', e);
    }
  },
}));
