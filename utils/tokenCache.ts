import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1500;

let cacheQueue = Promise.resolve();

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      cacheQueue = cacheQueue.then(async () => {
        try {
          let fullToken = '';
          let chunkIndex = 0;
          
          while (true) {
            const chunkKey = chunkIndex === 0 ? key : `${key}_${chunkIndex}`;
            const chunk = await SecureStore.getItemAsync(chunkKey);
            
            if (!chunk) {
              break;
            }
            
            fullToken += chunk;
            chunkIndex++;
          }
          
          resolve(fullToken || null);
        } catch (error) {
          // Don't delete the token on a transient read error (e.g. Keystore temporarily
          // locked, biometric prompt cancelled). Return null so the caller retries auth,
          // but leave the stored data intact so the next read can succeed.
          console.error('SecureStore get item error: ', error);
          resolve(null);
        }
      });
    });
  },
  
  async saveToken(key: string, value: string | null | undefined): Promise<void> {
    return new Promise((resolve) => {
      cacheQueue = cacheQueue.then(async () => {
        try {
          // First delete any existing chunks
          let chunkIndex = 0;
          while (true) {
            const chunkKey = chunkIndex === 0 ? key : `${key}_${chunkIndex}`;
            const chunk = await SecureStore.getItemAsync(chunkKey);
            if (!chunk) break;
            await SecureStore.deleteItemAsync(chunkKey);
            chunkIndex++;
          }
          
          if (!value) {
            resolve();
            return;
          }
          
          const numChunks = Math.ceil(value.length / CHUNK_SIZE);
          
          for (let i = 0; i < numChunks; i++) {
            const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const chunkKey = i === 0 ? key : `${key}_${i}`;
            await SecureStore.setItemAsync(chunkKey, chunk);
          }
        } catch (err) {
          console.error('SecureStore save item error: ', err);
        }
        resolve();
      });
    });
  },
  
  async deleteToken(key: string): Promise<void> {
    // We proxy this to saveToken with null to use the same queue
    return this.saveToken(key, null);
  }
};
