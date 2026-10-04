import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const verify = jest.fn();
  const findFirst = jest.fn();
  const request = { headers: { authorization: 'Bearer signed-token' } } as {
    headers: { authorization: string };
    user?: unknown;
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    request.user = undefined;
    guard = new JwtAuthGuard(
      { verify } as unknown as JwtService,
      { user: { findFirst } } as unknown as PrismaService,
    );
  });

  it('loads current role data from the database for a valid active user', async () => {
    verify.mockReturnValue({ sub: 'user-1', role: Role.ADMIN });
    findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: Role.DRIVER,
      displayId: 'DRV-01',
      hubName: 'West Hub',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        displayId: true,
        hubName: true,
      },
    });
    expect(request.user).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      role: Role.DRIVER,
      displayId: 'DRV-01',
      hubName: 'West Hub',
    });
  });

  it('rejects a valid token after the user is deactivated', async () => {
    verify.mockReturnValue({ sub: 'user-1' });
    findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});