import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../src/middleware/authMiddleware';
import { createClerkClient } from '@clerk/clerk-sdk-node';

// Mock Clerk client
jest.mock('@clerk/clerk-sdk-node', () => {
  const mockVerifyToken = jest.fn();
  return {
    createClerkClient: jest.fn().mockReturnValue({
      verifyToken: mockVerifyToken
    }),
    _mockVerifyToken: mockVerifyToken // export helper to adjust behavior in tests
  };
});

// Helper to access mockVerifyToken
const mockVerifyToken = (createClerkClient as any)().verifyToken;

describe('authMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('should return 401 if authorization header is missing', async () => {
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Missing or invalid authorization header'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', async () => {
    mockRequest.headers = { authorization: 'Basic credentials' };
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should allow bypassing auth when using mock token in test environment', async () => {
    mockRequest.headers = { authorization: 'Bearer mock_test_user_id' };
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.auth).toEqual({ userId: 'test_user_id' });
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should verify valid token and set auth context', async () => {
    mockRequest.headers = { authorization: 'Bearer valid_clerk_token' };
    mockVerifyToken.mockResolvedValueOnce({ sub: 'user_clerk_123' });

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockVerifyToken).toHaveBeenCalledWith('valid_clerk_token');
    expect(mockRequest.auth).toEqual({ userId: 'user_clerk_123' });
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should return 401 if Clerk verification throws an error', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid_clerk_token' };
    mockVerifyToken.mockRejectedValueOnce(new Error('Invalid signature'));

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockVerifyToken).toHaveBeenCalledWith('invalid_clerk_token');
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid token'
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
