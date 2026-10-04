import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const password = 'Enterprise@2026';
  let service: AuthService;
  let findUnique: jest.Mock;
  let sign: jest.Mock;
  let userUpdate: jest.Mock;
  let refreshTokenFindUnique: jest.Mock;
  let refreshTokenCreate: jest.Mock;
  let refreshTokenUpdateMany: jest.Mock;
  let refreshTokenUpdate: jest.Mock;
  let passwordResetTokenFindUnique: jest.Mock;
  let passwordResetTokenCreate: jest.Mock;
  let passwordResetTokenUpdateMany: jest.Mock;
  let loginAttemptCreate: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    userUpdate = jest.fn().mockResolvedValue({ failedLoginAttempts: 1 });
    sign = jest.fn().mockReturnValue('signed-access-token');
    refreshTokenFindUnique = jest.fn();
    refreshTokenCreate = jest.fn().mockResolvedValue({ id: 'refresh-new' });
    refreshTokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    refreshTokenUpdate = jest.fn();
    passwordResetTokenFindUnique = jest.fn();
    passwordResetTokenCreate = jest.fn();
    passwordResetTokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    loginAttemptCreate = jest.fn().mockResolvedValue({ id: 'login-attempt-1' });
    const refreshToken = {
      findUnique: refreshTokenFindUnique,
      create: refreshTokenCreate,
      updateMany: refreshTokenUpdateMany,
      update: refreshTokenUpdate,
    };
    const passwordResetToken = {
      findUnique: passwordResetTokenFindUnique,
      create: passwordResetTokenCreate,
      updateMany: passwordResetTokenUpdateMany,
    };
    const loginAttempt = { create: loginAttemptCreate };
    service = new AuthService(
      { sign } as unknown as JwtService,
      {
        user: { findUnique, update: userUpdate },
        refreshToken,
        passwordResetToken,
        loginAttempt,
        $transaction: (run: (transaction: unknown) => unknown) =>
          run({ refreshToken, passwordResetToken, loginAttempt, user: { update: userUpdate } }),
      } as unknown as PrismaService,
    );
  });

  it('authenticates an active database user and returns the existing login contract', async () => {
    const user = {
      id: 'user-123',
      email: 'dispatch@vectologistics.in',
      passwordHash: await argon2.hash(password),
      name: 'Dispatch Manager',
      initials: 'DM',
      role: Role.DISPATCH_MANAGER,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      displayId: 'DIS-04',
      hubName: 'Western Corridor Hub #4 (Bhiwandi)',
      deletedAt: null,
    };
    findUnique.mockResolvedValue(user);

    const result = await service.login({
      email: ' DISPATCH@VECTOLOGISTICS.IN ',
      password,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'dispatch@vectologistics.in' },
    });
    expect(sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayId: user.displayId,
      hubName: user.hubName,
    });
    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: expect.any(String),
      user: {
        id: user.id,
        name: user.name,
        initials: user.initials,
        role: user.role,
        displayId: user.displayId,
        hubName: user.hubName,
        redirectPath: '/dispatch',
      },
    });
    expect(refreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        familyId: expect.any(String),
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(loginAttemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: user.email,
        userId: user.id,
        succeeded: true,
      }),
    });
  });

  it('rejects unknown users with a generic authentication error', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'unknown@example.com', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sign).not.toHaveBeenCalled();
    expect(loginAttemptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'unknown@example.com',
        succeeded: false,
        failureReason: 'INVALID_CREDENTIALS',
      }),
    });
  });

  it('rejects an incorrect password with the same generic authentication error', async () => {
    findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'dispatch@vectologistics.in',
      passwordHash: await argon2.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      deletedAt: null,
    });

    await expect(
      service.login({
        email: 'dispatch@vectologistics.in',
        password: 'incorrect-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sign).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  });

  it('sets a timed lock after the fifth failed password attempt', async () => {
    findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'dispatch@vectologistics.in',
      passwordHash: await argon2.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 4,
      lockedUntil: null,
      deletedAt: null,
    });
    userUpdate.mockResolvedValueOnce({ failedLoginAttempts: 5 });

    await expect(
      service.login({
        email: 'dispatch@vectologistics.in',
        password: 'incorrect-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-123' },
      data: { lockedUntil: expect.any(Date) },
    });
  });

  it('rejects accounts during an active lock without checking a password', async () => {
    findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'dispatch@vectologistics.in',
      passwordHash: await argon2.hash(password),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
      deletedAt: null,
    });

    await expect(
      service.login({ email: 'dispatch@vectologistics.in', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and records its replacement', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'refresh-old',
      userId: 'user-123',
      familyId: 'family-123',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-123',
        email: 'dispatch@vectologistics.in',
        role: Role.DISPATCH_MANAGER,
        displayId: 'DIS-04',
        hubName: 'Western Corridor Hub #4 (Bhiwandi)',
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const result = await service.refresh('presented-refresh-token');

    expect(refreshTokenFindUnique).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      include: { user: true },
    });
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'refresh-old',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date), familyId: 'family-123' },
    });
    expect(refreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-123',
        familyId: 'family-123',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(refreshTokenUpdate).toHaveBeenCalledWith({
      where: { id: 'refresh-old' },
      data: { replacedBy: 'refresh-new' },
    });
    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: expect.any(String),
    });
  });

  it('revokes the refresh-token family when a rotated token is reused', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'refresh-old',
      familyId: 'family-123',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'user-123',
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    });

    await expect(
      service.refresh('reused-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-123', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshTokenCreate).not.toHaveBeenCalled();
  });

  it('keeps password reset responses generic for unknown email addresses', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.requestPasswordReset('missing@example.com'),
    ).resolves.toEqual({
      success: true,
      message: 'If the email exists, a password reset link was sent.',
    });
    expect(passwordResetTokenCreate).not.toHaveBeenCalled();
  });

  it('stores only a hash for a known account password reset token', async () => {
    findUnique.mockResolvedValue({
      id: 'user-123',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });

    const result = await service.requestPasswordReset(
      ' DISPATCH@VECTOLOGISTICS.IN ',
    );

    expect(result).toEqual({
      success: true,
      message: 'If the email exists, a password reset link was sent.',
      resetToken: undefined,
    });
    expect(passwordResetTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(passwordResetTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-123',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('consumes a reset token, updates the password, and revokes active sessions', async () => {
    passwordResetTokenFindUnique.mockResolvedValue({
      id: 'reset-123',
      userId: 'user-123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    });

    await expect(
      service.resetPassword('one-time-reset-token', 'NewPassword@2026'),
    ).resolves.toEqual({
      success: true,
      message: 'Password reset successfully.',
    });

    expect(passwordResetTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'reset-123',
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    const passwordUpdate = userUpdate.mock.calls[0][0];
    expect(passwordUpdate).toMatchObject({
      where: { id: 'user-123' },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordHash: expect.any(String),
      },
    });
    await expect(
      argon2.verify(passwordUpdate.data.passwordHash, 'NewPassword@2026'),
    ).resolves.toBe(true);
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects expired password reset tokens', async () => {
    passwordResetTokenFindUnique.mockResolvedValue({
      id: 'reset-expired',
      userId: 'user-123',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    });

    await expect(
      service.resetPassword('expired-reset-token', 'NewPassword@2026'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
