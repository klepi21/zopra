import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

const SOUNDS = {
  tick: require('../assets/sounds/tick.wav'),
  success: require('../assets/sounds/success.wav'),
  warning: require('../assets/sounds/warning.wav'),
  win: require('../assets/sounds/win.wav'),
  evaluating: require('../assets/sounds/evaluating.wav'),
};

class SoundManager {
  private sounds: Record<string, Audio.Sound> = {};
  private isMuted: boolean = false;

  constructor() {
    SecureStore.getItemAsync('zopra_muted_setting')
      .then((val) => {
        this.isMuted = val === 'true';
      })
      .catch(() => {});
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAll().catch(() => {});
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  async playSound(name: keyof typeof SOUNDS) {
    if (this.isMuted) return;
    try {
      // Ensure audio mode allows playback even in silent mode (iOS ring switch)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });

      if (this.sounds[name]) {
        try {
          await this.sounds[name].stopAsync();
          await this.sounds[name].playFromPositionAsync(0);
          return;
        } catch (e) {
          // If playing from position fails, reload
          await this.sounds[name].unloadAsync();
        }
      }

      const { sound } = await Audio.Sound.createAsync(
        SOUNDS[name],
        { shouldPlay: true }
      );
      this.sounds[name] = sound;
    } catch (error) {
      console.warn(`Failed to play sound: ${name}`, error);
    }
  }

  async stopAll() {
    for (const key in this.sounds) {
      try {
        await this.sounds[key].stopAsync();
      } catch (e) {
        // ignore
      }
    }
  }

  async unloadAll() {
    for (const key in this.sounds) {
      try {
        await this.sounds[key].unloadAsync();
      } catch (e) {
        // ignore
      }
    }
    this.sounds = {};
  }
}

export const soundManager = new SoundManager();
