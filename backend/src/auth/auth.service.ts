import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
  displayId: string;
  hubName: string | null;
};

export type LoginRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

const LOGIN_PRESETS = [
  {
    email: 'dispatch@vectologistics.in',
    role: Role.DISPATCH_MANAGER,
    label: 'Dispatch Manager',
    redirectPath: '/dispatch',
  },
  {
    email: 'driver.rajesh@vectologistics.in',
    role: Role.DRIVER,
    label: 'Driver Mobile App',
    redirectPath: '/driver',
  },
  {
    email: 'audit.lead@vectologistics.in',
    role: Role.AUDITOR,
    label: 'Internal Audit Desk',
    redirectPath: '/audit',
  },
  {
    email: 'billing.finance@vectologistics.in',
    role: Role.ACCOUNTS,
    label: 'Accounts & Billing',
    redirectPath: '/accounts',
  },
  {
    email: 'ap.payments@metro-wholesale.in',
    role: Role.CLIENT_AP,
    label: 'Client AP Portal',
    redirectPath: '/client-portal',
  },
  {
    email: 'admin@vectologistics.in',
    role: Role.ADMIN,
    label: 'Platform Administrator',
    redirectPath: '/admin',
  },
] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, metadata: LoginRequestMetadata = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt ||
      !user.passwordHash
    ) {
      await this.recordLoginAttempt({
        email,
        userId: user?.id,
        succeeded: false,
        failureReason: 'INVALID_CREDENTIALS',
        metadata,
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginAttempt({
        email,
        userId: user.id,
        succeeded: false,
        failureReason: 'ACCOUNT_LOCKED',
        metadata,
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const failedLogin = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      if (failedLogin.failedLoginAttempts >= LOGIN_FAILURE_LIMIT) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + LOGIN_LOCK_DURATION_MS),
          },
        });
      }
      await this.recordLoginAttempt({
        email,
        userId: user.id,
        succeeded: false,
        failureReason: 'INVALID_CREDENTIALS',
        metadata,
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      displayId: user.displayId,
      hubName: user.hubName,
    };

    const session = await this.createSession(payload, user.id, metadata);

    const resultUser = {
      id: payload.sub,
      name: user.name,
      initials: user.initials,
      role: user.role,
      displayId: user.displayId,
      hubName: user.hubName,
      redirectPath:
        LOGIN_PRESETS.find((preset) => preset.role === user.role)
          ?.redirectPath ?? '/dispatch',
    };

    return {
      ...session,
      user: resultUser,
    };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const now = new Date();
    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextTokenHash = this.hashToken(nextRefreshToken);
    const result = await this.prisma.$transaction(async (transaction) => {
      const storedToken = await transaction.refreshToken.findUnique({
        where: { tokenHash: this.hashToken(refreshToken) },
        include: { user: true },
      });

      if (!storedToken) {
        return null;
      }

      const familyId = storedToken.familyId ?? randomUUID();
      if (storedToken.revokedAt || storedToken.expiresAt <= now) {
        await transaction.refreshToken.updateMany({
          where: { familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      if (
        storedToken.user.status !== UserStatus.ACTIVE ||
        storedToken.user.deletedAt
      ) {
        return null;
      }

      const claimedToken = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, familyId },
      });

      if (claimedToken.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: { familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      const replacement = await transaction.refreshToken.create({
        data: {
          tokenHash: nextTokenHash,
          userId: storedToken.userId,
          familyId,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
      });
      await transaction.refreshToken.update({
        where: { id: storedToken.id },
        data: { replacedBy: replacement.id },
      });

      const payload: TokenPayload = {
        sub: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
        displayId: storedToken.user.displayId,
        hubName: storedToken.user.hubName,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        refreshToken: nextRefreshToken,
      };
    });

    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return result;
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const response = {
      success: true,
      message: 'If the email exists, a password reset link was sent.',
    };

    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) {
      return response;
    }

    const resetToken = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.passwordResetToken.create({
        data: {
          tokenHash: this.hashToken(resetToken),
          userId: user.id,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        },
      });
    });

    return {
      ...response,
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const now = new Date();
    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(resetToken) },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.usedAt ||
      storedToken.expiresAt <= now ||
      storedToken.user.status !== UserStatus.ACTIVE ||
      storedToken.user.deletedAt
    ) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const passwordHash = await argon2.hash(newPassword);
    const reset = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: storedToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: storedToken.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });

    if (!reset) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    return { success: true, message: 'Password reset successfully.' };
  }

  me(user: TokenPayload) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
      displayId: user.displayId,
      hubName: user.hubName,
    };
  }

  getPresets() {
    return LOGIN_PRESETS.map((user) => ({
      role: user.role,
      label: user.label,
      email: user.email,
      redirectPath: user.redirectPath,
    }));
  }

  private async createSession(
    payload: TokenPayload,
    userId: string,
    metadata: LoginRequestMetadata,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.create({
        data: {
          tokenHash: this.hashToken(refreshToken),
          userId,
          familyId: randomUUID(),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      await transaction.loginAttempt.create({
        data: {
          email: payload.email,
          userId,
          succeeded: true,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent?.slice(0, 512),
        },
      });
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordLoginAttempt(input: {
    email: string;
    userId?: string;
    succeeded: boolean;
    failureReason?: string;
    metadata: LoginRequestMetadata;
  }) {
    await this.prisma.loginAttempt.create({
      data: {
        email: input.email,
        userId: input.userId,
        succeeded: input.succeeded,
        failureReason: input.failureReason,
        ipAddress: input.metadata.ipAddress,
        userAgent: input.metadata.userAgent?.slice(0, 512),
      },
    });
  }
}
