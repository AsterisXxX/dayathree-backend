import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    staffSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionService(prisma as unknown as PrismaService);
  });

  it('creates a token and stores only its SHA-256 hash', async () => {
    prisma.user.findUnique.mockResolvedValue({ isActive: true });
    prisma.staffSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await service.create('user-1');
    const data = prisma.staffSession.create.mock.calls[0][0].data;

    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(data.userId).toBe('user-1');
    expect(data.tokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(data.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an inactive user', async () => {
    prisma.user.findUnique.mockResolvedValue({ isActive: false });

    await expect(service.create('user-1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.staffSession.create).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.create('missing')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.staffSession.create).not.toHaveBeenCalled();
  });

  it('rejects invalid token formats', async () => {
    await expect(service.validate('invalid-token')).resolves.toBeNull();
    expect(prisma.staffSession.findFirst).not.toHaveBeenCalled();
  });

  it('returns null for nonexistent, revoked, expired or inactive sessions', async () => {
    prisma.staffSession.findFirst.mockResolvedValue(null);

    await expect(service.validate('a'.repeat(64))).resolves.toBeNull();

    expect(prisma.staffSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
          user: { isActive: true },
        }),
      }),
    );
  });

  it('returns user identity and current roles for a valid session', async () => {
    prisma.staffSession.findFirst.mockResolvedValue({
      id: 'session-1',
      user: {
        id: 'user-1',
        email: 'rider@example.invalid',
        fullName: 'Test Rider',
        roles: [
          { role: { code: 'RIDER' } },
          { role: { code: 'CHECKER' } },
        ],
      },
    });

    const result = await service.validate('a'.repeat(64));

    expect(result).toEqual({
      sessionId: 'session-1',
      userId: 'user-1',
      email: 'rider@example.invalid',
      fullName: 'Test Rider',
      roles: ['RIDER', 'CHECKER'],
    });
  });

  it('revokes a session using its token hash', async () => {
    prisma.staffSession.updateMany.mockResolvedValue({ count: 1 });

    const token = 'b'.repeat(64);
    await service.revoke(token);

    expect(prisma.staffSession.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('ignores invalid revoke tokens', async () => {
    await service.revoke('invalid');

    expect(prisma.staffSession.updateMany).not.toHaveBeenCalled();
  });
});
