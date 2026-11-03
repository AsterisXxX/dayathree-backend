import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };

  const passwords = {
    verify: jest.fn(),
    getDummyHash: jest.fn(),
  };

  const sessions = {
    create: jest.fn(),
    revoke: jest.fn(),
    validate: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    passwords.getDummyHash.mockResolvedValue('dummy-hash');
    passwords.verify.mockResolvedValue(false);

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
      sessions as unknown as SessionService,
    );
  });

  it('logs in with valid credentials and normalized email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'stored-hash',
      isActive: true,
    });
    passwords.verify.mockResolvedValue(true);
    sessions.create.mockResolvedValue({
      token: 'a'.repeat(64),
      expiresAt: new Date('2030-01-01'),
    });

    const result = await service.login(
      '  RIDER@Example.com  ',
      'CorrectPassword123!',
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'rider@example.com' },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
      },
    });
    expect(passwords.verify).toHaveBeenCalledWith(
      'stored-hash',
      'CorrectPassword123!',
    );
    expect(sessions.create).toHaveBeenCalledWith('user-1');
    expect(result.token).toHaveLength(64);
  });

  it('rejects an incorrect password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'stored-hash',
      isActive: true,
    });
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login('rider@example.com', 'WrongPassword'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'stored-hash',
      isActive: false,
    });

    await expect(
      service.login('rider@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    expect(passwords.getDummyHash).toHaveBeenCalledTimes(1);
    expect(passwords.verify).toHaveBeenCalledWith(
      'dummy-hash',
      'Password123!',
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects empty credentials', async () => {
    await expect(
      service.login('  ', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login('rider@example.com', ''),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('uses dummy verification for a nonexistent account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    expect(passwords.getDummyHash).toHaveBeenCalledTimes(1);
    expect(passwords.verify).toHaveBeenCalledWith(
      'dummy-hash',
      'Password123!',
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('never creates a session for an inactive account even if dummy verification succeeds', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'inactive-user',
      passwordHash: 'stored-hash',
      isActive: false,
    });

    passwords.verify.mockResolvedValue(true);

    await expect(
      service.login('inactive@example.com', 'Password123!'),
    ).rejects.toThrow(UnauthorizedException);

    expect(passwords.getDummyHash).toHaveBeenCalledTimes(1);
    expect(passwords.verify).toHaveBeenCalledWith(
      'dummy-hash',
      'Password123!',
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('revokes a session on logout', async () => {
    sessions.revoke.mockResolvedValue(undefined);

    await service.logout('a'.repeat(64));

    expect(sessions.revoke).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('returns session identity for a valid token', async () => {
    const identity = {
      sessionId: 'session-1',
      userId: 'user-1',
      email: 'rider@example.com',
      fullName: 'Test Rider',
      roles: ['RIDER'],
    };

    sessions.validate.mockResolvedValue(identity);

    await expect(service.me('a'.repeat(64))).resolves.toEqual(
      identity,
    );
  });

  it('rejects an invalid session', async () => {
    sessions.validate.mockResolvedValue(null);

    await expect(
      service.me('invalid-token'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
