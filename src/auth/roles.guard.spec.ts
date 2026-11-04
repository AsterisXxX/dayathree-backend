import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './session.guard';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let guard: RolesGuard;

  function contextFor(roles?: string[]): ExecutionContext {
    const request = {
      staff: roles
        ? {
            sessionId: 'session-1',
            userId: 'user-1',
            email: 'staff@example.com',
            fullName: 'Test Staff',
            roles,
          }
        : undefined,
    } as AuthenticatedRequest;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => contextFor,
      getClass: () => RolesGuard,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new RolesGuard(
      reflector as unknown as Reflector,
    );
  });

  it('allows a Rider on a Rider endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['RIDER']);

    expect(guard.canActivate(contextFor(['RIDER']))).toBe(true);
    expect(reflector.getAllAndOverride)
      .toHaveBeenCalledWith(
        ROLES_KEY,
        expect.any(Array),
      );
  });

  it('denies a Rider on a Checker endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['CHECKER']);

    expect(() =>
      guard.canActivate(contextFor(['RIDER'])),
    ).toThrow(ForbiddenException);
  });

  it('allows a Checker on a Checker endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['CHECKER']);

    expect(guard.canActivate(contextFor(['CHECKER']))).toBe(true);
  });

  it('allows a staff member with either required role', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'RIDER',
      'CHECKER',
    ]);

    expect(guard.canActivate(contextFor(['CHECKER']))).toBe(true);
  });

  it('denies a staff member with no assigned role', () => {
    reflector.getAllAndOverride.mockReturnValue(['RIDER']);

    expect(() => guard.canActivate(contextFor([])))
      .toThrow(ForbiddenException);
  });

  it('denies a request without authenticated staff', () => {
    reflector.getAllAndOverride.mockReturnValue(['RIDER']);

    expect(() => guard.canActivate(contextFor()))
      .toThrow(UnauthorizedException);
  });

  it('fails closed when role metadata is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(() =>
      guard.canActivate(contextFor(['RIDER'])),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when required roles are empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(() =>
      guard.canActivate(contextFor(['RIDER'])),
    ).toThrow(ForbiddenException);
  });
});
