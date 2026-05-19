const mockStore: Record<string, string> = {};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: async (key: string) => {
        return mockStore[key] || null;
      },
      set: async (key: string, value: string) => {
        mockStore[key] = value;
        return 'OK';
      },
      setex: async (key: string, ttl: number, value: string) => {
        mockStore[key] = value;
        return 'OK';
      },
      del: async (key: string) => {
        delete mockStore[key];
        return 1;
      },
      on: (event: string, callback: any) => {
        return {};
      },
    };
  });
});

// Expose the mocked store on the global object for test assertions
(global as any).redisStore = mockStore;
