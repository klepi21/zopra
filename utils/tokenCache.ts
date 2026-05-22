import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1500;

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
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
      
      return fullToken || null;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await this.deleteToken(key);
      return null;
    }
  },
  
  async saveToken(key: string, value: string): Promise<void> {
    try {
      // First delete any existing chunks to avoid mixing old and new
      await this.deleteToken(key);
      
      const numChunks = Math.ceil(value.length / CHUNK_SIZE);
      
      for (let i = 0; i < numChunks; i++) {
        const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkKey = i === 0 ? key : `${key}_${i}`;
        await SecureStore.setItemAsync(chunkKey, chunk);
      }
    } catch (err) {
      console.error('SecureStore save item error: ', err);
    }
  },
  
  async deleteToken(key: string): Promise<void> {
    try {
      let chunkIndex = 0;
      while (true) {
        const chunkKey = chunkIndex === 0 ? key : `${key}_${chunkIndex}`;
        const chunk = await SecureStore.getItemAsync(chunkKey);
        if (!chunk) break;
        await SecureStore.deleteItemAsync(chunkKey);
        chunkIndex++;
      }
    } catch (err) {
      console.error('SecureStore delete item error: ', err);
    }
  }
};
