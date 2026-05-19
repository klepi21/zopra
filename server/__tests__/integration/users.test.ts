// Mock Supabase module (Must be at the very top)
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

const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();

const mockQueryBuilder = {
  select: mockSelect,
  upsert: mockUpsert,
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  single: mockSingle
};

describe('Users API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Explicitly set up return values before each test
    mockFrom.mockReturnValue(mockQueryBuilder);
    mockSelect.mockReturnValue(mockQueryBuilder);
    mockUpsert.mockReturnValue(mockQueryBuilder);
    mockEq.mockReturnValue(mockQueryBuilder);
  });

  describe('GET /api/users/me', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('should return 404 if profile does not exist', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer mock_user_123');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User profile not found');
    });

    it('should return user profile if found', async () => {
      const mockProfile = {
        id: 'db-uuid-123',
        clerk_id: 'user_123',
        username: 'achilles',
        avatar_url: 'https://avatar.url/achilles'
      };

      mockMaybeSingle.mockResolvedValueOnce({ data: mockProfile, error: null });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer mock_user_123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockProfile);
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockEq).toHaveBeenCalledWith('clerk_id', 'user_123');
    });
  });

  describe('POST /api/users', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).post('/api/users').send({ username: 'hector' });
      expect(res.status).toBe(401);
    });

    it('should return 400 if username is missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer mock_user_123')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username is required');
    });

    it('should return 409 if username is already taken', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'some-other-uuid' }, error: null });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer mock_user_123')
        .send({ username: 'achilles' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Username already taken');
    });

    it('should create and return new user profile if username is unique', async () => {
      // 1. Mock the uniqueness check to return no existing user
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      // 2. Mock the upsert and single result
      const mockNewProfile = {
        id: 'new-db-uuid',
        clerk_id: 'user_123',
        username: 'patroclus',
        avatar_url: 'https://avatar.url/patroclus'
      };
      mockSingle.mockResolvedValueOnce({ data: mockNewProfile, error: null });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer mock_user_123')
        .send({ username: 'patroclus', avatar_url: 'https://avatar.url/patroclus' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockNewProfile);
      expect(mockUpsert).toHaveBeenCalledWith({
        clerk_id: 'user_123',
        username: 'patroclus',
        avatar_url: 'https://avatar.url/patroclus'
      }, { onConflict: 'clerk_id' });
    });
  });
});
