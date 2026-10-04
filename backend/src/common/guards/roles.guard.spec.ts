import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const requiredRoles = jest.fn();
  const reflector = {
    getAllAndOverride: requiredRoles,
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function contextWithUser(user: unknown) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    requiredRoles.mockReset();
  });

  it('allows a user with a required role', () => {
    requiredRoles.mockReturnValue(['DISPATCH_MANAGER', 'ADMIN']);

    expect(
      guard.canActivate(contextWithUser({ role: 'DISPATCH_MANAGER' })),
    ).toBe(true);
  });

  it('denies a user with a role outside the allowed set', () => {
    requiredRoles.mockReturnValue(['DISPATCH_MANAGER', 'ADMIN']);

    expect(() =>
      guard.canActivate(contextWithUser({ role: 'DRIVER' })),
    ).toThrow(ForbiddenException);
  });

  it('denies a missing role context on restricted routes', () => {
    requiredRoles.mockReturnValue(['AUDITOR']);

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows routes without role metadata', () => {
    requiredRoles.mockReturnValue(undefined);

    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });
});