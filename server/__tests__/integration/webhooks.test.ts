// Mock Svix webhook verification (Must be at the very top)
jest.mock('svix', () => {
  return {
    Webhook: class {
      verify = jest.fn().mockImplementation((payload) => {
        return JSON.parse(payload);
      });
    }
  };
});

// Mock Supabase module to return jest.fn() for from (Must be at the very top)
jest.mock('../../src/db/supabase', () => {
  return {
    supabase: {
      from: jest.fn()
    }
  };
});

import request from 'supertest';
import { app } from '../../src/index';
import { supabase } from '../../src/db/supabase';

const mockFrom = supabase.from as jest.Mock;

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();

const mockQueryBuilder = {
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq
};

describe('Clerk Webhook Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Explicitly set up return values before each test
    mockFrom.mockReturnValue(mockQueryBuilder);
    mockInsert.mockReturnValue(mockQueryBuilder);
    mockUpdate.mockReturnValue(mockQueryBuilder);
    mockDelete.mockReturnValue(mockQueryBuilder);
    mockEq.mockReturnValue(mockQueryBuilder);

    process.env = {
      ...originalEnv,
      CLERK_WEBHOOK_SECRET: 'test_webhook_secret',
      NODE_ENV: 'test'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return 400 if Svix headers are missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .send({ type: 'user.created', data: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing Svix headers');
  });

  it('should process user.created event and insert user into Supabase', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const payload = {
      type: 'user.created',
      data: {
        id: 'user_clerk_999',
        username: 'greek_hero',
        image_url: 'https://avatar.url/hero.png',
        email_addresses: [{ email_address: 'hero@olympus.gr' }]
      }
    };

    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('svix-id', 'msg_123')
      .set('svix-timestamp', '1716000000')
      .set('svix-signature', 'v1,some_signature')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockInsert).toHaveBeenCalledWith({
      clerk_id: 'user_clerk_999',
      username: 'greek_hero',
      avatar_url: 'https://avatar.url/hero.png'
    });
  });

  it('should fallback to email prefix if username is missing on user.created', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    const payload = {
      type: 'user.created',
      data: {
        id: 'user_clerk_888',
        image_url: 'https://avatar.url/888.png',
        email_addresses: [{ email_address: 'zeus@olympus.gr' }]
      }
    };

    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('svix-id', 'msg_123')
      .set('svix-timestamp', '1716000000')
      .set('svix-signature', 'v1,some_signature')
      .send(payload);

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({
      clerk_id: 'user_clerk_888',
      username: 'zeus',
      avatar_url: 'https://avatar.url/888.png'
    });
  });

  it('should process user.updated event and update user in Supabase', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const payload = {
      type: 'user.updated',
      data: {
        id: 'user_clerk_999',
        username: 'greek_hero_updated',
        image_url: 'https://avatar.url/hero_updated.png'
      }
    };

    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('svix-id', 'msg_123')
      .set('svix-timestamp', '1716000000')
      .set('svix-signature', 'v1,some_signature')
      .send(payload);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      username: 'greek_hero_updated',
      avatar_url: 'https://avatar.url/hero_updated.png'
    });
    expect(mockEq).toHaveBeenCalledWith('clerk_id', 'user_clerk_999');
  });

  it('should process user.deleted event and delete user from Supabase', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const payload = {
      type: 'user.deleted',
      data: {
        id: 'user_clerk_999'
      }
    };

    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('svix-id', 'msg_123')
      .set('svix-timestamp', '1716000000')
      .set('svix-signature', 'v1,some_signature')
      .send(payload);

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('clerk_id', 'user_clerk_999');
  });
});
