import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import {
  AuthenticatedRequest,
  SessionGuard,
} from './session.guard';

describe('SessionGuard', () => {
  const sessions = {
    validate: jest.fn(),
  };

  const identity = {
    sessionId: 'session-1',
    userId: 'user-1',
    email: 'rider@example.com',
    fullName: 'Test Rider',
    roles: ['RIDER'],
  };

  let guard: SessionGuard;

  const contextFor = (authorization?: string) => {
    const request = {
      headers: { authorization },
    } as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return { request, context };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new SessionGuard(
      sessions as unknown as SessionService,
    );
  });

  it('accepts a valid bearer session', async () => {
    const token = 'a'.repeat(64);
    sessions.validate.mockResolvedValue(identity);

    const { request, context } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(sessions.validate).toHaveBeenCalledWith(token);
    expect(request.staff).toEqual(identity);
    expect(request.staffToken).toBe(token);
  });

  it.each([
    undefined,
    '',
    'Basic abc123',
    'Bearer invalid',
    `bearer ${'a'.repeat(64)}`,
    `Bearer ${'a'.repeat(63)}`,
    `Bearer ${'a'.repeat(65)}`,
    `Bearer ${'g'.repeat(64)}`,
  ])('rejects malformed authorization: %s', async (authorization) => {
    const { context } = contextFor(authorization);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('rejects a session that is not active', async () => {
    sessions.validate.mockResolvedValue(null);

    const { context } = contextFor(`Bearer ${'a'.repeat(64)}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
