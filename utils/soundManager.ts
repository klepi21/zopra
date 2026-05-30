import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';

const SOUNDS = {
  tick: require('../assets/sounds/tick.wav'),
  success: require('../assets/sounds/success.wav'),
  warning: require('../assets/sounds/warning.wav'),
  win: require('../assets/sounds/win.wav'),
  evaluating: require('../assets/sounds/evaluating.wav'),
};

class SoundManager {
  private sounds: Record<string, AudioPlayer> = {};
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
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
      });

      if (this.sounds[name]) {
        try {
          this.sounds[name].pause();
          this.sounds[name].seekTo(0);
          this.sounds[name].play();
          return;
        } catch (e) {
          // If playing from position fails, reload
          this.sounds[name].release();
          delete this.sounds[name];
        }
      }

      const player = createAudioPlayer(SOUNDS[name]);
      player.play();
      this.sounds[name] = player;
    } catch (error) {
      console.warn(`Failed to play sound: ${name}`, error);
    }
  }

  async stopAll() {
    for (const key in this.sounds) {
      try {
        this.sounds[key].pause();
      } catch (e) {
        // ignore
      }
    }
  }

  async unloadAll() {
    for (const key in this.sounds) {
      try {
        this.sounds[key].release();
      } catch (e) {
        // ignore
      }
    }
    this.sounds = {};
  }
}

export const soundManager = new SoundManager();
