import { Audio } from 'expo-av';

const SOUNDS = {
  tick: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav',
  success: 'https://assets.mixkit.co/active_storage/sfx/911/911-84.wav',
  warning: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-84.wav',
};

class SoundManager {
  private sounds: Record<string, Audio.Sound> = {};

  async playSound(name: keyof typeof SOUNDS) {
    try {
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
        { uri: SOUNDS[name] },
        { shouldPlay: true }
      );
      this.sounds[name] = sound;
    } catch (error) {
      console.warn(`Failed to play sound: ${name}`, error);
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
